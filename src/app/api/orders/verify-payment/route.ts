/**
 * POST /api/orders/verify-payment
 *
 * Verifies Razorpay HMAC signature then marks the order as paid.
 *
 * Call this after the Razorpay modal fires its success handler.
 * If verification fails the order stays in payment_status='pending'.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

interface VerifyPaymentBody {
  order_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ success: boolean; order_number: string }>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as VerifyPaymentBody;
    const { order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { data: null, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // ── Verify Razorpay HMAC-SHA256 signature ─────────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('[api/orders/verify-payment] Signature mismatch for order', order_id);
      return NextResponse.json(
        { data: null, error: 'Payment verification failed — invalid signature' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ── Update order: mark paid + save payment id ─────────────────────────────
    const { data: order, error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        razorpay_payment_id,
      })
      .eq('id', order_id)
      .eq('buyer_id', user.id)  // safety: can only update own orders
      .select('order_number')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      data: { success: true, order_number: order.order_number },
      error: null,
    });
  } catch (error) {
    console.error('[api/orders/verify-payment POST]', error);
    return NextResponse.json(
      { data: null, error: 'Payment verification failed' },
      { status: 500 }
    );
  }
}
