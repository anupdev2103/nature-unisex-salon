import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth } from "date-fns";

/**
 * Aggregated dashboard metrics. All amounts paise. Only PAID invoices count
 * toward revenue. Scoped to a branch when branchId is provided.
 */
export async function getDashboardMetrics(branchId?: string) {
  const now = new Date();
  const dayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const branchFilter = branchId ? { branchId } : {};

  const [
    todayAgg,
    monthAgg,
    branchRevenue,
    activeMemberships,
    monthMembershipSales,
    customerCount,
    newCustomersThisMonth,
    topServices,
    topStaff,
    couponAgg,
    discountAgg,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      _count: true,
      where: { status: "PAID", createdAt: { gte: dayStart }, ...branchFilter },
    }),
    prisma.invoice.aggregate({
      _sum: { grandTotal: true },
      _count: true,
      where: { status: "PAID", createdAt: { gte: monthStart }, ...branchFilter },
    }),
    prisma.invoice.groupBy({
      by: ["branchId"],
      _sum: { grandTotal: true },
      where: { status: "PAID", createdAt: { gte: monthStart } },
    }),
    prisma.customerMembership.count({
      where: { status: "ACTIVE", deletedAt: null, expiryDate: { gte: now }, ...branchFilter },
    }),
    prisma.customerMembership.count({
      where: { createdAt: { gte: monthStart }, deletedAt: null, ...branchFilter },
    }),
    prisma.customer.count({ where: { deletedAt: null, ...(branchId ? { registeredBranchId: branchId } : {}) } }),
    prisma.customer.count({
      where: { deletedAt: null, createdAt: { gte: monthStart }, ...(branchId ? { registeredBranchId: branchId } : {}) },
    }),
    prisma.invoiceItem.groupBy({
      by: ["serviceNameSnapshot"],
      _sum: { lineTotal: true, quantity: true },
      where: { invoice: { status: "PAID", createdAt: { gte: monthStart }, ...branchFilter } },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 5,
    }),
    prisma.invoice.groupBy({
      by: ["staffId"],
      _sum: { grandTotal: true },
      _count: true,
      where: { status: "PAID", createdAt: { gte: monthStart }, ...branchFilter },
      orderBy: { _sum: { grandTotal: "desc" } },
      take: 5,
    }),
    prisma.couponRedemption.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { invoice: { status: "PAID", createdAt: { gte: monthStart }, ...branchFilter } },
    }),
    prisma.invoiceDiscount.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { invoice: { status: "PAID", createdAt: { gte: monthStart }, ...branchFilter } },
    }),
  ]);

  // Resolve names for branches + staff in the grouped results.
  const [branches, staff] = await Promise.all([
    prisma.branch.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { id: { in: topStaff.map((s) => s.staffId) } },
      select: { id: true, fullName: true },
    }),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const staffName = new Map(staff.map((s) => [s.id, s.fullName]));

  return {
    todayRevenue: todayAgg._sum.grandTotal ?? 0,
    todayInvoices: todayAgg._count,
    monthRevenue: monthAgg._sum.grandTotal ?? 0,
    monthInvoices: monthAgg._count,
    branchRevenue: branchRevenue.map((b) => ({
      branchId: b.branchId,
      name: branchName.get(b.branchId) ?? "—",
      revenue: b._sum.grandTotal ?? 0,
    })),
    activeMemberships,
    monthMembershipSales,
    totalCustomers: customerCount,
    newCustomersThisMonth,
    topServices: topServices.map((s) => ({
      name: s.serviceNameSnapshot,
      revenue: s._sum.lineTotal ?? 0,
      qty: s._sum.quantity ?? 0,
    })),
    topStaff: topStaff.map((s) => ({
      name: staffName.get(s.staffId) ?? "—",
      revenue: s._sum.grandTotal ?? 0,
      invoices: s._count,
    })),
    couponUsage: { count: couponAgg._count, amount: couponAgg._sum.amount ?? 0 },
    discountUsage: { count: discountAgg._count, amount: discountAgg._sum.amount ?? 0 },
  };
}

/**
 * Daily revenue series for the last N days. Aggregated DB-side (one grouped
 * row per day instead of every invoice), then zero-filled for empty days.
 */
export async function getRevenueSeries(days = 30, branchId?: string) {
  const since = startOfDay(new Date());
  since.setDate(since.getDate() - (days - 1));

  const rows = branchId
    ? await prisma.$queryRaw<{ day: string; revenue: number }[]>(Prisma.sql`
        select to_char(("createdAt" at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as day, sum("grandTotal")::int as revenue
        from invoices where status = 'PAID' and "createdAt" >= ${since} and "branchId" = ${branchId}::uuid
        group by 1`)
    : await prisma.$queryRaw<{ day: string; revenue: number }[]>(Prisma.sql`
        select to_char(("createdAt" at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as day, sum("grandTotal")::int as revenue
        from invoices where status = 'PAID' and "createdAt" >= ${since}
        group by 1`);

  const byDay = new Map(rows.map((r) => [r.day, r.revenue]));
  const out: { date: string; revenue: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, revenue: byDay.get(key) ?? 0 });
  }
  return out;
}
