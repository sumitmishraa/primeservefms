/**
 * POST /api/auth/login
 *
 * ⚠️  TEMPORARY — Firebase auth is bypassed.
 * Looks up the user by email directly in Supabase.
 * No password is verified (passwords are stored in Firebase, not Supabase).
 *
 * TODO: Re-enable Firebase token verification when auth is set up.
 *
 * Flow:
 *   1. Accept { email } in request body
 *   2. Look up user in Supabase by email
 *      → 404 if not found
 *      → 403 if deactivated
 *   3. Create session cookie
 *   4. Return { user }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface LoginBody {
  email: string;
  /** Accepted but not verified yet — Firebase handles this when auth is enabled */
  password?: string;
}

/**
 * Logs in an existing user by email and sets the httpOnly session cookie.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: LoginBody;
    try {
      body = (await request.json()) as LoginBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "email is required" },
        { status: 400 }
      );
    }

    // ── Look up user by email ────────────────────────────────────────────────
    const supabase = createAdminClient();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (lookupError) {
      console.error("[LOGIN] DB lookup error:", lookupError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email. Please register first.", code: "USER_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Contact support.", code: "ACCOUNT_DEACTIVATED" },
        { status: 403 }
      );
    }

    console.log("[LOGIN] User logged in:", user.email, "role:", user.role);

    // ── Create session cookie and return ─────────────────────────────────────
    const response = NextResponse.json(
      {
        user: {
          id:                user.id,
          role:              user.role,
          full_name:         user.full_name,
          email:             user.email,
          phone:             user.phone,
          company_name:      user.company_name,
          business_verified: user.business_verified,
        },
      },
      { status: 200 }
    );

    createSession(response, user.id, user.role);
    return response;
  } catch (error) {
    console.error("[LOGIN] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
