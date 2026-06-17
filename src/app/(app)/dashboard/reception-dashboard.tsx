import Link from "next/link";
import { IndianRupee, Users, Receipt, Cake, BellRing } from "lucide-react";
import { getReceptionDashboard } from "@/server/queries/reception";
import { StatCard } from "@/components/dashboard/stat-card";
import { StaffQuickActions } from "./staff-dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export async function ReceptionDashboard({ branchId }: { branchId: string | null }) {
  const d = await getReceptionDashboard(branchId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reception</h1>
        <p className="text-muted-foreground">Today at a glance</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Today's Revenue" value={formatINR(d.todayRevenue)} icon={IndianRupee} />
        <StatCard label="Today's Customers" value={String(d.todayCustomers)} icon={Users} />
        <StatCard label="Today's Bills" value={String(d.todayBills)} icon={Receipt} />
      </div>

      <StaffQuickActions />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent Bills</CardTitle>
            <Link href="/invoices" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.recent.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No bills yet today.</TableCell></TableRow>
                ) : d.recent.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell><Link href={`/invoices/${b.id}`} className="font-mono text-xs hover:underline">{b.invoiceNumber}</Link></TableCell>
                    <TableCell>{b.customerNameSnapshot}{b.status === "VOID" ? <Badge variant="destructive" className="ml-2">Void</Badge> : null}</TableCell>
                    <TableCell className="text-right font-medium">{formatINR(b.grandTotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Cake className="h-4 w-4 text-primary" />
            <CardTitle>Upcoming Birthdays (7 days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Mobile</TableHead><TableHead className="text-right">Birthday</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.birthdays.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No birthdays this week.</TableCell></TableRow>
                ) : d.birthdays.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Link href={`/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link></TableCell>
                    <TableCell>{c.phone}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDate(c.nextBirthday)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <BellRing className="h-4 w-4 text-primary" />
          <CardTitle>Membership Renewals (next 14 days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Plan</TableHead><TableHead>Balance</TableHead><TableHead className="text-right">Expires</TableHead></TableRow></TableHeader>
            <TableBody>
              {d.renewals.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No memberships expiring soon.</TableCell></TableRow>
              ) : d.renewals.map((m) => (
                <TableRow key={m.id}>
                  <TableCell><Link href={`/customers/${m.customer.id}`} className="font-medium hover:underline">{m.customer.name}</Link> <span className="text-xs text-muted-foreground">{m.customer.phone}</span></TableCell>
                  <TableCell>{m.plan.name}</TableCell>
                  <TableCell>{m.kind === "WALLET" ? formatINR(m.remainingValue) : "—"}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(m.expiryDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
