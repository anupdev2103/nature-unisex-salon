"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Minus, Trash2, Receipt, Search, X, Wallet, History,
  CalendarClock, IndianRupee, Tag, BadgePercent,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSearch } from "@/components/customers/customer-search";
import { QuickCustomerDialog } from "@/components/billing/quick-customer-dialog";
import { toast } from "@/components/ui/toaster";
import type { CustomerHit } from "@/server/queries/customers";
import { getCustomerBillingContext, type CustomerBillingContext } from "@/server/queries/billing";
import { validateCoupon } from "@/server/actions/coupons";
import { createInvoice } from "@/server/actions/billing";
import { computeBill } from "@/lib/billing-engine";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { formatDate } from "@/lib/utils";

interface ServiceOpt { id: string; name: string; price: number; category: string | null }
interface Line { serviceId: string; name: string; unitPrice: number; quantity: number; lineDiscount: number; membershipBenefit: boolean }
type Membership = CustomerBillingContext["memberships"][number];

const PAYMENTS = [
  { v: "CASH", l: "Cash" },
  { v: "UPI", l: "UPI" },
  { v: "CARD", l: "Card" },
  { v: "BANK_TRANSFER", l: "Bank" },
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
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickPrefill, setQuickPrefill] = useState("");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [stats, setStats] = useState<CustomerBillingContext["stats"] | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [membershipId, setMembershipId] = useState<string>("");
  const [useWallet, setUseWallet] = useState(false);

  const [lines, setLines] = useState<Line[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");

  const [billDiscount, setBillDiscount] = useState(0);
  const [billDiscountReason, setBillDiscountReason] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponPaise, setCouponPaise] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]["v"]>("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  const selectedMembership = memberships.find((m) => m.id === membershipId) ?? null;

  // One round-trip context load when a customer is selected.
  useEffect(() => {
    if (!customer) {
      setMemberships([]); setMembershipId(""); setStats(null); return;
    }
    let active = true;
    setCtxLoading(true);
    getCustomerBillingContext(customer.id)
      .then((ctx) => {
        if (!active) return;
        setMemberships(ctx.memberships);
        setStats(ctx.stats);
        // Auto-select the only membership if there's exactly one.
        if (ctx.memberships.length === 1) setMembershipId(ctx.memberships[0].id);
      })
      .finally(() => active && setCtxLoading(false));
    return () => { active = false; };
  }, [customer]);

  // ── service cart helpers ──────────────────────────────────────
  function addService(svc: ServiceOpt) {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.serviceId === svc.id && !l.membershipBenefit);
      if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l));
      return [...prev, { serviceId: svc.id, name: svc.name, unitPrice: svc.price, quantity: 1, lineDiscount: 0, membershipBenefit: false }];
    });
  }
  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function changeQty(i: number, delta: number) {
    setLines((prev) =>
      prev.flatMap((l, idx) => {
        if (idx !== i) return [l];
        const q = l.quantity + delta;
        return q <= 0 ? [] : [{ ...l, quantity: q }];
      }),
    );
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) => s.name.toLowerCase().includes(q) || (s.category ?? "").toLowerCase().includes(q));
  }, [services, serviceQuery]);

  const walletAvailable = selectedMembership?.kind === "WALLET" && useWallet ? selectedMembership.remainingValue : 0;

  const priced = useMemo(
    () =>
      computeBill({
        lines: lines.map((l) => ({
          serviceId: l.serviceId, serviceName: l.name, unitPrice: l.unitPrice,
          quantity: l.quantity, lineDiscount: rupeesToPaise(l.lineDiscount), membershipBenefit: l.membershipBenefit,
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
      if (res.ok) { setCouponPaise(res.data.amount); setCouponMsg(`Applied ${formatINR(res.data.amount)}`); }
      else { setCouponPaise(0); setCouponMsg(res.error); }
    });
  }

  function submit() {
    if (!customer) return toast({ title: "Select a customer first", variant: "error" });
    if (lines.length === 0) return toast({ title: "Add at least one service", variant: "error" });
    startTransition(async () => {
      const res = await createInvoice({
        branchId, customerId: customer.id,
        items: lines.map((l) => ({ serviceId: l.serviceId, quantity: l.quantity, unitPrice: l.unitPrice / 100, lineDiscount: l.lineDiscount, membershipBenefit: l.membershipBenefit })),
        billDiscount, billDiscountReason,
        couponCode: couponPaise > 0 ? couponCode : "",
        membershipId: membershipId || "", useWallet, paymentMethod, paymentReference,
      });
      if (!res.ok) return toast({ title: "Could not create bill", description: res.error, variant: "error" });
      toast({ title: "Invoice created", description: res.data.invoiceNumber, variant: "success" });
      router.push(`/invoices/${res.data.invoiceId}`);
    });
  }

  const walletBalance = memberships.find((m) => m.kind === "WALLET")?.remainingValue ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
      <QuickCustomerDialog open={quickOpen} onOpenChange={setQuickOpen} branchId={branchId} prefill={quickPrefill} onCreated={(c) => setCustomer(c)} />

      {/* ───────────── LEFT: Customer ───────────── */}
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>

            {!customer ? (
              <CustomerSearch
                onSelect={setCustomer}
                placeholder="Mobile, name or customer ID…"
                onAddNew={(term) => { setQuickPrefill(term); setQuickOpen(true); }}
              />
            ) : (
              <div className="rounded-lg border bg-accent/40 p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{customer.name}</p>
                    <p className="text-sm text-muted-foreground">{customer.phone}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{customer.customerCode}</p>
                  </div>
                  <button type="button" className="rounded p-1 text-muted-foreground hover:bg-background" onClick={() => setCustomer(null)} title="Change customer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {customer && (
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat icon={History} label="Visits" value={ctxLoading ? "…" : String(stats?.totalVisits ?? 0)} />
                <Stat icon={IndianRupee} label="Spent" value={ctxLoading ? "…" : formatINR(stats?.totalRevenue ?? 0)} />
                <Stat icon={CalendarClock} label="Last" value={ctxLoading ? "…" : stats?.lastVisit ? formatDate(stats.lastVisit) : "New"} />
              </div>

              {walletBalance != null && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                  <span className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" /> Wallet</span>
                  <span className="font-semibold">{formatINR(walletBalance)}</span>
                </div>
              )}

              {memberships.length > 0 ? (
                <div className="space-y-2">
                  <Label>Membership</Label>
                  <Select value={membershipId} onValueChange={(v) => { setMembershipId(v); setUseWallet(false); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="No membership" /></SelectTrigger>
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
                      Pay with wallet ({formatINR(selectedMembership.remainingValue)})
                    </label>
                  )}
                  {selectedMembership?.kind === "UNLIMITED" && (
                    <p className="text-xs text-muted-foreground">Mark a line “benefit” to apply <b>{selectedMembership.plan.benefitLabel}</b>.</p>
                  )}
                </div>
              ) : (
                !ctxLoading && <p className="text-xs text-muted-foreground">No active membership.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ───────────── MIDDLE: Services ───────────── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={serviceQuery} onChange={(e) => setServiceQuery(e.target.value)} placeholder="Search services…" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {serviceQuery ? `${filteredServices.length} result${filteredServices.length === 1 ? "" : "s"}` : "Tap to add"}
            </p>
            <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {filteredServices.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addService(s)}
                  className="group flex flex-col items-start rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="line-clamp-2 text-sm font-medium leading-tight">{s.name}</span>
                  <span className="mt-1 flex w-full items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatINR(s.price)}</span>
                    <Plus className="h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              ))}
              {filteredServices.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No services match.</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Cart {lines.length > 0 && <Badge variant="secondary" className="ml-1">{lines.length}</Badge>}</CardTitle>
            {lines.length > 0 && <button type="button" className="text-xs text-destructive" onClick={() => setLines([])}>Clear all</button>}
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tap services above to build the bill.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{formatINR(l.unitPrice)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, -1)}><Minus className="h-3.5 w-3.5" /></Button>
                      <span className="w-6 text-center text-sm font-medium">{l.quantity}</span>
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(i, 1)}><Plus className="h-3.5 w-3.5" /></Button>
                    </div>
                    <Input type="number" min={0} value={l.lineDiscount || ""} placeholder="Disc ₹"
                      onChange={(e) => updateLine(i, { lineDiscount: Math.max(0, Number(e.target.value)) })}
                      className="h-7 w-16 text-xs" aria-label="Line discount" />
                    <div className="w-20 text-right text-sm font-semibold">
                      {l.membershipBenefit ? <Badge variant="success">Free</Badge> : formatINR(l.unitPrice * l.quantity - rupeesToPaise(l.lineDiscount))}
                    </div>
                    {selectedMembership?.kind === "UNLIMITED" && (
                      <label className="flex items-center gap-1 text-xs" title="Apply membership benefit">
                        <input type="checkbox" checked={l.membershipBenefit} onChange={(e) => updateLine(i, { membershipBenefit: e.target.checked })} /> benefit
                      </label>
                    )}
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ───────────── RIGHT: Summary (sticky) ───────────── */}
      <div className="space-y-4 self-start lg:sticky lg:top-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="flex items-center gap-1"><BadgePercent className="h-3.5 w-3.5" /> Bill discount</Label>
                <Input type="number" min={0} value={billDiscount || ""} placeholder="₹0" onChange={(e) => setBillDiscount(Math.max(0, Number(e.target.value)))} className="h-9" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Coupon</Label>
                <div className="flex gap-1">
                  <Input value={couponCode} onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponPaise(0); setCouponMsg(null); }} placeholder="CODE" className="h-9" />
                  <Button type="button" variant="outline" size="sm" className="h-9" onClick={checkCoupon} disabled={pending}>Apply</Button>
                </div>
              </div>
            </div>
            {billDiscount > 0 && (
              <Input value={billDiscountReason} onChange={(e) => setBillDiscountReason(e.target.value)} placeholder="Discount reason" className="h-9" />
            )}
            {couponMsg && <p className={`text-xs ${couponPaise > 0 ? "text-emerald-600" : "text-destructive"}`}>{couponMsg}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm">
            <Row label="Subtotal" value={formatINR(priced.subtotal)} />
            {priced.benefitCovered > 0 && <Row label="Membership benefit" value={`– ${formatINR(priced.benefitCovered)}`} muted />}
            {priced.itemDiscountTotal > 0 && <Row label="Item discounts" value={`– ${formatINR(priced.itemDiscountTotal)}`} muted />}
            {priced.billDiscountTotal > 0 && <Row label="Bill discount" value={`– ${formatINR(priced.billDiscountTotal)}`} muted />}
            {priced.couponTotal > 0 && <Row label="Coupon" value={`– ${formatINR(priced.couponTotal)}`} muted />}
            {priced.membershipApplied > 0 && <Row label="Wallet paid" value={`– ${formatINR(priced.membershipApplied)}`} muted />}
            {priced.taxAmount > 0 && <Row label={`Tax (${(taxRateBps / 100).toFixed(0)}%)`} value={formatINR(priced.taxAmount)} />}
            <div className="my-1 border-t" />
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Payable</span><span>{formatINR(priced.grandTotal)}</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 pt-2">
              {PAYMENTS.map((p) => (
                <button
                  key={p.v} type="button" onClick={() => setPaymentMethod(p.v)}
                  className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${paymentMethod === p.v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {p.l}
                </button>
              ))}
            </div>
            {paymentMethod !== "CASH" && (
              <Input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="UPI ref / card last4" className="h-9" />
            )}

            <Button className="mt-1 w-full" size="lg" onClick={submit} disabled={pending}>
              <Receipt className="mr-2 h-4 w-4" />
              {pending ? "Saving…" : `Charge ${formatINR(priced.grandTotal)}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof History; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" />
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={muted ? "text-muted-foreground" : ""}>{value}</span>
    </div>
  );
}
