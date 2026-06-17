-- ════════════════════════════════════════════════════════════════════
--  Nature Unisex Salon — Supabase security layer & helper functions
--  Run AFTER `prisma migrate deploy` has created the tables.
--  (Prisma owns the table DDL; this file owns RLS, triggers, storage,
--   and the atomic invoice-number generator.)
-- ════════════════════════════════════════════════════════════════════

-- ───────────────────────── helper: current user role ─────────────────────────
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.users where id = auth.uid() and "deletedAt" is null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'ADMIN', false);
$$;

-- ───────────────────────── sync auth.users -> public.users ─────────────────────────
-- When a new auth user is created, mirror them into public.users.
-- Role + branch default to STAFF / null and are managed by an admin afterwards.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, "fullName", role, status, "createdAt", "updatedAt")
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public."UserRole", 'STAFF'),
    'ACTIVE',
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep email in sync if it changes in auth.
create or replace function public.handle_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users set email = new.email, "updatedAt" = now() where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email on auth.users
  for each row execute function public.handle_auth_user_update();

-- ───────────────────────── atomic invoice number ─────────────────────────
-- Returns the next sequence for a branch+period, incrementing safely under
-- concurrency. The caller formats it into the final invoice number.
create or replace function public.next_invoice_seq(p_branch_id uuid, p_period text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into public.invoice_counters (id, "branchId", period, "lastSeq")
  values (gen_random_uuid(), p_branch_id, p_period, 1)
  on conflict ("branchId", period)
  do update set "lastSeq" = public.invoice_counters."lastSeq" + 1
  returning "lastSeq" into v_seq;
  return v_seq;
end;
$$;

-- ════════════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
--  The app talks to Postgres through Prisma using the service role
--  connection, so server-side mutations bypass RLS by design (all
--  authorization is enforced in server actions). RLS below is a
--  defence-in-depth layer for any client that uses the anon/auth key
--  directly (e.g. Supabase JS in the browser).
-- ════════════════════════════════════════════════════════════════════

alter table public.users                 enable row level security;
alter table public.branches              enable row level security;
alter table public.customers             enable row level security;
alter table public.service_categories    enable row level security;
alter table public.services              enable row level security;
alter table public.membership_plans      enable row level security;
alter table public.customer_memberships  enable row level security;
alter table public.membership_ledger     enable row level security;
alter table public.coupons               enable row level security;
alter table public.coupon_redemptions    enable row level security;
alter table public.invoices              enable row level security;
alter table public.invoice_items         enable row level security;
alter table public.payments              enable row level security;
alter table public.invoice_discounts     enable row level security;
alter table public.invoice_counters      enable row level security;
alter table public.visits                enable row level security;
alter table public.settings              enable row level security;
alter table public.audit_logs            enable row level security;

-- Authenticated users may READ operational data. Mutations go through
-- server actions (service role), so we only grant SELECT to authenticated.
do $$
declare t text;
begin
  foreach t in array array[
    'branches','customers','service_categories','services','membership_plans',
    'customer_memberships','membership_ledger','coupons','coupon_redemptions',
    'invoices','invoice_items','payments','invoice_discounts','visits','settings'
  ]
  loop
    execute format($f$
      drop policy if exists "auth_read_%1$s" on public.%1$I;
      create policy "auth_read_%1$s" on public.%1$I
        for select to authenticated using (true);
    $f$, t);
  end loop;
end $$;

-- A user can read their own profile; admins can read all profiles.
drop policy if exists "users_self_or_admin_read" on public.users;
create policy "users_self_or_admin_read" on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Audit logs: admin read only.
drop policy if exists "audit_admin_read" on public.audit_logs;
create policy "audit_admin_read" on public.audit_logs
  for select to authenticated using (public.is_admin());

-- ───────────────────────── storage bucket ─────────────────────────
insert into storage.buckets (id, name, public)
values ('salon-assets', 'salon-assets', true)
on conflict (id) do nothing;

drop policy if exists "salon_assets_auth_read" on storage.objects;
create policy "salon_assets_auth_read" on storage.objects
  for select to authenticated using (bucket_id = 'salon-assets');

drop policy if exists "salon_assets_auth_write" on storage.objects;
create policy "salon_assets_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'salon-assets');
