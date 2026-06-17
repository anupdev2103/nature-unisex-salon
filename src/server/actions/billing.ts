"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertUser } from "@/lib/auth";
import { ActionResult, ok, parse, toActionError } from "@/lib/action";
import { createInvoiceSchema } from "@/lib/validation";
import { rupeesToPaise } from "@/lib/money";
import { computeBill, PricedLineInput } from "@/lib/billing-engine";
import { nextInvoiceNumber } from "@/lib/ids";
import { writeAudit } from "@/lib/audit";
import {
  redeemWallet,
  recordUnlimitedUsage,
  refreshMembershipStatus,
} from "@/lib/membership-engine";

/**
 * Create an invoice — the central transaction of the system.
 * Validates everything, prices the bill, redeems coupon + membership,
 * snapshots services, records payment + visit, and writes an audit log.
 * All within a single DB transaction so partial bills can never persist.
 */
export async function createInvoice(
  input: unknown,
): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  try {
    const user = await assertUser();
    const p = parse(createInvoiceSchema, input);
    if (!p.success) return p.result;
    const data = p.data;

    const result = await prisma.$transaction(async (tx) => {
      // ── Branch + settings ──────────────────────────────────────────
      const branch = await tx.branch.findFirst({
        where: { id: data.branchId, deletedAt: null, isActive: true },
      });
      if (!branch) throw new Error("Selected branch is not available");

      const settings = await tx.setting.findUnique({ where: { id: "global" } });
      const taxRateBps = settings?.taxRatePctBps ?? 0;
      const invoicePrefix = settings?.invoicePrefix ?? "NUS";

      // ── Customer ───────────────────────────────────────────────────
      const customer = await tx.customer.findFirst({
        where: { id: data.customerId, deletedAt: null },
      });
      if (!customer) throw new Error("Customer not found");
      if (customer.status === "BLOCKED")
        throw new Error("This customer is blocked");

      // ── Services (snapshot prices) ─────────────────────────────────
      const serviceIds = [...new Set(data.items.map((i) => i.serviceId))];
      const services = await tx.service.findMany({
        where: { id: { in: serviceIds }, deletedAt: null },
      });
      const serviceMap = new Map(services.map((s) => [s.id, s]));

      const pricedLines: PricedLineInput[] = data.items.map((item) => {
        const svc = serviceMap.get(item.serviceId);
        if (!svc) throw new Error("One of the services is unavailable");
        const unitPrice =
          item.unitPrice != null
            ? rupeesToPaise(item.unitPrice)
            : svc.price;
        return {
          serviceId: svc.id,
          serviceName: svc.name,
          unitPrice,
          quantity: item.quantity,
          lineDiscount: rupeesToPaise(item.lineDiscount ?? 0),
          membershipBenefit: item.membershipBenefit ?? false,
        };
      });

      // ── Membership (validate up-front) ─────────────────────────────
      let walletAvailable = 0;
      let membership = null as Awaited<
        ReturnType<typeof tx.customerMembership.findFirst>
      > | null;
      const hasBenefitLine = pricedLines.some((l) => l.membershipBenefit);

      if (data.membershipId) {
        await refreshMembershipStatus(tx, data.membershipId);
        membership = await tx.customerMembership.findFirst({
          where: {
            id: data.membershipId,
            customerId: customer.id,
            deletedAt: null,
          },
        });
        if (!membership) throw new Error("Membership not found for this customer");
        if (membership.status !== "ACTIVE")
          throw new Error(`Membership is ${membership.status.toLowerCase()}`);

        if (membership.kind === "WALLET" && data.useWallet) {
          walletAvailable = membership.remainingValue;
        }
        if (membership.kind !== "UNLIMITED" && hasBenefitLine) {
          throw new Error(
            "Membership-benefit items require an unlimited membership",
          );
        }
      } else if (hasBenefitLine) {
        throw new Error("Select a membership to apply benefit items");
      }

      // ── Coupon (validate) ──────────────────────────────────────────
      let couponAmount = 0;
      let coupon = null as Awaited<ReturnType<typeof tx.coupon.findFirst>> | null;
      if (data.couponCode) {
        coupon = await tx.coupon.findFirst({
          where: { code: data.couponCode.toUpperCase(), deletedAt: null },
        });
        if (!coupon) throw new Error("Invalid coupon code");
        if (coupon.status !== "ACTIVE")
          throw new Error("This coupon is not active");
        if (coupon.expiryDate && coupon.expiryDate < new Date())
          throw new Error("This coupon has expired");
        if (
          coupon.usageLimit != null &&
          coupon.usageCount >= coupon.usageLimit
        )
          throw new Error("This coupon has reached its usage limit");
        couponAmount = coupon.amount;
      }

      // ── Price it ───────────────────────────────────────────────────
      const billDiscount = rupeesToPaise(data.billDiscount ?? 0);
      const priced = computeBill({
        lines: pricedLines,
        billDiscount,
        couponAmount,
        walletAvailable,
        taxRateBps,
      });

      // Enforce coupon minimum bill against pre-coupon billable.
      if (coupon && coupon.minBillAmount > 0) {
        const preCoupon =
          priced.subtotal -
          priced.benefitCovered -
          priced.itemDiscountTotal -
          priced.billDiscountTotal;
        if (preCoupon < coupon.minBillAmount)
          throw new Error("Bill is below the coupon's minimum amount");
      }

      // ── Invoice number + record ────────────────────────────────────
      const invoiceNumber = await nextInvoiceNumber(
        tx,
        branch.id,
        branch.code,
        invoicePrefix,
      );

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          branchId: branch.id,
          customerId: customer.id,
          staffId: user.id,
          customerNameSnapshot: customer.name,
          customerPhoneSnapshot: customer.phone,
          subtotal: priced.subtotal,
          itemDiscountTotal: priced.itemDiscountTotal,
          billDiscountTotal: priced.billDiscountTotal,
          couponTotal: priced.couponTotal,
          membershipApplied: priced.membershipApplied,
          taxableAmount: priced.taxableAmount,
          taxAmount: priced.taxAmount,
          taxRatePctBps: taxRateBps,
          grandTotal: priced.grandTotal,
          amountDue: 0,
          paymentMethod: data.paymentMethod,
          status: "PAID",
          membershipId: membership?.id ?? null,
          notes: data.notes || null,
          items: {
            create: priced.lines.map((l) => ({
              serviceId: l.serviceId,
              serviceNameSnapshot: l.serviceName,
              unitPriceSnapshot: l.unitPrice,
              quantity: l.quantity,
              lineDiscount: l.lineDiscount,
              membershipBenefit: l.membershipBenefit,
              lineTotal: l.lineTotal,
            })),
          },
          payments: {
            create: {
              method: data.paymentMethod,
              amount: priced.grandTotal,
              reference: data.paymentReference || null,
            },
          },
        },
      });

      // ── Bill-level discount record ─────────────────────────────────
      if (priced.billDiscountTotal > 0) {
        await tx.invoiceDiscount.create({
          data: {
            invoiceId: invoice.id,
            scope: "INVOICE",
            amount: priced.billDiscountTotal,
            reason: data.billDiscountReason || "Discount",
            staffId: user.id,
          },
        });
      }

      // ── Coupon redemption ──────────────────────────────────────────
      if (coupon && priced.couponTotal > 0) {
        await tx.couponRedemption.create({
          data: {
            couponId: coupon.id,
            invoiceId: invoice.id,
            customerId: customer.id,
            amount: priced.couponTotal,
          },
        });
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usageCount: { increment: 1 } },
        });
      }

      // ── Membership effects ─────────────────────────────────────────
      if (membership) {
        if (membership.kind === "WALLET" && priced.membershipApplied > 0) {
          await redeemWallet(tx, {
            membershipId: membership.id,
            amount: priced.membershipApplied,
            invoiceId: invoice.id,
            createdById: user.id,
          });
        }
        if (membership.kind === "UNLIMITED" && hasBenefitLine) {
          await recordUnlimitedUsage(tx, {
            membershipId: membership.id,
            notionalValue: priced.unlimitedNotional,
          });
        }
      }

      // ── Visit record ───────────────────────────────────────────────
      await tx.visit.create({
        data: {
          customerId: customer.id,
          invoiceId: invoice.id,
          branchId: branch.id,
          amount: priced.grandTotal,
        },
      });

      await writeAudit(
        {
          actorId: user.id,
          action: "invoice.create",
          entity: "Invoice",
          entityId: invoice.id,
          after: { invoiceNumber, grandTotal: priced.grandTotal },
        },
        tx,
      );

      return { invoiceId: invoice.id, invoiceNumber };
    });

    revalidatePath("/dashboard");
    revalidatePath("/billing");
    revalidatePath(`/customers/${data.customerId}`);
    return ok(result);
  } catch (e) {
    return toActionError(e);
  }
}

/** Void an invoice (admin). Reverses wallet redemptions via a REFUND credit. */
export async function voidInvoice(
  invoiceId: string,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await assertUser();
    if (user.role !== "ADMIN") throw new Error("FORBIDDEN");

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: { ledgerLinks: true },
      });
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === "VOID") throw new Error("Invoice already voided");

      // Refund any wallet value spent on this invoice.
      if (invoice.membershipId && invoice.membershipApplied > 0) {
        const m = await tx.customerMembership.findUnique({
          where: { id: invoice.membershipId },
        });
        if (m && m.kind === "WALLET") {
          const newBalance = m.remainingValue + invoice.membershipApplied;
          await tx.customerMembership.update({
            where: { id: m.id },
            data: {
              remainingValue: newBalance,
              status: m.status === "EXHAUSTED" ? "ACTIVE" : m.status,
            },
          });
          await tx.membershipLedger.create({
            data: {
              membershipId: m.id,
              direction: "CREDIT",
              reason: "REFUND",
              amount: invoice.membershipApplied,
              balanceAfter: newBalance,
              invoiceId: invoice.id,
              note: "Refund — invoice voided",
              createdById: user.id,
            },
          });
        }
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "VOID", voidedAt: new Date(), voidReason: reason },
      });

      await writeAudit(
        {
          actorId: user.id,
          action: "invoice.void",
          entity: "Invoice",
          entityId: invoice.id,
          before: { status: invoice.status },
          after: { status: "VOID", reason },
        },
        tx,
      );
    });

    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return ok({ id: invoiceId });
  } catch (e) {
    return toActionError(e);
  }
}
