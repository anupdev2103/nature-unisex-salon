import { Download, IndianRupee, ReceiptText, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { resolveRange, getOwnerAnalytics, type RangePreset } from "@/server/queries/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { DateRangeFilter } from "@/components/analytics/date-range-filter";
import { PrintButton } from "@/components/analytics/print-button";
import { BarList } from "@/components/analytics/bar-list";
import { formatINR } from "@/lib/money";

const EXPORTS = [
  { type: "revenue", label: "Revenue" },
  { type: "invoices", label: "Invoices" },
  { type: "memberships", label: "Memberships" },
  { type: "customers", label: "Customers" },
  { type: "staff", label: "Staff" },
] as const;

const PAY_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank Transfer" };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const preset = (sp.preset as RangePreset) || "this_month";
  const range = resolveRange(preset, sp.from, sp.to);
  const a = await getOwnerAnalytics(range);

  const g = a.revenue.growthPct;
  const GrowthIcon = g >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="space-y-6">
      {/* Header + global date filter */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics &amp; Reports</h1>
            <p className="text-sm text-muted-foreground">{range.label} · {a.revenue.invoiceCount} bills</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <PrintButton />
          </div>
        </div>
        <div className="print:hidden">
          <DateRangeFilter preset={preset} from={sp.from} to={sp.to} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatINR(a.revenue.total)}
          sub={`${g >= 0 ? "+" : ""}${g}% vs prev`}
          icon={IndianRupee}
        />
        <StatCard label="Avg Bill Value" value={formatINR(a.revenue.avgBill)} sub={`${a.revenue.invoiceCount} invoices`} icon={ReceiptText} />
        <StatCard label="Membership Sales" value={formatINR(a.membership.walletRevenue + a.membership.unlimitedRevenue)} sub={`${a.membership.salesCount} sold`} icon={TrendingUp} />
        <StatCard label="Wallet Liability" value={formatINR(a.membership.liability)} sub="outstanding balance" icon={Wallet} accent="bg-amber-100 text-amber-800" />
      </div>

      {/* Revenue analytics */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Revenue Trend</CardTitle>
            <span className={`flex items-center gap-1 text-sm font-medium ${g >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              <GrowthIcon className="h-4 w-4" /> {g >= 0 ? "+" : ""}{g}%
            </span>
          </CardHeader>
          <CardContent><RevenueChart data={a.trend} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment Mix</CardTitle></CardHeader>
          <CardContent>
            <BarList
              items={a.revenue.byPayment.map((p) => ({ label: PAY_LABEL[p.method] ?? p.method, value: p.revenue, display: formatINR(p.revenue), sub: `${p.count}` }))}
            />
            <div className="mt-4 space-y-1 border-t pt-3 text-sm">
              <Row label="Service revenue" value={formatINR(a.revenue.serviceRevenue)} />
              <Row label="Membership revenue" value={formatINR(a.membership.walletRevenue + a.membership.unlimitedRevenue)} />
              <Row label="Tax collected" value={formatINR(a.revenue.tax)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Membership analytics + LIABILITY */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Membership Analytics</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Mini label="Sales (period)" value={String(a.membership.salesCount)} />
            <Mini label="Active" value={String(a.membership.active)} />
            <Mini label="Expired" value={String(a.membership.expired)} />
            <Mini label="Wallet revenue" value={formatINR(a.membership.walletRevenue)} />
            <Mini label="Unlimited revenue" value={formatINR(a.membership.unlimitedRevenue)} />
            <Mini label="Wallet used (period)" value={formatINR(a.membership.usageValue)} />
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader><CardTitle>Membership Liability</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-amber-700">{formatINR(a.membership.liability)}</p>
            <p className="mb-3 text-xs text-muted-foreground">Outstanding wallet balance owed to customers</p>
            <BarList
              items={a.membership.liabilityByBranch.map((b) => ({ label: b.name, value: b.amount, display: formatINR(b.amount) }))}
              empty="No wallet liability"
            />
          </CardContent>
        </Card>
      </div>

      {/* Customer + Visit analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Customer Analytics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Mini label="New (period)" value={String(a.customers.newCount)} sub={`${a.customers.newGrowthPct >= 0 ? "+" : ""}${a.customers.newGrowthPct}%`} />
            <Mini label="Returning" value={String(a.customers.returning)} />
            <Mini label="Total" value={String(a.customers.total)} />
            <Mini label="Inactive 30d" value={String(a.customers.inactive30)} />
            <Mini label="Inactive 60d" value={String(a.customers.inactive60)} />
            <Mini label="Birthdays (month)" value={String(a.customers.birthdaysThisMonth)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Visit Analytics</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Mini label="Visits" value={String(a.visits.total)} />
              <Mini label="Avg / cust" value={String(a.visits.avgPerCustomer)} />
              <Mini label="Peak day" value={a.visits.peakDay} />
              <Mini label="Peak hour" value={a.visits.peakHour} />
            </div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Top Services</p>
            <BarList items={a.visits.topServices.map((s) => ({ label: s.name, value: s.revenue, display: formatINR(s.revenue), sub: `×${s.qty}` }))} />
          </CardContent>
        </Card>
      </div>

      {/* Staff + Branch analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Staff Performance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Bills</TableHead><TableHead>Memberships</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.staff.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No data.</TableCell></TableRow> :
                  a.staff.map((s) => (
                    <TableRow key={s.name}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.invoices}</TableCell><TableCell>{s.memSales}</TableCell><TableCell className="text-right font-medium">{formatINR(s.revenue)}</TableCell></TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Branch Comparison</CardTitle></CardHeader>
          <CardContent>
            <BarList items={a.branches.map((b) => ({ label: b.name, value: b.revenue, display: formatINR(b.revenue) }))} />
            <Table className="mt-3">
              <TableHeader><TableRow><TableHead>Branch</TableHead><TableHead>Bills</TableHead><TableHead>Customers</TableHead><TableHead>Memberships</TableHead></TableRow></TableHeader>
              <TableBody>
                {a.branches.map((b) => (
                  <TableRow key={b.name}><TableCell className="font-medium">{b.name}</TableCell><TableCell>{b.invoices}</TableCell><TableCell>{b.customers}</TableCell><TableCell>{b.memSales}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Reporting center — exports */}
      <Card className="print:hidden">
        <CardHeader><CardTitle>Export Reports</CardTitle></CardHeader>
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}{sub ? <span className="ml-1 text-xs font-normal text-emerald-600">{sub}</span> : null}</p>
    </div>
  );
}
