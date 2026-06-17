"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { quickCreateCustomer } from "@/server/actions/customers";
import type { CustomerHit } from "@/server/queries/customers";

/**
 * Quick "Add New Customer" form that lives INSIDE Billing. Requires only Name +
 * Mobile. On save the customer is created (or, if the mobile already exists,
 * that customer is loaded) and handed back via onCreated for auto-selection —
 * the receptionist never leaves the Billing screen.
 */
export function QuickCustomerDialog({
  open,
  onOpenChange,
  branchId,
  prefill,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  /** Raw search term: digits prefill phone, anything else prefills name. */
  prefill?: string;
  onCreated: (c: CustomerHit) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [gender, setGender] = useState("");
  const [name, setName] = useState("");
  const [phoneVal, setPhoneVal] = useState("");
  const [pending, startTransition] = useTransition();

  // Seed the fields from the search term each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const t = (prefill ?? "").trim();
    const isPhone = /^[0-9]+$/.test(t);
    setPhoneVal(isPhone ? t : "");
    setName(isPhone ? "" : t);
    setGender("");
    setErrors({});
  }, [open, prefill]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      name: f.get("name"),
      phone: f.get("phone"),
      gender: gender || undefined,
      dob: f.get("dob") || "",
      notes: f.get("notes") || "",
      registeredBranchId: branchId,
    };
    startTransition(async () => {
      const res = await quickCreateCustomer(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast({ title: "Could not add customer", description: res.error, variant: "error" });
        return;
      }
      if (res.data.existed) {
        toast({ title: "Customer already exists", description: "Loaded the existing record.", variant: "default" });
      } else {
        toast({ title: "Customer added", description: res.data.customer.customerCode, variant: "success" });
      }
      onCreated(res.data.customer);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="qc-name">Name *</Label>
              <Input id="qc-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name[0]}</p>}
            </div>
            <div>
              <Label htmlFor="qc-phone">Mobile *</Label>
              <Input id="qc-phone" name="phone" value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} inputMode="numeric" required />
              {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone[0]}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="qc-dob">Birthday</Label>
              <Input id="qc-dob" name="dob" type="date" />
            </div>
          </div>
          <div>
            <Label htmlFor="qc-notes">Notes</Label>
            <Input id="qc-notes" name="notes" placeholder="Allergies, preferences…" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save & continue billing"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
