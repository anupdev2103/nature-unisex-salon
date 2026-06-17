import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await prisma.setting.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-muted-foreground">Salon profile, invoicing &amp; branding</p></div>
      <SettingsForm settings={settings} />
    </div>
  );
}
