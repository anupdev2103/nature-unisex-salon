"use server";

import { prisma } from "@/lib/prisma";

/** Active services for the bill builder (id, name, price in paise, category). */
export async function getActiveServices() {
  return prisma.service.findMany({
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      price: true,
      category: { select: { name: true } },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
}

/** A customer's usable memberships (active, not expired), for billing. */
export async function getCustomerMemberships(customerId: string) {
  const now = new Date();
  return prisma.customerMembership.findMany({
    where: {
      customerId,
      deletedAt: null,
      status: "ACTIVE",
      expiryDate: { gte: now },
    },
    select: {
      id: true,
      membershipNumber: true,
      kind: true,
      remainingValue: true,
      plan: { select: { name: true, benefitLabel: true } },
      expiryDate: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface CustomerBillingContext {
  memberships: Awaited<ReturnType<typeof getCustomerMemberships>>;
  stats: { totalVisits: number; lastVisit: string | null; totalRevenue: number };
}

/**
 * Single round-trip context the billing left panel needs when a customer is
 * picked: usable memberships + visit/revenue stats. Replaces several separate
 * client fetches so the panel fills in one request.
 */
export async function getCustomerBillingContext(customerId: string): Promise<CustomerBillingContext> {
  const now = new Date();
  const [memberships, totalVisits, lastVisit, revenueAgg] = await Promise.all([
    prisma.customerMembership.findMany({
      where: { customerId, deletedAt: null, status: "ACTIVE", expiryDate: { gte: now } },
      select: {
        id: true, membershipNumber: true, kind: true, remainingValue: true,
        plan: { select: { name: true, benefitLabel: true } }, expiryDate: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.visit.count({ where: { customerId } }),
    prisma.visit.findFirst({ where: { customerId }, orderBy: { visitedAt: "desc" }, select: { visitedAt: true } }),
    prisma.invoice.aggregate({ where: { customerId, status: "PAID" }, _sum: { grandTotal: true } }),
  ]);
  return {
    memberships,
    stats: {
      totalVisits,
      lastVisit: lastVisit?.visitedAt.toISOString() ?? null,
      totalRevenue: revenueAgg._sum.grandTotal ?? 0,
    },
  };
}
