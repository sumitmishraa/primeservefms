/**
 * Marketplace — Product Detail Page (v3)
 *
 * Premium B2B product page with:
 *   - Hero gallery with prev/next + thumbnail strip + zoom-on-hover
 *   - Sticky right "buy box" on desktop scroll
 *   - Variant SELECTOR CARDS (size/litre/format) with price, MOQ, savings,
 *     "Best value" / "Most popular" badges, out-of-stock striping
 *   - Colour swatch picker (when sizes match but colour differs)
 *   - Volume savings calculator strip (next-tier nudge)
 *   - Tabbed/sectioned details: Description · Specifications · Volume Pricing
 *     · Why this product · Delivery & Invoicing
 *   - Related products carousel (same category, by total_orders desc)
 *   - Mobile sticky bottom bar (price + jump-to-cart)
 *   - All variant switches preserve correct cart product_id, price, MOQ
 *
 * Variant model: products sharing `group_slug` are siblings.  The buyer
 * can switch between them and the exact selected variant is what reaches
 * the cart.  Each variant retains its own price, MOQ, unit_of_measure,
 * stock status, and pricing_tiers.
 *
 * PUBLIC — no auth required to view.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { use } from 'react';
import {
  Package,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  ShieldCheck,
  Tag,
  Truck,
  FileText,
  Sparkles,
  Phone,
  Info,
  PackageCheck,
} from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout';
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

const UOM_LABELS: Record<string, string> = {
  piece: 'Piece', kg: 'Kg', liter: 'Litre', pack: 'Pack',
  box: 'Box', carton: 'Carton', roll: 'Roll', pair: 'Pair',
  set: 'Set', ream: 'Ream', pkt: 'Packet', can: 'Can',
  bottle: 'Bottle', tube: 'Tube',
};

function uomLabel(uom: string): string {
  return UOM_LABELS[uom] ?? (uom.charAt(0).toUpperCase() + uom.slice(1));
}

/** "5 Ltr Can", "500ml Bottle", "Per Piece" */
function formatVariantLabel(sizeVariant: string | null, uom: string): string {
  const u = uomLabel(uom);
  if (!sizeVariant) return `Per ${u}`;
  return `${sizeVariant} ${u}`;
}

function productSeoSummary(product: Product, categoryLabel: string): string {
  const short = product.short_description?.trim();
  if (short) return short;

  const long = product.description?.replace(/\s+/g, ' ').trim();
  if (long) return long.length > 180 ? `${long.slice(0, 177).trim()}...` : long;

  const size = product.size_variant ? ` ${product.size_variant}` : '';
  const brand = product.brand ? `${product.brand} ` : '';
  return `Buy ${brand}${product.name}${size} for ${categoryLabel.toLowerCase()} procurement with GST invoice and bulk B2B delivery from PrimeServe.`;
}

function productImageAlt(productName: string, sizeVariant: string | null, categoryLabel: string): string {
  const size = sizeVariant ? ` ${sizeVariant}` : '';
  return `Buy ${productName}${size} online for ${categoryLabel.toLowerCase()} B2B procurement`;
}

function getProductColor(p: Product): string | null {
  const specs = p.specifications as Record<string, string> | null;
  if (!specs) return null;
  return specs['color'] ?? specs['Color'] ?? specs['colour'] ?? specs['Colour'] ?? null;
}

const CSS_COLOR_MAP: Record<string, string> = {
  blue: '#3B82F6', red: '#EF4444', green: '#22C55E',
  yellow: '#EAB308', orange: '#F97316', purple: '#A855F7',
  pink: '#EC4899', white: '#F8FAFC', black: '#1E293B',
  grey: '#94A3B8', gray: '#94A3B8', brown: '#78350F',
  clear: '#E2E8F0', transparent: '#E2E8F0', silver: '#CBD5E1',
};

function getSwatchCss(name: string): string {
  return CSS_COLOR_MAP[name.toLowerCase()] ?? '#0D9488';
}

/** Lowest tier price across the array (used to show "From ₹X" hints). */
function lowestPrice(tiers: PricingTierRow[], basePrice: number): number {
  if (!tiers || tiers.length === 0) return basePrice;
  return Math.min(basePrice, ...tiers.map((t) => t.price));
}

/** Choose the next price tier the buyer hasn't yet reached. */
function nextTier(tiers: PricingTierRow[], qty: number): PricingTierRow | null {
  return tiers
    .slice()
    .sort((a, b) => a.min_qty - b.min_qty)
    .find((t) => t.min_qty > qty) ?? null;
}

/**
 * Computes which variant gets which badge.
 *   "best-value"   — variant with the cheapest per-unit price (incl. tiers)
 *   "most-popular" — variant with the highest total_orders, if it differs
 *                    from best-value and total_orders > 0.
 */
function computeVariantBadges(
  variants: Product[],
  enabled: boolean,
): Map<string, 'best-value' | 'most-popular'> {
  const m = new Map<string, 'best-value' | 'most-popular'>();
  if (!enabled || variants.length < 2) return m;

  let bestValueId  = '';
  let bestValuePer = Infinity;
  for (const v of variants) {
    const t = (v.pricing_tiers ?? []) as PricingTierRow[];
    const p = lowestPrice(t, v.base_price);
    if (p < bestValuePer) { bestValuePer = p; bestValueId = v.id; }
  }
  if (bestValueId) m.set(bestValueId, 'best-value');

  const sortedByOrders = [...variants].sort(
    (a, b) => (b.total_orders ?? 0) - (a.total_orders ?? 0),
  );
  const top = sortedByOrders[0];
  if (top && top.id !== bestValueId && (top.total_orders ?? 0) > 0) {
    m.set(top.id, 'most-popular');
  }
  return m;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StockBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    in_stock:     { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'In Stock'     },
    out_of_stock: { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Out of Stock' },
    low_stock:    { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Low Stock'    },
  };
  const m = map[status] ?? { bg: 'bg-slate-50', text: 'text-slate-600', dot: 'bg-slate-400', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-current/10 px-3 py-1 text-xs font-semibold ${m.bg} ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
      {m.label}
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface VariantCardProps {
  variant: Product;
  isSelected: boolean;
  badge?: 'best-value' | 'most-popular' | null;
  onSelect: (v: Product) => void;
}

/**
 * Visual variant selector card.  Bigger and richer than a pill — shows
 * format label, price, MOQ, savings %, optional badge.  Selected variant
 * gets a teal halo + checkmark.  Out-of-stock variants are striped.
 */
function VariantCard({ variant, isSelected, badge, onSelect }: VariantCardProps) {
  const isUnavailable = variant.stock_status === 'out_of_stock';
  const label         = formatVariantLabel(variant.size_variant, variant.unit_of_measure);
  const tiers         = (variant.pricing_tiers ?? []) as PricingTierRow[];
  const bestPrice     = lowestPrice(tiers, variant.base_price);
  const savings       = variant.base_price - bestPrice;
  const savingPct     = savings > 0 ? Math.round((savings / variant.base_price) * 100) : 0;
  const colour        = getProductColor(variant);

  return (
    <button
      type="button"
      onClick={() => onSelect(variant)}
      aria-pressed={isSelected}
      aria-label={`${label}${isUnavailable ? ' — out of stock' : ''}`}
      className={[
        'group relative flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3.5 text-left',
        'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
        isSelected
          ? 'pdp-selected-glow border-teal-500 bg-teal-50/70'
          : isUnavailable
            ? 'pdp-stripes-disabled cursor-not-allowed border-slate-200 bg-slate-50 opacity-70'
            : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50/30 hover:shadow-md',
      ].join(' ')}
    >
      {/* Badges */}
      {badge && !isUnavailable && (
        <span className={[
          'absolute -top-2 left-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm',
          badge === 'best-value'
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
        ].join(' ')}>
          {badge === 'best-value' ? '★ Best value' : '🔥 Most popular'}
        </span>
      )}

      {/* Selected check */}
      {isSelected && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500 shadow-md ring-2 ring-white">
          <CheckIcon />
        </span>
      )}

      {/* OUT badge */}
      {isUnavailable && !isSelected && (
        <span className="absolute right-2 top-2 rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold leading-none text-rose-700">
          OUT
        </span>
      )}

      {/* Header row: colour dot + label */}
      <div className="flex w-full items-center gap-2">
        {colour && (
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: getSwatchCss(colour) }}
            aria-hidden="true"
          />
        )}
        <span className={[
          'text-sm font-bold leading-tight',
          isSelected ? 'text-teal-800' : 'text-slate-800',
        ].join(' ')}>
          {label}
        </span>
      </div>

      {/* Price row */}
      <div className="flex w-full items-baseline gap-1.5">
        <span className={[
          'font-heading text-base font-bold',
          isSelected ? 'text-teal-700' : 'text-slate-900',
        ].join(' ')}>
          {formatINR(variant.base_price)}
        </span>
        {savingPct > 0 && (
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
            -{savingPct}%
          </span>
        )}
      </div>

      {/* MOQ row */}
      <span className="text-[11px] text-slate-500">
        MOQ&nbsp;{variant.moq}&nbsp;
        <span className="capitalize">{variant.unit_of_measure}</span>
        {variant.moq > 1 ? 's' : ''}
        {tiers.length > 0 && (
          <>
            &nbsp;·&nbsp;<span className="text-teal-600">From {formatINR(bestPrice)}</span>
          </>
        )}
      </span>
    </button>
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

  const [baseProduct,     setBaseProduct]     = useState<Product | null>(null);
  const [variants,        setVariants]        = useState<Product[]>([]);
  const [related,         setRelated]         = useState<Product[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);
  const [activeImageIdx,  setActiveImageIdx]  = useState(0);
  const [isLoading,       setIsLoading]       = useState(true);
  const [error,           setError]           = useState<string | null>(null);
  const [activeTab,       setActiveTab]       = useState<TabKey>('description');

  const cartSectionRef = useRef<HTMLDivElement>(null);

  // The product being displayed (selected variant, or base product fallback)
  const product = selectedVariant ?? baseProduct;

  // ---------------------------------------------------------------------------
  // Fetch product, siblings, and related items
  // ---------------------------------------------------------------------------

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(slug)}`);
        const json = (await res.json()) as {
          data: { product: Product; variants: Product[]; related: Product[] } | null;
          error: string | null;
        };

        if (!res.ok || json.error || !json.data) {
          setError(json.error ?? 'Product not found');
          return;
        }

        const { product: data, variants: sibs, related: rel } = json.data;
        setBaseProduct(data);
        setSelectedVariant(data);
        setActiveImageIdx(0);
        setVariants(sibs);
        setRelated(rel);
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
    setActiveImageIdx(0);
  }, []);

  const scrollToCart = useCallback(() => {
    cartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ---------------------------------------------------------------------------
  // Loading skeleton
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-6 h-4 w-64 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-8 lg:grid-cols-2 xl:grid-cols-[55%_1fr]">
            <div className="space-y-3">
              <div className="aspect-square w-full animate-pulse rounded-3xl bg-slate-200" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-16 w-16 animate-pulse rounded-xl bg-slate-200" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
              <div className="h-10 w-3/4 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-32 animate-pulse rounded-full bg-slate-200" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
                ))}
              </div>
              <div className="h-32 w-full animate-pulse rounded-2xl bg-slate-200" />
              <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-200" />
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
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white py-24 text-center shadow-sm">
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
  // Derived values
  // ---------------------------------------------------------------------------

  const categoryLabel = getCategoryLabel(product.category);
  const seoSummary    = productSeoSummary(product, categoryLabel);
  const imageAlt      = productImageAlt(product.name, product.size_variant, categoryLabel);
  const specs         = (product.specifications ?? {}) as Record<string, string>;
  const specEntries   = Object.entries(specs).filter(
    ([k]) => !['color', 'Color', 'colour', 'Colour'].includes(k),
  );
  const pricingTiers  = (product.pricing_tiers ?? []) as PricingTierRow[];
  const isOutOfStock  = product.stock_status === 'out_of_stock';
  const galleryImages: string[] = product.images && product.images.length > 0
    ? product.images
    : (product.thumbnail_url ? [product.thumbnail_url] : []);
  const activeImage   = galleryImages[activeImageIdx] ?? null;
  const lowest        = lowestPrice(pricingTiers, product.base_price);
  const maxSavingPct  = Math.round(((product.base_price - lowest) / product.base_price) * 100);
  const isChemical    = product.category === 'cleaning_chemicals';

  // Variant selector logic
  const showVariants  = variants.length > 1;
  const sizeLabels    = variants.map((v) => formatVariantLabel(v.size_variant, v.unit_of_measure));
  const hasDiverseSizes = new Set(sizeLabels).size > 1;
  const colourEntries = variants
    .map((v) => ({ variant: v, color: getProductColor(v) }))
    .filter((x): x is { variant: Product; color: string } => x.color !== null);
  const distinctColours = new Set(colourEntries.map((x) => x.color.toLowerCase()));
  const showSizeCards   = showVariants && hasDiverseSizes;
  const showColourPicker = showVariants && !hasDiverseSizes && distinctColours.size > 1;

  // Variant badges: cheapest per-unit = "best value", most-ordered = "most popular"
  const variantBadges = computeVariantBadges(variants, showSizeCards);

  // CartableProduct built from selected variant
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

  const moqNextTier = nextTier(pricingTiers, product.moq);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
    <PublicHeader />
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">

        {/* ── Breadcrumb ──────────────────────────────────────────────── */}
        <nav
          className="mb-5 flex items-center gap-1.5 text-xs text-slate-500"
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
          <span className="max-w-[260px] truncate font-medium text-slate-700" aria-current="page">
            {product.name}
          </span>
        </nav>

        {/* ════════ HERO GRID (gallery + sticky buy box) ════════════════ */}
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-[52%_1fr] lg:items-start">

          {/* ── LEFT: Image gallery ─────────────────────────────────── */}
          <div className="space-y-2">

            <ProductGallery
              key={product.id}
              imageAlt={imageAlt}
              images={galleryImages}
              activeIdx={activeImageIdx}
              onSelect={setActiveImageIdx}
              isOutOfStock={isOutOfStock}
              maxSavingPct={maxSavingPct}
              activeImage={activeImage}
            />

          </div>

          {/* ── RIGHT: Sticky buy box ───────────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-20" ref={cartSectionRef}>

            {/* Brand row */}
            <div className="flex flex-wrap items-center gap-2">
              {product.brand && (
                <span className="rounded-md bg-gradient-to-r from-teal-600 to-teal-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
                  {product.brand}
                </span>
              )}
              {product.brand && <span className="text-xs text-slate-400">·</span>}
              <span className="text-xs text-slate-500">{categoryLabel}</span>
            </div>

            {/* Product name */}
            <div key={`title-${product.id}`} className="pdp-fade-up">
              <h1 className="font-heading text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                {product.name}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {seoSummary}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <StockBadge status={product.stock_status} />
              {product.total_orders > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {product.total_orders}+ orders fulfilled
                </span>
              )}
            </div>

            {/* ── VARIANT (size/format) CARDS ──────────────────────── */}
            {showSizeCards && (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {isChemical ? 'Choose Litre / Format' : 'Choose Size / Format'}
                  </p>
                  <span className="text-[11px] text-slate-400">
                    {variants.length} option{variants.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div
                  className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="Select product format"
                >
                  {variants.map((v) => (
                    <VariantCard
                      key={v.id}
                      variant={v}
                      isSelected={v.id === product.id}
                      badge={variantBadges.get(v.id) ?? null}
                      onSelect={handleVariantSelect}
                    />
                  ))}
                </div>
                {isChemical && (
                  <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
                    <Info className="mt-0.5 h-3 w-3 shrink-0 text-teal-500" aria-hidden="true" />
                    <span>
                      Larger packs offer better per-litre value — ideal for monthly
                      facility use. Each format is shipped in its own sealed container.
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* ── COLOUR PICKER ────────────────────────────────────── */}
            {showColourPicker && (
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Choose Colour
                </p>
                <div className="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Select product colour">
                  {colourEntries.map(({ variant: v, color }) => {
                    const isSelected = v.id === product.id;
                    return (
                      <div key={v.id} className="flex flex-col items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleVariantSelect(v)}
                          aria-pressed={isSelected}
                          aria-label={`Colour: ${color}${isSelected ? ' (selected)' : ''}`}
                          className={[
                            'flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all duration-150',
                            'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
                            isSelected
                              ? 'border-teal-500 shadow-md ring-2 ring-teal-500/25'
                              : 'border-white shadow-sm hover:scale-105',
                          ].join(' ')}
                          style={{ backgroundColor: getSwatchCss(color) }}
                        >
                          {isSelected && <CheckIcon />}
                        </button>
                        <span className="text-[10px] font-medium capitalize text-slate-600">
                          {color}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PRICE CARD ───────────────────────────────────────── */}
            <div
              key={`price-${product.id}`}
              className="pdp-fade-up rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-teal-50/40 p-4 shadow-sm"
            >
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Rate per <span className="capitalize">{product.unit_of_measure}</span>
                {product.size_variant && <> · {product.size_variant}</>}
              </p>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-heading text-3xl font-extrabold text-teal-700 sm:text-4xl">
                  {formatINR(product.base_price)}
                </span>
                {maxSavingPct > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                    Save up to {maxSavingPct}%
                  </span>
                )}
              </div>

              {/* Explicit GST breakdown */}
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Rate</p>
                  <p className="mt-0.5 font-heading text-sm font-bold text-slate-900">
                    {formatINR(product.base_price)}
                  </p>
                </div>
                <div className="border-x border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    GST&nbsp;{product.gst_rate}%
                  </p>
                  <p className="mt-0.5 font-heading text-sm font-bold text-slate-700">
                    {formatINR(product.base_price * product.gst_rate / 100)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Incl. GST</p>
                  <p className="mt-0.5 font-heading text-sm font-bold text-emerald-700">
                    {formatINR(product.base_price * (1 + product.gst_rate / 100))}
                  </p>
                </div>
              </div>
              {product.hsn_code && (
                <p className="mt-2 text-[11px] text-slate-500">
                  HSN&nbsp;<span className="font-mono font-semibold text-slate-700">{product.hsn_code}</span>
                  &nbsp;· GST-compliant B2B invoicing
                </p>
              )}

              {pricingTiers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('pricing')}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  See volume pricing
                </button>
              )}
            </div>

            {/* MOQ + bulk-savings hint */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                <Tag className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <div className="leading-tight">
                  <p className="text-xs font-semibold text-amber-900">
                    MOQ: {product.moq}&nbsp;
                    <span className="capitalize">{product.unit_of_measure}</span>
                    {product.moq > 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-amber-700">Minimum order quantity</p>
                </div>
              </div>

              {moqNextTier && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                  <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <div className="leading-tight">
                    <p className="text-xs font-semibold text-emerald-900">
                      Buy {moqNextTier.min_qty}+ at {formatINR(moqNextTier.price)}
                    </p>
                    <p className="text-[10px] text-emerald-700">Unlock volume discount</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quantity + Add to Cart (existing component, receives selected variant) */}
            <AddToCartButton product={cartProduct} variant="detail" />


          </div>
        </div>

        {/* ════════ DETAILS TAB SECTION ═════════════════════════════════ */}
        <section className="mt-12">
          <TabBar active={activeTab} onChange={setActiveTab} hasSpecs={specEntries.length > 0} hasTiers={pricingTiers.length > 0} />

          <div className="mt-5">
            {activeTab === 'description' && (
              <DescriptionPanel
                description={product.description ?? seoSummary}
                isChemical={isChemical}
                productName={product.name}
                hsnCode={product.hsn_code}
                gstRate={product.gst_rate}
              />
            )}

            {activeTab === 'specifications' && specEntries.length > 0 && (
              <SpecificationsTable entries={specEntries} />
            )}

            {activeTab === 'pricing' && pricingTiers.length > 0 && (
              <VolumePricingTable
                tiers={pricingTiers}
                basePrice={product.base_price}
                uom={product.unit_of_measure}
              />
            )}

            {activeTab === 'shipping' && (
              <ShippingPanel />
            )}
          </div>
        </section>

        {/* ════════ RELATED PRODUCTS ════════════════════════════════════ */}
        {related.length > 0 && (
          <section className="mt-14">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-heading text-xl font-bold text-slate-900">
                You might also like
              </h2>
              <Link
                href={`/marketplace?category=${product.category}`}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                View all {categoryLabel.toLowerCase()} →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {related.map((r) => (
                <RelatedProductCard key={r.id} product={r} />
              ))}
            </div>
          </section>
        )}

      </div>

      {/* ════════ MOBILE STICKY FOOTER ═══════════════════════════════════ */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-heading text-lg font-extrabold text-teal-700">
              {formatINR(product.base_price)}
              <span className="ml-1 text-[10px] font-normal text-slate-500">
                / <span className="capitalize">{product.unit_of_measure}</span>
              </span>
            </p>
            <p className="truncate text-[11px] text-slate-500">
              + GST {product.gst_rate}% ·&nbsp;
              <span className="font-semibold text-emerald-700">
                {formatINR(product.base_price * (1 + product.gst_rate / 100))} incl.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={scrollToCart}
            disabled={isOutOfStock}
            className={[
              'shrink-0 rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-colors',
              isOutOfStock
                ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                : 'bg-teal-600 text-white hover:bg-teal-700 active:scale-95',
            ].join(' ')}
          >
            {isOutOfStock ? 'Out of Stock' : 'Choose & Buy'}
          </button>
        </div>
      </div>

    </div>
    <PublicFooter />
    </>
  );
}

// ===========================================================================
// SUPPORTING COMPONENTS
// ===========================================================================

// ---------------------------------------------------------------------------
// ProductGallery — main image, prev/next, counter, thumbnail strip
// ---------------------------------------------------------------------------

interface ProductGalleryProps {
  imageAlt: string;
  images: string[];
  activeIdx: number;
  activeImage: string | null;
  onSelect: (idx: number) => void;
  isOutOfStock: boolean;
  maxSavingPct: number;
}

function ProductGallery({
  imageAlt, images, activeIdx, activeImage, onSelect, isOutOfStock, maxSavingPct,
}: ProductGalleryProps) {
  const total = images.length;
  const goPrev = () => onSelect((activeIdx - 1 + total) % total);
  const goNext = () => onSelect((activeIdx + 1) % total);

  return (
    <>
      <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-teal-50/50 to-slate-50 shadow-sm">
        {activeImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeImage}
            alt={imageAlt}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <Package className="h-24 w-24 text-teal-300/60" strokeWidth={1.25} aria-hidden="true" />
            <p className="text-sm text-slate-400">No image available</p>
          </div>
        )}

        {/* Top badges */}
        {maxSavingPct > 0 && !isOutOfStock && (
          <span className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md">
            Save up to {maxSavingPct}%
          </span>
        )}

        {/* Out-of-stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
            <span className="rounded-full bg-white px-5 py-2 text-sm font-bold text-slate-800 shadow-lg">
              Out of Stock
            </span>
          </div>
        )}

        {/* Prev/Next nav */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next image"
              className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>

            {/* Counter pill */}
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 font-mono text-[11px] font-medium text-white backdrop-blur">
              {activeIdx + 1} / {total}
            </span>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={`${img}-${idx}`}
              type="button"
              onClick={() => onSelect(idx)}
              className={[
                'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-150',
                activeIdx === idx
                  ? 'border-teal-500 shadow-sm ring-1 ring-teal-500/20'
                  : 'border-transparent opacity-70 hover:border-slate-300 hover:opacity-100',
              ].join(' ')}
              aria-label={`View image ${idx + 1}`}
              aria-current={activeIdx === idx}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img}
                alt={`${imageAlt} - image ${idx + 1}`}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// TrustPill — small icon + 2-line label
// ---------------------------------------------------------------------------

interface TrustPillProps {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  title: string;
  subtitle: string;
}

function TrustPill({ icon: Icon, title, subtitle }: TrustPillProps) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50">
        <Icon className="h-4 w-4 text-teal-600" aria-hidden />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold text-slate-800">{title}</p>
        <p className="truncate text-[10px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabBar — pill-style tab navigation for the details section
// ---------------------------------------------------------------------------

type TabKey = 'description' | 'specifications' | 'pricing' | 'shipping';

interface TabBarProps {
  active: TabKey;
  onChange: (k: TabKey) => void;
  hasSpecs: boolean;
  hasTiers: boolean;
}

function TabBar({ active, onChange, hasSpecs, hasTiers }: TabBarProps) {
  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'description',    label: 'Description',     show: true     },
    { key: 'specifications', label: 'Specifications',  show: hasSpecs },
    { key: 'pricing',        label: 'Volume Pricing',  show: hasTiers },
    { key: 'shipping',       label: 'Delivery & GST',  show: true     },
  ];

  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
      {tabs.filter((t) => t.show).map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={[
            'shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
            active === t.key
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ].join(' ')}
          aria-current={active === t.key}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DescriptionPanel
// ---------------------------------------------------------------------------

function DescriptionPanel({
  description, isChemical, productName, hsnCode, gstRate,
}: {
  description: string | null;
  isChemical: boolean;
  productName: string;
  hsnCode: string | null;
  gstRate: number;
}) {
  return (
    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
      <div className="sm:col-span-2">
        {description ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {description}
          </p>
        ) : (
          <p className="text-sm italic text-slate-400">
            No description provided. Contact sales for a detailed datasheet.
          </p>
        )}

        {isChemical && (
          <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/50 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-700">
              💡 B2B Tip
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              For monthly facility usage, the larger pack (5L can / 10L drum) typically
              offers 15-25% better per-litre value. Stocked items can be reordered with
              one click from your buyer dashboard.
            </p>
          </div>
        )}
      </div>

      <aside className="space-y-2.5 rounded-xl bg-slate-50 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          At a glance
        </p>
        <KvRow k="Product"   v={productName} />
        {hsnCode && <KvRow k="HSN Code"  v={hsnCode} mono />}
        <KvRow k="GST Rate"  v={`${gstRate}%`} mono />
        <KvRow k="Invoicing" v="GST B2B invoice" />
        <KvRow k="Pricing"   v="Bulk tiers" />
      </aside>
    </div>
  );
}

function KvRow({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0">
      <span className="text-[11px] text-slate-500">{k}</span>
      <span className={[
        'text-right text-xs font-semibold text-slate-800',
        mono ? 'font-mono' : '',
      ].join(' ')}>
        {v}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SpecificationsTable
// ---------------------------------------------------------------------------

function SpecificationsTable({ entries }: { entries: [string, string][] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-slate-100">
          {entries.map(([key, value]) => (
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
  );
}

// ---------------------------------------------------------------------------
// VolumePricingTable — with "savings %" column
// ---------------------------------------------------------------------------

function VolumePricingTable({
  tiers, basePrice, uom,
}: {
  tiers: PricingTierRow[];
  basePrice: number;
  uom: string;
}) {
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-gradient-to-r from-teal-50 to-teal-50/30">
            <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-600">
              Quantity
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
              Price / Unit
            </th>
            <th className="px-5 py-3.5 text-right text-xs font-bold uppercase tracking-wider text-slate-600">
              Savings
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((tier, idx) => {
            const saving    = basePrice - tier.price;
            const savingPct = saving > 0 ? Math.round((saving / basePrice) * 100) : 0;
            return (
              <tr
                key={idx}
                className="transition-colors even:bg-slate-50/50 hover:bg-teal-50/20"
              >
                <td className="px-5 py-3.5 text-slate-700">
                  <span className="font-mono font-semibold text-slate-900">
                    {tier.min_qty}
                    {tier.max_qty != null ? `–${tier.max_qty}` : '+'}
                  </span>{' '}
                  <span className="capitalize text-slate-500">{uom}</span>
                  {(tier.max_qty ?? 2) > 1 ? 's' : ''}
                </td>
                <td className="px-5 py-3.5 text-right font-heading font-bold text-teal-700">
                  {formatINR(tier.price)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {savingPct > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      Save {savingPct}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Base price</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShippingPanel
// ---------------------------------------------------------------------------

function ShippingPanel() {
  const items: { icon: typeof Truck; title: string; body: string }[] = [
    {
      icon: Truck,
      title: 'Fast delivery — 24 to 48 hours',
      body: 'Pan-India express delivery to your registered branch address. Free shipping on orders above ₹5,000; flat ₹150 below that.',
    },
    {
      icon: FileText,
      title: 'GST-compliant invoicing',
      body: 'Every order ships with a GST B2B invoice in your registered company name, suitable for input tax credit.',
    },
    {
      icon: PackageCheck,
      title: 'Carefully packed, damage-free',
      body: 'Every order is securely packed before dispatch. Products are bubble-wrapped and boxed to ensure zero damage on arrival.',
    },
    {
      icon: Phone,
      title: 'Need help?',
      body: 'Call our B2B desk for bulk pricing beyond 1,000 units, custom packs, or scheduled deliveries.',
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50">
            <Icon className="h-5 w-5 text-teal-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelatedProductCard — compact card for the "You might also like" rail
// ---------------------------------------------------------------------------

function RelatedProductCard({ product }: { product: Product }) {
  const tiers     = (product.pricing_tiers ?? []) as PricingTierRow[];
  const lowest    = lowestPrice(tiers, product.base_price);
  const savingPct = product.base_price > 0
    ? Math.round(((product.base_price - lowest) / product.base_price) * 100)
    : 0;

  return (
    <Link
      href={`/marketplace/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-teal-50/30">
        {product.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-teal-300/70" strokeWidth={1.25} aria-hidden="true" />
          </div>
        )}
        {savingPct > 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
            -{savingPct}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        {product.brand && (
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-teal-600">
            {product.brand}
          </p>
        )}
        <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800 group-hover:text-teal-700">
          {product.name}
        </p>
        <p className="mt-auto pt-1 font-heading text-sm font-bold text-slate-900">
          {formatINR(product.base_price)}
          <span className="ml-1 text-[10px] font-normal text-slate-500">
            / <span className="capitalize">{product.unit_of_measure}</span>
          </span>
        </p>
      </div>
    </Link>
  );
}
