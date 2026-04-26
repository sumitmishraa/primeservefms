/**
 * Marketplace — Product Detail Page (v2)
 *
 * Fetches the product from Supabase by slug.  If the product belongs to a
 * variant group (group_slug is set) it also fetches all siblings and renders
 * a variant-selector section so the buyer can switch between e.g. "1 Litre
 * Bottle" and "5 Litre Can" before adding to cart.
 *
 * Variant logic:
 *   - Size/format variants → pills labeled by size_variant + unit_of_measure
 *   - Colour variants       → swatch buttons (when sizes are identical but
 *                             specifications.color differs across siblings)
 *   - The selected variant's product_id / price / MOQ is what goes to cart —
 *     the buyer always gets exactly what they chose.
 *
 * PUBLIC — no auth required to browse.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { use } from 'react';
import {
  Package,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Tag,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatINR } from '@/lib/utils/formatting';
import { getCategoryLabel } from '@/lib/constants/categories';
import AddToCartButton from '@/components/marketplace/AddToCartButton';
import type { Tables } from '@/types/database';
import type { PricingTier } from '@/types/index';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

type Product = Tables<'products'>;

interface PricingTierRow {
  min_qty: number;
  max_qty: number | null;
  price: number;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable label for a product variant's size and packaging type.
 * e.g. size_variant="5 Ltr", uom="can" → "5 Ltr Can"
 */
function formatVariantLabel(sizeVariant: string | null, uom: string): string {
  const uomLabels: Record<string, string> = {
    piece: 'Piece', kg: 'Kg', liter: 'Litre', pack: 'Pack',
    box: 'Box', carton: 'Carton', roll: 'Roll', pair: 'Pair',
    set: 'Set', ream: 'Ream', pkt: 'Packet', can: 'Can',
    bottle: 'Bottle', tube: 'Tube',
  };
  const uomLabel = uomLabels[uom] ?? (uom.charAt(0).toUpperCase() + uom.slice(1));
  if (!sizeVariant) return `Per ${uomLabel}`;
  return `${sizeVariant} ${uomLabel}`;
}

/** Reads the `color` / `colour` key from a product's specifications JSONB. */
function getProductColor(product: Product): string | null {
  const specs = product.specifications as Record<string, string> | null;
  if (!specs) return null;
  return specs['color'] ?? specs['Color'] ?? specs['colour'] ?? specs['Colour'] ?? null;
}

/** Maps common colour names to a CSS hex for swatch rendering. */
const CSS_COLOR_MAP: Record<string, string> = {
  blue: '#3B82F6', red: '#EF4444', green: '#22C55E',
  yellow: '#EAB308', orange: '#F97316', purple: '#A855F7',
  pink: '#EC4899', white: '#F1F5F9', black: '#1E293B',
  grey: '#94A3B8', gray: '#94A3B8', brown: '#78350F',
  clear: '#E2E8F0', transparent: '#E2E8F0', silver: '#CBD5E1',
};

function getSwatchCss(colorName: string): string {
  return CSS_COLOR_MAP[colorName.toLowerCase()] ?? '#0D9488';
}

// ---------------------------------------------------------------------------
// StockBadge
// ---------------------------------------------------------------------------

function StockBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    in_stock:     { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', label: 'In Stock' },
    out_of_stock: { bg: 'bg-rose-100',    text: 'text-rose-800',    dot: 'bg-rose-500',    label: 'Out of Stock' },
    low_stock:    { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500',   label: 'Low Stock' },
  };
  const meta = map[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Checkmark icon for selected variant pill
// ---------------------------------------------------------------------------

function CheckIcon() {
  return (
    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [baseProduct,      setBaseProduct]      = useState<Product | null>(null);
  const [variants,         setVariants]         = useState<Product[]>([]);
  const [selectedVariant,  setSelectedVariant]  = useState<Product | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [activeImage,      setActiveImage]      = useState<string | null>(null);

  // The product whose fields are rendered in the right panel
  const product = selectedVariant ?? baseProduct;

  // ---------------------------------------------------------------------------
  // Fetch: product + siblings
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();

        const { data, error: dbErr } = await supabase
          .from('products')
          .select('*')
          .eq('slug', slug)
          .eq('is_approved', true)
          .eq('is_active', true)
          .single();

        if (dbErr || !data) {
          setError('Product not found');
          return;
        }

        setBaseProduct(data);
        setSelectedVariant(data);
        setActiveImage(data.thumbnail_url ?? data.images[0] ?? null);

        if (data.group_slug) {
          const { data: siblings } = await supabase
            .from('products')
            .select('*')
            .eq('group_slug', data.group_slug)
            .eq('is_approved', true)
            .eq('is_active', true)
            .order('base_price', { ascending: true });

          setVariants(siblings && siblings.length > 1 ? siblings : [data]);
        } else {
          setVariants([data]);
        }
      } catch {
        setError('Failed to load product');
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [slug]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleVariantSelect = useCallback((v: Product) => {
    setSelectedVariant(v);
    setActiveImage(v.thumbnail_url ?? v.images[0] ?? null);
  }, []);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 h-4 w-64 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-slate-200" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 w-16 animate-pulse rounded-xl bg-slate-200" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200" />
              <div className="flex gap-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 w-28 animate-pulse rounded-lg bg-slate-200" />
                ))}
              </div>
              <div className="h-24 w-full animate-pulse rounded-xl bg-slate-200" />
              <div className="h-14 w-full animate-pulse rounded-xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error / not-found
  // ---------------------------------------------------------------------------

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white py-24 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50">
              <AlertCircle className="h-8 w-8 text-rose-400" aria-hidden="true" />
            </div>
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
              className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              Back to Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const categoryLabel   = getCategoryLabel(product.category);
  const specs           = (product.specifications ?? {}) as Record<string, string>;
  // Filter colour key out of the specs table — it's shown in the colour picker instead
  const specEntries     = Object.entries(specs).filter(
    ([k]) => !['color', 'Color', 'colour', 'Colour'].includes(k),
  );
  const pricingTiers    = (product.pricing_tiers ?? []) as PricingTierRow[];
  const isOutOfStock    = product.stock_status === 'out_of_stock';
  const galleryImages   = product.images ?? [];

  // Variant selector logic
  const showVariants    = variants.length > 1;

  // Detect whether variants differ by size label
  const sizeLabels      = variants.map((v) => formatVariantLabel(v.size_variant, v.unit_of_measure));
  const hasDiverseSizes = new Set(sizeLabels).size > 1;

  // Detect whether variants differ by colour (and sizes are identical → standalone colour picker)
  const colourEntries   = variants
    .map((v) => ({ variant: v, color: getProductColor(v) }))
    .filter((x): x is { variant: Product; color: string } => x.color !== null);
  const distinctColors  = new Set(colourEntries.map((x) => x.color.toLowerCase()));
  const showSizePills   = showVariants && hasDiverseSizes;
  const showColorPicker = showVariants && !hasDiverseSizes && distinctColors.size > 1;

  // CartableProduct built from the currently selected variant
  const cartProduct = {
    id:              product.id,
    slug:            product.slug,
    name:            product.name,
    brand:           product.brand,
    size_variant:    product.size_variant,
    base_price:      product.base_price,
    gst_rate:        product.gst_rate,
    moq:             product.moq,
    unit_of_measure: product.unit_of_measure,
    thumbnail_url:   product.thumbnail_url,
    category:        product.category,
    stock_status:    product.stock_status,
    pricing_tiers:   pricingTiers as PricingTier[],
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav
          className="mb-6 flex items-center gap-1.5 text-xs text-slate-500"
          aria-label="Breadcrumb"
        >
          <Link href="/marketplace" className="transition-colors hover:text-teal-600">
            Marketplace
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link
            href={`/marketplace?category=${product.category}`}
            className="transition-colors hover:text-teal-600"
          >
            {categoryLabel}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="max-w-[240px] truncate font-medium text-slate-700" aria-current="page">
            {product.name}
          </span>
        </nav>

        {/* ── Main two-column grid ───────────────────────────────────── */}
        <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-[55%_1fr]">

          {/* ── LEFT: Image gallery ─────────────────────────────────── */}
          <div className="space-y-3">

            {/* Main image */}
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50/60 to-slate-50 shadow-sm">
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeImage}
                  alt={product.name}
                  className="h-full w-full object-cover transition-opacity duration-300"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                  <Package className="h-20 w-20 text-teal-300/60" strokeWidth={1.25} aria-hidden="true" />
                  <p className="text-sm text-slate-400">No image available</p>
                </div>
              )}

              {isOutOfStock && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                  <span className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-800 shadow-lg">
                    Out of Stock
                  </span>
                </div>
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
                      'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-150',
                      activeImage === img
                        ? 'border-teal-500 shadow-sm ring-1 ring-teal-500/20'
                        : 'border-transparent opacity-70 hover:border-slate-300 hover:opacity-100',
                    ].join(' ')}
                    aria-label={`View image ${idx + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={`${product.name} — image ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(
                [
                  { icon: ShieldCheck,   label: 'Quality Assured' },
                  { icon: CheckCircle2,  label: 'GST Invoice'     },
                  { icon: Tag,           label: 'Bulk Pricing'    },
                ] as const
              ).map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 bg-white px-2 py-2.5 text-center shadow-sm"
                >
                  <Icon className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  <span className="text-[10px] font-medium leading-tight text-slate-600">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Product info ─────────────────────────────────── */}
          <div className="flex flex-col gap-5">

            {/* Brand chip + category label */}
            <div className="flex flex-wrap items-center gap-2">
              {product.brand && (
                <span className="rounded-md bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
                  {product.brand}
                </span>
              )}
              <span className="text-xs text-slate-400">{categoryLabel}</span>
            </div>

            {/* Product name */}
            <div>
              <h1 className="font-heading text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                {product.name}
              </h1>
              {product.sku && (
                <p className="mt-1 font-mono text-[11px] font-medium uppercase tracking-widest text-slate-400">
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Stock badge — always visible; updates when variant changes */}
            <StockBadge status={product.stock_status} />

            {/* ── SIZE / FORMAT VARIANT SELECTOR ──────────────────── */}
            {showSizePills && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Format
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select product format">
                  {variants.map((v) => {
                    const isSelected    = v.id === product.id;
                    const isUnavailable = v.stock_status === 'out_of_stock';
                    const label         = formatVariantLabel(v.size_variant, v.unit_of_measure);
                    const vColor        = getProductColor(v);

                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVariantSelect(v)}
                        aria-pressed={isSelected}
                        aria-label={`${label}${isUnavailable ? ' — out of stock' : ''}`}
                        className={[
                          'relative flex items-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-sm font-semibold',
                          'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
                          isSelected
                            ? 'border-teal-500 bg-teal-50 text-teal-800 shadow-sm'
                            : isUnavailable
                              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 opacity-50'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50/40',
                        ].join(' ')}
                      >
                        {/* Colour dot embedded in the pill (when variants also differ by colour) */}
                        {vColor && (
                          <span
                            className="h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: getSwatchCss(vColor) }}
                            aria-hidden="true"
                          />
                        )}

                        {label}

                        {/* Price sub-label */}
                        <span
                          className={[
                            'font-mono text-xs font-normal',
                            isSelected ? 'text-teal-600' : 'text-slate-500',
                          ].join(' ')}
                        >
                          {formatINR(v.base_price)}
                        </span>

                        {/* Selected checkmark badge */}
                        {isSelected && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 shadow-sm">
                            <CheckIcon />
                          </span>
                        )}

                        {/* Out-of-stock badge */}
                        {isUnavailable && !isSelected && (
                          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-rose-600">
                            OUT
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── COLOUR-ONLY SELECTOR (same size, different colours) ── */}
            {showColorPicker && (
              <div className="space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Select Colour
                </p>
                <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Select product colour">
                  {colourEntries.map(({ variant: v, color }) => {
                    const isSelected = v.id === product.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleVariantSelect(v)}
                        aria-pressed={isSelected}
                        aria-label={`Colour: ${color}${isSelected ? ' (selected)' : ''}`}
                        className={[
                          'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-150',
                          'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
                          isSelected
                            ? 'border-teal-500 shadow-md ring-2 ring-teal-500/25'
                            : 'border-transparent hover:border-slate-300',
                        ].join(' ')}
                        style={{ backgroundColor: getSwatchCss(color) }}
                      >
                        {isSelected && <CheckIcon />}
                      </button>
                    );
                  })}
                </div>
                {getProductColor(product) && (
                  <p className="text-xs capitalize text-slate-500">
                    Selected:&nbsp;
                    <span className="font-semibold text-slate-700">
                      {getProductColor(product)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* ── PRICE CARD ──────────────────────────────────────────── */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Price per{' '}
                <span className="capitalize">{product.unit_of_measure}</span>
              </p>
              <p className="mt-1 font-mono text-3xl font-bold text-teal-700">
                {formatINR(product.base_price)}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  / <span className="capitalize">{product.unit_of_measure}</span>
                </span>
              </p>
              {pricingTiers.length > 0 && (
                <p className="mt-1.5 text-xs text-teal-600">
                  Volume discounts available — see pricing table below
                </p>
              )}
            </div>

            {/* MOQ notice */}
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-base leading-none">
                📦
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Minimum Order:&nbsp;
                  {product.moq}&nbsp;
                  <span className="capitalize">{product.unit_of_measure}</span>
                  {product.moq > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-amber-700">
                  Orders below the minimum quantity are not accepted
                </p>
              </div>
            </div>

            {/* Seller */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600">
                <ShieldCheck className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Sold by
                </p>
                <p className="font-semibold text-slate-800">PrimeServe Facility Solutions</p>
                <p className="text-xs text-teal-600">Verified B2B Supplier</p>
              </div>
            </div>

            {/* Quantity selector + Add to Cart — receives selected variant data */}
            <AddToCartButton product={cartProduct} variant="detail" />

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

        {/* ── Specifications ─────────────────────────────────────────── */}
        {specEntries.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-heading text-xl font-bold text-slate-900">
              Specifications
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {specEntries.map(([key, value]) => (
                    <tr
                      key={key}
                      className="transition-colors even:bg-slate-50/50 hover:bg-teal-50/20"
                    >
                      <td className="w-1/3 px-5 py-3.5 font-medium capitalize text-slate-600">
                        {key.replace(/_/g, ' ')}
                      </td>
                      <td className="px-5 py-3.5 text-slate-800">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── Volume pricing table ────────────────────────────────────── */}
        {pricingTiers.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-heading text-xl font-bold text-slate-900">
              Volume Pricing
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-teal-50/60">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Quantity
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Price / Unit
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Savings
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pricingTiers.map((tier, idx) => {
                    const saving    = product.base_price - tier.price;
                    const savingPct = saving > 0 ? Math.round((saving / product.base_price) * 100) : 0;
                    const isFirstTier = idx === 0;
                    return (
                      <tr
                        key={idx}
                        className="transition-colors even:bg-slate-50/50 hover:bg-teal-50/20"
                      >
                        <td className="px-5 py-3.5 text-slate-700">
                          {tier.min_qty}
                          {tier.max_qty != null ? `–${tier.max_qty}` : '+'}{' '}
                          <span className="capitalize">{product.unit_of_measure}</span>
                          {(tier.max_qty ?? 2) > 1 ? 's' : ''}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-teal-700">
                          {formatINR(tier.price)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {isFirstTier && savingPct === 0 ? (
                            <span className="text-xs text-slate-400">Base price</span>
                          ) : savingPct > 0 ? (
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              Save {savingPct}%
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ── HSN / GST footer ────────────────────────────────────────── */}
        {(product.hsn_code != null || product.gst_rate > 0) && (
          <section className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-100 bg-white px-5 py-3.5 text-xs text-slate-500 shadow-sm">
            {product.hsn_code && (
              <span>
                HSN Code:{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {product.hsn_code}
                </span>
              </span>
            )}
            {product.gst_rate > 0 && (
              <span>
                GST Rate:{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {product.gst_rate}%
                </span>
              </span>
            )}
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>All prices are exclusive of GST</span>
          </section>
        )}

      </div>
    </div>
  );
}
