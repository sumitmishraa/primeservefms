/**
 * ProductCard — marketplace grid card for a single product.
 *
 * Displays thumbnail, name, brand/size, price, MOQ, stock badge,
 * and an "Add to Cart" button that opens a quantity modal.
 *
 * The image + product info area links to /marketplace/[slug].
 * The "Add to Cart" button is a separate element that does NOT trigger the link.
 *
 * Used in: src/app/marketplace/page.tsx
 */

'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
import AddToCartButton from './AddToCartButton';
import type { CartableProduct } from './AddToCartButton';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: CartableProduct;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card component for the marketplace product grid.
 * The main card area links to the product detail page.
 * The "Add to Cart" button opens a quantity modal (login-gated).
 *
 * @param product - Product data including pricing_tiers and gst_rate
 */
export default function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const subtitle = [product.brand, product.size_variant].filter(Boolean).join(' · ');

  return (
    <div className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">

      {/* Thumbnail — entire image is a link to detail page */}
      <Link
        href={`/marketplace/${product.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="focus:outline-none"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-t-xl bg-slate-100">
          {product.thumbnail_url ? (
            <img
              src={product.thumbnail_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-12 w-12 text-slate-300" aria-hidden="true" />
            </div>
          )}

          {isOutOfStock && (
            <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-semibold text-white">
              Out of Stock
            </span>
          )}
        </div>
      </Link>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-4">

        {/* Product name — links to detail page */}
        <Link
          href={`/marketplace/${product.slug}`}
          className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {product.name}
        </Link>

        {/* Brand + size */}
        {subtitle && (
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        )}

        {/* Price */}
        <p className="mt-auto font-mono text-base font-bold text-teal-700">
          {formatINR(product.base_price)}{' '}
          <span className="text-xs font-normal text-slate-500">
            / {product.unit_of_measure}
          </span>
        </p>

        {/* MOQ */}
        <p className="text-xs text-slate-400">
          Min.&nbsp;{product.moq}&nbsp;{product.unit_of_measure}
        </p>

        {/* Add to Cart button (modal variant) */}
        <AddToCartButton product={product} variant="card" />
      </div>
    </div>
  );
}
