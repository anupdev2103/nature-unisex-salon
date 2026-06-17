/**
 * ════════════════════════════════════════════════════════════════════
 *  Billing Engine — pure pricing calculation (no DB).
 *  Order of operations:
 *    line totals → item discounts → unlimited-membership coverage
 *    → bill discount → coupon → wallet membership → tax → grand total
 *  All amounts are paise.
 * ════════════════════════════════════════════════════════════════════
 */

export interface PricedLineInput {
  serviceId: string;
  serviceName: string;
  unitPrice: number; // paise
  quantity: number;
  lineDiscount: number; // paise
  membershipBenefit: boolean; // covered by unlimited membership
}

export interface PricedLine extends PricedLineInput {
  gross: number; // unitPrice * quantity
  lineTotal: number; // payable for this line (0 if benefit)
}

export interface BillingInput {
  lines: PricedLineInput[];
  billDiscount: number; // paise
  couponAmount: number; // paise (already validated by caller)
  walletAvailable: number; // paise remaining on wallet membership (0 if none/unused)
  taxRateBps: number; // e.g. 1800 = 18%
}

export interface BillingResult {
  lines: PricedLine[];
  subtotal: number; // gross of all lines
  itemDiscountTotal: number;
  benefitCovered: number; // value covered by unlimited membership
  billDiscountTotal: number;
  couponTotal: number;
  membershipApplied: number; // wallet value spent
  taxableAmount: number;
  taxAmount: number;
  grandTotal: number; // payable via selected payment method (after wallet)
  unlimitedNotional: number; // notional value of benefit lines (for usage tracking)
}

export function computeBill(input: BillingInput): BillingResult {
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let benefitCovered = 0;
  let unlimitedNotional = 0;

  const lines: PricedLine[] = input.lines.map((l) => {
    const gross = l.unitPrice * l.quantity;
    subtotal += gross;

    if (l.membershipBenefit) {
      benefitCovered += gross;
      unlimitedNotional += gross;
      return { ...l, gross, lineTotal: 0 };
    }

    const discount = Math.min(l.lineDiscount, gross);
    itemDiscountTotal += discount;
    return { ...l, gross, lineTotal: gross - discount };
  });

  // Billable after item-level reductions.
  let billable = subtotal - benefitCovered - itemDiscountTotal;

  // Bill-level discount (clamped).
  const billDiscountTotal = clamp(input.billDiscount, 0, billable);
  billable -= billDiscountTotal;

  // Coupon (clamped to remaining billable).
  const couponTotal = clamp(input.couponAmount, 0, billable);
  billable -= couponTotal;

  // Wallet membership pays down the remaining billable.
  const membershipApplied = clamp(input.walletAvailable, 0, billable);
  billable -= membershipApplied;

  // Tax on the net payable.
  const taxableAmount = billable;
  const taxAmount = Math.round((taxableAmount * input.taxRateBps) / 10000);
  const grandTotal = taxableAmount + taxAmount;

  return {
    lines,
    subtotal,
    itemDiscountTotal,
    benefitCovered,
    billDiscountTotal,
    couponTotal,
    membershipApplied,
    taxableAmount,
    taxAmount,
    grandTotal,
    unlimitedNotional,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
