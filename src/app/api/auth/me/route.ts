/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's full profile.
 * Used by the frontend on initial load to restore auth state.
 *
 * Flow:
 *   1. Verify the 'ps-session' cookie via verifyAuth()
 *   2. Return the full user profile (excluding firebase_uid)
 *   3. Return 401 if not authenticated
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";

/**
 * Returns the authenticated user's profile from a fresh Supabase lookup.
 * Excludes `firebase_uid` — that's an internal field, not for the frontend.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Return full profile, excluding the internal firebase_uid field
    const {
      firebase_uid: _firebaseUid,
      ...publicProfile
    } = user;

    return NextResponse.json(
      { user: publicProfile },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ME] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
