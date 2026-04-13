/**
 * POST /api/payments/create-order
 *
 * Creates a Razorpay order server-side before opening the payment modal.
 * The frontend calls this, gets an order_id, then opens the Razorpay modal.
 *
 * Razorpay requires the order to be created on the server so the amount
 * cannot be tampered with by the browser.
 *
 * Request body:
 *   { amount: number }  ← grand total in INR (converted to paise here)
 *
 * Response:
 *   { data: { order_id, amount, currency, key_id }, error: null }
 */

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { verifyAuth } from '@/lib/auth/verify';

// Initialise the Razorpay instance with server-side credentials
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

/**
 * Creates a Razorpay order for the given INR amount.
 * Only authenticated buyers can call this route.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── Step 1: Auth check ─────────────────────────────────────────────────
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 },
      );
    }

    if (user.role !== 'buyer') {
      return NextResponse.json(
        { data: null, error: 'Only buyers can place orders' },
        { status: 403 },
      );
    }

    // ── Step 2: Validate amount ────────────────────────────────────────────
    const body = (await request.json()) as { amount: number };
    const { amount } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { data: null, error: 'Invalid amount' },
        { status: 400 },
      );
    }

    // Razorpay requires amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    // ── Step 3: Create Razorpay order ──────────────────────────────────────
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `ps-${user.id.slice(0, 8)}-${Date.now()}`,
    });

    console.log('[PAYMENTS/CREATE-ORDER] Razorpay order created:', order.id);

    return NextResponse.json({
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID,
      },
      error: null,
    });
  } catch (error) {
    console.error('[PAYMENTS/CREATE-ORDER] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Failed to create payment order' },
      { status: 500 },
    );
  }
}
