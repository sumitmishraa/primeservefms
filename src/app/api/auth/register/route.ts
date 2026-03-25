/**
 * POST /api/auth/register
 *
 * Registers a new buyer directly in Supabase — no Firebase involved.
 *
 * Flow:
 *   1. Validate body: full_name, email, phone, password, terms_accepted
 *   2. Check for duplicate email / phone
 *   3. Hash password with bcrypt (cost 12)
 *   4. Insert user row into Supabase (firebase_uid is nullable — left null)
 *   5. Create session cookie
 *   6. Return { user, message }
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Validation ───────────────────────────────────────────────────────────────

const registerSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name is too long'),
  email: z.string().email('Please enter a valid email address'),
  /** 10-digit number — +91 prefix added by the frontend */
  phone: z
    .string()
    .regex(/^\+91[0-9]{10}$/, 'Phone must be in +91XXXXXXXXXX format'),
  /** Plain-text password — will be hashed before storage */
  password: z.string().min(6, 'Password must be at least 6 characters'),
  company_name: z.string().max(100).optional(),
  newsletter_opt_in: z.boolean().optional().default(false),
  terms_accepted: z.boolean(),
});

type RegisterBody = z.infer<typeof registerSchema>;

// ─── Handler ──────────────────────────────────────────────────────────────────

/**
 * Creates a new buyer account, hashes the password with bcrypt,
 * sets a session cookie, and returns the user profile.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log('[REGISTER] Request received');
  try {
    // 1. Parse + validate
    let body: RegisterBody;
    try {
      const raw: unknown = await request.json();
      const result = registerSchema.safeParse(raw);
      if (!result.success) {
        const firstIssue = result.error.issues[0];
        return NextResponse.json(
          { error: firstIssue?.message ?? 'Invalid request body' },
          { status: 400 }
        );
      }
      body = result.data;
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }

    const { full_name, email, phone, password, company_name, terms_accepted } = body;

    // 2. Terms must be accepted
    if (!terms_accepted) {
      return NextResponse.json(
        { error: 'You must accept the Terms & Conditions' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 3. Duplicate email check
    const { data: dupEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (dupEmail) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please login instead.' },
        { status: 409 }
      );
    }

    // 4. Duplicate phone check
    const { data: dupPhone } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (dupPhone) {
      return NextResponse.json(
        { error: 'This phone number is already registered. Please login instead.' },
        { status: 409 }
      );
    }

    // 5. Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // 6. Insert user
    console.log('[REGISTER] Creating user in Supabase...');
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        firebase_uid:      null,           // nullable after migration 5
        role:              'buyer',
        email:             email.toLowerCase().trim(),
        phone,
        full_name:         full_name.trim(),
        company_name:      company_name?.trim() ?? null,
        password_hash,
        business_verified: false,
        is_active:         true,
      })
      .select()
      .single();

    if (insertError || !newUser) {
      console.error('[REGISTER] Supabase insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[REGISTER] User created:', newUser.id, email);

    // 7. Session + response
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
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('[REGISTER] Error:', err?.message, error);
    return NextResponse.json(
      { error: 'Registration failed: ' + (err?.message ?? 'Unknown error') },
      { status: 500 }
    );
  }
}
