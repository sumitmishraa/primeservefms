'use client';

/**
 * Order Success Page — /buyer/checkout/success?order_id=XXX
 *
 * Shows order confirmation after successful Razorpay payment.
 * Fetches order details from GET /api/orders/[id].
 */

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, ShoppingBag, Copy, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { Order, OrderItem } from '@/types';

interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('order_id');

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orderId) {
      router.replace('/buyer/orders');
      return;
    }

    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const json = await res.json() as { data: OrderWithItems | null; error: string | null };
        if (!res.ok || json.error || !json.data) {
          throw new Error(json.error ?? 'Order not found');
        }
        setOrder(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [orderId, router]);

  async function copyOrderNumber() {
    if (!order) return;
    await navigator.clipboard.writeText(order.order_number);
    setCopied(true);
    toast.success('Order number copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <p className="text-sm">Loading your order…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-slate-500 mb-4">{error ?? 'Order not found'}</p>
        <Link href="/buyer/orders" className="text-teal-600 hover:underline text-sm">
          View all orders
        </Link>
      </div>
    );
  }

  const shippingAddr = order.shipping_address as {
    name?: string; line1?: string; city?: string; state?: string; pincode?: string;
  } | null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

      {/* ── Success hero ─────────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        {/* Pulsing circle animation */}
        <div className="relative inline-flex items-center justify-center mb-5">
          <span className="absolute inline-flex h-24 w-24 rounded-full bg-emerald-100 animate-ping opacity-50" />
          <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
            <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2} />
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Order Placed Successfully!</h1>
        <p className="text-slate-500 text-sm">Thank you for your order. We&apos;ll process it shortly.</p>
      </div>

      {/* ── Order details card ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Order number + status */}
        <div className="p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Order Number</p>
            <p className="text-xl font-mono font-bold text-teal-600">{order.order_number}</p>
            <p className="text-xs text-slate-400 mt-1">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Payment Confirmed
            </span>
            <button
              onClick={copyOrderNumber}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-teal-600 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Items summary */}
        <div className="p-5">
          <p className="text-sm font-medium text-slate-700 mb-3">
            Items ({order.order_items.length})
          </p>
          <div className="space-y-2">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-slate-600 truncate mr-2">
                  {item.product_name}
                  <span className="text-slate-400 ml-1">×{item.quantity}</span>
                </span>
                <span className="font-mono text-slate-800 whitespace-nowrap">
                  {formatINR(item.total_amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Price breakdown */}
        <div className="p-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono text-slate-700">{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">GST</span>
            <span className="font-mono text-slate-700">{formatINR(order.gst_amount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Delivery</span>
            {order.shipping_amount === 0 ? (
              <span className="font-mono text-emerald-600 font-medium">FREE</span>
            ) : (
              <span className="font-mono text-slate-700">{formatINR(order.shipping_amount)}</span>
            )}
          </div>
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-slate-100">
            <span className="text-slate-900">Total Paid</span>
            <span className="font-mono text-teal-600 text-base">{formatINR(order.total_amount)}</span>
          </div>
          <div className="flex justify-between text-xs pt-1">
            <span className="text-slate-400">Payment Method</span>
            <span className="text-slate-500">Razorpay · Paid</span>
          </div>
        </div>

        {/* Shipping address */}
        {shippingAddr && (
          <div className="p-5">
            <p className="text-sm font-medium text-slate-700 mb-1">Shipping To</p>
            <p className="text-sm text-slate-500">
              {[shippingAddr.name, shippingAddr.line1, shippingAddr.city, shippingAddr.state, shippingAddr.pincode]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Link
          href={`/buyer/orders/${order.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 transition-colors"
        >
          <Package className="w-4 h-4" />
          View Order Details
        </Link>
        <Link
          href="/marketplace"
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
        >
          <ShoppingBag className="w-4 h-4" />
          Continue Shopping
        </Link>
      </div>

      <p className="text-center text-xs text-slate-400 mt-4">
        Order confirmation has been recorded. You can track your order in the Orders section.
      </p>
    </div>
  );
}
