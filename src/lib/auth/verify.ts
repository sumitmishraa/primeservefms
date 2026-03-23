/**
 * Auth verification helper — SERVER-SIDE ONLY.
 *
 * verifyAuth() is the single function every protected API route calls first.
 * It reads the 'ps-session' cookie, verifies the HMAC signature, then fetches
 * the full user row from Supabase to ensure the account is still active.
 *
 * Also re-exports the session token helpers for routes that need them directly
 * (e.g. login/register — which create sessions after verifying Firebase tokens).
 */

import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/types/database";

// Re-export session helpers so routes have a single import location
export { createSession, destroySession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";

// ─── Primary API ──────────────────────────────────────────────────────────────

/**
 * Verifies the incoming request's session and returns the full user profile.
 *
 * Steps:
 *   1. Read and verify the 'ps-session' cookie (HMAC check + expiry)
 *   2. Fetch the user from Supabase by the userId encoded in the cookie
 *   3. Reject deactivated accounts
 *
 * Returns `null` if the session is absent, invalid, expired, or the account
 * is deactivated. Returns the full `users` row on success.
 *
 * Usage in any protected API route:
 * ```ts
 * const user = await verifyAuth(request);
 * if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * ```
 *
 * @param request - Incoming `NextRequest` from the route handler
 * @returns Full Supabase `users` row, or `null` if not authenticated
 */
export async function verifyAuth(
  request: NextRequest
): Promise<Tables<"users"> | null> {
  const session = getSession(request);
  if (!session) return null;

  console.log("[AUTH] Verifying session for user:", session.userId);

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.userId)
      .single();

    if (error || !data) return null;
    if (!data.is_active) return null;

    return data;
  } catch (error) {
    console.error("[AUTH] verifyAuth error:", error);
    return null;
  }
}

/**
 * Alias for `verifyAuth` — kept for backward compatibility with existing routes
 * that import `getSessionUser` from this module.
 *
 * @deprecated Use `verifyAuth` instead.
 */
export const getSessionUser = verifyAuth;
