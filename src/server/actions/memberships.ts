"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertUser, assertAdmin } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { membershipPlanSchema, sellMembershipSchema } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";
import { nextMembershipNumber } from "@/lib/ids";
import { writeAudit } from "@/lib/audit";
import { issueWalletMembership, issueUnlimitedMembership } from "@/lib/membership-engine";

// ───────────────────────── Plans (admin) ─────────────────────────
export async function createMembershipPlan(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    const p = parse(membershipPlanSchema, input);
    if (!p.success) return p.result;
    const d = p.data;

    const plan = await prisma.membershipPlan.create({
      data: {
        name: d.name,
        kind: d.kind,
        validityDays: d.validityDays,
        isActive: d.isActive,
        price: d.kind === "WALLET" ? rupeesToPaise(d.price!) : null,
        walletValue: d.kind === "WALLET" ? rupeesToPaise(d.walletValue!) : null,
        flatPrice: d.kind === "UNLIMITED" ? rupeesToPaise(d.flatPrice!) : null,
        benefitLabel: d.kind === "UNLIMITED" ? d.benefitLabel || null : null,
      },
    });
    await writeAudit({ actorId: user.id, action: "membershipPlan.create", entity: "MembershipPlan", entityId: plan.id, after: plan });
    revalidatePath("/memberships");
    return ok({ id: plan.id });
  } catch (e) {
    return toActionError(e);
  }
}

export async function setMembershipPlanActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertAdmin();
    await prisma.membershipPlan.update({ where: { id }, data: { isActive } });
    await writeAudit({ actorId: user.id, action: "membershipPlan.toggle", entity: "MembershipPlan", entityId: id, after: { isActive } });
    revalidatePath("/memberships");
    return ok({ id });
  } catch (e) {
    return toActionError(e);
  }
}

// ───────────────────────── Sell a membership to a customer ─────────────────────────
export async function sellMembership(
  input: unknown,
): Promise<ActionResult<{ membershipId: string; membershipNumber: string }>> {
  try {
    const user = await assertUser();
    const p = parse(sellMembershipSchema, input);
    if (!p.success) return p.result;
    const d = p.data;

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: d.customerId, deletedAt: null } });
      if (!customer) throw new Error("Customer not found");

      const plan = await tx.membershipPlan.findFirst({ where: { id: d.planId, deletedAt: null, isActive: true } });
      if (!plan) throw new Error("Membership plan unavailable");

      const branch = await tx.branch.findFirst({ where: { id: d.branchId, deletedAt: null, isActive: true } });
      if (!branch) throw new Error("Branch unavailable");

      const membershipNumber = await nextMembershipNumber(tx);

      let issued: { id: string };
      let chargedAmount: number;

      if (plan.kind === "WALLET") {
        const purchase = plan.price ?? 0;
        const total = plan.walletValue ?? purchase;
        const bonus = Math.max(0, total - purchase);
        chargedAmount = purchase;
        issued = await issueWalletMembership(tx, {
          membershipNumber,
          customerId: customer.id,
          planId: plan.id,
          branchId: branch.id,
          purchaseValue: purchase,
          bonusValue: bonus,
          validityDays: plan.validityDays,
          soldById: user.id,
        });
      } else {
        chargedAmount = plan.flatPrice ?? 0;
        issued = await issueUnlimitedMembership(tx, {
          membershipNumber,
          customerId: customer.id,
          planId: plan.id,
          branchId: branch.id,
          flatPrice: chargedAmount,
          validityDays: plan.validityDays,
          soldById: user.id,
        });
      }

      await writeAudit(
        {
          actorId: user.id,
          action: "membership.sell",
          entity: "CustomerMembership",
          entityId: issued.id,
          after: { membershipNumber, planId: plan.id, charged: chargedAmount, paymentMethod: d.paymentMethod },
        },
        tx,
      );

      return { membershipId: issued.id, membershipNumber };
    });

    revalidatePath("/memberships");
    revalidatePath(`/customers/${d.customerId}`);
    return ok(result);
  } catch (e) {
    return toActionError(e);
  }
}
