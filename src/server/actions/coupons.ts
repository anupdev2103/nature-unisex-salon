"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertAdmin } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { couponSchema } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";
import { writeAudit } from "@/lib/audit";

export async function createCoupon(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(couponSchema, input);
    if (!p.success) return p.result;
    const d = p.data;

    const existing = await prisma.coupon.findUnique({ where: { code: d.code } });
    if (existing) throw new Error("Coupon code already exists");

    const coupon = await prisma.coupon.create({
      data: {
        code: d.code,
        type: "FIXED",
        amount: rupeesToPaise(d.amount),
        expiryDate: d.expiryDate ? new Date(d.expiryDate) : null,
        usageLimit: d.usageLimit ?? null,
        minBillAmount: rupeesToPaise(d.minBillAmount),
        status: d.status,
      },
    });
    await writeAudit({ actorId: user.id, action: "coupon.create", entity: "Coupon", entityId: coupon.id, after: coupon });
    revalidatePath("/coupons");
    return ok({ id: coupon.id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function setCouponStatus(id: string, status: "ACTIVE" | "DISABLED"): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    await prisma.coupon.update({ where: { id }, data: { status } });
    await writeAudit({ actorId: user.id, action: "coupon.status", entity: "Coupon", entityId: id, after: { status } });
    revalidatePath("/coupons");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Validate a coupon for a given pre-coupon billable amount (paise). Used by
 * the billing screen to preview the discount before submitting.
 */
export async function validateCoupon(
  code: string,
  billablePaise: number,
): Promise<ActionResult<{ amount: number }>> {
  try {
    const coupon = await prisma.coupon.findFirst({ where: { code: code.toUpperCase(), deletedAt: null } });
    if (!coupon) throw new Error("Invalid coupon code");
    if (coupon.status !== "ACTIVE") throw new Error("Coupon is not active");
    if (coupon.expiryDate && coupon.expiryDate < new Date()) throw new Error("Coupon has expired");
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) throw new Error("Coupon usage limit reached");
    if (coupon.minBillAmount > billablePaise) throw new Error("Bill below coupon minimum");
    return ok({ amount: Math.min(coupon.amount, billablePaise) });
  } catch (e) {
    return toActionError(e);
  }
}
