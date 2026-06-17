import { prisma } from "@/lib/prisma";
import { startOfMonth } from "date-fns";

/** Consolidated figures for the reports page. */
export async function getReportSummary() {
  const monthStart = startOfMonth(new Date());

  const [byBranch, byStaff, byService, paymentMix, membershipAgg, lifetimeAgg] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["branchId"],
      where: { status: "PAID" },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["staffId"],
      where: { status: "PAID", createdAt: { gte: monthStart } },
      _sum: { grandTotal: true },
      _count: true,
      orderBy: { _sum: { grandTotal: "desc" } },
      take: 10,
    }),
    prisma.invoiceItem.groupBy({
      by: ["serviceNameSnapshot"],
      where: { invoice: { status: "PAID" } },
      _sum: { lineTotal: true, quantity: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: 10,
    }),
    prisma.invoice.groupBy({
      by: ["paymentMethod"],
      where: { status: "PAID" },
      _sum: { grandTotal: true },
      _count: true,
    }),
    prisma.customerMembership.groupBy({
      by: ["kind", "status"],
      where: { deletedAt: null },
      _count: true,
      _sum: { remainingValue: true },
    }),
    prisma.invoice.aggregate({ where: { status: "PAID" }, _sum: { grandTotal: true }, _count: true }),
  ]);

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const staff = await prisma.user.findMany({ select: { id: true, fullName: true } });
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  const sName = new Map(staff.map((s) => [s.id, s.fullName]));

  return {
    lifetimeRevenue: lifetimeAgg._sum.grandTotal ?? 0,
    lifetimeInvoices: lifetimeAgg._count,
    branchRevenue: byBranch.map((b) => ({ name: bName.get(b.branchId) ?? "—", revenue: b._sum.grandTotal ?? 0, invoices: b._count })),
    staffPerformance: byStaff.map((s) => ({ name: sName.get(s.staffId) ?? "—", revenue: s._sum.grandTotal ?? 0, invoices: s._count })),
    topServices: byService.map((s) => ({ name: s.serviceNameSnapshot, revenue: s._sum.lineTotal ?? 0, qty: s._sum.quantity ?? 0 })),
    paymentMix: paymentMix.map((p) => ({ method: p.paymentMethod, revenue: p._sum.grandTotal ?? 0, count: p._count })),
    membershipBreakdown: membershipAgg.map((m) => ({ kind: m.kind, status: m.status, count: m._count, remaining: m._sum.remainingValue ?? 0 })),
  };
}
