/**
 * cartStore — Zustand store for the buyer's shopping cart.
 *
 * Persists to localStorage under the key 'primeserve-cart' so the cart
 * survives page refreshes and tab reloads.
 *
 * Usage:
 *   const { items, addItem, getGrandTotal } = useCartStore();
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import toast from 'react-hot-toast';

import type { CartItem, PricingTier, Product } from '@/types/index';

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface CartState {
  /** All items currently in the cart */
  items: CartItem[];

  // ── Mutating actions ─────────────────────────────────────────────────────

  /**
   * Adds a product to the cart at the requested quantity.
   * If the product is already in the cart its quantity is incremented instead.
   * Quantity is clamped to product.moq if too low.
   *
   * @param product  - Full product record from the marketplace
   * @param quantity - Desired number of units (will be set to moq if below it)
   */
  addItem: (product: Product, quantity: number) => void;

  /**
   * Removes a product from the cart entirely.
   *
   * @param productId - products.id to remove
   */
  removeItem: (productId: string) => void;

  /**
   * Updates the quantity of an existing cart item and recalculates its price.
   * Shows an error toast if the new quantity is below the item's moq.
   *
   * @param productId - products.id to update
   * @param quantity  - New quantity (must be >= item.moq)
   */
  updateQuantity: (productId: string, quantity: number) => void;

  /** Empties the cart. */
  clearCart: () => void;

  // ── Computed helpers (read-only, call as functions) ───────────────────────

  /** Total number of units across all cart items. */
  getItemCount: () => number;

  /** Sum of (unit_price × quantity) for all items, before GST and delivery. */
  getSubtotal: () => number;

  /**
   * GST amounts grouped by rate.
   * e.g. [{ rate: 18, amount: 1500 }, { rate: 12, amount: 300 }]
   */
  getGSTBreakdown: () => { rate: number; amount: number }[];

  /** Sum of all GST amounts across all items. */
  getTotalGST: () => number;

  /** ₹0 if subtotal >= ₹2,000, otherwise ₹100. */
  getDeliveryCharge: () => number;

  /** subtotal + totalGST + deliveryCharge */
  getGrandTotal: () => number;
}

// ---------------------------------------------------------------------------
// Internal helper — price resolution
// ---------------------------------------------------------------------------

/**
 * Returns the per-unit price for a given quantity by scanning pricing_tiers.
 * Falls back to base_price if no tier matches.
 *
 * @param pricingTiers - Volume discount tiers from the product record
 * @param quantity     - Number of units the buyer wants
 * @param basePrice    - Fallback price when no tier applies
 */
function resolveUnitPrice(
  pricingTiers: PricingTier[],
  quantity: number,
  basePrice: number,
): number {
  if (!pricingTiers || pricingTiers.length === 0) return basePrice;

  const matchingTier = pricingTiers.find(
    (tier) =>
      quantity >= tier.min_qty &&
      (tier.max_qty === null || quantity <= tier.max_qty),
  );

  return matchingTier ? matchingTier.price : basePrice;
}

// ---------------------------------------------------------------------------
// Store definition
// ---------------------------------------------------------------------------

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      // ── addItem ────────────────────────────────────────────────────────────
      addItem: (product: Product, quantity: number) => {
        const { items } = get();

        // Clamp quantity to MOQ
        const safeQty = quantity < product.moq ? product.moq : quantity;

        // Cast JSONB pricing_tiers to the typed shape
        const pricingTiers = (product.pricing_tiers ?? []) as PricingTier[];

        const existingIndex = items.findIndex(
          (item) => item.product_id === product.id,
        );

        if (existingIndex !== -1) {
          // Product already in cart — accumulate quantity and recalculate price
          const existing = items[existingIndex];
          const newQty = existing.quantity + safeQty;
          const newPrice = resolveUnitPrice(
            existing.pricing_tiers,
            newQty,
            existing.base_price,
          );

          set({
            items: items.map((item) =>
              item.product_id === product.id
                ? { ...item, quantity: newQty, unit_price: newPrice }
                : item,
            ),
          });
        } else {
          // New product — build flat CartItem from Product fields
          const unitPrice = resolveUnitPrice(
            pricingTiers,
            safeQty,
            product.base_price,
          );

          const newItem: CartItem = {
            product_id: product.id,
            product_name: product.name,
            product_slug: product.slug,
            brand: product.brand,
            size_variant: product.size_variant,
            thumbnail_url: product.thumbnail_url,
            category: product.category,
            unit_of_measure: product.unit_of_measure,
            base_price: product.base_price,
            gst_rate: product.gst_rate,
            moq: product.moq,
            quantity: safeQty,
            unit_price: unitPrice,
            pricing_tiers: pricingTiers,
          };

          set({ items: [...items, newItem] });
        }
      },

      // ── removeItem ─────────────────────────────────────────────────────────
      removeItem: (productId: string) => {
        set({
          items: get().items.filter((item) => item.product_id !== productId),
        });
      },

      // ── updateQuantity ─────────────────────────────────────────────────────
      updateQuantity: (productId: string, quantity: number) => {
        const { items } = get();
        const item = items.find((i) => i.product_id === productId);
        if (!item) return;

        if (quantity < item.moq) {
          toast.error(`Minimum order: ${item.moq} units`);
          return;
        }

        const newPrice = resolveUnitPrice(
          item.pricing_tiers,
          quantity,
          item.base_price,
        );

        set({
          items: items.map((i) =>
            i.product_id === productId
              ? { ...i, quantity, unit_price: newPrice }
              : i,
          ),
        });
      },

      // ── clearCart ──────────────────────────────────────────────────────────
      clearCart: () => set({ items: [] }),

      // ── getItemCount ───────────────────────────────────────────────────────
      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      // ── getSubtotal ────────────────────────────────────────────────────────
      getSubtotal: () =>
        get().items.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0,
        ),

      // ── getGSTBreakdown ────────────────────────────────────────────────────
      getGSTBreakdown: () => {
        const breakdown = new Map<number, number>();

        for (const item of get().items) {
          const gstAmount =
            item.unit_price * item.quantity * (item.gst_rate / 100);
          breakdown.set(
            item.gst_rate,
            (breakdown.get(item.gst_rate) ?? 0) + gstAmount,
          );
        }

        return Array.from(breakdown.entries()).map(([rate, amount]) => ({
          rate,
          amount,
        }));
      },

      // ── getTotalGST ────────────────────────────────────────────────────────
      getTotalGST: () =>
        get().items.reduce(
          (sum, item) =>
            sum + item.unit_price * item.quantity * (item.gst_rate / 100),
          0,
        ),

      // ── getDeliveryCharge ──────────────────────────────────────────────────
      getDeliveryCharge: () => (get().getSubtotal() >= 2000 ? 0 : 100),

      // ── getGrandTotal ──────────────────────────────────────────────────────
      getGrandTotal: () => {
        const { getSubtotal, getTotalGST, getDeliveryCharge } = get();
        return getSubtotal() + getTotalGST() + getDeliveryCharge();
      },
    }),
    {
      name: 'primeserve-cart', // localStorage key
    },
  ),
);
