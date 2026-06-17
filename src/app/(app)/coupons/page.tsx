import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CouponForm } from "@/components/coupons/coupon-form";
import { CouponStatusToggle } from "@/components/coupons/coupon-status-toggle";
import { formatINR } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export default async function CouponsPage() {
  await requireAdmin();
  const coupons = await prisma.coupon.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Coupons</h1><p className="text-muted-foreground">{coupons.length} coupons</p></div>
        <CouponForm />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Amount</TableHead><TableHead>Min bill</TableHead><TableHead>Used</TableHead><TableHead>Expiry</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No coupons.</TableCell></TableRow>
              ) : coupons.map((c) => {
                const expired = c.expiryDate ? c.expiryDate < now : false;
                const effective = expired ? "EXPIRED" : c.status;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{formatINR(c.amount)}</TableCell>
                    <TableCell>{c.minBillAmount > 0 ? formatINR(c.minBillAmount) : "—"}</TableCell>
                    <TableCell>{c._count.redemptions}{c.usageLimit ? ` / ${c.usageLimit}` : ""}</TableCell>
                    <TableCell className="text-muted-foreground">{c.expiryDate ? formatDate(c.expiryDate) : "—"}</TableCell>
                    <TableCell><Badge variant={effective === "ACTIVE" ? "success" : effective === "EXPIRED" ? "warning" : "secondary"}>{effective}</Badge></TableCell>
                    <TableCell className="text-right"><CouponStatusToggle id={c.id} status={effective as "ACTIVE" | "DISABLED" | "EXPIRED"} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
