import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client for client components (login form, etc.). */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
