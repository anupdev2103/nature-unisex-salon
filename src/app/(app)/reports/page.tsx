import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getReportSummary } from "@/server/queries/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/money";

const EXPORTS = [
  { type: "invoices", label: "Invoices" },
  { type: "customers", label: "Customers" },
  { type: "memberships", label: "Memberships" },
  { type: "revenue", label: "Revenue" },
  { type: "staff", label: "Staff" },
] as const;

export default async function ReportsPage() {
  await requireAdmin();
  const r = await getReportSummary();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">Reports</h1><p className="text-muted-foreground">Lifetime revenue {formatINR(r.lifetimeRevenue)} · {r.lifetimeInvoices} invoices</p></div>
      </div>

      <Card>
        <CardHeader><CardTitle>Exports</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {EXPORTS.map((e) => (
            <div key={e.type} className="flex items-center gap-1 rounded-md border p-1">
              <span className="px-2 text-sm font-medium">{e.label}</span>
              <Button asChild size="sm" variant="ghost"><a href={`/api/export/${e.type}?format=csv`}><Download className="mr-1 h-3 w-3" /> CSV</a></Button>
              <Button asChild size="sm" variant="ghost"><a href={`/api/export/${e.type}?format=xlsx`}><Download className="mr-1 h-3 w-3" /> Excel</a></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by branch</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>Invoices</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{r.branchRevenue.map((b) => <TableRow key={b.name}><TableCell>{b.name}</TableCell><TableCell>{b.invoices}</TableCell><TableCell className="text-right font-medium">{formatINR(b.revenue)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment mix</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Method</TableHead><TableHead>Count</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{r.paymentMix.map((p) => <TableRow key={p.method}><TableCell>{p.method}</TableCell><TableCell>{p.count}</TableCell><TableCell className="text-right font-medium">{formatINR(p.revenue)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Staff performance (month)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Invoices</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{r.staffPerformance.map((s) => <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.invoices}</TableCell><TableCell className="text-right font-medium">{formatINR(s.revenue)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top services</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>{r.topServices.map((s) => <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.qty}</TableCell><TableCell className="text-right font-medium">{formatINR(s.revenue)}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Membership breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>Count</TableHead><TableHead className="text-right">Wallet remaining</TableHead></TableRow></TableHeader>
            <TableBody>{r.membershipBreakdown.map((m, i) => <TableRow key={i}><TableCell><Badge variant="outline">{m.kind}</Badge></TableCell><TableCell>{m.status}</TableCell><TableCell>{m.count}</TableCell><TableCell className="text-right">{m.kind === "WALLET" ? formatINR(m.remaining) : "—"}</TableCell></TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
