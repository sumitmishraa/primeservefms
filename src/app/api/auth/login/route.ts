/**
 * POST /api/auth/login
 *
 * Email + password login — no Firebase involved.
 *
 * Flow:
 *   1. Validate body: { email, password }
 *   2. Look up user by email in Supabase
 *   3. Check account is active
 *   4. Compare password against bcrypt hash
 *   5. Create session cookie
 *   6. Return { user }
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface LoginBody {
  email:    string;
  password: string;
}

/**
 * Authenticates an existing user via email + bcrypt password comparison.
 * Sets an httpOnly session cookie on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse body
    let body: LoginBody;
    try {
      body = (await request.json()) as LoginBody;
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const { email, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // 2. Look up user by email
    const supabase = createAdminClient();
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (lookupError) {
      console.error('[LOGIN] DB lookup error:', lookupError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email. Please register first.', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // 3. Check account active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact support.', code: 'ACCOUNT_DEACTIVATED' },
        { status: 403 }
      );
    }

    // 4. Verify password
    if (!user.password_hash) {
      console.warn('[LOGIN] No password_hash for user:', user.email, 'role:', user.role);
      return NextResponse.json(
        {
          error:
            'This account was created via phone OTP and has no password set. ' +
            'Please sign in with the OTP option, or contact support to add a password.',
          code: 'NO_PASSWORD',
        },
        { status: 401 }
      );
    }

    // Sanity-check the stored hash format. bcrypt hashes always start with
    // $2a$ / $2b$ / $2y$ — if it's anything else the row was corrupted /
    // double-hashed / inserted manually with raw text. Surface it loudly so
    // we can fix the data instead of telling the user "wrong password".
    const hashPrefix = user.password_hash.slice(0, 4);
    const looksLikeBcrypt = /^\$2[aby]\$/.test(user.password_hash);
    if (!looksLikeBcrypt) {
      console.error(
        '[LOGIN] Stored password_hash for',
        user.email,
        'is not a bcrypt hash. prefix:',
        hashPrefix,
        'length:',
        user.password_hash.length
      );
      return NextResponse.json(
        {
          error:
            'Your password is stored in an unexpected format. Please reset your password or contact support.',
          code: 'HASH_FORMAT_ERROR',
        },
        { status: 500 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      // Log the failure server-side (without leaking the password) so we can
      // distinguish "user typed wrong password" from "everyone is failing"
      // in Vercel logs.
      console.warn('[LOGIN] bcrypt.compare returned false for', user.email);
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    console.log('[LOGIN] User authenticated:', user.email, 'role:', user.role);

    // 5. Session + response
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
    console.error('[LOGIN] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
