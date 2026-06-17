# Nature Unisex Salon — Management System

Internal, production-grade operations platform for **Nature Unisex Salon**
(Sahakar Nagar Branch, New Branch, and future branches). Billing, customers,
memberships, coupons, discounts, reporting and exports — everything wired to a
real PostgreSQL database. No mock data, no placeholders.

> Owner (Admin) and Staff/Receptionist roles. Internal only — no public portal,
> no customer login, no online booking.

---

## Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Framework    | Next.js 15 (App Router) + TypeScript              |
| UI           | Tailwind CSS + shadcn-style components            |
| Backend      | Next.js Server Actions + Route Handlers           |
| Database     | PostgreSQL (Supabase) via Prisma (pg adapter)     |
| Auth         | Supabase Auth (email/password, RBAC)              |
| Storage      | Supabase Storage (invoices + logo)                |
| Charts       | Recharts                                          |
| Validation   | Zod                                               |
| PDF / Excel  | pdf-lib / ExcelJS                                 |
| Deployment   | Cloudflare Pages + Supabase                       |

### Money is stored in **paise** (integers)

Every monetary column is an integer number of paise (₹1 = 100 paise) to avoid
floating-point drift. Convert at the edges with `src/lib/money.ts`.

---

## Project structure

```
nature-salon/
├─ prisma/
│  ├─ schema.prisma          # Full schema: models, enums, indexes, relations
│  └─ seed.ts                # Branches, services, plans, owner admin
├─ supabase/
│  └─ migrations/
│     └─ 0001_security_and_functions.sql  # RLS, auth trigger, invoice-seq fn
├─ src/
│  ├─ app/
│  │  ├─ (app)/              # Authenticated area (sidebar shell)
│  │  │  ├─ dashboard/       # Admin + staff dashboards
│  │  │  ├─ billing/         # Bill builder
│  │  │  ├─ customers/       # List + profile (visit/membership/invoice history)
│  │  │  ├─ invoices/[id]/   # Invoice view + PDF link + void
│  │  │  ├─ memberships/     # Plans + issued memberships + sell
│  │  │  ├─ services/        # Service catalogue
│  │  │  ├─ coupons/         # Coupon management
│  │  │  ├─ branches/        # Branch management
│  │  │  ├─ staff/           # Staff/admin logins
│  │  │  ├─ reports/         # Reports + exports
│  │  │  └─ settings/        # Salon profile, GST, logo
│  │  ├─ api/
│  │  │  ├─ invoices/[id]/pdf/  # Generate + store invoice PDF
│  │  │  ├─ export/[type]/      # CSV / XLSX exports
│  │  │  └─ health/             # DB liveness probe
│  │  └─ login/              # Auth screen
│  ├─ components/            # UI primitives + feature components
│  ├─ lib/                   # prisma, supabase, auth, money, engines, validation
│  └─ server/
│     ├─ actions/            # All mutations (Server Actions)
│     └─ queries/            # Read models for pages/exports
└─ middleware.ts             # Session refresh + route guard
```

### Business engines

- **`src/lib/membership-engine.ts`** — issues wallet/unlimited memberships,
  redeems wallet value (writing an immutable ledger row per movement), records
  unlimited-benefit usage, and lazily expires memberships.
- **`src/lib/billing-engine.ts`** — pure pricing calculator. The exact same
  function runs on the client (live preview) and is re-validated on the server,
  so what staff see is what gets saved.

### Data-integrity guarantees

- **Invoices snapshot** service name + price and the customer's name + phone, so
  re-pricing or renaming a service never alters historical bills.
- **Soft delete** everywhere (`deletedAt`). Customers, invoices and memberships
  are never hard-deleted.
- **Audit log** (`audit_logs`) records every mutating action with actor + diff.
- **Gapless invoice numbers** per branch+year via the `next_invoice_seq()` DB
  function (safe under concurrency).
- Every booking is wrapped in a **single DB transaction** — partial bills can
  never persist.

---

## Local setup

### 1. Create a Supabase project
Grab these from **Project Settings → API / Database**:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, and the pooled + direct connection strings.

### 2. Configure env
```bash
cp .env.example .env   # then fill in the values
```

### 3. Install + generate
```bash
npm install
npm run prisma:generate
```

### 4. Create the schema, then the security layer
```bash
npm run prisma:deploy          # creates all tables (prisma migrate deploy)
# Then run supabase/migrations/0001_security_and_functions.sql in the
# Supabase SQL editor (RLS policies, auth trigger, invoice-seq function,
# storage bucket). Run it AFTER the tables exist.
```

> First time on a fresh DB you can use `npm run prisma:migrate` to create and
> apply an initial migration locally.

### 5. Seed (branches, services, plans, owner login)
```bash
ADMIN_EMAIL="owner@natureunisexsalon.com" ADMIN_PASSWORD="change-me-now" npm run db:seed
```

### 6. Run
```bash
npm run dev      # http://localhost:3000  → redirects to /login
```

Sign in with the owner credentials from step 5. Create staff logins under
**Staff**, branches under **Branches**, services under **Services**, etc.

---

## Modules at a glance

| Module        | What works                                                            |
| ------------- | -------------------------------------------------------------------- |
| Auth          | Supabase email/password, role-based routing, disabled-account block  |
| Dashboard     | Admin KPIs (revenue, memberships, top staff/services, coupon/discount) + 30-day chart; staff quick-bill + lookup |
| Branches      | Create / edit / disable (code feeds invoice numbers)                 |
| Customers     | Register, edit, search (name/phone/code/membership #), full profile  |
| Services      | Create / edit / reprice / disable, with categories                   |
| Memberships   | Wallet (Type A) + Unlimited (Type B) plans; sell; ledger; usage      |
| Coupons       | Fixed-amount, expiry, usage limits, min-bill, live validation        |
| Discounts     | Per-line + bill-level, with reason + staff, fully tracked            |
| Billing       | Full bill builder → invoice → payment → visit; void w/ wallet refund |
| Invoices      | View + **PDF** (stored in Supabase Storage, URL persisted)           |
| Reports       | Branch/staff/service/payment/membership summaries                    |
| Exports       | CSV **and** Excel for customers, invoices, memberships, revenue, staff |
| Settings      | Salon name, GST, invoice prefix, logo upload, address, WhatsApp, GST% |

---

## Membership mechanics

**Type A — Wallet** (e.g. pay ₹20,000, get ₹25,000): purchase + bonus credited
to a balance. Each redemption on a bill writes a `DEBIT` ledger row and reduces
`remainingValue`; voiding a bill writes a `REFUND` credit. Status flips to
`EXHAUSTED` at zero, `EXPIRED` past validity.

**Type B — Unlimited** (e.g. ₹2,000 unlimited haircut, 1 year): the haircut
still appears on the invoice, but the line is marked as a membership benefit
(₹0 charged) and `usageCount` / `valueConsumed` are tracked separately.

---

## Deployment (Cloudflare Pages + Supabase)

1. Push tables (`prisma migrate deploy`) and run the SQL security migration on
   your production Supabase project.
2. Set the environment variables (see `wrangler.toml`) in the Cloudflare Pages
   project. Use the **pooled** `DATABASE_URL` (port 6543) at runtime.
3. Build + deploy:
   ```bash
   npm run pages:deploy
   ```
   (`@cloudflare/next-on-pages` builds; `wrangler pages deploy` ships it.)
4. Point your domain at the Pages project.

Health check: `GET /api/health` returns `{ "status": "ok" }` when the DB is
reachable.

---

## Security notes

- Server Actions enforce authorization (`assertUser` / `assertAdmin`) — admin
  actions reject non-admins server-side, not just in the UI.
- RLS is enabled on every table as defence-in-depth; the app accesses Postgres
  through the pooled connection and authorizes in the action layer.
- The Supabase **service-role key** is used only on the server (staff creation,
  storage uploads) and is never sent to the browser.
