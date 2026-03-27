/**
 * POST /api/auth/verify
 *
 * Verifies a Firebase ID token (from phone OTP or email sign-in),
 * then finds or creates the user in Supabase and sets a session cookie.
 *
 * Used by:
 *   • Phone OTP login  — after confirming OTP, Firebase issues an ID token
 *   • Phone OTP register — after phone verification, we look up the phone
 *
 * Body:
 *   { idToken: string }                    — phone OTP login
 *   { idToken: string, mode: "register",   — new account via phone OTP
 *     full_name: string, email?: string,
 *     company_name?: string }
 *
 * Flow:
 *   1. Verify idToken with Firebase Admin
 *   2. Extract phone_number (or email) from the decoded token
 *   3. If mode === "register": create new user row in Supabase
 *   4. Else: look up existing user by phone; 404 if not found
 *   5. Create session cookie + return user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getFirebaseAuth } from '@/lib/firebase/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Validation ───────────────────────────────────────────────────────────────

const verifySchema = z.object({
  idToken:      z.string().min(1, 'idToken is required'),
  mode:         z.enum(['login', 'register']).optional().default('login'),
  full_name:    z.string().min(2).max(100).optional(),
  email:        z.string().email().optional(),
  company_name: z.string().max(100).optional(),
});

type VerifyBody = z.infer<typeof verifySchema>;

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Verifies a Firebase phone OTP ID token and sets a Primeserve session cookie.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse + validate body
    let body: VerifyBody;
    try {
      const raw: unknown = await request.json();
      const result = verifySchema.safeParse(raw);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error.issues[0]?.message ?? 'Invalid request' },
          { status: 400 }
        );
      }
      body = result.data;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { idToken, mode, full_name, email, company_name } = body;

    // 2. Verify Firebase token
    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      console.error('[VERIFY] Firebase Admin not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(idToken);
    } catch (err) {
      console.error('[VERIFY] Invalid Firebase token:', err);
      return NextResponse.json({ error: 'Invalid or expired verification token.' }, { status: 401 });
    }

    // Extract phone number from Firebase token (E.164 format: +91XXXXXXXXXX)
    const firebasePhone = decodedToken.phone_number ?? null;
    const firebaseEmail = decodedToken.email ?? null;
    const firebaseUid   = decodedToken.uid;

    if (!firebasePhone && !firebaseEmail) {
      return NextResponse.json(
        { error: 'Token does not contain a phone number or email.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ── REGISTER mode: create a new user ─────────────────────────────────────
    if (mode === 'register') {
      if (!full_name) {
        return NextResponse.json({ error: 'full_name is required for registration.' }, { status: 400 });
      }

      // Check for existing account with this phone
      if (firebasePhone) {
        const { data: existing } = await supabase
          .from('users')
          .select('id, email')
          .eq('phone', firebasePhone)
          .maybeSingle();

        if (existing) {
          return NextResponse.json(
            { error: 'An account with this phone number already exists. Please login instead.' },
            { status: 409 }
          );
        }
      }

      // Check for existing account with this email (if provided)
      if (email) {
        const { data: existingEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase().trim())
          .maybeSingle();

        if (existingEmail) {
          return NextResponse.json(
            { error: 'An account with this email already exists. Please login instead.' },
            { status: 409 }
          );
        }
      }

      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          firebase_uid:      firebaseUid,
          role:              'buyer',
          email:             email?.toLowerCase().trim() ?? null,
          phone:             firebasePhone,
          full_name:         full_name.trim(),
          company_name:      company_name?.trim() ?? null,
          business_verified: false,
          is_active:         true,
        })
        .select()
        .single();

      if (insertError || !newUser) {
        console.error('[VERIFY] Insert error:', insertError);
        return NextResponse.json(
          { error: 'Failed to create account. Please try again.' },
          { status: 500 }
        );
      }

      console.log('[VERIFY/REGISTER] New user created:', newUser.id, firebasePhone);

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
          message: 'Registration successful',
        },
        { status: 201 }
      );
      createSession(response, newUser.id, newUser.role);
      return response;
    }

    // ── LOGIN mode: find existing user ────────────────────────────────────────
    let lookupQuery = supabase.from('users').select('*');

    if (firebasePhone) {
      lookupQuery = lookupQuery.eq('phone', firebasePhone);
    } else if (firebaseEmail) {
      lookupQuery = lookupQuery.eq('email', firebaseEmail.toLowerCase());
    }

    const { data: user, error: lookupError } = await lookupQuery.maybeSingle();

    if (lookupError) {
      console.error('[VERIFY/LOGIN] DB error:', lookupError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        {
          error: 'No account found with this phone number. Please register first.',
          code:  'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact support.', code: 'ACCOUNT_DEACTIVATED' },
        { status: 403 }
      );
    }

    console.log('[VERIFY/LOGIN] User authenticated:', user.phone ?? user.email, 'role:', user.role);

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
    console.error('[VERIFY] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
