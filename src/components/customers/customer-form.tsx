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
import { createCustomer, updateCustomer } from "@/server/actions/customers";

interface Branch { id: string; name: string }
interface Existing {
  id: string; name: string; phone: string; gender: string | null;
  dob: string | null; notes: string | null; status: string; registeredBranchId: string;
}

export function CustomerForm({
  branches,
  defaultBranchId,
  existing,
  trigger,
  defaultOpen,
}: {
  branches: Branch[];
  defaultBranchId?: string;
  existing?: Existing;
  trigger?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const [gender, setGender] = useState(existing?.gender ?? "");
  const [status, setStatus] = useState(existing?.status ?? "ACTIVE");
  const [branchId, setBranchId] = useState(existing?.registeredBranchId ?? defaultBranchId ?? branches[0]?.id ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name"),
      phone: form.get("phone"),
      gender: gender || undefined,
      dob: form.get("dob") || "",
      notes: form.get("notes") || "",
      registeredBranchId: branchId,
      status,
    };
    startTransition(async () => {
      const res = existing ? await updateCustomer(existing.id, payload) : await createCustomer(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast({ title: "Could not save", description: res.error, variant: "error" });
        return;
      }
      toast({ title: existing ? "Customer updated" : "Customer registered", variant: "success" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button><Plus className="mr-2 h-4 w-4" /> New Customer</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit customer" : "Register customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={existing?.name} required />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name[0]}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={existing?.phone} inputMode="numeric" required />
              {errors.phone && <p className="mt-1 text-xs text-destructive">{errors.phone[0]}</p>}
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" name="dob" type="date" defaultValue={existing?.dob ?? ""} />
            </div>
            <div>
              <Label>Registered branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                <SelectContent>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.registeredBranchId && <p className="mt-1 text-xs text-destructive">{errors.registeredBranchId[0]}</p>}
            </div>
          </div>
          {existing && (
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" defaultValue={existing?.notes ?? ""} placeholder="Allergies, preferences…" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : existing ? "Save changes" : "Register"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
