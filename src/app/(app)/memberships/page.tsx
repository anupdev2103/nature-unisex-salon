import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlanForm } from "@/components/memberships/plan-form";
import { SellMembership } from "@/components/memberships/sell-membership";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export default async function MembershipsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [plans, branches, memberships] = await Promise.all([
    prisma.membershipPlan.findMany({ where: { deletedAt: null, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.branch.findMany({ where: { deletedAt: null, isActive: true }, select: { id: true, name: true } }),
    prisma.customerMembership.findMany({
      where: { deletedAt: null },
      include: { customer: { select: { id: true, name: true, phone: true } }, plan: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Memberships</h1><p className="text-muted-foreground">{memberships.length} issued</p></div>
        <div className="flex gap-2">
          {isAdmin && <PlanForm />}
          <SellMembership
            plans={plans.map((p) => ({ id: p.id, name: p.name, kind: p.kind, price: p.price, flatPrice: p.flatPrice }))}
            branches={branches}
            defaultBranchId={user.branchId ?? undefined}
          />
        </div>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader><CardTitle>Plans</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Price</TableHead><TableHead>Value / Benefit</TableHead><TableHead>Validity</TableHead></TableRow></TableHeader>
              <TableBody>
                {plans.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.kind}</Badge></TableCell>
                    <TableCell>{formatINR((p.kind === "WALLET" ? p.price : p.flatPrice) ?? 0)}</TableCell>
                    <TableCell>{p.kind === "WALLET" ? formatINR(p.walletValue ?? 0) : p.benefitLabel}</TableCell>
                    <TableCell>{p.validityDays} days</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Issued memberships</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Plan</TableHead><TableHead>Balance / Usage</TableHead><TableHead>Status</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader>
            <TableBody>
              {memberships.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No memberships issued yet.</TableCell></TableRow>
              ) : memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.membershipNumber}</TableCell>
                  <TableCell><Link href={`/customers/${m.customer.id}`} className="font-medium hover:underline">{m.customer.name}</Link></TableCell>
                  <TableCell>{m.plan.name}</TableCell>
                  <TableCell>{m.kind === "WALLET" ? `${formatINR(m.remainingValue)} left` : `${m.usageCount} uses`}</TableCell>
                  <TableCell><Badge variant={m.status === "ACTIVE" ? "success" : "secondary"}>{m.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.expiryDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
