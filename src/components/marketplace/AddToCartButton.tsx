/**
 * AddToCartButton — reusable "Add to Cart" trigger used on both the product
 * grid cards (as a modal) and the product detail page (inline controls).
 *
 * Behaviour:
 *   - Not logged in  → redirects to /login?redirect=<currentPath>
 *   - Logged in      → shows a quantity modal (for cards) or renders inline
 *   - Out of stock   → button is disabled
 *
 * The modal shows:
 *   - Product name + unit price
 *   - MOQ notice
 *   - Quantity input (min = moq)
 *   - Dynamic tier-price hints ("Buy 100+ for ₹130/unit")
 *   - Live subtotal (excl. GST)
 *   - Confirm button → calls useCartStore().addItem()
 *   - Success toast with "View Cart" action
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingCart, X, Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { formatINR } from '@/lib/utils/formatting';
import type { Product, PricingTier } from '@/types/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Slim product shape accepted by AddToCartButton.
 * Matches what the marketplace API returns — no need to pass the full DB row.
 */
export interface CartableProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  size_variant: string | null;
  group_slug?: string | null;
  variant_count?: number;
  base_price: number;
  gst_rate: number;
  moq: number;
  unit_of_measure: string;
  thumbnail_url: string | null;
  category: string;
  stock_status: string;
  pricing_tiers: PricingTier[];
}

interface AddToCartButtonProps {
  /** Product data — must include pricing_tiers and gst_rate */
  product: CartableProduct;
  /**
   * "card"   — renders a compact button that opens a quantity modal
   * "detail" — renders a full inline quantity selector (used on detail page)
   */
  variant?: 'card' | 'detail';
  /** Override the initial quantity (defaults to product.moq) */
  initialQuantity?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the per-unit price for a given quantity from pricing_tiers.
 * Falls back to base_price when no tier applies.
 */
function resolvePrice(tiers: PricingTier[], qty: number, basePrice: number): number {
  if (!tiers || tiers.length === 0) return basePrice;
  const match = tiers.find(
    (t) => qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty),
  );
  return match ? match.price : basePrice;
}

/**
 * Returns tier hints for quantities the buyer hasn't yet reached.
 * e.g. [{ label: 'Buy 100+ for ₹130/unit', triggerQty: 100 }]
 */
function getBetterTierHints(
  tiers: PricingTier[],
  currentQty: number,
): { label: string; triggerQty: number }[] {
  return tiers
    .filter((t) => t.min_qty > currentQty)
    .sort((a, b) => a.min_qty - b.min_qty)
    .slice(0, 2) // show at most 2 upcoming tiers
    .map((t) => ({
      label: `Buy ${t.min_qty}+ for ${formatINR(t.price)}/unit`,
      triggerQty: t.min_qty,
    }));
}

// ---------------------------------------------------------------------------
// Modal component (used in "card" variant)
// ---------------------------------------------------------------------------

interface CartModalProps {
  product: CartableProduct;
  onClose: () => void;
  onAdd: (qty: number) => void;
}

/**
 * Small popover-style modal for quantity selection on the product grid.
 * Closes on Escape key or backdrop click.
 */
function CartModal({ product, onClose, onAdd }: CartModalProps) {
  const [qty, setQty] = useState(product.moq);
  const inputRef = useRef<HTMLInputElement>(null);

  const unitPrice = resolvePrice(product.pricing_tiers, qty, product.base_price);
  const subtotal  = unitPrice * qty;
  const gstAmount = subtotal * product.gst_rate / 100;
  const total     = subtotal + gstAmount;
  const tierHints = getBetterTierHints(product.pricing_tiers, qty);

  // Focus the input when modal opens
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Clamp quantity to valid range
  const setValidQty = useCallback(
    (val: number) => {
      setQty(Math.max(product.moq, isNaN(val) ? product.moq : val));
    },
    [product.moq],
  );

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-modal-title"
    >
      {/* Panel */}
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">

        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2
            id="cart-modal-title"
            className="font-heading text-base font-bold leading-snug text-slate-900"
          >
            {product.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Price per unit */}
        <p className="font-heading text-xl font-bold text-teal-700">
          {formatINR(unitPrice)}{' '}
          <span className="text-sm font-normal text-slate-500">
            / {product.unit_of_measure}
          </span>
        </p>

        {/* MOQ notice */}
        <p className="mt-2 text-xs text-amber-700">
          Minimum order: {product.moq} {product.unit_of_measure}
        </p>

        {/* Quantity control */}
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setValidQty(qty - 1)}
            disabled={qty <= product.moq}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>

          <input
            ref={inputRef}
            type="number"
            min={product.moq}
            value={qty}
            onChange={(e) => setValidQty(parseInt(e.target.value, 10))}
            className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-center font-mono text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Quantity"
          />

          <button
            type="button"
            onClick={() => setValidQty(qty + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>

          <span className="text-xs text-slate-400">{product.unit_of_measure}</span>
        </div>

        {/* Tier hints */}
        {tierHints.length > 0 && (
          <div className="mt-3 space-y-1">
            {tierHints.map((hint) => (
              <button
                key={hint.triggerQty}
                type="button"
                onClick={() => setQty(hint.triggerQty)}
                className="block text-xs text-teal-600 underline-offset-2 hover:underline"
              >
                {hint.label}
              </button>
            ))}
          </div>
        )}

        {/* Live order total */}
        <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Subtotal (excl. GST)</span>
            <span className="font-heading text-sm font-bold text-slate-900">
              {formatINR(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">GST ({product.gst_rate}%)</span>
            <span className="font-heading text-sm font-semibold text-slate-700">
              {formatINR(gstAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-1.5">
            <span className="text-xs font-semibold text-slate-700">Total incl. GST</span>
            <span className="font-heading text-base font-bold text-teal-700">
              {formatINR(total)}
            </span>
          </div>
        </div>

        {/* Confirm */}
        <button
          type="button"
          onClick={() => onAdd(qty)}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 active:bg-teal-800"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Add to Cart
        </button>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Reusable Add to Cart trigger.
 *
 * - variant="card"   → compact button + quantity modal
 * - variant="detail" → full inline quantity selector for the product detail page
 *
 * Auth check is built in: unauthenticated users are redirected to /login.
 */
export default function AddToCartButton({
  product,
  variant = 'card',
  initialQuantity,
}: AddToCartButtonProps) {
  const router    = useRouter();
  const pathname  = usePathname();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const addItem   = useCartStore((s) => s.addItem);

  const [modalOpen, setModalOpen] = useState(false);

  // Inline variant state
  const [qty, setQty] = useState(initialQuantity ?? product.moq);
  const unitPrice = resolvePrice(product.pricing_tiers, qty, product.base_price);
  const subtotal  = unitPrice * qty;
  const gstAmount = subtotal * product.gst_rate / 100;
  const total     = subtotal + gstAmount;
  const tierHints = getBetterTierHints(product.pricing_tiers, qty);

  const isOutOfStock = product.stock_status === 'out_of_stock';

  // Clamp inline quantity
  const setValidQty = useCallback(
    (val: number) => {
      setQty(Math.max(product.moq, isNaN(val) ? product.moq : val));
    },
    [product.moq],
  );

  /**
   * Handles the button click.
   * Redirects to login if not authenticated; opens modal if "card" variant.
   */
  const handleClick = useCallback(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (variant === 'card') {
      setModalOpen(true);
    }
  }, [isAuthenticated, router, pathname, variant]);

  /**
   * Adds the product to the cart and shows a success toast.
   * Called by both the modal confirm and the inline button.
   */
  const handleAdd = useCallback(
    (quantity: number) => {
      // Build the Product-shaped object the cart store expects
      const productForCart = {
        ...product,
        // Fields the cart store reads but aren't on CartableProduct —
        // these are never used for display, just forwarded as-is.
        id: product.id,
      } as unknown as Product;

      addItem(productForCart, quantity);
      setModalOpen(false);

      toast.success(
        (t) => (
          <span className="flex items-center gap-3">
            Added to cart!
            <button
              type="button"
              className="rounded bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-700"
              onClick={() => {
                toast.dismiss(t.id);
                router.push('/cart');
              }}
            >
              View Cart
            </button>
          </span>
        ),
        { duration: 4000 },
      );
    },
    [product, addItem, router],
  );

  // ── Card variant ──────────────────────────────────────────────────────────

  if (variant === 'card') {
    return (
      <>
        <button
          type="button"
          disabled={isOutOfStock || authLoading}
          onClick={handleClick}
          className={[
            'mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
            isOutOfStock
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
          ].join(' ')}
        >
          <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
          {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>

        {modalOpen && (
          <CartModal
            product={product}
            onClose={() => setModalOpen(false)}
            onAdd={handleAdd}
          />
        )}
      </>
    );
  }

  // ── Detail variant ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Quantity control */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Quantity</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setValidQty(qty - 1)}
            disabled={qty <= product.moq}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>

          <input
            type="number"
            min={product.moq}
            value={qty}
            onChange={(e) => setValidQty(parseInt(e.target.value, 10))}
            className="h-10 w-24 rounded-lg border border-slate-300 px-3 text-center font-mono text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Quantity"
          />

          <button
            type="button"
            onClick={() => setValidQty(qty + 1)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50"
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>

          <span className="text-sm text-slate-500">{product.unit_of_measure}</span>
        </div>
      </div>

      {/* Dynamic unit price */}
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-2xl font-bold text-teal-700">
          {formatINR(unitPrice)}
        </span>
        <span className="text-sm text-slate-500">/ {product.unit_of_measure}</span>
        {unitPrice < product.base_price && (
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700">
            Bulk price
          </span>
        )}
      </div>

      {/* Tier hints */}
      {tierHints.length > 0 && (
        <div className="space-y-1">
          {tierHints.map((hint) => (
            <button
              key={hint.triggerQty}
              type="button"
              onClick={() => setQty(hint.triggerQty)}
              className="block text-xs text-teal-600 underline-offset-2 hover:underline"
            >
              {hint.label}
            </button>
          ))}
        </div>
      )}

      {/* Live subtotal */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Product price</p>
          <p className="font-heading text-lg font-bold text-slate-900">
            {formatINR(subtotal)}
          </p>
        </div>
        <div className="sm:text-center">
          <p className="text-xs text-slate-500">GST ({product.gst_rate}%)</p>
          <p className="font-heading text-sm font-semibold text-slate-600">
            + {formatINR(gstAmount)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-semibold text-slate-700">Total incl. GST</p>
          <p className="font-heading text-lg font-bold text-teal-700">
            {formatINR(total)}
          </p>
        </div>
      </div>

      {/* Add to Cart button */}
      <button
        type="button"
        disabled={isOutOfStock || authLoading}
        onClick={isAuthenticated ? () => handleAdd(qty) : handleClick}
        className={[
          'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold transition-colors',
          isOutOfStock
            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
            : 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
        ].join(' ')}
      >
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
        {isOutOfStock
          ? 'Out of Stock'
          : isAuthenticated
            ? 'Add to Cart'
            : 'Log in to Order'}
      </button>

      {!isAuthenticated && !authLoading && !isOutOfStock && (
        <p className="text-center text-xs text-slate-400">
          You&apos;ll be asked to log in before adding to cart.
        </p>
      )}
    </div>
  );
}
