/**
 * Seed: creates the two real branches, default settings, sample service
 * categories + services, and the two membership plans described by the
 * business. It also provisions the OWNER admin login via Supabase Auth.
 *
 * Run with:  npm run db:seed
 * Requires:  DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *            and ADMIN_EMAIL / ADMIN_PASSWORD env vars for the owner login.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const r = (rupees: number) => rupees * 100; // paise

async function main() {
  // ── Settings ───────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      salonName: "Nature Unisex Salon",
      invoicePrefix: "NUS",
      taxRatePctBps: 0,
    },
    update: {},
  });

  // ── Branches ───────────────────────────────────────────────
  const sahakar = await prisma.branch.upsert({
    where: { code: "SNG" },
    create: { name: "Sahakar Nagar Branch", code: "SNG", isActive: true },
    update: {},
  });
  await prisma.branch.upsert({
    where: { code: "NEW" },
    create: { name: "New Branch", code: "NEW", isActive: true },
    update: {},
  });

  // ── Service categories + services ──────────────────────────
  const hair = await prisma.serviceCategory.upsert({
    where: { name: "Hair" },
    create: { name: "Hair", sortOrder: 1 },
    update: {},
  });
  const skin = await prisma.serviceCategory.upsert({
    where: { name: "Skin & Spa" },
    create: { name: "Skin & Spa", sortOrder: 2 },
    update: {},
  });

  const services: { name: string; price: number; categoryId: string; durationMin: number }[] = [
    { name: "Haircut (Men)", price: r(300), categoryId: hair.id, durationMin: 30 },
    { name: "Haircut (Women)", price: r(600), categoryId: hair.id, durationMin: 45 },
    { name: "Hair Colour", price: r(1500), categoryId: hair.id, durationMin: 90 },
    { name: "Beard Trim", price: r(150), categoryId: hair.id, durationMin: 20 },
    { name: "Facial", price: r(1200), categoryId: skin.id, durationMin: 60 },
    { name: "Head Massage", price: r(500), categoryId: skin.id, durationMin: 30 },
  ];
  for (const s of services) {
    const exists = await prisma.service.findFirst({ where: { name: s.name } });
    if (!exists) await prisma.service.create({ data: { ...s, isActive: true } });
  }

  // ── Membership plans (Type A wallet + Type B unlimited) ────
  const walletExists = await prisma.membershipPlan.findFirst({ where: { name: "Wallet ₹20,000 → ₹25,000" } });
  if (!walletExists) {
    await prisma.membershipPlan.create({
      data: {
        name: "Wallet ₹20,000 → ₹25,000",
        kind: "WALLET",
        price: r(20000),
        walletValue: r(25000),
        validityDays: 365,
        isActive: true,
      },
    });
  }
  const unlimitedExists = await prisma.membershipPlan.findFirst({ where: { name: "Unlimited Haircut (1 Year)" } });
  if (!unlimitedExists) {
    await prisma.membershipPlan.create({
      data: {
        name: "Unlimited Haircut (1 Year)",
        kind: "UNLIMITED",
        flatPrice: r(2000),
        benefitLabel: "Unlimited Haircut",
        validityDays: 365,
        isActive: true,
      },
    });
  }

  // ── Owner admin login ──────────────────────────────────────
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Salon Owner", role: "ADMIN" },
    });
    if (error && !error.message.toLowerCase().includes("already")) {
      console.warn("Admin auth user:", error.message);
    }
    const authId = data?.user?.id;
    if (authId) {
      await prisma.user.upsert({
        where: { id: authId },
        create: { id: authId, email, fullName: "Salon Owner", role: "ADMIN", status: "ACTIVE", branchId: sahakar.id },
        update: { role: "ADMIN", status: "ACTIVE" },
      });
      console.log(`✓ Owner admin ready: ${email}`);
    }
  } else {
    console.log("ℹ Skipped admin creation (set ADMIN_EMAIL, ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY).");
  }

  console.log("✓ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
