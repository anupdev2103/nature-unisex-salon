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
import { createStaff } from "@/server/actions/staff";

export function StaffForm({ branches }: { branches: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("STAFF");
  const [branchId, setBranchId] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      email: f.get("email"),
      fullName: f.get("fullName"),
      password: f.get("password"),
      role,
      branchId: branchId || "",
      phone: f.get("phone") || "",
    };
    startTransition(async () => {
      const res = await createStaff(payload);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast({ title: "Could not create", description: res.error, variant: "error" }); return; }
      toast({ title: "Login created", variant: "success" });
      setOpen(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Login</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create staff / admin login</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div><Label htmlFor="fullName">Full name</Label><Input id="fullName" name="fullName" required />{errors.fullName && <p className="text-xs text-destructive">{errors.fullName[0]}</p>}</div>
          <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required />{errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}</div>
          <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="text" placeholder="Min 8 characters" required />{errors.password && <p className="text-xs text-destructive">{errors.password[0]}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="STAFF">Staff</SelectItem><SelectItem value="ADMIN">Admin</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" /></div>
          <Button type="submit" className="w-full" disabled={pending}>{pending ? "Creating…" : "Create login"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
