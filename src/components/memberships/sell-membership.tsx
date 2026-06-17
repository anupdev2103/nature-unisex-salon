"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerSearch } from "@/components/customers/customer-search";
import { toast } from "@/components/ui/toaster";
import type { CustomerHit } from "@/server/queries/customers";
import { sellMembership } from "@/server/actions/memberships";
import { formatINR } from "@/lib/money";

interface Plan { id: string; name: string; kind: string; price: number | null; flatPrice: number | null }
interface Branch { id: string; name: string }

export function SellMembership({ plans, branches, defaultBranchId }: { plans: Plan[]; branches: Branch[]; defaultBranchId?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [planId, setPlanId] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? "");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [pending, startTransition] = useTransition();

  function onSell() {
    if (!customer) return toast({ title: "Select a customer", variant: "error" });
    if (!planId) return toast({ title: "Select a plan", variant: "error" });
    startTransition(async () => {
      const res = await sellMembership({ customerId: customer.id, planId, branchId, paymentMethod });
      if (!res.ok) return toast({ title: "Could not sell", description: res.error, variant: "error" });
      toast({ title: "Membership sold", description: res.data.membershipNumber, variant: "success" });
      setOpen(false); setCustomer(null); setPlanId(""); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><CreditCard className="mr-2 h-4 w-4" /> Sell Membership</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Sell membership</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Customer</Label>
            {customer ? (
              <div className="flex items-center justify-between rounded-md border px-3 h-10">
                <span className="text-sm font-medium">{customer.name} · {customer.phone}</span>
                <button type="button" className="text-xs text-destructive" onClick={() => setCustomer(null)}>change</button>
              </div>
            ) : <CustomerSearch onSelect={setCustomer} />}
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatINR((p.kind === "WALLET" ? p.price : p.flatPrice) ?? 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={onSell} disabled={pending}>{pending ? "Processing…" : "Sell membership"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
