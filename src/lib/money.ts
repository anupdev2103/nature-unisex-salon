/**
 * Money helpers. All amounts are stored as integer PAISE in the DB.
 * ₹1 = 100 paise. Never use floats for money math.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/** Format paise as an Indian-locale rupee string, e.g. 2500050 -> "₹25,000.50". */
export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

/** Compact format for dashboard tiles, e.g. ₹1.2L, ₹3.4Cr. */
export function formatINRCompact(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(rupees);
}

/** Apply a basis-points tax rate to a paise amount. 1800 bps = 18%. */
export function applyTaxBps(amountPaise: number, rateBps: number): number {
  return Math.round((amountPaise * rateBps) / 10000);
}
