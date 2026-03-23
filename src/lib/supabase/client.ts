import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use in Client Components (browser-side).
 *
 * Uses the public anon key — safe to expose in the browser.
 * Subject to Row Level Security policies defined in Supabase.
 *
 * Usage:
 *   "use client";
 *   const supabase = createClient();
 *   const { data } = await supabase.from("products").select("*");
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
