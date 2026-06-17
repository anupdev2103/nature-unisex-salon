"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { serviceSchema, serviceCategorySchema } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";
import { writeAudit } from "@/lib/audit";

export async function createService(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(serviceSchema, input);
    if (!p.success) return p.result;

    const service = await prisma.service.create({
      data: {
        name: p.data.name,
        categoryId: p.data.categoryId || null,
        price: rupeesToPaise(p.data.price),
        durationMin: p.data.durationMin,
        isActive: p.data.isActive,
      },
    });
    await writeAudit({ actorId: user.id, action: "service.create", entity: "Service", entityId: service.id, after: service });
    revalidatePath("/services");
    return ok({ id: service.id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateService(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(serviceSchema, input);
    if (!p.success) return p.result;

    const before = await prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new Error("Service not found");

    // Price changes are safe: existing invoices keep their snapshot.
    const service = await prisma.service.update({
      where: { id },
      data: {
        name: p.data.name,
        categoryId: p.data.categoryId || null,
        price: rupeesToPaise(p.data.price),
        durationMin: p.data.durationMin,
        isActive: p.data.isActive,
      },
    });
    await writeAudit({
      actorId: user.id,
      action: "service.update",
      entity: "Service",
      entityId: id,
      before: { price: before.price },
      after: { price: service.price },
    });
    revalidatePath("/services");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function setServiceActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    await prisma.service.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: user.id, action: "service.toggle", entity: "Service", entityId: id, after: { isActive } });
    revalidatePath("/services");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function createServiceCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(serviceCategorySchema, input);
    if (!p.success) return p.result;
    const cat = await prisma.serviceCategory.create({ data: p.data });
    await writeAudit({ actorId: user.id, action: "serviceCategory.create", entity: "ServiceCategory", entityId: cat.id });
    revalidatePath("/services");
    return ok({ id: cat.id });
  } catch (e) {
    return toActionError(e);
  }
}
