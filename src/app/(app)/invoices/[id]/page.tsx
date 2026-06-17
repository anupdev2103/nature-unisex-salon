import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";
import { VoidInvoiceButton } from "@/components/billing/void-invoice-button";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: true,
      branch: { select: { name: true } },
      staff: { select: { fullName: true } },
      customer: { select: { id: true } },
      payments: true,
    },
  });
  if (!invoice) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" asChild><Link href="/billing"><ArrowLeft className="mr-2 h-4 w-4" /> New bill</Link></Button>
        <div className="flex gap-2">
          {user.role === "ADMIN" && invoice.status === "PAID" && <VoidInvoiceButton invoiceId={invoice.id} />}
          <Button asChild>
            <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" /> PDF
            </a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle className="text-xl">{invoice.invoiceNumber}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(invoice.createdAt)}</p>
          </div>
          <Badge variant={invoice.status === "PAID" ? "success" : "destructive"}>{invoice.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{invoice.customerNameSnapshot}</p>
              <p className="text-muted-foreground">{invoice.customerPhoneSnapshot}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Branch / Staff</p>
              <p className="font-medium">{invoice.branch.name}</p>
              <p className="text-muted-foreground">{invoice.staff.fullName}</p>
            </div>
          </div>

          <Table>
            <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>
              {invoice.items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell>{it.serviceNameSnapshot}</TableCell>
                  <TableCell>{it.quantity}</TableCell>
                  <TableCell>{formatINR(it.unitPriceSnapshot)}</TableCell>
                  <TableCell className="text-right">{it.membershipBenefit ? <Badge variant="success">Membership</Badge> : formatINR(it.lineTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={formatINR(invoice.subtotal)} />
            {invoice.itemDiscountTotal > 0 && <Row label="Item discount" value={`- ${formatINR(invoice.itemDiscountTotal)}`} />}
            {invoice.billDiscountTotal > 0 && <Row label="Bill discount" value={`- ${formatINR(invoice.billDiscountTotal)}`} />}
            {invoice.couponTotal > 0 && <Row label="Coupon" value={`- ${formatINR(invoice.couponTotal)}`} />}
            {invoice.membershipApplied > 0 && <Row label="Wallet paid" value={`- ${formatINR(invoice.membershipApplied)}`} />}
            {invoice.taxAmount > 0 && <Row label={`GST (${(invoice.taxRatePctBps / 100).toFixed(0)}%)`} value={formatINR(invoice.taxAmount)} />}
            <div className="my-1 border-t" />
            <div className="flex justify-between text-base font-bold"><span>Total</span><span>{formatINR(invoice.grandTotal)}</span></div>
            <Row label="Paid via" value={invoice.paymentMethod} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
