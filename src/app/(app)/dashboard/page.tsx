import {
  IndianRupee,
  CalendarDays,
  CreditCard,
  Users,
  Ticket,
  Percent,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardMetrics, getRevenueSeries } from "@/server/queries/dashboard";
import { formatINR } from "@/lib/money";
import { StatCard } from "@/components/dashboard/stat-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaffDashboard } from "./staff-dashboard";

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    return <StaffDashboard branchId={user.branchId} />;
  }

  const [m, series] = await Promise.all([
    getDashboardMetrics(),
    getRevenueSeries(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Business overview across all branches</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Revenue" value={formatINR(m.todayRevenue)} sub={`${m.todayInvoices} invoices`} icon={IndianRupee} />
        <StatCard label="This Month" value={formatINR(m.monthRevenue)} sub={`${m.monthInvoices} invoices`} icon={CalendarDays} />
        <StatCard label="Active Memberships" value={String(m.activeMemberships)} sub={`${m.monthMembershipSales} sold this month`} icon={CreditCard} />
        <StatCard label="Customers" value={String(m.totalCustomers)} sub={`+${m.newCustomersThisMonth} this month`} icon={Users} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Branch Revenue (month)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {m.branchRevenue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revenue yet.</p>
            ) : (
              m.branchRevenue.map((b) => (
                <div key={b.branchId} className="flex items-center justify-between">
                  <span className="text-sm">{b.name}</span>
                  <span className="font-medium">{formatINR(b.revenue)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Services (month)</CardTitle>
          </CardHeader>
          <CardContent>
            {m.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ol className="space-y-2">
                {m.topServices.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between text-sm">
                    <span><span className="text-muted-foreground mr-2">{i + 1}.</span>{s.name} <span className="text-muted-foreground">×{s.qty}</span></span>
                    <span className="font-medium">{formatINR(s.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Staff (month)</CardTitle>
          </CardHeader>
          <CardContent>
            {m.topStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : (
              <ol className="space-y-2">
                {m.topStaff.map((s, i) => (
                  <li key={s.name + i} className="flex items-center justify-between text-sm">
                    <span><span className="text-muted-foreground mr-2">{i + 1}.</span>{s.name} <span className="text-muted-foreground">· {s.invoices} bills</span></span>
                    <span className="font-medium">{formatINR(s.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Coupon Usage (month)" value={formatINR(m.couponUsage.amount)} sub={`${m.couponUsage.count} redemptions`} icon={Ticket} />
        <StatCard label="Discounts Given (month)" value={formatINR(m.discountUsage.amount)} sub={`${m.discountUsage.count} discounts`} icon={Percent} />
      </div>
    </div>
  );
}
