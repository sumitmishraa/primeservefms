/**
 * POST /api/auth/login
 *
 * Authenticates a returning user using a Firebase ID token.
 * Supports both login methods:
 *   - Email + password  → client calls signInWithEmailAndPassword → getIdToken()
 *   - Phone OTP         → client calls signInWithPhoneNumber → verifyOtp() → getIdToken()
 *
 * Flow:
 *   1. Verify Firebase ID token → extract firebase_uid (401 on failure)
 *   2. Look up user in Supabase by firebase_uid
 *      → 404 if not found (direct user to /register)
 *      → 403 if account is deactivated
 *   3. Create session cookie
 *   4. Return { user }
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession } from "@/lib/auth/session";

// ─── Request body shape ───────────────────────────────────────────────────────

interface LoginBody {
  /** Firebase ID token — from getIdToken() after email+password or phone OTP sign-in */
  firebase_token: string;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Logs in an existing user and sets the httpOnly session cookie.
 * Returns the user's role so the client can redirect to the correct dashboard.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Parse request body ───────────────────────────────────────────────────
    let body: LoginBody;
    try {
      body = (await request.json()) as LoginBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const { firebase_token } = body;

    if (!firebase_token || typeof firebase_token !== "string") {
      return NextResponse.json(
        { error: "firebase_token is required" },
        { status: 400 }
      );
    }

    // ── 1. Verify Firebase ID token ──────────────────────────────────────────
    let firebaseUid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(firebase_token);
      firebaseUid = decoded.uid;
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired Firebase token. Please sign in again." },
        { status: 401 }
      );
    }

    // ── 2. Look up user in Supabase by firebase_uid ──────────────────────────
    const supabase = createAdminClient();
    const { data: user, error: lookupError } = await supabase
      .from("users")
      .select("*")
      .eq("firebase_uid", firebaseUid)
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
        {
          error: "Account not found. Please register first.",
          code: "USER_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        {
          error: "Your account has been deactivated. Contact support.",
          code: "ACCOUNT_DEACTIVATED",
        },
        { status: 403 }
      );
    }

    console.log("[LOGIN] User logged in:", user.email, "role:", user.role);

    // ── 3. Create session cookie and return ──────────────────────────────────
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          role: user.role,
          full_name: user.full_name,
          email: user.email,
          company_name: user.company_name,
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
