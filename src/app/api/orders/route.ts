/**
 * /api/orders
 *
 * GET  — Returns all orders for the authenticated buyer (newest first).
 * POST — Creates an order in Supabase after verifying Razorpay payment.
 *
 * POST flow:
 *   1. Verify ps-session cookie (buyer must be logged in)
 *   2. Verify Razorpay payment signature (HMAC-SHA256)
 *   3. Insert row into `orders`
 *   4. Insert rows into `order_items` (one per cart item)
 *   5. Return { order_id, order_number }
 *
 * Signature verification:
 *   expected = HMAC_SHA256(key_secret, razorpay_order_id + "|" + razorpay_payment_id)
 *   If expected !== razorpay_signature → reject with 400.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyAuth } from "@/lib/auth/verify";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatOrderNumber } from "@/lib/utils/formatting";
import type { ApiResponse, ShippingAddress, CartItem } from "@/types";

// ---------------------------------------------------------------------------
// POST body shape
// ---------------------------------------------------------------------------

interface CreateOrderBody {
  /** Cart items — snapshotted at checkout time */
  items: CartItem[];
  /** Shipping destination address */
  shipping_address: ShippingAddress;
  /** Billing address — null if same as shipping */
  billing_address?: ShippingAddress | null;
  /** Buyer's GST number for B2B invoice — optional */
  gst_number?: string | null;
  /** Special instructions from the buyer — optional */
  notes?: string | null;
  /** Sum of (unit_price × qty) for all items, before GST and delivery */
  subtotal: number;
  /** Total GST across all items */
  gst_amount: number;
  /** Delivery charge (0 or 100) */
  shipping_amount: number;
  /** subtotal + gst_amount + shipping_amount */
  total_amount: number;
  /** Razorpay order id returned from POST /api/orders/razorpay */
  razorpay_order_id: string;
  /** Payment id returned by Razorpay modal on success */
  razorpay_payment_id: string;
  /** Signature from Razorpay to verify authenticity */
  razorpay_signature: string;
}

// ---------------------------------------------------------------------------
// GET — buyer order history
// ---------------------------------------------------------------------------

/**
 * Returns all orders for the authenticated buyer, newest first.
 * Includes order_items joined inline.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error("[api/orders GET]", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create order after successful Razorpay payment
// ---------------------------------------------------------------------------

/**
 * Verifies the Razorpay signature then persists the order and its line items
 * to Supabase. Returns the new order's id and human-readable order_number.
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ order_id: string; order_number: string }>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as CreateOrderBody;
    const {
      items,
      shipping_address,
      billing_address,
      gst_number,
      notes,
      subtotal,
      gst_amount,
      shipping_amount,
      total_amount,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    // ── Validate required fields ──────────────────────────────────────────
    if (
      !items?.length ||
      !shipping_address ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        { data: null, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // ── Verify Razorpay payment signature ─────────────────────────────────
    // Per Razorpay docs: HMAC-SHA256 of "<order_id>|<payment_id>"
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("[api/orders POST] Signature mismatch for order", razorpay_order_id);
      return NextResponse.json(
        { data: null, error: "Payment verification failed — invalid signature" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const order_number = formatOrderNumber();

    // ── Insert order ──────────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number,
        buyer_id: user.id,
        vendor_id: null,
        status: "pending",
        payment_status: "paid",
        subtotal,
        gst_amount,
        shipping_amount,
        total_amount,
        shipping_address: shipping_address as unknown as never,
        billing_address: (billing_address ?? null) as unknown as never,
        notes: notes ?? null,
        // Store Razorpay payment reference + buyer GST in admin_notes as JSON
        admin_notes: JSON.stringify({
          razorpay_order_id,
          razorpay_payment_id,
          gst_number: gst_number ?? null,
        }),
        client_id: user.client_id ?? null,
        branch_id: user.branch_id ?? null,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // ── Insert order items ────────────────────────────────────────────────
    const orderItems = items.map((item) => {
      const lineGst =
        Math.round(item.unit_price * item.quantity * (item.gst_rate / 100) * 100) / 100;
      const lineTotal =
        Math.round((item.unit_price * item.quantity + lineGst) * 100) / 100;
      return {
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: null as string | null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: item.gst_rate,
        gst_amount: lineGst,
        total_amount: lineTotal,
      };
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return NextResponse.json(
      {
        data: { order_id: order.id, order_number: order.order_number },
        error: null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[api/orders POST]", error);
    return NextResponse.json(
      { data: null, error: "Failed to create order" },
      { status: 500 }
    );
  }
}
