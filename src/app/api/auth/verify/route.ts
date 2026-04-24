/**
 * POST /api/auth/verify
 *
 * Verifies a Firebase phone OTP ID token, then creates or finds a user
 * in Supabase and sets an httpOnly session cookie.
 *
 * Used by:
 *   • Phone OTP login     — { idToken }
 *   • Phone OTP register  — { idToken, mode:"register", full_name, email?, company_name?, password? }
 *
 * Register flow:
 *   1. Verify Firebase token → extract phone number
 *   2. Check for duplicate phone/email
 *   3. Hash password with bcrypt (if provided)
 *   4. Insert user row in Supabase
 *   5. Set session cookie → return user profile
 *
 * Login flow:
 *   1. Verify Firebase token → extract phone number
 *   2. Look up user by phone — 404 if not found
 *   3. Set session cookie → return user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
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
  email:        z.string().email().optional().or(z.literal('')),
  company_name: z.string().max(100).optional(),
  /** Optional password — if provided, hashed and stored for email+password login later */
  password:     z.string().min(6).optional(),
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

    const { idToken, mode, full_name, email, company_name, password } = body;

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
      return NextResponse.json(
        { error: 'Invalid or expired verification code. Please request a new OTP.' },
        { status: 401 }
      );
    }

    const firebasePhone = decodedToken.phone_number ?? null;
    const firebaseUid   = decodedToken.uid;

    if (!firebasePhone) {
      return NextResponse.json(
        { error: 'Token does not contain a phone number.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ── REGISTER mode ─────────────────────────────────────────────────────────
    if (mode === 'register') {
      if (!full_name) {
        return NextResponse.json(
          { error: 'Full name is required for registration.' },
          { status: 400 }
        );
      }

      // Duplicate phone check
      const { data: existingPhone } = await supabase
        .from('users')
        .select('id')
        .eq('phone', firebasePhone)
        .maybeSingle();

      if (existingPhone) {
        return NextResponse.json(
          { error: 'An account with this phone number already exists. Please login instead.' },
          { status: 409 }
        );
      }

      // Duplicate email check (only if email was provided)
      const cleanEmail = email?.trim() || null;
      if (cleanEmail) {
        const { data: existingEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', cleanEmail.toLowerCase())
          .maybeSingle();

        if (existingEmail) {
          return NextResponse.json(
            { error: 'An account with this email already exists. Please login instead.' },
            { status: 409 }
          );
        }
      }

      // Hash password if provided. The OTP register flow accepts an optional
      // password — if the user fills the password field on the register page
      // we hash + store it so they can later log in with email + password.
      // If they skip it, password_hash stays null and email/password login
      // for this account will return code='NO_PASSWORD' with a helpful
      // "use OTP instead" message.
      let password_hash: string | null = null;
      if (password) {
        const salt = await bcrypt.genSalt(12);
        password_hash = await bcrypt.hash(password, salt);
        console.log(
          '[VERIFY/REGISTER] bcrypt hash generated for',
          firebasePhone,
          '— prefix:',
          password_hash.slice(0, 7),
          'length:',
          password_hash.length,
          'looksValid:',
          /^\$2[aby]\$/.test(password_hash)
        );
      } else {
        console.log(
          '[VERIFY/REGISTER] No password provided for',
          firebasePhone,
          '— password_hash will be NULL; email/password login disabled for this account'
        );
      }

      // Insert new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          firebase_uid:      firebaseUid,
          role:              'buyer',
          email:             cleanEmail ? cleanEmail.toLowerCase() : null,
          phone:             firebasePhone,
          full_name:         full_name.trim(),
          company_name:      company_name?.trim() ?? null,
          password_hash,
          business_verified: false,
          is_active:         true,
        })
        .select()
        .single();

      if (insertError || !newUser) {
        console.error('[VERIFY/REGISTER] Insert error:', insertError);
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

    // ── LOGIN mode ────────────────────────────────────────────────────────────
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('*')
      .eq('phone', firebasePhone)
      .maybeSingle();

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

    console.log('[VERIFY/LOGIN] Authenticated:', user.phone, 'role:', user.role);

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
