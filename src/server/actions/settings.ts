"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { settingsSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "salon-assets";

export async function updateSettings(input: unknown): Promise<ActionResult<{ ok: true }>> {
  try {
    const user = await assertAdmin();
    const p = parse(settingsSchema, input);
    if (!p.success) return p.result;
    const d = p.data;

    await prisma.setting.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        salonName: d.salonName,
        gstNumber: d.gstNumber || null,
        invoicePrefix: d.invoicePrefix,
        address: d.address || null,
        whatsappNumber: d.whatsappNumber || null,
        email: d.email || null,
        taxRatePctBps: Math.round(d.taxRatePct * 100),
      },
      update: {
        salonName: d.salonName,
        gstNumber: d.gstNumber || null,
        invoicePrefix: d.invoicePrefix,
        address: d.address || null,
        whatsappNumber: d.whatsappNumber || null,
        email: d.email || null,
        taxRatePctBps: Math.round(d.taxRatePct * 100),
      },
    });
    await writeAudit({ actorId: user.id, action: "settings.update", entity: "Setting", entityId: "global" });
    revalidatePath("/settings");
    return ok({ ok: true });
  } catch (e) {
    return toActionError(e);
  }
}

/** Upload the salon logo to Supabase Storage and store its public URL. */
export async function uploadLogo(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const user = await assertAdmin();
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new Error("No file provided");
    if (file.size > 2 * 1024 * 1024) throw new Error("Logo must be under 2MB");

    const supabase = createSupabaseAdminClient();
    const ext = file.name.split(".").pop() || "png";
    const path = `branding/logo-${Date.now()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type || "image/png",
      upsert: true,
    });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    await prisma.setting.upsert({
      where: { id: "global" },
      create: { id: "global", logoUrl: data.publicUrl },
      update: { logoUrl: data.publicUrl },
    });
    await writeAudit({ actorId: user.id, action: "settings.logo", entity: "Setting", entityId: "global" });
    revalidatePath("/settings");
    return ok({ url: data.publicUrl });
  } catch (e) {
    return toActionError(e);
  }
}
