/**
 * Marketplace — Product Detail Page
 *
 * Fetches the product directly from Supabase (browser client) using the slug.
 * Only publicly visible products (is_approved + is_active) are shown.
 *
 * Sections:
 *   - Breadcrumb
 *   - Image gallery (main + thumbnails) or placeholder
 *   - Name, brand, size, stock badge
 *   - Price + MOQ
 *   - Description
 *   - Specifications table (from JSONB)
 *   - Pricing tiers table
 *   - "Add to Cart" button (disabled with tooltip — cart is Phase 4)
 *
 * PUBLIC — no auth required.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import {
  Package,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatINR } from '@/lib/utils/formatting';
import { getCategoryLabel } from '@/lib/constants/categories';
import AddToCartButton from '@/components/marketplace/AddToCartButton';
import type { Tables } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = Tables<'products'>;

interface PricingTierRow {
  min_qty: number;
  max_qty: number | null;
  price: number;
}

// ---------------------------------------------------------------------------
// Stock badge
// ---------------------------------------------------------------------------

/**
 * Coloured badge for product stock status.
 *
 * @param status - stock_status enum value from the DB
 */
function StockBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    in_stock:     { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'In Stock' },
    out_of_stock: { bg: 'bg-rose-100',    text: 'text-rose-800',    label: 'Out of Stock' },
    low_stock:    { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Low Stock' },
  };
  const meta = map[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Product detail page. Fetches by slug from Supabase using the browser client.
 * Handles loading, not-found, and error states.
 *
 * @param params - Next.js dynamic route params ({ slug: string })
 */
export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [product,      setProduct]      = useState<Product | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [activeImage,  setActiveImage]  = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: dbError } = await supabase
          .from('products')
          .select('*')
          .eq('slug', slug)
          .eq('is_approved', true)
          .eq('is_active', true)
          .single();

        if (dbError || !data) {
          setError('Product not found');
          return;
        }

        setProduct(data);
        // Default active image to thumbnail or first image in gallery
        setActiveImage(data.thumbnail_url ?? data.images[0] ?? null);
      } catch {
        setError('Failed to load product');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [slug]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Image skeleton */}
            <div className="space-y-3">
              <div className="aspect-square w-full animate-pulse rounded-xl bg-slate-200" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 w-16 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
            </div>
            {/* Info skeleton */}
            <div className="space-y-4">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
              <div className="h-10 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-20 w-full animate-pulse rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error / not-found state
  // ---------------------------------------------------------------------------

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white py-24 text-center">
            <AlertCircle className="h-12 w-12 text-rose-400" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-slate-800">
                {error ?? 'Product not found'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This product may have been removed or the link is incorrect.
              </p>
            </div>
            <Link
              href="/marketplace"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const categoryLabel = getCategoryLabel(product.category);
  const subtitle      = [product.brand, product.size_variant].filter(Boolean).join(' · ');
  const specs         = product.specifications as Record<string, string>;
  const specEntries   = Object.entries(specs ?? {});
  const pricingTiers  = (product.pricing_tiers ?? []) as PricingTierRow[];
  const isOutOfStock  = product.stock_status === 'out_of_stock';
  const galleryImages = product.images ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <Link href="/marketplace" className="hover:text-teal-600">
            Marketplace
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            href={`/marketplace?category=${product.category}`}
            className="hover:text-teal-600"
          >
            {categoryLabel}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="max-w-xs truncate text-slate-700" aria-current="page">
            {product.name}
          </span>
        </nav>

        {/* Main grid */}
        <div className="grid gap-10 lg:grid-cols-2">

          {/* Left — Image gallery */}
          <div className="space-y-3">
            {/* Main image */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Package className="h-20 w-20 text-slate-300" aria-hidden="true" />
                </div>
              )}

              {isOutOfStock && (
                <span className="absolute left-3 top-3 rounded-full bg-rose-500 px-3 py-1 text-xs font-semibold text-white">
                  Out of Stock
                </span>
              )}
            </div>

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={[
                      'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      activeImage === img
                        ? 'border-teal-500'
                        : 'border-transparent hover:border-slate-300',
                    ].join(' ')}
                    aria-label={`View image ${idx + 1}`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} image ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right — Product info */}
          <div className="flex flex-col gap-5">
            {/* Name + brand */}
            <div>
              {subtitle && (
                <p className="mb-1 text-sm text-slate-500">{subtitle}</p>
              )}
              <h1 className="font-heading text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                {product.name}
              </h1>
            </div>

            {/* Stock status */}
            <StockBadge status={product.stock_status} />

            {/* Base price label (shown above the interactive quantity selector) */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Starting price
              </p>
              <p className="font-mono text-2xl font-bold text-teal-700">
                {formatINR(product.base_price)}
                <span className="ml-1 text-sm font-normal text-slate-500">
                  / {product.unit_of_measure}
                </span>
              </p>
            </div>

            {/* MOQ notice */}
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <span className="text-sm font-medium text-amber-800">
                Minimum Order: {product.moq}&nbsp;{product.unit_of_measure}
              </span>
            </div>

            {/* Seller */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Sold by
              </p>
              <p className="mt-1 font-semibold text-slate-800">PrimeServe Facility Solutions</p>
              <p className="text-xs text-slate-500">Verified B2B Supplier</p>
            </div>

            {/* Quantity selector + Add to Cart (live price, tier hints, subtotal) */}
            <AddToCartButton
              product={{
                id:               product.id,
                slug:             product.slug,
                name:             product.name,
                brand:            product.brand,
                size_variant:     product.size_variant,
                base_price:       product.base_price,
                gst_rate:         product.gst_rate,
                moq:              product.moq,
                unit_of_measure:  product.unit_of_measure,
                thumbnail_url:    product.thumbnail_url,
                category:         product.category,
                stock_status:     product.stock_status,
                pricing_tiers:    pricingTiers,
              }}
              variant="detail"
            />

            {/* Description */}
            {product.description && (
              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Description
                </h2>
                <p className="text-sm leading-relaxed text-slate-700">
                  {product.description}
                </p>
              </section>
            )}
          </div>
        </div>

        {/* Specifications table */}
        {specEntries.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-heading text-lg font-bold text-slate-900">
              Specifications
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {specEntries.map(([key, value]) => (
                    <tr key={key} className="even:bg-slate-50/50">
                      <td className="w-1/3 px-4 py-3 font-medium capitalize text-slate-600">
                        {key.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-slate-800">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Pricing tiers table */}
        {pricingTiers.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-heading text-lg font-bold text-slate-900">
              Volume Pricing
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Price / Unit
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pricingTiers.map((tier, idx) => (
                    <tr key={idx} className="even:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700">
                        {tier.min_qty}
                        {tier.max_qty != null ? ` – ${tier.max_qty}` : '+'}
                        &nbsp;{product.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-teal-700">
                        {formatINR(tier.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* HSN + GST metadata */}
        {(product.hsn_code ?? product.gst_rate > 0) && (
          <section className="mt-6 flex flex-wrap gap-4 text-xs text-slate-500">
            {product.hsn_code && (
              <span>HSN Code: <span className="font-mono font-medium text-slate-700">{product.hsn_code}</span></span>
            )}
            {product.gst_rate > 0 && (
              <span>GST: <span className="font-mono font-medium text-slate-700">{product.gst_rate}%</span></span>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
