"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";
import { updateSettings, uploadLogo } from "@/server/actions/settings";

interface Settings {
  salonName: string; gstNumber: string | null; invoicePrefix: string;
  address: string | null; whatsappNumber: string | null; email: string | null;
  taxRatePctBps: number; logoUrl: string | null;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const f = new FormData(e.currentTarget);
    const payload = {
      salonName: f.get("salonName"),
      gstNumber: f.get("gstNumber") || "",
      invoicePrefix: f.get("invoicePrefix"),
      address: f.get("address") || "",
      whatsappNumber: f.get("whatsappNumber") || "",
      email: f.get("email") || "",
      taxRatePct: f.get("taxRatePct") || 0,
    };
    startTransition(async () => {
      const res = await updateSettings(payload);
      if (!res.ok) { setErrors(res.fieldErrors ?? {}); toast({ title: "Could not save", description: res.error, variant: "error" }); return; }
      toast({ title: "Settings saved", variant: "success" });
      router.refresh();
    });
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("logo", file);
    startTransition(async () => {
      const res = await uploadLogo(fd);
      if (!res.ok) return toast({ title: "Upload failed", description: res.error, variant: "error" });
      setLogoUrl(res.data.url);
      toast({ title: "Logo updated", variant: "success" });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Business details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div><Label htmlFor="salonName">Salon name</Label><Input id="salonName" name="salonName" defaultValue={settings.salonName} required />{errors.salonName && <p className="text-xs text-destructive">{errors.salonName[0]}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="gstNumber">GST number</Label><Input id="gstNumber" name="gstNumber" defaultValue={settings.gstNumber ?? ""} /></div>
              <div><Label htmlFor="invoicePrefix">Invoice prefix</Label><Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="whatsappNumber">WhatsApp / Phone</Label><Input id="whatsappNumber" name="whatsappNumber" defaultValue={settings.whatsappNumber ?? ""} /></div>
              <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} /></div>
            </div>
            <div><Label htmlFor="address">Address</Label><Input id="address" name="address" defaultValue={settings.address ?? ""} /></div>
            <div className="w-40"><Label htmlFor="taxRatePct">GST rate (%)</Label><Input id="taxRatePct" name="taxRatePct" type="number" min={0} max={100} step="0.1" defaultValue={settings.taxRatePctBps / 100} /></div>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {logoUrl ? (
            <Image src={logoUrl} alt="Salon logo" width={160} height={160} className="rounded-lg border object-contain" />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">No logo</div>
          )}
          <Input type="file" accept="image/*" onChange={onLogo} disabled={pending} />
          <p className="text-xs text-muted-foreground">PNG/JPG up to 2MB. Appears on invoices &amp; login.</p>
        </CardContent>
      </Card>
    </div>
  );
}
