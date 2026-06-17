"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { createMembershipPlan } from "@/server/actions/memberships";

export function PlanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"WALLET" | "UNLIMITED">("WALLET");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      name: f.get("name"),
      kind,
      validityDays: f.get("validityDays"),
      price: f.get("price") || undefined,
      walletValue: f.get("walletValue") || undefined,
      flatPrice: f.get("flatPrice") || undefined,
      benefitLabel: f.get("benefitLabel") || "",
      isActive: true,
    };
    startTransition(async () => {
      const res = await createMembershipPlan(payload);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast({ title: "Could not create", description: res.error, variant: "error" }); return; }
      toast({ title: "Plan created", variant: "success" });
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" /> New Plan</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New membership plan</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required />{errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}</div>
          <div>
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "WALLET" | "UNLIMITED")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WALLET">Wallet (pay X, get Y value)</SelectItem>
                <SelectItem value="UNLIMITED">Unlimited benefit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {kind === "WALLET" ? (
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="price">Price (₹)</Label><Input id="price" name="price" type="number" min={1} required />{errors.price && <p className="text-xs text-destructive">{errors.price[0]}</p>}</div>
              <div><Label htmlFor="walletValue">Wallet value (₹)</Label><Input id="walletValue" name="walletValue" type="number" min={1} required />{errors.walletValue && <p className="text-xs text-destructive">{errors.walletValue[0]}</p>}</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="flatPrice">Price (₹)</Label><Input id="flatPrice" name="flatPrice" type="number" min={1} required />{errors.flatPrice && <p className="text-xs text-destructive">{errors.flatPrice[0]}</p>}</div>
              <div><Label htmlFor="benefitLabel">Benefit</Label><Input id="benefitLabel" name="benefitLabel" placeholder="Unlimited Haircut" required />{errors.benefitLabel && <p className="text-xs text-destructive">{errors.benefitLabel[0]}</p>}</div>
            </div>
          )}
          <div><Label htmlFor="validityDays">Validity (days)</Label><Input id="validityDays" name="validityDays" type="number" min={1} defaultValue={365} required />{errors.validityDays && <p className="text-xs text-destructive">{errors.validityDays[0]}</p>}</div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Create plan"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
