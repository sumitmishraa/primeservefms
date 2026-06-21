/**
 * POST /api/webhooks
 *
 * Generic webhook receiver. Every inbound request must carry a valid
 * HMAC-SHA256 signature in the `X-Webhook-Signature` header, computed
 * over the raw request body using the WEBHOOK_SECRET environment variable.
 *
 * Unauthenticated requests are rejected with 401 — no payload is processed.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SIGNATURE_HEADER = 'x-webhook-signature';

function signaturesMatch(expected: string, provided: string): boolean {
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhooks] WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook service not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const providedSig = request.headers.get(SIGNATURE_HEADER) ?? '';

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex');

  if (!providedSig || !signaturesMatch(expectedSig, providedSig)) {
    console.warn('[webhooks] Signature verification failed');
    return NextResponse.json({ error: 'Unauthorized — invalid webhook signature' }, { status: 401 });
  }

  // Signature verified — parse and handle the payload
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  console.log('[webhooks] Verified webhook received:', typeof payload === 'object' && payload !== null
    ? Object.keys(payload as Record<string, unknown>)
    : '(non-object)');

  // TODO: route to the appropriate handler based on payload.event or similar
  return NextResponse.json({ received: true });
}
