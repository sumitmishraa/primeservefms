/**
 * POST /api/newsletter
 *
 * Public endpoint for the PublicFooter newsletter signup.
 * Idempotent — a duplicate email returns ok without erroring out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const newsletterSchema = z.object({
  email:  z.string().trim().email('Please enter a valid email address').max(200),
  source: z.string().trim().max(50).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = newsletterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const email = parsed.data.email.toLowerCase();
    const source = parsed.data.source ?? 'footer';

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert({ email, source });

    // 23505 = unique_violation — treat as success (already subscribed)
    if (error?.code === '23505') {
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }

    if (error) {
      console.error('[api/newsletter POST] insert error:', error);
      return NextResponse.json({ error: 'Could not subscribe. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, alreadySubscribed: false });
  } catch (error) {
    console.error('[api/newsletter POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
