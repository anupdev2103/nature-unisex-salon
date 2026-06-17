"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActionResult, ok, parse, fail } from "@/lib/action";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export async function signIn(input: unknown): Promise<ActionResult<{ ok: true }>> {
  const p = parse(loginSchema, input);
  if (!p.success) return p.result;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: p.data.email,
    password: p.data.password,
  });
  if (error) return fail("Invalid email or password");
  return ok({ ok: true });
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
