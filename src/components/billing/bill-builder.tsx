"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomerSearch } from "@/components/customers/customer-search";
import { toast } from "@/components/ui/toaster";
import type { CustomerHit } from "@/server/queries/customers";
import { getCustomerMemberships } from "@/server/queries/billing";
import { validateCoupon } from "@/server/actions/coupons";
import { createInvoice } from "@/server/actions/billing";
import { computeBill } from "@/lib/billing-engine";
import { formatINR, rupeesToPaise } from "@/lib/money";

interface ServiceOpt { id: string; name: string; price: number; category: string | null }
interface Line { serviceId: string; name: string; unitPrice: number; quantity: number; lineDiscount: number; membershipBenefit: boolean }
interface Membership { id: string; membershipNumber: string; kind: "WALLET" | "UNLIMITED"; remainingValue: number; plan: { name: string; benefitLabel: string | null } }

const PAYMENTS = [
  { v: "CASH", l: "Cash" },
  { v: "UPI", l: "UPI" },
  { v: "CARD", l: "Card" },
  { v: "BANK_TRANSFER", l: "Bank Transfer" },
] as const;

export function BillBuilder({
  services,
  branches,
  defaultBranchId,
  taxRateBps,
}: {
  services: ServiceOpt[];
  branches: { id: string; name: string }[];
  defaultBranchId: string;
  taxRateBps: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [branchId, setBranchId] = useState(defaultBranchId);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [membershipId, setMembershipId] = useState<string>("");
  const [useWallet, setUseWallet] = useState(false);

  const [lines, setLines] = useState<Line[]>([]);
  const [serviceToAdd, setServiceToAdd] = useState("");

  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountReason, setBillDiscountReason] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponPaise, setCouponPaise] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]["v"]>("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  const selectedMembership = memberships.find((m) => m.id === membershipId) ?? null;

  // Load a customer's memberships when selected.
  useEffect(() => {
    if (!customer) {
      setMemberships([]);
      setMembershipId("");
      return;
    }
    getCustomerMemberships(customer.id).then((m) => setMemberships(m as Membership[]));
  }, [customer]);

  function addService() {
    const svc = services.find((s) => s.id === serviceToAdd);
    if (!svc) return;
    setLines((prev) => [
      ...prev,
      { serviceId: svc.id, name: svc.name, unitPrice: svc.price, quantity: 1, lineDiscount: 0, membershipBenefit: false },
    ]);
    setServiceToAdd("");
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const walletAvailable =
    selectedMembership?.kind === "WALLET" && useWallet ? selectedMembership.remainingValue : 0;

  // Live pricing preview (mirrors the server engine exactly).
  const priced = useMemo(
    () =>
      computeBill({
        lines: lines.map((l) => ({
          serviceId: l.serviceId,
          serviceName: l.name,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          lineDiscount: rupeesToPaise(l.lineDiscount),
          membershipBenefit: l.membershipBenefit,
        })),
        billDiscount: rupeesToPaise(billDiscount),
        couponAmount: couponPaise,
        walletAvailable,
        taxRateBps,
      }),
    [lines, billDiscount, couponPaise, walletAvailable, taxRateBps],
  );

  function checkCoupon() {
    if (!couponCode.trim()) return;
    const preCoupon = priced.subtotal - priced.benefitCovered - priced.itemDiscountTotal - priced.billDiscountTotal;
    startTransition(async () => {
      const res = await validateCoupon(couponCode, preCoupon);
      if (res.ok) {
        setCouponPaise(res.data.amount);
        setCouponMsg(`Applied ${formatINR(res.data.amount)}`);
      } else {
        setCouponPaise(0);
        setCouponMsg(res.error);
      }
    });
  }

  function submit() {
    if (!customer) return toast({ title: "Select a customer", variant: "error" });
    if (lines.length === 0) return toast({ title: "Add at least one service", variant: "error" });

    startTransition(async () => {
      const res = await createInvoice({
        branchId,
        customerId: customer.id,
        items: lines.map((l) => ({
          serviceId: l.serviceId,
          quantity: l.quantity,
          unitPrice: l.unitPrice / 100,
          lineDiscount: l.lineDiscount,
          membershipBenefit: l.membershipBenefit,
        })),
        billDiscount,
        billDiscountReason,
        couponCode: couponPaise > 0 ? couponCode : "",
        membershipId: membershipId || "",
        useWallet,
        paymentMethod,
        paymentReference,
      });
      if (!res.ok) return toast({ title: "Could not create bill", description: res.error, variant: "error" });
      toast({ title: "Invoice created", description: res.data.invoiceNumber, variant: "success" });
      router.push(`/invoices/${res.data.invoiceId}`);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: builder */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Customer & Branch</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer</Label>
                {customer ? (
                  <div className="flex items-center justify-between rounded-md border px-3 h-10">
                    <span className="text-sm font-medium">{customer.name} · {customer.phone}</span>
                    <button type="button" className="text-xs text-destructive" onClick={() => setCustomer(null)}>change</button>
                  </div>
                ) : (
                  <CustomerSearch onSelect={setCustomer} />
                )}
              </div>
            </div>

            {selectedMembership || memberships.length > 0 ? (
              <div className="rounded-md border p-3 space-y-2">
                <Label>Membership</Label>
                <Select value={membershipId} onValueChange={(v) => { setMembershipId(v); setUseWallet(false); }}>
                  <SelectTrigger><SelectValue placeholder="No membership" /></SelectTrigger>
                  <SelectContent>
                    {memberships.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.plan.name} · {m.kind === "WALLET" ? `${formatINR(m.remainingValue)} left` : m.plan.benefitLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMembership?.kind === "WALLET" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
                    Pay using wallet balance ({formatINR(selectedMembership.remainingValue)} available)
                  </label>
                )}
                {selectedMembership?.kind === "UNLIMITED" && (
                  <p className="text-xs text-muted-foreground">
                    Tick &quot;benefit&quot; on a haircut line to apply <b>{selectedMembership.plan.benefitLabel}</b>.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Services</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={serviceToAdd} onValueChange={setServiceToAdd}>
                <SelectTrigger><SelectValue placeholder="Add a service…" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {formatINR(s.price)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addService} disabled={!serviceToAdd}><Plus className="h-4 w-4" /></Button>
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">No services added yet.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-md border p-2">
                    <div className="col-span-4 text-sm font-medium">{l.name}</div>
                    <div className="col-span-2">
                      <Input type="number" min={1} value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value)) })}
                        aria-label="Quantity" />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min={0} value={l.lineDiscount}
                        onChange={(e) => updateLine(i, { lineDiscount: Math.max(0, Number(e.target.value)) })}
                        aria-label="Line discount ₹" placeholder="Disc ₹" />
                    </div>
                    <div className="col-span-2 text-right text-sm">
                      {l.membershipBenefit ? <Badge variant="success">Free</Badge> : formatINR(l.unitPrice * l.quantity)}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {selectedMembership?.kind === "UNLIMITED" && (
                        <input type="checkbox" title="Apply membership benefit" checked={l.membershipBenefit}
                          onChange={(e) => updateLine(i, { membershipBenefit: e.target.checked })} />
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right: summary */}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Discounts & Coupon</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Bill discount (₹)</Label>
              <Input type="number" min={0} value={billDiscount} onChange={(e) => setBillDiscount(Math.max(0, Number(e.target.value)))} />
            </div>
            {billDiscount > 0 && (
              <div>
                <Label>Discount reason</Label>
                <Input value={billDiscountReason} onChange={(e) => setBillDiscountReason(e.target.value)} placeholder="e.g. Festive offer" />
              </div>
            )}
            <div>
              <Label>Coupon code</Label>
              <div className="flex gap-2">
                <Input value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponPaise(0); setCouponMsg(null); }} placeholder="SAVE100" />
                <Button type="button" variant="outline" onClick={checkCoupon} disabled={pending}>Apply</Button>
              </div>
              {couponMsg && <p className={`mt-1 text-xs ${couponPaise > 0 ? "text-emerald-600" : "text-destructive"}`}>{couponMsg}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatINR(priced.subtotal)} />
            {priced.benefitCovered > 0 && <Row label="Membership benefit" value={`– ${formatINR(priced.benefitCovered)}`} />}
            {priced.itemDiscountTotal > 0 && <Row label="Item discounts" value={`– ${formatINR(priced.itemDiscountTotal)}`} />}
            {priced.billDiscountTotal > 0 && <Row label="Bill discount" value={`– ${formatINR(priced.billDiscountTotal)}`} />}
            {priced.couponTotal > 0 && <Row label="Coupon" value={`– ${formatINR(priced.couponTotal)}`} />}
            {priced.membershipApplied > 0 && <Row label="Wallet paid" value={`– ${formatINR(priced.membershipApplied)}`} />}
            {priced.taxAmount > 0 && <Row label={`Tax (${(taxRateBps / 100).toFixed(0)}%)`} value={formatINR(priced.taxAmount)} />}
            <div className="my-2 border-t" />
            <div className="flex items-center justify-between text-base font-bold">
              <span>Payable</span><span>{formatINR(priced.grandTotal)}</span>
            </div>

            <div className="pt-3">
              <Label>Payment method</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENTS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {paymentMethod !== "CASH" && (
              <div>
                <Label>Reference</Label>
                <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="UPI ref / card last4" />
              </div>
            )}

            <Button className="mt-3 w-full" size="lg" onClick={submit} disabled={pending}>
              <Receipt className="mr-2 h-4 w-4" />
              {pending ? "Saving…" : `Create Invoice · ${formatINR(priced.grandTotal)}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
