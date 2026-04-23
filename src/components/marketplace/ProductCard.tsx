/**
 * ProductCard — marketplace grid card for a single product.
 *
 * Layout matches the B2B marketplace reference:
 *   - Top half: light teal tint image area with a stock badge (top-left)
 *     and a heart/wishlist icon (top-right)
 *   - Bottom half: SKU, product name, star rating + review count,
 *     price per unit, bulk hint ("From ₹X for 50+"), and Add to Cart button
 *
 * The image + name link to /marketplace/[slug]; the Add to Cart button
 * opens the quantity modal (login-gated).
 */

'use client';

import Link from 'next/link';
import { Package, Heart, Star } from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
import AddToCartButton from './AddToCartButton';
import type { CartableProduct } from './AddToCartButton';

interface ProductCardProps {
  product: CartableProduct;
}

/**
 * Hash-based stable rating + review count so the skeleton looks realistic
 * in the demo build before real review data is wired up.
 */
function pseudoRating(id: string) {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) | 0;
  const rating = 3.5 + ((Math.abs(seed) % 15) / 10);
  const count = 10 + (Math.abs(seed >> 3) % 180);
  return { rating: Math.min(5, Math.round(rating * 10) / 10), count };
}

/**
 * Finds the lowest per-unit price across all pricing tiers.
 * Returns null when there are no tiers that beat base_price.
 */
function lowestTierPrice(product: CartableProduct): { price: number; minQty: number } | null {
  if (!product.pricing_tiers || product.pricing_tiers.length === 0) return null;
  const sorted = [...product.pricing_tiers].sort((a, b) => a.price - b.price);
  const best = sorted[0];
  if (!best || best.price >= product.base_price) return null;
  return { price: best.price, minQty: best.min_qty };
}

export default function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const isLowStock = product.stock_status === 'low_stock';
  const { rating, count } = pseudoRating(product.id);
  const sku = product.id.slice(0, 8).toUpperCase();
  const bulk = lowestTierPrice(product);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-teal-300">
      {/* Image area */}
      <Link
        href={`/marketplace/${product.slug}`}
        className="relative block aspect-square w-full overflow-hidden bg-teal-50/40"
      >
        {product.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-14 w-14 text-teal-300/70" strokeWidth={1.25} />
          </div>
        )}

        {/* Stock badge */}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isOutOfStock
              ? 'bg-rose-100 text-rose-700'
              : isLowStock
                ? 'bg-amber-100 text-amber-700'
                : 'bg-teal-100 text-teal-700'
          }`}
        >
          {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
        </span>

        {/* Wishlist */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition-colors hover:border-rose-300 hover:text-rose-500"
          aria-label="Add to wishlist"
        >
          <Heart className="h-4 w-4" />
        </button>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {/* SKU */}
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {sku}
        </p>

        {/* Name */}
        <Link
          href={`/marketplace/${product.slug}`}
          className="line-clamp-2 font-heading text-sm font-bold leading-snug text-slate-900 hover:text-teal-700"
        >
          {product.name}
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1.5 text-xs">
          <div className="flex">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
                  i < Math.round(rating)
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-slate-200 text-slate-200'
                }`}
              />
            ))}
          </div>
          <span className="text-slate-500">({count})</span>
        </div>

        {/* Price */}
        <p className="mt-1 font-heading text-lg font-bold text-teal-700">
          {formatINR(product.base_price)}
          <span className="ml-1 text-xs font-normal text-slate-500">
            / {product.unit_of_measure}
          </span>
        </p>

        {/* Bulk hint */}
        <p className="text-[11px] text-slate-500">
          {bulk
            ? `From ${formatINR(bulk.price)} for ${bulk.minQty}+`
            : `Min. ${product.moq} ${product.unit_of_measure}`}
        </p>

        {/* Add to Cart */}
        <div className="mt-2">
          <AddToCartButton product={product} variant="card" />
        </div>
      </div>
    </div>
  );
}
