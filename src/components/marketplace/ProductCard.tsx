/**
 * ProductCard — marketplace grid card for a single product.
 *
 * Displays thumbnail, name, brand/size, price, MOQ, stock badge,
 * and a "View Details" link. The entire card is clickable.
 *
 * Used in: src/app/marketplace/page.tsx
 */

'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductCardProps {
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string | null;
    size_variant: string | null;
    base_price: number;
    unit_of_measure: string;
    moq: number;
    thumbnail_url: string | null;
    category: string;
    stock_status: string;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card component for the marketplace product grid.
 * Links to /marketplace/[slug] for the full product detail view.
 *
 * @param product - Slim product shape used in list views
 */
export default function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const subtitle = [product.brand, product.size_variant].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/marketplace/${product.slug}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {/* Thumbnail */}
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

        {/* Out of stock overlay badge */}
        {isOutOfStock && (
          <span className="absolute left-2 top-2 rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-semibold text-white">
            Out of Stock
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Product name */}
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
          {product.name}
        </p>

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

        {/* CTA button */}
        <span
          className={[
            'mt-1 block w-full rounded-lg py-2 text-center text-sm font-medium transition-colors',
            isOutOfStock
              ? 'cursor-not-allowed bg-slate-100 text-slate-400'
              : 'bg-teal-600 text-white group-hover:bg-teal-700',
          ].join(' ')}
        >
          View Details
        </span>
      </div>
    </Link>
  );
}
