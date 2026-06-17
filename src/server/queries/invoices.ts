import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";

export type DatePreset = "today" | "yesterday" | "week" | "month" | "custom" | "all";

export interface InvoiceFilter {
  q?: string;
  preset?: DatePreset;
  from?: string; // ISO date (custom)
  to?: string; // ISO date (custom)
  page?: number;
  pageSize?: number;
}

/** Resolve a date preset to an inclusive [gte, lte] range, or null for "all". */
function resolveRange(f: InvoiceFilter): { gte: Date; lte: Date } | null {
  const now = new Date();
  switch (f.preset ?? "today") {
    case "all":
      return null;
    case "yesterday": {
      const d = subDays(now, 1);
      return { gte: startOfDay(d), lte: endOfDay(d) };
    }
    case "week":
      return { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) };
    case "month":
      return { gte: startOfMonth(now), lte: endOfMonth(now) };
    case "custom":
      return {
        gte: f.from ? startOfDay(new Date(f.from)) : startOfDay(subDays(now, 30)),
        lte: f.to ? endOfDay(new Date(f.to)) : endOfDay(now),
      };
    case "today":
    default:
      return { gte: startOfDay(now), lte: endOfDay(now) };
  }
}

/**
 * Paginated invoice history. Searches invoice number, snapshotted customer
 * name/phone, and the linked customer's code. Returns totals for the range.
 */
export async function getInvoices(f: InvoiceFilter) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, f.pageSize ?? 20);
  const range = resolveRange(f);
  const q = f.q?.trim();

  const where: Prisma.InvoiceWhereInput = {
    ...(range ? { createdAt: { gte: range.gte, lte: range.lte } } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q, mode: "insensitive" } },
            { customerNameSnapshot: { contains: q, mode: "insensitive" } },
            { customerPhoneSnapshot: { contains: q } },
            { customer: { customerCode: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, sumAgg] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        customerNameSnapshot: true,
        customerPhoneSnapshot: true,
        grandTotal: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        branch: { select: { name: true } },
        staff: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({ where: { ...where, status: "PAID" }, _sum: { grandTotal: true } }),
  ]);

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    rangeRevenue: sumAgg._sum.grandTotal ?? 0,
  };
}
