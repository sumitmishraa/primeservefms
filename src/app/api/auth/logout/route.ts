/**
 * POST /api/auth/logout
 *
 * Ends the current user's server session by clearing the 'ps-session' cookie.
 * Always succeeds, even if the user is already logged out.
 *
 * NOTE: Firebase sign-out must be handled separately on the client side
 * by calling `signOut(auth)` from 'firebase/auth'.
 */

import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

/**
 * Clears the session cookie and returns a success response.
 * The response body is `{ success: true, message: "Logged out successfully" }`.
 */
export async function POST(): Promise<NextResponse> {
  try {
    return destroySession();
  } catch (error) {
    console.error("[LOGOUT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
