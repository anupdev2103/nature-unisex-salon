"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertUser } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { customerSchema, quickCustomerSchema } from "@/lib/validation";
import { nextCustomerCode } from "@/lib/ids";
import { writeAudit } from "@/lib/audit";
import type { CustomerHit } from "@/server/queries/customers";

const HIT_SELECT = {
  id: true,
  customerCode: true,
  name: true,
  phone: true,
  status: true,
} as const;

/**
 * Inline quick-add used by the Billing screen. Mobile numbers are NOT unique
 * (family members share numbers), so this always creates a new customer and
 * returns it for immediate auto-selection — the receptionist never leaves
 * Billing. The `existed` flag is retained (always false) for caller compat.
 */
export async function quickCreateCustomer(
  input: unknown,
): Promise<ActionResult<{ existed: boolean; customer: CustomerHit }>> {
  try {
    const user = await assertUser();
    const p = parse(quickCustomerSchema, input);
    if (!p.success) return p.result;

    const result = await prisma.$transaction(async (tx) => {
      const code = await nextCustomerCode(tx);
      const customer = await tx.customer.create({
        data: {
          customerCode: code,
          name: p.data.name,
          phone: p.data.phone,
          gender: p.data.gender ?? null,
          dob: p.data.dob ? new Date(p.data.dob) : null,
          notes: p.data.notes || null,
          status: "ACTIVE",
          registeredBranchId: p.data.registeredBranchId,
        },
        select: HIT_SELECT,
      });
      await writeAudit(
        { actorId: user.id, action: "customer.quickCreate", entity: "Customer", entityId: customer.id, after: { code } },
        tx,
      );
      return { existed: false, customer };
    });

    revalidatePath("/customers");
    return ok(result);
  } catch (e) {
    return toActionError(e);
  }
}

export async function createCustomer(input: unknown): Promise<ActionResult<{ id: string; customerCode: string }>> {
  try {
    const user = await assertUser();
    const p = parse(customerSchema, input);
    if (!p.success) return p.result;

    const result = await prisma.$transaction(async (tx) => {
      // Mobile numbers are not unique (shared family numbers are common), so we
      // do NOT block on a duplicate phone. customerCode is the unique identity.
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

    // Duplicate phone numbers are allowed by design — no uniqueness check here.
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
