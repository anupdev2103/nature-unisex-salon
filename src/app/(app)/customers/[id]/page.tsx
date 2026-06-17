import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerForm } from "@/components/customers/customer-form";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
    include: {
      registeredBranch: { select: { name: true } },
      invoices: {
        where: { status: "PAID" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, invoiceNumber: true, grandTotal: true, createdAt: true, paymentMethod: true },
      },
      memberships: {
        orderBy: { createdAt: "desc" },
        include: { plan: { select: { name: true } } },
      },
      visits: { orderBy: { visitedAt: "desc" }, take: 20 },
    },
  });
  if (!customer) notFound();

  const branches = await prisma.branch.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const lifetime = customer.invoices.reduce((s, i) => s + i.grandTotal, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-muted-foreground">{customer.customerCode} · {customer.phone}</p>
        </div>
        <CustomerForm
          branches={branches}
          trigger={<Button variant="outline">Edit</Button>}
          existing={{
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            gender: customer.gender,
            dob: customer.dob ? customer.dob.toISOString().slice(0, 10) : null,
            notes: customer.notes,
            status: customer.status,
            registeredBranchId: customer.registeredBranchId,
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Lifetime spend</p><p className="mt-1 text-2xl font-bold">{formatINR(lifetime)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total visits</p><p className="mt-1 text-2xl font-bold">{customer.visits.length}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Branch</p><p className="mt-1 text-lg font-semibold">{customer.registeredBranch.name}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Memberships</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Plan</TableHead><TableHead>Type</TableHead><TableHead>Balance / Usage</TableHead><TableHead>Status</TableHead><TableHead>Expiry</TableHead></TableRow></TableHeader>
            <TableBody>
              {customer.memberships.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No memberships.</TableCell></TableRow>
              ) : customer.memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">{m.membershipNumber}</TableCell>
                  <TableCell>{m.plan.name}</TableCell>
                  <TableCell><Badge variant="outline">{m.kind}</Badge></TableCell>
                  <TableCell>{m.kind === "WALLET" ? `${formatINR(m.remainingValue)} left` : `${m.usageCount} uses`}</TableCell>
                  <TableCell><Badge variant={m.status === "ACTIVE" ? "success" : "secondary"}>{m.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(m.expiryDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoice history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Payment</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {customer.invoices.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No invoices yet.</TableCell></TableRow>
              ) : customer.invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell><Link href={`/invoices/${inv.id}`} className="font-mono text-xs hover:underline">{inv.invoiceNumber}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(inv.createdAt)}</TableCell>
                  <TableCell>{inv.paymentMethod}</TableCell>
                  <TableCell className="text-right font-medium">{formatINR(inv.grandTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
