/**
 * Seed — idempotent, re-runnable, safe to re-run, easy to remove.
 *
 *   npm run db:seed         → create branches, settings, services, plans,
 *                             staff, 10 demo customers, memberships & invoices
 *   npm run db:clean-demo   → remove ONLY the demo customers and everything
 *                             attached to them (see prisma/clean-demo.ts)
 *
 * Demo customers use FIXED uuids (DEMO_CUSTOMER_IDS) so re-running upserts
 * instead of duplicating, and the clean script can target them exactly.
 *
 * Requires: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Owner login also needs ADMIN_EMAIL / ADMIN_PASSWORD.
 */
import { PrismaClient, type Service, type Customer } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const r = (rupees: number) => rupees * 100; // → paise
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000);

export const DEMO_CUSTOMER_IDS = Array.from(
  { length: 10 },
  (_, i) => `00000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`,
);

const STAFF_PASSWORD = "Salon@1234";
const DEMO_STAFF = [
  { email: "ravi@naturesalon.local", fullName: "Ravi Kumar (Senior Stylist)" },
  { email: "sana@naturesalon.local", fullName: "Sana Shaikh (Beautician)" },
  { email: "imran@naturesalon.local", fullName: "Imran Ali (Junior Stylist)" },
  { email: "pooja@naturesalon.local", fullName: "Pooja Patil (Receptionist)" },
  { email: "vikram@naturesalon.local", fullName: "Vikram Rao (Senior Stylist)" },
  { email: "neha@naturesalon.local", fullName: "Neha Joshi (Beautician)" },
];

async function main() {
  // ── Settings ───────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { id: "global" },
    create: { id: "global", salonName: "Nature Unisex Salon", invoicePrefix: "NUS", taxRatePctBps: 0 },
    update: {},
  });

  // ── Branches ───────────────────────────────────────────────
  const sahakar = await prisma.branch.upsert({
    where: { code: "SNG" }, create: { name: "Sahakar Nagar Branch", code: "SNG", isActive: true }, update: {},
  });
  const newBranch = await prisma.branch.upsert({
    where: { code: "NEW" }, create: { name: "New Branch", code: "NEW", isActive: true }, update: {},
  });

  // ── Service categories + services ──────────────────────────
  const hair = await prisma.serviceCategory.upsert({ where: { name: "Hair" }, create: { name: "Hair", sortOrder: 1 }, update: {} });
  const skin = await prisma.serviceCategory.upsert({ where: { name: "Skin & Spa" }, create: { name: "Skin & Spa", sortOrder: 2 }, update: {} });

  const serviceDefs = [
    { name: "Haircut (Men)", price: r(300), categoryId: hair.id, durationMin: 30 },
    { name: "Haircut (Women)", price: r(600), categoryId: hair.id, durationMin: 45 },
    { name: "Beard Trim", price: r(150), categoryId: hair.id, durationMin: 20 },
    { name: "Hair Color", price: r(1500), categoryId: hair.id, durationMin: 90 },
    { name: "Hair Spa", price: r(1200), categoryId: hair.id, durationMin: 60 },
    { name: "Keratin Treatment", price: r(4000), categoryId: hair.id, durationMin: 120 },
    { name: "Head Massage", price: r(500), categoryId: hair.id, durationMin: 30 },
    { name: "Facial", price: r(1200), categoryId: skin.id, durationMin: 60 },
    { name: "Cleanup", price: r(700), categoryId: skin.id, durationMin: 45 },
    { name: "Threading", price: r(80), categoryId: skin.id, durationMin: 15 },
    { name: "Waxing (Full Arms)", price: r(400), categoryId: skin.id, durationMin: 30 },
    { name: "De-Tan", price: r(900), categoryId: skin.id, durationMin: 40 },
  ];
  const services: Service[] = [];
  for (const s of serviceDefs) {
    let svc = await prisma.service.findFirst({ where: { name: s.name } });
    if (!svc) svc = await prisma.service.create({ data: { ...s, isActive: true } });
    services.push(svc);
  }
  const svcByName = (n: string) => services.find((s) => s.name === n)!;

  // ── Membership plans (3) ───────────────────────────────────
  async function ensurePlan(name: string, data: Record<string, unknown>) {
    let p = await prisma.membershipPlan.findFirst({ where: { name } });
    if (!p) p = await prisma.membershipPlan.create({ data: { name, ...data } as never });
    return p;
  }
  const walletPlan = await ensurePlan("Wallet ₹20,000 → ₹25,000", { kind: "WALLET", price: r(20000), walletValue: r(25000), validityDays: 365, isActive: true });
  const unlimitedPlan = await ensurePlan("Unlimited Haircut (1 Year)", { kind: "UNLIMITED", flatPrice: r(2000), benefitLabel: "Unlimited Haircut", validityDays: 365, isActive: true });
  const premiumPlan = await ensurePlan("Premium Grooming ₹10,000 → ₹12,000", { kind: "WALLET", price: r(10000), walletValue: r(12000), validityDays: 365, isActive: true });

  // ── Owner admin + staff logins ─────────────────────────────
  const haveSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabase = haveSupabase
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

  async function ensureLogin(email: string, password: string, fullName: string, role: "ADMIN" | "STAFF", branchId: string | null) {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role } });
    if (error && !error.message.toLowerCase().includes("already")) { console.warn(`auth ${email}: ${error.message}`); }
    let id = data?.user?.id;
    if (!id) { const existing = await prisma.user.findUnique({ where: { email } }); id = existing?.id; }
    if (!id) return null;
    await prisma.user.upsert({
      where: { id },
      create: { id, email, fullName, role, status: "ACTIVE", branchId },
      update: { fullName, role, branchId },
    });
    return id;
  }

  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    await ensureLogin(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, "Salon Owner", "ADMIN", sahakar.id);
    console.log(`✓ Owner admin: ${process.env.ADMIN_EMAIL}`);
  }

  const staffIds: string[] = [];
  for (let i = 0; i < DEMO_STAFF.length; i++) {
    const s = DEMO_STAFF[i];
    const id = await ensureLogin(s.email, STAFF_PASSWORD, s.fullName, "STAFF", i % 2 === 0 ? sahakar.id : newBranch.id);
    if (id) staffIds.push(id);
  }
  // Fall back to the owner/any admin if staff couldn't be created (no Supabase).
  if (staffIds.length === 0) {
    const anyUser = await prisma.user.findFirst({ where: { deletedAt: null } });
    if (anyUser) staffIds.push(anyUser.id);
  }
  if (staffIds.length === 0) { console.log("⚠ No users available — skipping invoices."); console.log("✓ Seed complete (catalog only)."); return; }

  // ── 10 demo customers (fixed ids) ──────────────────────────
  const customerDefs = [
    { name: "Anup Deshpande", phone: "9876543210", gender: "MALE", dob: new Date("1992-03-14"), notes: "Prefers Ravi. Coffee, no sugar.", branch: sahakar.id },
    { name: "Priya Deshpande", phone: "9876543210", gender: "FEMALE", dob: new Date("1994-11-02"), notes: "Family of Anup (shared mobile).", branch: sahakar.id },
    { name: "Rahul Nair", phone: "9811122233", gender: "MALE", dob: new Date("1988-07-21"), notes: "Unlimited haircut member.", branch: sahakar.id },
    { name: "Sneha Iyer", phone: "9822233344", gender: "FEMALE", dob: new Date("1996-01-09"), notes: "Sensitive skin — patch test.", branch: newBranch.id },
    { name: "Mohammed Khan", phone: "9833344455", gender: "MALE", dob: new Date("1990-05-30"), notes: "", branch: sahakar.id },
    { name: "Aisha Sheikh", phone: "9844455566", gender: "FEMALE", dob: new Date("1998-09-12"), notes: "Bridal package interested.", branch: newBranch.id },
    { name: "Karan Mehta", phone: "9855566677", gender: "MALE", dob: daysAhead(6), notes: "Birthday this week!", branch: sahakar.id },
    { name: "Divya Rao", phone: "9866677788", gender: "FEMALE", dob: daysAhead(3), notes: "Birthday soon — offer facial.", branch: newBranch.id },
    { name: "Sameer Joshi", phone: "9877788899", gender: "MALE", dob: new Date("1985-12-25"), notes: "", branch: sahakar.id },
    { name: "Tanvi Kulkarni", phone: "9888899900", gender: "FEMALE", dob: new Date("1993-04-18"), notes: "Prefers weekend slots.", branch: newBranch.id },
  ];
  const customers: Customer[] = [];
  for (let i = 0; i < customerDefs.length; i++) {
    const c = customerDefs[i];
    const id = DEMO_CUSTOMER_IDS[i];
    // Demo codes live in a high range (CUST-9000xx) so they never collide with
    // the app's count-based codes (CUST-0000xx) and are easy to spot/remove.
    const code = `CUST-${String(900001 + i)}`;
    const cust = await prisma.customer.upsert({
      where: { id },
      create: { id, customerCode: code, name: c.name, phone: c.phone, gender: c.gender as never, dob: c.dob, notes: c.notes || null, status: "ACTIVE", registeredBranchId: c.branch },
      update: { name: c.name, phone: c.phone, dob: c.dob, notes: c.notes || null },
    });
    customers.push(cust);
  }
  console.log(`✓ ${customers.length} demo customers`);

  // ── Memberships for a few customers (skip if already present) ──
  async function sellWallet(customerId: string, branchId: string, plan: typeof walletPlan, idx: number) {
    const exists = await prisma.customerMembership.findFirst({ where: { customerId, planId: plan.id } });
    if (exists) return;
    const purchase = plan.price ?? 0;
    const total = plan.walletValue ?? purchase;
    const bonus = Math.max(0, total - purchase);
    const m = await prisma.customerMembership.create({
      data: {
        membershipNumber: `MEM-${String(900000 + idx)}`, customerId, planId: plan.id, branchId, kind: "WALLET",
        status: "ACTIVE", purchaseValue: purchase, bonusValue: bonus, totalValue: total, remainingValue: total,
        expiryDate: daysAhead(365), soldById: staffIds[0],
      },
    });
    await prisma.membershipLedger.create({ data: { membershipId: m.id, direction: "CREDIT", reason: "PURCHASE", amount: purchase, balanceAfter: purchase, note: "Seed purchase", createdById: staffIds[0] } });
    if (bonus > 0) await prisma.membershipLedger.create({ data: { membershipId: m.id, direction: "CREDIT", reason: "BONUS", amount: bonus, balanceAfter: total, note: "Seed bonus", createdById: staffIds[0] } });
  }
  async function sellUnlimited(customerId: string, branchId: string, idx: number) {
    const exists = await prisma.customerMembership.findFirst({ where: { customerId, planId: unlimitedPlan.id } });
    if (exists) return;
    await prisma.customerMembership.create({
      data: {
        membershipNumber: `MEM-${String(900000 + idx)}`, customerId, planId: unlimitedPlan.id, branchId, kind: "UNLIMITED",
        status: "ACTIVE", purchaseValue: unlimitedPlan.flatPrice ?? 0, expiryDate: daysAhead(365), soldById: staffIds[0],
      },
    });
  }
  await sellWallet(customers[0].id, sahakar.id, walletPlan, 1);
  await sellUnlimited(customers[2].id, sahakar.id, 2);
  await sellWallet(customers[3].id, newBranch.id, premiumPlan, 3);
  console.log("✓ Memberships issued");

  // ── Invoices + visits (skip if demo customers already billed) ──
  const alreadyBilled = await prisma.invoice.count({ where: { customerId: { in: DEMO_CUSTOMER_IDS } } });
  if (alreadyBilled > 0) {
    console.log(`✓ Invoices already present (${alreadyBilled}) — skipping invoice seed.`);
  } else {
    const payments: ("CASH" | "UPI" | "CARD")[] = ["CASH", "UPI", "CARD"];
    const baskets = [
      ["Haircut (Men)", "Beard Trim"],
      ["Haircut (Women)", "Facial"],
      ["Hair Color"],
      ["Hair Spa", "Head Massage"],
      ["Facial", "Cleanup", "Threading"],
      ["Haircut (Men)"],
      ["Keratin Treatment"],
      ["Waxing (Full Arms)", "Threading"],
      ["Haircut (Women)", "De-Tan"],
      ["Beard Trim", "Head Massage"],
      ["Cleanup"],
      ["Haircut (Men)", "Hair Spa"],
      ["Facial"],
      ["Haircut (Women)", "Threading", "Waxing (Full Arms)"],
    ];
    const settings = await prisma.setting.findUnique({ where: { id: "global" } });
    const prefix = settings?.invoicePrefix ?? "NUS";

    let made = 0;
    for (let i = 0; i < baskets.length; i++) {
      const cust = customers[i % customers.length];
      const branch = cust.registeredBranchId === sahakar.id ? sahakar : newBranch;
      const staffId = staffIds[i % staffIds.length];
      const when = daysAgo(baskets.length - i); // spread across recent days
      const method = payments[i % payments.length];
      const items = baskets[i].map((n) => svcByName(n));
      const subtotal = items.reduce((s, it) => s + it.price, 0);

      const year = when.getFullYear().toString();
      const counter = await prisma.invoiceCounter.upsert({
        where: { branchId_period: { branchId: branch.id, period: year } },
        create: { branchId: branch.id, period: year, lastSeq: 1 },
        update: { lastSeq: { increment: 1 } },
      });
      const invoiceNumber = `${prefix}-${branch.code}/${year}/${String(counter.lastSeq).padStart(6, "0")}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber, branchId: branch.id, customerId: cust.id, staffId,
          customerNameSnapshot: cust.name, customerPhoneSnapshot: cust.phone,
          subtotal, grandTotal: subtotal, taxableAmount: subtotal, amountDue: 0,
          paymentMethod: method, status: "PAID", createdAt: when, updatedAt: when,
          items: { create: items.map((it) => ({ serviceId: it.id, serviceNameSnapshot: it.name, unitPriceSnapshot: it.price, quantity: 1, lineTotal: it.price })) },
          payments: { create: { method, amount: subtotal } },
        },
      });
      await prisma.visit.create({ data: { customerId: cust.id, invoiceId: invoice.id, branchId: branch.id, amount: subtotal, visitedAt: when } });
      made++;
    }
    console.log(`✓ ${made} invoices + visits created`);
  }

  console.log("✓ Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
