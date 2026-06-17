"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { writeAudit } from "@/lib/audit";

const staffSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["ADMIN", "STAFF"]),
  branchId: z.string().uuid().optional().or(z.literal("")),
  phone: z.string().trim().optional().or(z.literal("")),
});

/**
 * Create a staff/admin login. Uses the Supabase service role to create the
 * auth user; the DB trigger mirrors it into public.users, which we then
 * enrich with role + branch.
 */
export async function createStaff(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    const p = parse(staffSchema, input);
    if (!p.success) return p.result;
    const d = p.data;

    const supabase = createSupabaseAdminClient();
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
      user_metadata: { full_name: d.fullName, role: d.role },
    });
    if (error || !created.user) throw new Error(error?.message || "Failed to create login");

    // Upsert ensures the row exists even if the trigger hasn't fired yet.
    await prisma.user.upsert({
      where: { id: created.user.id },
      create: {
        id: created.user.id,
        email: d.email,
        fullName: d.fullName,
        role: d.role,
        status: "ACTIVE",
        phone: d.phone || null,
        branchId: d.branchId || null,
      },
      update: {
        fullName: d.fullName,
        role: d.role,
        phone: d.phone || null,
        branchId: d.branchId || null,
      },
    });

    await writeAudit({ actorId: admin.id, action: "staff.create", entity: "User", entityId: created.user.id, after: { email: d.email, role: d.role } });
    revalidatePath("/staff");
    return ok({ id: created.user.id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function setStaffStatus(id: string, status: "ACTIVE" | "DISABLED"): Promise<ActionResult<{ id: string }>> {
  try {
    const admin = await assertAdmin();
    if (id === admin.id) throw new Error("You cannot disable your own account");
    await prisma.user.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: admin.id, action: "staff.status", entity: "User", entityId: id, after: { status } });
    revalidatePath("/staff");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}
