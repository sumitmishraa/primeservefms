/**
 * POST /api/auth/reset-password
 *
 * Verifies a Firebase phone OTP ID token, then updates the matching
 * Supabase user's bcrypt password hash.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getFirebaseAuth } from '@/lib/firebase/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resetPasswordSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: z.infer<typeof resetPasswordSchema>;
    try {
      const raw: unknown = await request.json();
      const parsed = resetPasswordSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
          { status: 400 }
        );
      }
      body = parsed.data;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const firebaseAuth = getFirebaseAuth();
    if (!firebaseAuth) {
      console.error('[RESET_PASSWORD] Firebase Admin not initialized');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await firebaseAuth.verifyIdToken(body.idToken);
    } catch (err) {
      console.error('[RESET_PASSWORD] Invalid Firebase token:', err);
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please request a new one.' },
        { status: 401 }
      );
    }

    const firebasePhone = decodedToken.phone_number ?? null;
    if (!firebasePhone) {
      return NextResponse.json(
        { error: 'Verified token does not include a mobile number.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('phone', firebasePhone)
      .maybeSingle();

    if (lookupError) {
      console.error('[RESET_PASSWORD] DB lookup error:', lookupError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'No active account found with this mobile number.' },
        { status: 404 }
      );
    }

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact support.' },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(body.password, await bcrypt.genSalt(12));
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    if (updateError) {
      console.error('[RESET_PASSWORD] update error:', updateError);
      return NextResponse.json({ error: 'Could not update password.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[RESET_PASSWORD] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
