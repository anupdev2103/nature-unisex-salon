/**
 * Remove ONLY the demo data created by the seed (the 10 fixed-id customers and
 * everything attached to them). Catalog data (services, plans, staff, branches,
 * settings) is left intact. Run: npm run db:clean-demo
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEMO_CUSTOMER_IDS } from "./seed";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  const ids = DEMO_CUSTOMER_IDS;
  const invoices = await prisma.invoice.findMany({ where: { customerId: { in: ids } }, select: { id: true } });
  const invoiceIds = invoices.map((i) => i.id);
  const memberships = await prisma.customerMembership.findMany({ where: { customerId: { in: ids } }, select: { id: true } });
  const membershipIds = memberships.map((m) => m.id);

  // Order matters because of FKs: children of invoices/memberships first.
  await prisma.visit.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.membershipLedger.deleteMany({ where: { membershipId: { in: membershipIds } } });
  await prisma.couponRedemption.deleteMany({ where: { customerId: { in: ids } } });
  // Invoice delete cascades items / payments / discounts.
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.customerMembership.deleteMany({ where: { id: { in: membershipIds } } });
  await prisma.customer.deleteMany({ where: { id: { in: ids } } });

  console.log(`✓ Removed ${ids.length} demo customers, ${invoiceIds.length} invoices, ${membershipIds.length} memberships.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
