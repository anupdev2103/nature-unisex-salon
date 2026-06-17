import { prisma } from "@/lib/prisma";
import { startOfDay, endOfDay, addDays } from "date-fns";

/** Today's reception metrics + actionable lists, optionally scoped to a branch. */
export async function getReceptionDashboard(branchId?: string | null) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const branchFilter = branchId ? { branchId } : {};
  const custBranch = branchId ? { registeredBranchId: branchId } : {};

  const [todayAgg, todayCustomers, recent, renewals, dobRows] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: "PAID", createdAt: { gte: dayStart, lte: dayEnd }, ...branchFilter },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["customerId"],
      where: { createdAt: { gte: dayStart, lte: dayEnd }, ...branchFilter },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: dayStart, lte: dayEnd }, ...branchFilter },
      select: {
        id: true, invoiceNumber: true, customerId: true, customerNameSnapshot: true,
        grandTotal: true, paymentMethod: true, status: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.customerMembership.findMany({
      where: { status: "ACTIVE", deletedAt: null, expiryDate: { gte: now, lte: addDays(now, 14) }, ...branchFilter },
      select: {
        id: true, membershipNumber: true, expiryDate: true, kind: true, remainingValue: true,
        customer: { select: { id: true, name: true, phone: true } },
        plan: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
      take: 10,
    }),
    prisma.customer.findMany({
      where: { deletedAt: null, dob: { not: null }, ...custBranch },
      select: { id: true, name: true, phone: true, customerCode: true, dob: true },
      take: 2000,
    }),
  ]);

  // Upcoming birthdays within the next 7 days (computed in JS — month/day match).
  const today = startOfDay(now);
  const horizon = addDays(today, 7);
  const birthdays = dobRows
    .map((c) => {
      const d = c.dob!;
      let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
      return { ...c, nextBirthday: next };
    })
    .filter((c) => c.nextBirthday >= today && c.nextBirthday <= horizon)
    .sort((a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime())
    .slice(0, 10);

  return {
    todayRevenue: todayAgg._sum.grandTotal ?? 0,
    todayBills: todayAgg._count,
    todayCustomers: todayCustomers.length,
    recent,
    renewals,
    birthdays,
  };
}
