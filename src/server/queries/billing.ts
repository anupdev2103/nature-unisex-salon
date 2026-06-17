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
