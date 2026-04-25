'use client';

/**
 * Buyer Cart Page — /buyer/cart
 *
 * Shows all items currently in the buyer's cart with:
 * - Quantity controls (MOQ-enforced)
 * - Live price recalculation via pricing tiers
 * - GST breakdown per rate
 * - Delivery charge threshold (free above ₹2,000 subtotal)
 * - Order summary sidebar / bottom sheet
 * - Pricing tier upsell hints
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Package,
  ArrowRight,
  ShoppingBag,
} from 'lucide-react';
import Image from 'next/image';
import { useCartStore } from '@/stores/cartStore';
import { formatINR } from '@/lib/utils/formatting';
import type { CartItem, PricingTier } from '@/types';

// ---------------------------------------------------------------------------
// Helper: find the next pricing tier the buyer hasn't reached yet
// ---------------------------------------------------------------------------

/**
 * Returns the next pricing tier above the current quantity, or null if already
 * at the best tier or there are no tiers.
 *
 * @param pricingTiers - The product's volume pricing tiers
 * @param currentQty   - Buyer's current quantity for this item
 */
function getNextTierHint(
  pricingTiers: PricingTier[],
  currentQty: number,
): { unitsNeeded: number; price: number } | null {
  if (!pricingTiers || pricingTiers.length === 0) return null;

  const sorted = [...pricingTiers].sort((a, b) => a.min_qty - b.min_qty);
  const nextTier = sorted.find((t) => t.min_qty > currentQty);
  if (!nextTier) return null;

  return {
    unitsNeeded: nextTier.min_qty - currentQty,
    price: nextTier.price,
  };
}

// ---------------------------------------------------------------------------
// Sub-component: single cart item row
// ---------------------------------------------------------------------------

interface CartItemRowProps {
  item: CartItem;
  onUpdateQuantity: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
}

/**
 * Renders one cart item as a card with thumbnail, details, quantity controls,
 * line total, remove button, and an optional pricing-tier upsell hint.
 */
function CartItemRow({ item, onUpdateQuantity, onRemove }: CartItemRowProps) {
  const [pendingQty, setPendingQty] = useState(String(item.quantity));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const lineTotal = item.unit_price * item.quantity;
  const belowMOQ = item.quantity < item.moq;
  const tierHint = getNextTierHint(item.pricing_tiers, item.quantity);

  /** Commits a quantity change from the input field. */
  const commitQty = (raw: string) => {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 1) {
      setPendingQty(String(item.quantity)); // revert
      return;
    }
    onUpdateQuantity(item.product_id, parsed);
    setPendingQty(String(parsed));
  };

  const handleDecrement = () => {
    const next = item.quantity - 1;
    if (next < item.moq) return; // blocked at MOQ
    onUpdateQuantity(item.product_id, next);
    setPendingQty(String(next));
  };

  const handleIncrement = () => {
    const next = item.quantity + 1;
    onUpdateQuantity(item.product_id, next);
    setPendingQty(String(next));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3">
      {/* ── Top row: thumbnail + details ─────────────────────────── */}
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
          {item.thumbnail_url ? (
            <Image
              src={item.thumbnail_url}
              alt={item.product_name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <Package className="w-6 h-6" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm leading-tight truncate">
            {item.product_name}
          </p>
          {(item.brand || item.size_variant) && (
            <p className="text-xs text-slate-500 mt-0.5">
              {[item.brand, item.size_variant].filter(Boolean).join(' · ')}
            </p>
          )}
          <span className="inline-block mt-1 px-2 py-0.5 bg-teal-50 text-teal-700 text-xs rounded-full font-medium capitalize">
            {item.category.replace(/_/g, ' ')}
          </span>
          <p className="text-xs text-slate-500 mt-1">
            {formatINR(item.unit_price)}{' '}
            <span className="text-slate-400">per {item.unit_of_measure}</span>
          </p>
        </div>

        {/* Line total + remove (desktop right-side) */}
        <div className="hidden sm:flex flex-col items-end justify-between gap-2">
          <p className="font-bold text-slate-900 font-mono text-sm">
            {formatINR(lineTotal)}
          </p>
          {confirmRemove ? (
            <div className="flex gap-1 items-center">
              <span className="text-xs text-slate-500">Remove?</span>
              <button
                onClick={() => onRemove(item.product_id)}
                className="text-xs text-rose-600 font-medium hover:underline"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-xs text-slate-500 hover:underline"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              aria-label={`Remove ${item.product_name} from cart`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── Quantity controls ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleDecrement}
            disabled={item.quantity <= item.moq}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3 h-3" aria-hidden="true" />
          </button>

          <input
            type="number"
            min={item.moq}
            value={pendingQty}
            onChange={(e) => setPendingQty(e.target.value)}
            onBlur={(e) => commitQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitQty(pendingQty);
            }}
            className="w-16 h-8 text-center text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono"
            aria-label="Quantity"
          />

          <button
            onClick={handleIncrement}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
          </button>

          <span className="text-xs text-slate-400">
            MOQ: {item.moq}
          </span>
        </div>

        {/* Mobile: line total + remove */}
        <div className="flex sm:hidden items-center gap-3">
          <p className="font-bold text-slate-900 font-mono text-sm">
            {formatINR(lineTotal)}
          </p>
          {confirmRemove ? (
            <div className="flex gap-1 items-center">
              <button
                onClick={() => onRemove(item.product_id)}
                className="text-xs text-rose-600 font-medium"
              >
                Remove?
              </button>
              <button
                onClick={() => setConfirmRemove(false)}
                className="text-xs text-slate-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              aria-label={`Remove ${item.product_name} from cart`}
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* ── MOQ warning ───────────────────────────────────────────── */}
      {belowMOQ && (
        <p className="text-xs text-rose-600 font-medium bg-rose-50 rounded-lg px-3 py-1.5">
          Below minimum order of {item.moq} {item.unit_of_measure}s — increase
          quantity to proceed.
        </p>
      )}

      {/* ── Tier upsell hint ─────────────────────────────────────── */}
      {tierHint && !belowMOQ && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
          💡 Add {tierHint.unitsNeeded} more to get{' '}
          {formatINR(tierHint.price)}/{item.unit_of_measure} pricing!
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

/**
 * Full cart page for the buyer role.
 * Shows an empty state when the cart has no items, otherwise renders the
 * items list and the order summary panel side-by-side (desktop) or stacked
 * (mobile).
 */
export default function BuyerCartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, getSubtotal, getGSTBreakdown, getDeliveryCharge, getGrandTotal } =
    useCartStore();

  const subtotal = getSubtotal();
  const gstBreakdown = getGSTBreakdown();
  const deliveryCharge = getDeliveryCharge();
  const grandTotal = getGrandTotal();

  const hasMOQViolation = items.some((item) => item.quantity < item.moq);
  const freeDeliveryThreshold = 5000;
  const amountToFreeDelivery = freeDeliveryThreshold - subtotal;

  // ── Empty state ─────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
        <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
          <ShoppingCart className="w-12 h-12 text-slate-300" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Your cart is empty</h2>
          <p className="text-slate-500 mt-1 text-sm">
            Add products from the marketplace to get started.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
        >
          <ShoppingBag className="w-4 h-4" aria-hidden="true" />
          Browse Marketplace
        </Link>
      </div>
    );
  }

  // ── Cart with items ─────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Items list ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4">
          {items.map((item) => (
            <CartItemRow
              key={item.product_id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeItem}
            />
          ))}

          {/* Continue shopping */}
          <div className="pt-2">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              ← Continue Shopping
            </Link>
          </div>
        </div>

        {/* ── Order summary ────────────────────────────────────────────── */}
        <aside className="lg:w-80 xl:w-96 shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sticky top-20">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Order Summary</h2>

            {/* Subtotal */}
            <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-mono font-medium text-slate-900">
                {formatINR(subtotal)}
              </span>
            </div>

            {/* GST breakdown */}
            {gstBreakdown.map(({ rate, amount }) => (
              <div
                key={rate}
                className="flex justify-between items-center text-sm py-2 border-b border-slate-100"
              >
                <span className="text-slate-600">GST {rate}%</span>
                <span className="font-mono text-slate-700">{formatINR(amount)}</span>
              </div>
            ))}

            {/* Delivery */}
            <div className="flex justify-between items-center text-sm py-2 border-b border-slate-100">
              <span className="text-slate-600">Delivery</span>
              {deliveryCharge === 0 ? (
                <span className="font-mono font-medium text-emerald-600">FREE</span>
              ) : (
                <span className="font-mono text-slate-700">{formatINR(deliveryCharge)}</span>
              )}
            </div>

            {/* Free delivery nudge */}
            {deliveryCharge > 0 && amountToFreeDelivery > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-2">
                Add {formatINR(amountToFreeDelivery)} more for free delivery!
              </p>
            )}

            {/* Grand total */}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-200">
              <span className="font-semibold text-slate-900">Grand Total</span>
              <span className="font-mono text-xl font-bold text-teal-600">
                {formatINR(grandTotal)}
              </span>
            </div>

            {/* MOQ violation warning */}
            {hasMOQViolation && (
              <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-3">
                Fix quantities below minimum order to proceed.
              </p>
            )}

            {/* Checkout button */}
            <button
              onClick={() => router.push('/buyer/checkout')}
              disabled={hasMOQViolation}
              className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold text-base hover:bg-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proceed to Checkout
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
