"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertUser } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { customerSchema } from "@/lib/validation";
import { nextCustomerCode } from "@/lib/ids";
import { writeAudit } from "@/lib/audit";

export async function createCustomer(input: unknown): Promise<ActionResult<{ id: string; customerCode: string }>> {
  try {
    const user = await assertUser();
    const p = parse(customerSchema, input);
    if (!p.success) return p.result;

    const result = await prisma.$transaction(async (tx) => {
      const dup = await tx.customer.findFirst({
        where: { phone: p.data.phone, deletedAt: null },
      });
      if (dup) throw new Error("A customer with this phone already exists");

      const code = await nextCustomerCode(tx);
      const customer = await tx.customer.create({
        data: {
          customerCode: code,
          name: p.data.name,
          phone: p.data.phone,
          gender: p.data.gender ?? null,
          dob: p.data.dob ? new Date(p.data.dob) : null,
          notes: p.data.notes || null,
          status: p.data.status,
          registeredBranchId: p.data.registeredBranchId,
        },
      });
      await writeAudit(
        { actorId: user.id, action: "customer.create", entity: "Customer", entityId: customer.id, after: { code } },
        tx,
      );
      return { id: customer.id, customerCode: code };
    });

    revalidatePath("/customers");
    return ok(result);
  } catch (e) {
    return toActionError(e);
  }
}

export async function updateCustomer(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertUser();
    const p = parse(customerSchema, input);
    if (!p.success) return p.result;

    const before = await prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new Error("Customer not found");

    if (p.data.phone !== before.phone) {
      const dup = await prisma.customer.findFirst({
        where: { phone: p.data.phone, deletedAt: null, NOT: { id } },
      });
      if (dup) throw new Error("Another customer already uses this phone");
    }

    await prisma.customer.update({
      where: { id },
      data: {
        name: p.data.name,
        phone: p.data.phone,
        gender: p.data.gender ?? null,
        dob: p.data.dob ? new Date(p.data.dob) : null,
        notes: p.data.notes || null,
        status: p.data.status,
        registeredBranchId: p.data.registeredBranchId,
      },
    });
    await writeAudit({ actorId: user.id, action: "customer.update", entity: "Customer", entityId: id, before });
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

/** Soft-delete only — customers are never hard-deleted. */
export async function archiveCustomer(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertUser();
    if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
    await prisma.customer.update({
      where: { id },
      data: { status: "INACTIVE", deletedAt: new Date() },
    });
    await writeAudit({ actorId: user.id, action: "customer.archive", entity: "Customer", entityId: id });
    revalidatePath("/customers");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}
