import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, subWeeks,
  startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear,
} from "date-fns";

export type RangePreset =
  | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";

export const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today", yesterday: "Yesterday", this_week: "This Week", last_week: "Last Week",
  this_month: "This Month", last_month: "Last Month", last_3_months: "Last 3 Months",
  this_year: "This Year", custom: "Custom",
};

export interface ResolvedRange { gte: Date; lte: Date; prevGte: Date; prevLte: Date; label: string }

/** Resolve a preset (or custom from/to) to a range + the preceding period. */
export function resolveRange(preset: RangePreset, from?: string, to?: string): ResolvedRange {
  const now = new Date();
  let gte: Date, lte: Date;
  switch (preset) {
    case "today": gte = startOfDay(now); lte = endOfDay(now); break;
    case "yesterday": { const d = subDays(now, 1); gte = startOfDay(d); lte = endOfDay(d); break; }
    case "this_week": gte = startOfWeek(now, { weekStartsOn: 1 }); lte = endOfWeek(now, { weekStartsOn: 1 }); break;
    case "last_week": { const d = subWeeks(now, 1); gte = startOfWeek(d, { weekStartsOn: 1 }); lte = endOfWeek(d, { weekStartsOn: 1 }); break; }
    case "last_month": { const d = subMonths(now, 1); gte = startOfMonth(d); lte = endOfMonth(d); break; }
    case "last_3_months": gte = startOfDay(subMonths(now, 3)); lte = endOfDay(now); break;
    case "this_year": gte = startOfYear(now); lte = endOfYear(now); break;
    case "custom":
      gte = from ? startOfDay(new Date(from)) : startOfMonth(now);
      lte = to ? endOfDay(new Date(to)) : endOfDay(now);
      break;
    case "this_month":
    default: gte = startOfMonth(now); lte = endOfMonth(now); break;
  }
  const durationMs = lte.getTime() - gte.getTime();
  const prevLte = new Date(gte.getTime() - 1);
  const prevGte = new Date(gte.getTime() - durationMs - 1);
  return { gte, lte, prevGte, prevLte, label: PRESET_LABELS[preset] };
}

const growthPct = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 1000) / 10;

/**
 * One batched owner-analytics payload for the given range. Everything is
 * DB-side aggregation (no row dumps). Liability is point-in-time (not ranged).
 */
export async function getOwnerAnalytics(range: ResolvedRange) {
  const { gte, lte, prevGte, prevLte } = range;
  const now = new Date();
  const inRange = { createdAt: { gte, lte } };
  const paidRange = { status: "PAID" as const, ...inRange };

  const [
    revAgg, prevRevAgg, byPayment, serviceRevAgg,
    memByKind, activeMem, expiredMem, liabilityAgg, liabilityByBranch, walletRedeemedAgg,
    newCustomers, prevNewCustomers, visitsByCustomer, active30, active60,
    totalVisits, topServices, staffPerf, memSalesByStaff,
    branchRevenue, branchMembers, branchMemSales,
  ] = await Promise.all([
    prisma.invoice.aggregate({ where: paidRange, _sum: { grandTotal: true, taxAmount: true, couponTotal: true, membershipApplied: true }, _count: true }),
    prisma.invoice.aggregate({ where: { status: "PAID", createdAt: { gte: prevGte, lte: prevLte } }, _sum: { grandTotal: true } }),
    prisma.invoice.groupBy({ by: ["paymentMethod"], where: paidRange, _sum: { grandTotal: true }, _count: true }),
    prisma.invoiceItem.aggregate({ where: { invoice: paidRange }, _sum: { lineTotal: true } }),

    prisma.customerMembership.groupBy({ by: ["kind"], where: { deletedAt: null, ...inRange }, _count: true, _sum: { purchaseValue: true } }),
    prisma.customerMembership.count({ where: { deletedAt: null, status: "ACTIVE", expiryDate: { gte: now } } }),
    prisma.customerMembership.count({ where: { deletedAt: null, expiryDate: { lt: now } } }),
    prisma.customerMembership.aggregate({ where: { deletedAt: null, status: "ACTIVE", kind: "WALLET" }, _sum: { remainingValue: true } }),
    prisma.customerMembership.groupBy({ by: ["branchId"], where: { deletedAt: null, status: "ACTIVE", kind: "WALLET" }, _sum: { remainingValue: true } }),
    prisma.invoice.aggregate({ where: paidRange, _sum: { membershipApplied: true } }),

    prisma.customer.count({ where: { deletedAt: null, ...inRange } }),
    prisma.customer.count({ where: { deletedAt: null, createdAt: { gte: prevGte, lte: prevLte } } }),
    prisma.visit.groupBy({ by: ["customerId"], _count: true }),
    prisma.visit.groupBy({ by: ["customerId"], where: { visitedAt: { gte: subDays(now, 30) } } }),
    prisma.visit.groupBy({ by: ["customerId"], where: { visitedAt: { gte: subDays(now, 60) } } }),

    prisma.visit.count({ where: { visitedAt: { gte, lte } } }),
    prisma.invoiceItem.groupBy({ by: ["serviceNameSnapshot"], where: { invoice: paidRange }, _sum: { lineTotal: true, quantity: true }, orderBy: { _sum: { lineTotal: "desc" } }, take: 8 }),
    prisma.invoice.groupBy({ by: ["staffId"], where: paidRange, _sum: { grandTotal: true }, _count: true, orderBy: { _sum: { grandTotal: "desc" } } }),
    prisma.customerMembership.groupBy({ by: ["soldById"], where: { deletedAt: null, ...inRange }, _count: true, _sum: { purchaseValue: true } }),

    prisma.invoice.groupBy({ by: ["branchId"], where: paidRange, _sum: { grandTotal: true }, _count: true }),
    prisma.customer.groupBy({ by: ["registeredBranchId"], where: { deletedAt: null }, _count: true }),
    prisma.customerMembership.groupBy({ by: ["branchId"], where: { deletedAt: null, ...inRange }, _count: true, _sum: { purchaseValue: true } }),
  ]);

  // Peak day-of-week + hour (IST), daily revenue trend, birthdays — raw aggregates.
  const [peakDays, peakHours, trendRows, birthdayRows] = await Promise.all([
    prisma.$queryRaw<{ dow: number; n: number }[]>(Prisma.sql`
      select extract(dow from ("visitedAt" at time zone 'Asia/Kolkata'))::int as dow, count(*)::int as n
      from visits where "visitedAt" between ${gte} and ${lte} group by 1 order by 2 desc`),
    prisma.$queryRaw<{ hour: number; n: number }[]>(Prisma.sql`
      select extract(hour from ("visitedAt" at time zone 'Asia/Kolkata'))::int as hour, count(*)::int as n
      from visits where "visitedAt" between ${gte} and ${lte} group by 1 order by 2 desc limit 1`),
    prisma.$queryRaw<{ day: string; revenue: number }[]>(Prisma.sql`
      select to_char(("createdAt" at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD') as day, sum("grandTotal")::int as revenue
      from invoices where status = 'PAID' and "createdAt" between ${gte} and ${lte} group by 1 order by 1`),
    prisma.$queryRaw<{ n: number }[]>(Prisma.sql`
      select count(*)::int as n from customers
      where "deletedAt" is null and dob is not null
      and extract(month from dob) = extract(month from now())`),
  ]);

  // Resolve names
  const [branches, staff] = await Promise.all([
    prisma.branch.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, fullName: true } }),
  ]);
  const bName = new Map(branches.map((b) => [b.id, b.name]));
  const sName = new Map(staff.map((s) => [s.id, s.fullName]));

  const totalCustomers = await prisma.customer.count({ where: { deletedAt: null } });

  const totalRevenue = revAgg._sum.grandTotal ?? 0;
  const invoiceCount = revAgg._count;
  const wallet = memByKind.find((m) => m.kind === "WALLET");
  const unlimited = memByKind.find((m) => m.kind === "UNLIMITED");
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    revenue: {
      total: totalRevenue,
      invoiceCount,
      avgBill: invoiceCount ? Math.round(totalRevenue / invoiceCount) : 0,
      tax: revAgg._sum.taxAmount ?? 0,
      growthPct: growthPct(totalRevenue, prevRevAgg._sum.grandTotal ?? 0),
      serviceRevenue: serviceRevAgg._sum.lineTotal ?? 0,
      byPayment: byPayment.map((p) => ({ method: p.paymentMethod, revenue: p._sum.grandTotal ?? 0, count: p._count })),
    },
    membership: {
      salesCount: (wallet?._count ?? 0) + (unlimited?._count ?? 0),
      walletRevenue: wallet?._sum.purchaseValue ?? 0,
      unlimitedRevenue: unlimited?._sum.purchaseValue ?? 0,
      active: activeMem,
      expired: expiredMem,
      usageValue: walletRedeemedAgg._sum.membershipApplied ?? 0,
      liability: liabilityAgg._sum.remainingValue ?? 0,
      liabilityByBranch: liabilityByBranch.map((l) => ({ name: bName.get(l.branchId) ?? "—", amount: l._sum.remainingValue ?? 0 })),
    },
    customers: {
      total: totalCustomers,
      newCount: newCustomers,
      newGrowthPct: growthPct(newCustomers, prevNewCustomers),
      returning: visitsByCustomer.filter((v) => v._count > 1).length,
      inactive30: Math.max(0, totalCustomers - active30.length),
      inactive60: Math.max(0, totalCustomers - active60.length),
      birthdaysThisMonth: birthdayRows[0]?.n ?? 0,
    },
    visits: {
      total: totalVisits,
      avgPerCustomer: visitsByCustomer.length ? Math.round((totalVisits / visitsByCustomer.length) * 10) / 10 : 0,
      peakDay: peakDays[0] ? DOW[peakDays[0].dow] : "—",
      peakHour: peakHours[0] ? `${peakHours[0].hour}:00` : "—",
      topServices: topServices.map((s) => ({ name: s.serviceNameSnapshot, revenue: s._sum.lineTotal ?? 0, qty: s._sum.quantity ?? 0 })),
    },
    staff: staffPerf.map((s) => ({
      name: sName.get(s.staffId) ?? "—",
      revenue: s._sum.grandTotal ?? 0,
      invoices: s._count,
      memSales: memSalesByStaff.find((m) => m.soldById === s.staffId)?._count ?? 0,
      memRevenue: memSalesByStaff.find((m) => m.soldById === s.staffId)?._sum.purchaseValue ?? 0,
    })),
    branches: branchRevenue
      .map((b) => ({
        name: bName.get(b.branchId) ?? "—",
        revenue: b._sum.grandTotal ?? 0,
        invoices: b._count,
        customers: branchMembers.find((c) => c.registeredBranchId === b.branchId)?._count ?? 0,
        memSales: branchMemSales.find((m) => m.branchId === b.branchId)?._count ?? 0,
      }))
      .sort((a, b) => b.revenue - a.revenue),
    trend: trendRows.map((t) => ({ date: t.day, revenue: t.revenue })),
  };
}
