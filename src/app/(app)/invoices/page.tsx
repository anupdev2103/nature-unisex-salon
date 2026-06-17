import Link from "next/link";
import { Download, Eye, User } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getInvoices, type DatePreset } from "@/server/queries/invoices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
];

export default async function InvoiceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; preset?: string; from?: string; to?: string; page?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const preset = (sp.preset as DatePreset) || "today";
  const page = Number(sp.page) || 1;

  const data = await getInvoices({ q: sp.q, preset, from: sp.from, to: sp.to, page });

  const buildHref = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, preset, from: sp.from, to: sp.to, page, ...patch };
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== "" && !(k === "page" && v === 1)) params.set(k, String(v));
    });
    const s = params.toString();
    return `/invoices${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoice History</h1>
          <p className="text-muted-foreground">
            {data.total} invoice{data.total === 1 ? "" : "s"} · {formatINR(data.rangeRevenue)} collected
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          {/* Search */}
          <form className="flex gap-2">
            <input type="hidden" name="preset" value={preset} />
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search invoice #, mobile, name or customer ID…"
              className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button type="submit" variant="secondary">Search</Button>
            {sp.q ? (
              <Button asChild variant="ghost"><Link href={buildHref({ q: "", page: 1 })}>Clear</Link></Button>
            ) : null}
          </form>

          {/* Date preset chips + custom range */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <Link
                key={p.key}
                href={buildHref({ preset: p.key, page: 1 })}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  preset === p.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {p.label}
              </Link>
            ))}
            <form className="ml-auto flex items-center gap-2 text-sm">
              <input type="hidden" name="preset" value="custom" />
              {sp.q ? <input type="hidden" name="q" value={sp.q} /> : null}
              <input name="from" type="date" defaultValue={sp.from} className="h-9 rounded-md border border-input bg-background px-2" />
              <span className="text-muted-foreground">to</span>
              <input name="to" type="date" defaultValue={sp.to} className="h-9 rounded-md border border-input bg-background px-2" />
              <Button type="submit" size="sm" variant="outline">Apply</Button>
            </form>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No invoices for this filter.</TableCell></TableRow>
              ) : (
                data.rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(inv.createdAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{inv.customerNameSnapshot}</div>
                      <div className="text-xs text-muted-foreground">{inv.customerPhoneSnapshot}</div>
                    </TableCell>
                    <TableCell>{inv.branch.name}</TableCell>
                    <TableCell>{inv.paymentMethod}</TableCell>
                    <TableCell className="text-right font-medium">{formatINR(inv.grandTotal)}</TableCell>
                    <TableCell><Badge variant={inv.status === "PAID" ? "success" : "destructive"}>{inv.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" title="View invoice"><Link href={`/invoices/${inv.id}`}><Eye className="h-4 w-4" /></Link></Button>
                        <Button asChild size="icon" variant="ghost" title="Download / reprint PDF"><a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a></Button>
                        <Button asChild size="icon" variant="ghost" title="Open customer profile"><Link href={`/customers/${inv.customerId}`}><User className="h-4 w-4" /></Link></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {data.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {data.page} of {data.pageCount}</p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" disabled={data.page <= 1}>
              <Link href={buildHref({ page: data.page - 1 })}>Previous</Link>
            </Button>
            <Button asChild variant="outline" size="sm" disabled={data.page >= data.pageCount}>
              <Link href={buildHref({ page: data.page + 1 })}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
