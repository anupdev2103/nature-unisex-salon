"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { createBranch, updateBranch } from "@/server/actions/branches";

interface Existing { id: string; name: string; code: string; address: string | null; phone: string | null; isActive: boolean }

export function BranchForm({ existing, trigger }: { existing?: Existing; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      name: f.get("name"),
      code: f.get("code"),
      address: f.get("address") || "",
      phone: f.get("phone") || "",
      isActive: f.get("isActive") === "on",
    };
    startTransition(async () => {
      const res = existing ? await updateBranch(existing.id, payload) : await createBranch(payload);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast({ title: "Could not save", description: res.error, variant: "error" }); return; }
      toast({ title: existing ? "Branch updated" : "Branch created", variant: "success" });
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> New Branch</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? "Edit branch" : "New branch"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={existing?.name} required />{errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}</div>
          <div><Label htmlFor="code">Code (used in invoice #)</Label><Input id="code" name="code" defaultValue={existing?.code} placeholder="SNG" required />{errors.code && <p className="text-xs text-destructive">{errors.code[0]}</p>}</div>
          <div><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={existing?.address ?? ""} /></div>
          <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" defaultValue={existing?.phone ?? ""} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={existing?.isActive ?? true} /> Active</label>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
