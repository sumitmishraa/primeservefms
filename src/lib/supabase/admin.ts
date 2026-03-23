import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Creates a Supabase client using the service role key.
 *
 * IMPORTANT — SERVER-SIDE ONLY. Never import this in Client Components.
 * This key BYPASSES Row Level Security. Only use it for:
 *   - Admin operations (approving vendors, resolving disputes)
 *   - Webhook handlers that need to write on behalf of users
 *   - Background jobs / cron tasks
 *
 * Usage (API route only):
 *   const supabase = createAdminClient();
 *   const { data } = await supabase.from("users").select("*");
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
