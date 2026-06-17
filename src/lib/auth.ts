import { cache } from "react";
import { redirect } from "next/navigation";
import type { User as DbUser } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = DbUser;

/**
 * Resolve the current app user (Supabase auth identity joined to our
 * public.users row). Memoized per request via React cache().
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let dbUser = await prisma.user.findFirst({
    where: { id: user.id, deletedAt: null },
  });

  // Defensive self-heal: an authenticated identity with no profile row (e.g.
  // the auth->users trigger was never installed, or the user was created
  // straight in the Supabase dashboard) would otherwise loop /login <-> /dashboard.
  // Provision a STAFF profile from auth metadata so the session resolves.
  if (!dbUser) {
    const meta = (user.user_metadata ?? {}) as { full_name?: string; role?: string };
    const role = meta.role === "ADMIN" ? "ADMIN" : "STAFF";
    dbUser = await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? `${user.id}@unknown.local`,
        fullName: meta.full_name || user.email || "User",
        role,
        status: "ACTIVE",
      },
      update: {},
    });
  }

  if (dbUser.deletedAt || dbUser.status === "DISABLED") return null;
  return dbUser;
});

/** Require any authenticated, active user. Redirects to /login otherwise. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require an admin user. Redirects non-admins to the dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Guard helper for server actions — throws instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
