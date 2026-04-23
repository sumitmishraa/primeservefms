/**
 * POST /api/contact
 *
 * Public endpoint for the /contact page form.
 * Stores the message in `contact_messages` so admins can review later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const contactSchema = z.object({
  name:    z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email:   z.string().trim().email('Please enter a valid email address').max(200),
  message: z.string().trim().min(5, 'Message must be at least 5 characters').max(5000),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('contact_messages').insert({
      name:    parsed.data.name,
      email:   parsed.data.email.toLowerCase(),
      message: parsed.data.message,
      source:  'website',
    });

    if (error) {
      console.error('[api/contact POST] insert error:', error);
      return NextResponse.json({ error: 'Could not save your message. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/contact POST]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
