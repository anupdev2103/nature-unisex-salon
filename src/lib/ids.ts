import { Prisma } from "@prisma/client";
import { pad } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

/**
 * Next customer code, e.g. CUST-000123. Derived from a count; collisions are
 * avoided by the unique constraint + retry at the caller if ever needed.
 */
export async function nextCustomerCode(db: Tx): Promise<string> {
  const count = await db.customer.count();
  return `CUST-${pad(count + 1, 6)}`;
}

/** Next membership number, e.g. MEM-000045. */
export async function nextMembershipNumber(db: Tx): Promise<string> {
  const count = await db.customerMembership.count();
  return `MEM-${pad(count + 1, 6)}`;
}

/**
 * Atomic, gapless invoice number per branch+year. Uses a Prisma upsert on
 * invoice_counters (row-locked inside the billing transaction) so it does NOT
 * depend on any database function being installed. Safe under concurrency
 * because the surrounding $transaction serialises the increment on the
 * counter row. Format: <PREFIX>-<BRANCHCODE>/<YYYY>/<000123>.
 */
export async function nextInvoiceNumber(
  db: Tx,
  branchId: string,
  branchCode: string,
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear().toString();
  const counter = await db.invoiceCounter.upsert({
    where: { branchId_period: { branchId, period: year } },
    create: { branchId, period: year, lastSeq: 1 },
    update: { lastSeq: { increment: 1 } },
  });
  return `${prefix}-${branchCode}/${year}/${pad(counter.lastSeq, 6)}`;
}
