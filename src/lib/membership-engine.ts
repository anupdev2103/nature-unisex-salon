import { Prisma } from "@prisma/client";

/**
 * ════════════════════════════════════════════════════════════════════
 *  Membership Engine
 *  Pure transactional operations on memberships + their ledger.
 *  Every value movement on a WALLET membership writes a ledger row and
 *  keeps `remainingValue` consistent. UNLIMITED memberships track usage
 *  count + notional consumed value. All amounts are paise.
 * ════════════════════════════════════════════════════════════════════
 */

type Tx = Prisma.TransactionClient;

export class MembershipError extends Error {}

/**
 * Issue a brand-new WALLET membership: credits purchase + bonus and writes
 * two ledger rows. Returns the created membership id.
 */
export async function issueWalletMembership(
  db: Tx,
  params: {
    membershipNumber: string;
    customerId: string;
    planId: string;
    branchId: string;
    purchaseValue: number; // paise paid
    bonusValue: number; // paise free
    validityDays: number;
    soldById: string;
  },
): Promise<{ id: string }> {
  const total = params.purchaseValue + params.bonusValue;
  const expiry = addDays(new Date(), params.validityDays);

  const membership = await db.customerMembership.create({
    data: {
      membershipNumber: params.membershipNumber,
      customerId: params.customerId,
      planId: params.planId,
      branchId: params.branchId,
      kind: "WALLET",
      status: "ACTIVE",
      purchaseValue: params.purchaseValue,
      bonusValue: params.bonusValue,
      totalValue: total,
      remainingValue: total,
      expiryDate: expiry,
      soldById: params.soldById,
    },
  });

  // Ledger: purchase credit then bonus credit, with running balance.
  await db.membershipLedger.create({
    data: {
      membershipId: membership.id,
      direction: "CREDIT",
      reason: "PURCHASE",
      amount: params.purchaseValue,
      balanceAfter: params.purchaseValue,
      note: "Membership purchase",
      createdById: params.soldById,
    },
  });
  if (params.bonusValue > 0) {
    await db.membershipLedger.create({
      data: {
        membershipId: membership.id,
        direction: "CREDIT",
        reason: "BONUS",
        amount: params.bonusValue,
        balanceAfter: total,
        note: "Membership bonus value",
        createdById: params.soldById,
      },
    });
  }

  return { id: membership.id };
}

/** Issue an UNLIMITED membership (e.g. unlimited haircut for 1 year). */
export async function issueUnlimitedMembership(
  db: Tx,
  params: {
    membershipNumber: string;
    customerId: string;
    planId: string;
    branchId: string;
    flatPrice: number;
    validityDays: number;
    soldById: string;
  },
): Promise<{ id: string }> {
  const expiry = addDays(new Date(), params.validityDays);
  const membership = await db.customerMembership.create({
    data: {
      membershipNumber: params.membershipNumber,
      customerId: params.customerId,
      planId: params.planId,
      branchId: params.branchId,
      kind: "UNLIMITED",
      status: "ACTIVE",
      purchaseValue: params.flatPrice,
      expiryDate: expiry,
      soldById: params.soldById,
    },
  });
  return { id: membership.id };
}

/**
 * Spend value from a WALLET membership against an invoice. Validates
 * status, expiry and sufficient balance, writes a DEBIT ledger row and
 * updates the live balance. Returns the new remaining balance.
 */
export async function redeemWallet(
  db: Tx,
  params: {
    membershipId: string;
    amount: number; // paise to spend
    invoiceId: string;
    createdById: string;
  },
): Promise<{ remainingValue: number }> {
  const m = await db.customerMembership.findUnique({
    where: { id: params.membershipId },
  });
  if (!m) throw new MembershipError("Membership not found");
  if (m.kind !== "WALLET")
    throw new MembershipError("Not a wallet membership");
  if (m.status !== "ACTIVE")
    throw new MembershipError(`Membership is ${m.status.toLowerCase()}`);
  if (m.expiryDate < new Date())
    throw new MembershipError("Membership has expired");
  if (params.amount <= 0) throw new MembershipError("Invalid redemption amount");
  if (params.amount > m.remainingValue)
    throw new MembershipError(
      "Insufficient wallet balance for this redemption",
    );

  const newBalance = m.remainingValue - params.amount;
  const exhausted = newBalance === 0;

  await db.customerMembership.update({
    where: { id: m.id },
    data: {
      remainingValue: newBalance,
      status: exhausted ? "EXHAUSTED" : "ACTIVE",
    },
  });

  await db.membershipLedger.create({
    data: {
      membershipId: m.id,
      direction: "DEBIT",
      reason: "REDEMPTION",
      amount: params.amount,
      balanceAfter: newBalance,
      invoiceId: params.invoiceId,
      note: "Redeemed on invoice",
      createdById: params.createdById,
    },
  });

  return { remainingValue: newBalance };
}

/**
 * Record usage of an UNLIMITED membership benefit on an invoice. Increments
 * usage count and accumulates the notional value the customer would have
 * paid (for reporting / value-consumed tracking).
 */
export async function recordUnlimitedUsage(
  db: Tx,
  params: {
    membershipId: string;
    notionalValue: number; // paise the benefit is worth this visit
  },
): Promise<void> {
  const m = await db.customerMembership.findUnique({
    where: { id: params.membershipId },
  });
  if (!m) throw new MembershipError("Membership not found");
  if (m.kind !== "UNLIMITED")
    throw new MembershipError("Not an unlimited membership");
  if (m.status !== "ACTIVE")
    throw new MembershipError(`Membership is ${m.status.toLowerCase()}`);
  if (m.expiryDate < new Date())
    throw new MembershipError("Membership has expired");

  await db.customerMembership.update({
    where: { id: m.id },
    data: {
      usageCount: { increment: 1 },
      valueConsumed: { increment: params.notionalValue },
    },
  });
}

/**
 * Lazily flip ACTIVE memberships to EXPIRED when past expiry. Safe to call
 * before reads. Operates on a single membership for billing-time checks.
 */
export async function refreshMembershipStatus(
  db: Tx,
  membershipId: string,
): Promise<void> {
  const m = await db.customerMembership.findUnique({
    where: { id: membershipId },
  });
  if (!m) return;
  if (m.status === "ACTIVE" && m.expiryDate < new Date()) {
    await db.customerMembership.update({
      where: { id: m.id },
      data: { status: "EXPIRED" },
    });
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
