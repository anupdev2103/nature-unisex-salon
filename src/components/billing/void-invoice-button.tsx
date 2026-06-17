"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { voidInvoice } from "@/server/actions/billing";

export function VoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function onVoid() {
    if (!reason.trim()) return toast({ title: "Enter a reason", variant: "error" });
    startTransition(async () => {
      const res = await voidInvoice(invoiceId, reason);
      if (!res.ok) return toast({ title: "Could not void", description: res.error, variant: "error" });
      toast({ title: "Invoice voided", variant: "success" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive">Void</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Void invoice</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This reverses any wallet redemption. The invoice is kept for records.</p>
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Billed in error" />
        <Button variant="destructive" onClick={onVoid} disabled={pending}>{pending ? "Voiding…" : "Confirm void"}</Button>
      </DialogContent>
    </Dialog>
  );
}
