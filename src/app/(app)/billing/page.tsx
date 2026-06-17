import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveServices } from "@/server/queries/billing";
import { BillBuilder } from "@/components/billing/bill-builder";

export default async function BillingPage() {
  const user = await requireUser();
  const [services, branches, settings] = await Promise.all([
    getActiveServices(),
    prisma.branch.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.setting.findUnique({ where: { id: "global" }, select: { taxRatePctBps: true } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Bill</h1>
        <p className="text-muted-foreground">Create an invoice and take payment</p>
      </div>
      <BillBuilder
        services={services.map((s) => ({ id: s.id, name: s.name, price: s.price, category: s.category?.name ?? null }))}
        branches={branches}
        defaultBranchId={user.branchId ?? branches[0]?.id ?? ""}
        taxRateBps={settings?.taxRatePctBps ?? 0}
      />
    </div>
  );
}
