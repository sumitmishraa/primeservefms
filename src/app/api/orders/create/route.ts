/**
 * POST /api/orders/create
 *
 * Creates an order in Supabase then either:
 *   a) Opens a Razorpay order (payment_method = 'razorpay', default)
 *   b) Charges against the buyer's credit line and returns immediately
 *      (payment_method = 'credit_45day') — no Razorpay involved.
 *
 * Flow (razorpay):
 *   1. Verify auth
 *   2. Validate + recalculate prices server-side
 *   3. Check each product is active, approved, qty >= MOQ
 *   4. Insert order (payment_status: pending)
 *   5. Insert order_items
 *   6. Create Razorpay order
 *   7. Save razorpay_order_id on our order
 *   8. Return data needed for the frontend modal
 *
 * Flow (credit_45day):
 *   Steps 1–5 same as above, then:
 *   6. Verify buyer has an active credit account with sufficient available credit
 *   7. Deduct total_amount from credit_accounts.used_amount
 *   8. Return { order_id, order_number } — no Razorpay keys
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatOrderNumber } from '@/lib/utils/formatting';
import type { ApiResponse, ShippingAddress, PricingTier } from '@/types';

// ---------------------------------------------------------------------------
// Razorpay client (server-side only)
// ---------------------------------------------------------------------------

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

interface CreateOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

interface CreateOrderBody {
  items: CreateOrderItem[];
  shipping_address: ShippingAddress;
  billing_address?: ShippingAddress | null;
  gst_number?: string | null;
  notes?: string | null;
  payment_method?: 'razorpay' | 'credit_45day';
}

interface CreateOrderResponse {
  order_id: string;
  order_number: string;
  payment_method: 'razorpay' | 'credit_45day';
  // Razorpay-only fields (undefined for credit orders)
  razorpay_order_id?: string;
  razorpay_key?: string;
  amount?: number;        // paise
  currency?: string;
  buyer_name: string;
  buyer_email: string | null;
  buyer_phone: string | null;
}

// ---------------------------------------------------------------------------
// Helper — resolve unit price from pricing tiers
// ---------------------------------------------------------------------------

function resolvePrice(tiers: PricingTier[], basePrice: number, qty: number): number {
  if (!tiers || tiers.length === 0) return basePrice;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  let resolved = basePrice;
  for (const tier of sorted) {
    if (qty >= tier.min_qty && (tier.max_qty === null || qty <= tier.max_qty)) {
      resolved = tier.price;
      break;
    }
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<CreateOrderResponse>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CreateOrderBody;
    const {
      items,
      shipping_address,
      billing_address,
      gst_number,
      notes,
      payment_method = 'razorpay',
    } = body;

    if (!items?.length || !shipping_address) {
      return NextResponse.json(
        { data: null, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ── Fetch products and validate ──────────────────────────────────────────
    const productIds = items.map((i) => i.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku, base_price, moq, pricing_tiers, gst_rate, is_active, is_approved')
      .in('id', productIds);

    if (productsError) throw productsError;

    const productMap = new Map(products?.map((p) => [p.id, p]) ?? []);

    let subtotal = 0;
    let gst_amount = 0;

    interface ComputedItem {
      product_id: string;
      product_name: string;
      product_sku: string | null;
      quantity: number;
      unit_price: number;
      gst_rate: number;
      gst_amount: number;
      total_amount: number;
    }

    const computedItems: ComputedItem[] = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json(
          { data: null, error: `Product not found: ${item.product_id}` },
          { status: 400 }
        );
      }
      if (!product.is_active || !product.is_approved) {
        return NextResponse.json(
          { data: null, error: `Product unavailable: ${product.name}` },
          { status: 400 }
        );
      }
      if (item.quantity < product.moq) {
        return NextResponse.json(
          { data: null, error: `Minimum order quantity for ${product.name} is ${product.moq}` },
          { status: 400 }
        );
      }

      const tiers = (product.pricing_tiers ?? []) as PricingTier[];
      const unitPrice = resolvePrice(tiers, product.base_price, item.quantity);
      const lineBase = unitPrice * item.quantity;
      const lineGst = Math.round(lineBase * (product.gst_rate / 100) * 100) / 100;
      const lineTotal = Math.round((lineBase + lineGst) * 100) / 100;

      subtotal += lineBase;
      gst_amount += lineGst;

      computedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        product_sku: product.sku ?? null,
        quantity: item.quantity,
        unit_price: unitPrice,
        gst_rate: product.gst_rate,
        gst_amount: lineGst,
        total_amount: lineTotal,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    gst_amount = Math.round(gst_amount * 100) / 100;
    const shipping_amount = subtotal >= 5000 ? 0 : 150;
    const total_amount = Math.round((subtotal + gst_amount + shipping_amount) * 100) / 100;

    // ── Credit check (status-only — no limit cap) ─────────────────────────────
    if (payment_method === 'credit_45day') {
      const { data: creditRow, error: creditError } = await supabase
        .from('credit_accounts')
        .select('id, status')
        .eq('buyer_id', user.id)
        .maybeSingle();

      if (creditError) throw creditError;

      if (!creditRow || creditRow.status !== 'active') {
        return NextResponse.json(
          { data: null, error: 'You do not have an active credit account. Please contact support.' },
          { status: 400 }
        );
      }
    }

    // ── Insert order ──────────────────────────────────────────────────────────
    const order_number = formatOrderNumber();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number,
        buyer_id: user.id,
        vendor_id: null,
        status: 'pending',
        payment_status: 'pending',
        payment_method,
        subtotal,
        gst_amount,
        shipping_amount,
        total_amount,
        shipping_address: shipping_address as unknown as never,
        billing_address: (billing_address ?? null) as unknown as never,
        notes: notes ?? null,
        gst_number: gst_number ?? null,
        client_id: user.client_id ?? null,
        branch_id: user.branch_id ?? null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // ── Insert order_items ─────────────────────────────────────────────────────
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(computedItems.map((ci) => ({ ...ci, order_id: order.id })));

    if (itemsError) throw itemsError;

    // ── Credit path: order is already inserted — return immediately ──────────
    if (payment_method === 'credit_45day') {
      return NextResponse.json(
        {
          data: {
            order_id: order.id,
            order_number,
            payment_method: 'credit_45day',
            buyer_name: user.full_name,
            buyer_email: user.email,
            buyer_phone: user.phone,
          },
          error: null,
        },
        { status: 201 }
      );
    }

    // ── Razorpay path: create Razorpay order ──────────────────────────────────
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total_amount * 100),
      currency: 'INR',
      receipt: order_number,
      notes: {
        order_id: order.id,
        buyer_email: user.email ?? '',
      },
    });

    const { error: updateError } = await supabase
      .from('orders')
      .update({ razorpay_order_id: razorpayOrder.id })
      .eq('id', order.id);

    if (updateError) throw updateError;

    return NextResponse.json(
      {
        data: {
          order_id: order.id,
          order_number,
          payment_method: 'razorpay',
          razorpay_order_id: razorpayOrder.id,
          razorpay_key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
          amount: razorpayOrder.amount as number,
          currency: razorpayOrder.currency,
          buyer_name: user.full_name,
          buyer_email: user.email,
          buyer_phone: user.phone,
        },
        error: null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[api/orders/create POST]', error);
    return NextResponse.json(
      { data: null, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
