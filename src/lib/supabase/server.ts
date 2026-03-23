import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and API Route Handlers.
 *
 * Automatically reads and writes auth session cookies via Next.js headers.
 * Subject to Row Level Security — the logged-in user's permissions apply.
 *
 * Usage (Server Component or API route):
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("products").select("*");
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies cannot be
            // mutated here, but the session will still be read correctly.
          }
        },
      },
    }
  );
}
