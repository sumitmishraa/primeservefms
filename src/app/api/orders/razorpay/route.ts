/**
 * POST /api/orders/razorpay
 *
 * Creates a Razorpay order so the frontend can open the payment modal.
 * The buyer must be authenticated. Amount is in INR (converted to paise here).
 *
 * Flow:
 *   Frontend → POST /api/orders/razorpay { amount, receipt }
 *           ← { data: { id, amount, currency }, error: null }
 *   Frontend opens Razorpay modal with returned order id.
 *   On payment success Razorpay calls handler → frontend POSTs /api/orders.
 */

import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { verifyAuth } from "@/lib/auth/verify";
import type { ApiResponse } from "@/types";

// ---------------------------------------------------------------------------
// Razorpay client — initialised once at module level (server-side only)
// ---------------------------------------------------------------------------

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ---------------------------------------------------------------------------
// Request body shape
// ---------------------------------------------------------------------------

interface CreateRazorpayOrderBody {
  /** Grand total in INR (e.g. 1250.50). Converted to paise internally. */
  amount: number;
  /** Human-readable receipt ID — used in Razorpay dashboard. */
  receipt?: string;
}

// ---------------------------------------------------------------------------
// Razorpay order shape we expose to the frontend
// ---------------------------------------------------------------------------

interface RazorpayOrderData {
  id: string;
  amount: number;
  currency: string;
}

/**
 * Creates a Razorpay order and returns its id to the frontend.
 * The frontend uses this id to open the Razorpay checkout modal.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<RazorpayOrderData>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as CreateRazorpayOrderBody;
    const { amount, receipt } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { data: null, error: "Invalid amount — must be a positive number in INR" },
        { status: 400 }
      );
    }

    // Razorpay requires amount in paise (smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: receipt ?? `ps-${user.id.slice(0, 8)}-${Date.now()}`,
    });

    return NextResponse.json({
      data: {
        id: order.id,
        amount: order.amount as number,
        currency: order.currency,
      },
      error: null,
    });
  } catch (error) {
    console.error("[api/orders/razorpay POST]", error);
    return NextResponse.json(
      { data: null, error: "Failed to create payment order" },
      { status: 500 }
    );
  }
}
