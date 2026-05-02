/**
 * ProductCard — marketplace grid card for a single product.
 *
 * Layout matches the B2B marketplace reference:
 *   - Top half: light teal tint image area with a stock badge (top-left)
 *     and a heart/wishlist icon (top-right)
 *   - Bottom half: SKU, product name, one clear product price, MOQ,
 *     and Add to Cart button
 *
 * The card links to /marketplace/[slug]; the Add to Cart button opens the
 * quantity modal (login-gated).
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, Heart } from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
import AddToCartButton from './AddToCartButton';
import type { CartableProduct } from './AddToCartButton';

interface ProductCardProps {
  product: CartableProduct;
}

function productImageAlt(product: CartableProduct): string {
  const size = product.size_variant ? ` ${product.size_variant}` : '';
  return `Buy ${product.name}${size} online for B2B housekeeping procurement`;
}

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const isOutOfStock = product.stock_status === 'out_of_stock';
  const isLowStock = product.stock_status === 'low_stock';
  const sku = product.id.slice(0, 8).toUpperCase();
  const detailHref = `/marketplace/${product.slug}`;

  const openDetails = (target: EventTarget): boolean => {
    if (target instanceof Element && target.closest('a, button, input, select, textarea')) {
      return false;
    }
    router.push(detailHref);
    return true;
  };

  return (
    <article
      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors hover:border-teal-300 focus-within:border-teal-300"
      onClick={(e) => openDetails(e.target)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (openDetails(e.target)) e.preventDefault();
        }
      }}
      tabIndex={0}
      aria-label={`View ${product.name}`}
    >
      {/* Image area */}
      <Link
        href={detailHref}
        className="relative block aspect-square w-full overflow-hidden bg-slate-50"
      >
        {product.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.thumbnail_url}
            alt={productImageAlt(product)}
            className="h-full w-full object-contain p-5 transition-transform duration-300 group-hover:scale-105"
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
        {/* SKU + size-variant chip */}
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {sku}
          </p>
          {product.size_variant && (
            <span className="truncate rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {product.size_variant}
            </span>
          )}
        </div>

        {/* Name */}
        <Link
          href={detailHref}
          className="line-clamp-2 font-heading text-sm font-bold leading-snug text-slate-900 hover:text-teal-700"
        >
          {product.name}
        </Link>

        {/* Price only on card; GST breakdown lives on the product page. */}
        <div className="mt-1">
          <p className="font-heading text-base font-bold leading-tight text-teal-700">
            {formatINR(product.base_price)}
            <span className="ml-1 text-[10px] font-normal text-slate-500">
              / {product.unit_of_measure}
            </span>
          </p>
        </div>

        {/* MOQ hint */}
        <p className="text-[11px] text-slate-500">
          Min. {product.moq} {product.unit_of_measure}
        </p>

        {/* Add to Cart */}
        <div className="mt-2">
          <AddToCartButton product={product} variant="card" />
        </div>
      </div>
    </article>
  );
}
