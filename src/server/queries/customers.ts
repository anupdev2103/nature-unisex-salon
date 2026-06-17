"use server";

import { prisma } from "@/lib/prisma";

export interface CustomerHit {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  status: string;
}

/**
 * Search customers by name, phone, customer code, or membership number.
 * Returns up to 10 active matches. Used by billing + staff dashboard.
 */
export async function searchCustomers(term: string): Promise<CustomerHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  // Membership-number lookup short-circuits to the owning customer.
  const byMembership = await prisma.customerMembership.findFirst({
    where: { membershipNumber: { equals: q, mode: "insensitive" }, deletedAt: null },
    select: { customer: { select: { id: true, customerCode: true, name: true, phone: true, status: true } } },
  });
  if (byMembership?.customer) return [byMembership.customer];

  const rows = await prisma.customer.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { customerCode: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, customerCode: true, name: true, phone: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows;
}
