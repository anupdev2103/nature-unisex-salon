import { prisma } from "@/lib/prisma";
import { paiseToRupees } from "@/lib/money";

export type ExportType = "customers" | "invoices" | "memberships" | "revenue" | "staff";

export interface ExportTable {
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}

const R = (paise: number) => paiseToRupees(paise);
const D = (d: Date) => d.toISOString().slice(0, 10);

/** Build a tabular dataset for the given export type. */
export async function buildExport(type: ExportType): Promise<ExportTable> {
  switch (type) {
    case "customers": {
      const rows = await prisma.customer.findMany({
        where: { deletedAt: null },
        include: { registeredBranch: { select: { name: true } }, _count: { select: { invoices: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        filename: "customers",
        columns: ["Code", "Name", "Phone", "Gender", "Branch", "Status", "Invoices", "Joined"],
        rows: rows.map((c) => [c.customerCode, c.name, c.phone, c.gender ?? "", c.registeredBranch.name, c.status, c._count.invoices, D(c.createdAt)]),
      };
    }
    case "invoices": {
      const rows = await prisma.invoice.findMany({
        include: { branch: { select: { name: true } }, staff: { select: { fullName: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        filename: "invoices",
        columns: ["Invoice", "Date", "Branch", "Customer", "Phone", "Staff", "Subtotal", "Discount", "Coupon", "Wallet", "Tax", "Total", "Payment", "Status"],
        rows: rows.map((i) => [
          i.invoiceNumber, D(i.createdAt), i.branch.name, i.customerNameSnapshot, i.customerPhoneSnapshot, i.staff.fullName,
          R(i.subtotal), R(i.itemDiscountTotal + i.billDiscountTotal), R(i.couponTotal), R(i.membershipApplied), R(i.taxAmount), R(i.grandTotal), i.paymentMethod, i.status,
        ]),
      };
    }
    case "memberships": {
      const rows = await prisma.customerMembership.findMany({
        include: { customer: { select: { name: true, phone: true } }, plan: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });
      return {
        filename: "memberships",
        columns: ["Number", "Customer", "Phone", "Plan", "Type", "Purchase", "Bonus", "Remaining", "Usage", "Status", "Start", "Expiry"],
        rows: rows.map((m) => [
          m.membershipNumber, m.customer.name, m.customer.phone, m.plan.name, m.kind,
          R(m.purchaseValue), R(m.bonusValue), R(m.remainingValue), m.usageCount, m.status, D(m.startDate), D(m.expiryDate),
        ]),
      };
    }
    case "revenue": {
      const rows = await prisma.invoice.groupBy({
        by: ["branchId"],
        where: { status: "PAID" },
        _sum: { grandTotal: true, taxAmount: true, couponTotal: true, membershipApplied: true },
        _count: true,
      });
      const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
      const name = new Map(branches.map((b) => [b.id, b.name]));
      return {
        filename: "revenue-by-branch",
        columns: ["Branch", "Invoices", "Revenue", "Tax", "Coupons", "Wallet redeemed"],
        rows: rows.map((r) => [name.get(r.branchId) ?? "—", r._count, R(r._sum.grandTotal ?? 0), R(r._sum.taxAmount ?? 0), R(r._sum.couponTotal ?? 0), R(r._sum.membershipApplied ?? 0)]),
      };
    }
    case "staff": {
      const grouped = await prisma.invoice.groupBy({
        by: ["staffId"],
        where: { status: "PAID" },
        _sum: { grandTotal: true },
        _count: true,
      });
      const staff = await prisma.user.findMany({ select: { id: true, fullName: true, email: true, role: true } });
      const map = new Map(staff.map((s) => [s.id, s]));
      return {
        filename: "staff-performance",
        columns: ["Name", "Email", "Role", "Invoices", "Revenue"],
        rows: grouped.map((g) => {
          const s = map.get(g.staffId);
          return [s?.fullName ?? "—", s?.email ?? "", s?.role ?? "", g._count, R(g._sum.grandTotal ?? 0)];
        }),
      };
    }
  }
}
