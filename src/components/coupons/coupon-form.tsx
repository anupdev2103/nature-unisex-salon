"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { createCoupon } from "@/server/actions/coupons";

export function CouponForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      code: f.get("code"),
      amount: f.get("amount"),
      expiryDate: f.get("expiryDate") || "",
      usageLimit: f.get("usageLimit") ? Number(f.get("usageLimit")) : undefined,
      minBillAmount: f.get("minBillAmount") || 0,
      status: "ACTIVE",
    };
    startTransition(async () => {
      const res = await createCoupon(payload);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast({ title: "Could not create", description: res.error, variant: "error" }); return; }
      toast({ title: "Coupon created", variant: "success" });
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Coupon</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New coupon</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><Label htmlFor="code">Code</Label><Input id="code" name="code" placeholder="SAVE100" required className="uppercase" />{errors.code && <p className="text-xs text-destructive">{errors.code[0]}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="amount">Amount off (₹)</Label><Input id="amount" name="amount" type="number" min={1} required />{errors.amount && <p className="text-xs text-destructive">{errors.amount[0]}</p>}</div>
            <div><Label htmlFor="minBillAmount">Min bill (₹)</Label><Input id="minBillAmount" name="minBillAmount" type="number" min={0} defaultValue={0} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="expiryDate">Expiry</Label><Input id="expiryDate" name="expiryDate" type="date" /></div>
            <div><Label htmlFor="usageLimit">Usage limit</Label><Input id="usageLimit" name="usageLimit" type="number" min={1} placeholder="∞" /></div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Create coupon"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
