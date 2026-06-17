"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { branchSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

export async function createBranch(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(branchSchema, input);
    if (!p.success) return p.result;

    const existing = await prisma.branch.findUnique({ where: { code: p.data.code } });
    if (existing) return toActionError(new Error("Branch code already exists"));

    const branch = await prisma.branch.create({
      data: {
        name: p.data.name,
        code: p.data.code,
        address: p.data.address || null,
        phone: p.data.phone || null,
        isActive: p.data.isActive,
      },
    });
    await writeAudit({ actorId: user.id, action: "branch.create", entity: "Branch", entityId: branch.id, after: branch });
    revalidatePath("/branches");
    return ok({ id: branch.id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateBranch(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(branchSchema, input);
    if (!p.success) return p.result;

    const before = await prisma.branch.findUnique({ where: { id } });
    if (!before) throw new Error("Branch not found");

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        name: p.data.name,
        code: p.data.code,
        address: p.data.address || null,
        phone: p.data.phone || null,
        isActive: p.data.isActive,
      },
    });
    await writeAudit({ actorId: user.id, action: "branch.update", entity: "Branch", entityId: id, before, after: branch });
    revalidatePath("/branches");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function setBranchActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    await prisma.branch.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: user.id, action: "branch.toggle", entity: "Branch", entityId: id, after: { isActive } });
    revalidatePath("/branches");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}
