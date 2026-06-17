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
import { createService, updateService } from "@/server/actions/services";
import { paiseToRupees } from "@/lib/money";

interface Category { id: string; name: string }
interface Existing { id: string; name: string; categoryId: string | null; price: number; durationMin: number; isActive: boolean }

export function ServiceForm({ categories, existing, trigger }: { categories: Category[]; existing?: Existing; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      name: f.get("name"),
      categoryId: categoryId || "",
      price: f.get("price"),
      durationMin: f.get("durationMin"),
      isActive: f.get("isActive") === "on",
    };
    startTransition(async () => {
      const res = existing ? await updateService(existing.id, payload) : await createService(payload);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast({ title: "Could not save", description: res.error, variant: "error" }); return; }
      toast({ title: existing ? "Service updated" : "Service created", variant: "success" });
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> New Service</Button>}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{existing ? "Edit service" : "New service"}</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><Label htmlFor="name">Name</Label><Input id="name" name="name" defaultValue={existing?.name} required />{errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}</div>
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Uncategorised" /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="price">Price (₹)</Label><Input id="price" name="price" type="number" min={0} step="0.01" defaultValue={existing ? paiseToRupees(existing.price) : ""} required />{errors.price && <p className="text-xs text-destructive">{errors.price[0]}</p>}</div>
            <div><Label htmlFor="durationMin">Duration (min)</Label><Input id="durationMin" name="durationMin" type="number" min={1} defaultValue={existing?.durationMin ?? 30} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={existing?.isActive ?? true} /> Active</label>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
