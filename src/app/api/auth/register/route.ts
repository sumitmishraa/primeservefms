/**
 * POST /api/auth/register
 *
 * Registers a new buyer account after the browser has:
 *   1. Verified the user's phone number via Firebase OTP
 *   2. Created a Firebase account with email+password
 *   3. Linked the phone credential to that Firebase account
 *
 * Flow:
 *   1. Validate request body with Zod (400 on failure)
 *   2. Require terms_accepted === true (400 if false)
 *   3. Verify Firebase ID token → extract firebase_uid (401 on failure)
 *   4. Check for duplicate email OR phone in Supabase (409 if found)
 *   5. Insert user row — role is always 'buyer' regardless of input
 *   6. Create session cookie
 *   7. Return { user, message }
 *
 * Note: newsletter_opt_in is accepted in the request for UX purposes but
 * is not persisted until the `users` table schema includes that column.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession } from "@/lib/auth/session";

// ─── Validation schema ────────────────────────────────────────────────────────

const registerSchema = z.object({
  /** Firebase ID token obtained after creating the account on the client */
  firebase_token: z.string().min(1, "firebase_token is required"),
  /** User's full legal name */
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),
  /** Must be a valid email address */
  email: z.string().email("Please enter a valid email address"),
  /** Must match E.164 or Indian 10-digit format */
  phone: z
    .string()
    .regex(
      /^\+?[0-9]{10,15}$/,
      "Please enter a valid phone number (10–15 digits)"
    ),
  /** Optional — company or organisation name */
  company_name: z.string().max(100).optional(),
  /** Whether the user opted in to the newsletter */
  newsletter_opt_in: z.boolean(),
  /** Must be true — user must accept terms before registering */
  terms_accepted: z.boolean(),
});

type RegisterBody = z.infer<typeof registerSchema>;

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Creates a new buyer account, sets a session cookie, and returns the user.
 * All new registrations receive role='buyer' regardless of what is sent.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── 1. Parse and validate request body ──────────────────────────────────
    let body: RegisterBody;
    try {
      const raw: unknown = await request.json();
      const result = registerSchema.safeParse(raw);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        return NextResponse.json(
          { error: firstIssue?.message ?? "Invalid request body" },
          { status: 400 }
        );
      }
      body = result.data;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const { firebase_token, full_name, email, phone, company_name, terms_accepted } =
      body;

    // ── 2. Terms & Conditions must be accepted ───────────────────────────────
    if (!terms_accepted) {
      return NextResponse.json(
        { error: "You must accept the Terms & Conditions" },
        { status: 400 }
      );
    }

    // ── 3. Verify Firebase ID token ──────────────────────────────────────────
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

    const supabase = createAdminClient();

    // ── 4. Check for duplicate email OR phone ────────────────────────────────
    const { data: duplicateByEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (duplicateByEmail) {
      return NextResponse.json(
        { error: "Account already exists. Please login." },
        { status: 409 }
      );
    }

    const { data: duplicateByPhone } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (duplicateByPhone) {
      return NextResponse.json(
        { error: "Account already exists. Please login." },
        { status: 409 }
      );
    }

    // ── 5. Insert new user — role is ALWAYS 'buyer' ──────────────────────────
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        firebase_uid: firebaseUid,
        role: "buyer",
        email,
        phone,
        full_name: full_name.trim(),
        company_name: company_name ?? null,
        business_verified: false,
        is_active: true,
      })
      .select()
      .single();

    if (insertError || !newUser) {
      console.error("[REGISTER] DB insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create account. Please try again." },
        { status: 500 }
      );
    }

    console.log("[REGISTER] New buyer registered:", email);

    // ── 6. Create session and return ─────────────────────────────────────────
    const response = NextResponse.json(
      {
        user: {
          id: newUser.id,
          role: newUser.role,
          full_name: newUser.full_name,
          email: newUser.email,
          company_name: newUser.company_name,
        },
        message: "Registration successful",
      },
      { status: 201 }
    );

    createSession(response, newUser.id, newUser.role);
    return response;
  } catch (error) {
    console.error("[REGISTER] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
