/**
 * POST /api/auth/register
 *
 * ⚠️  TEMPORARY — Firebase auth is bypassed.
 * Registers a new buyer account directly in Supabase without any Firebase
 * token verification. A random UUID is used as the firebase_uid placeholder.
 *
 * TODO: Re-enable Firebase Phone OTP verification when auth is set up.
 *
 * Flow:
 *   1. Validate request body with Zod (400 on failure)
 *   2. Require terms_accepted === true
 *   3. Check for duplicate email or phone in Supabase (409 if found)
 *   4. Insert user row — role is always 'buyer'
 *   5. Create session cookie
 *   6. Return { user, message }
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSession } from "@/lib/auth/session";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Validation schema ────────────────────────────────────────────────────────

const registerSchema = z.object({
  full_name: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),
  email: z.string().email("Please enter a valid email address"),
  /** E.164 format: +91XXXXXXXXXX */
  phone: z
    .string()
    .regex(/^\+91[0-9]{10}$/, "Phone must be in +91XXXXXXXXXX format"),
  company_name: z.string().max(100).optional(),
  newsletter_opt_in: z.boolean(),
  terms_accepted: z.boolean(),
});

type RegisterBody = z.infer<typeof registerSchema>;

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Creates a new buyer account, sets a session cookie, and returns the user.
 * All new registrations receive role='buyer' regardless of what is sent.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("[REGISTER] Request received");
  try {
    // ── 1. Parse and validate ────────────────────────────────────────────────
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

    const { full_name, email, phone, company_name, terms_accepted } = body;

    // ── 2. Terms must be accepted ────────────────────────────────────────────
    if (!terms_accepted) {
      return NextResponse.json(
        { error: "You must accept the Terms & Conditions" },
        { status: 400 }
      );
    }

    // ── 3. Check for duplicates ──────────────────────────────────────────────
    const supabase = createAdminClient();

    const { data: duplicateByEmail } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (duplicateByEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please login instead." },
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
        { error: "This phone number is already registered. Please login instead." },
        { status: 409 }
      );
    }

    // ── 4. Insert new user — role is ALWAYS 'buyer' ──────────────────────────
    console.log("[REGISTER] Creating user in Supabase...");
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        // Placeholder — replaced with real Firebase UID when auth is enabled
        firebase_uid: randomUUID(),
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

    console.log("[REGISTER] User created:", newUser.id, email);

    // ── 5. Create session and return ─────────────────────────────────────────
    const response = NextResponse.json(
      {
        user: {
          id:                newUser.id,
          role:              newUser.role,
          full_name:         newUser.full_name,
          email:             newUser.email,
          phone:             newUser.phone,
          company_name:      newUser.company_name,
          business_verified: newUser.business_verified,
        },
        message: "Registration successful",
      },
      { status: 201 }
    );

    createSession(response, newUser.id, newUser.role);
    return response;
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("[REGISTER] Error:", err?.message);
    return NextResponse.json(
      { error: "Registration failed: " + (err?.message ?? "Unknown error") },
      { status: 500 }
    );
  }
}
