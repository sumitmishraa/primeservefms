/**
 * Marketplace — public product listing page.
 *
 * Features:
 *   - Filter state synced to URL search params (category, subcategory, search, page)
 *   - Fetches approved + active products from GET /api/products
 *   - 4-col desktop / 3-col tablet / 2-col mobile grid of ProductCards
 *   - Skeleton loading state (8 pulse cards)
 *   - Empty + error states
 *   - Prev/Next pagination
 *
 * PUBLIC — no auth required.
 */

'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingBag, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import ProductCard from '@/components/marketplace/ProductCard';
import ProductFilters from '@/components/marketplace/ProductFilters';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MarketplaceProduct {
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
}

interface ProductsApiResponse {
  products: MarketplaceProduct[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

/**
 * Animated placeholder card shown while products are loading.
 */
function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="aspect-square w-full animate-pulse rounded-t-xl bg-slate-100" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="mt-2 h-5 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
        <div className="mt-1 h-9 w-full animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Public marketplace listing page. No authentication required.
 * Filter state is stored in URL params so users can share/bookmark filtered views.
 */
function MarketplaceContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  // Read filter state from URL
  const urlCategory    = searchParams.get('category')    ?? '';
  const urlSubcategory = searchParams.get('subcategory') ?? '';
  const urlSearch      = searchParams.get('search')      ?? '';
  const urlPage        = parseInt(searchParams.get('page') ?? '1', 10);

  // Local state
  const [products,  setProducts]  = useState<MarketplaceProduct[]>([]);
  const [total,     setTotal]     = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Debounce search — we update the URL only after the user pauses typing
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);

  // ---------------------------------------------------------------------------
  // URL helpers
  // ---------------------------------------------------------------------------

  /**
   * Pushes updated filter values into the URL without a full navigation.
   * All params are derived from current URL to avoid clobbering siblings.
   */
  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, val]) => {
        if (val) {
          params.set(key, val);
        } else {
          params.delete(key);
        }
      });
      // Always reset to page 1 when a filter changes (unless we're explicitly setting page)
      if (!('page' in updates)) {
        params.delete('page');
      }
      router.push(`/marketplace?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // ---------------------------------------------------------------------------
  // Filter handlers
  // ---------------------------------------------------------------------------

  const handleCategoryChange = (cat: string) => {
    pushParams({ category: cat, subcategory: '' });
  };

  const handleSubcategoryChange = (sub: string) => {
    pushParams({ subcategory: sub });
  };

  const handleSearchChange = (q: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      pushParams({ search: q });
    }, 400);
  };

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        is_approved: 'true',
        is_active:   'true',
        page:        String(urlPage),
        per_page:    String(PER_PAGE),
      });
      if (urlCategory)    params.set('category',    urlCategory);
      if (urlSubcategory) params.set('subcategory', urlSubcategory);
      if (urlSearch)      params.set('search',      urlSearch);

      const res  = await fetch(`/api/products?${params.toString()}`);
      const json = (await res.json()) as { data: ProductsApiResponse | null; error: string | null };

      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Failed to load products');
        return;
      }

      setProducts(json.data.products);
      setTotal(json.data.total);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [urlPage, urlCategory, urlSubcategory, urlSearch]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Hero banner */}
      <div className="bg-linear-to-r from-teal-700 to-teal-600 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-teal-100" aria-hidden="true" />
            <div>
              <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">
                Primeserve Marketplace
              </h1>
              <p className="mt-1 text-sm text-teal-100">
                Housekeeping, cleaning, stationery, and facility supplies — all in one place
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Filters */}
        <div className="mb-6">
          <ProductFilters
            selectedCategory={urlCategory}
            selectedSubcategory={urlSubcategory}
            searchQuery={urlSearch}
            onCategoryChange={handleCategoryChange}
            onSubcategoryChange={handleSubcategoryChange}
            onSearchChange={handleSearchChange}
          />
        </div>

        {/* Product count row */}
        {!isLoading && !error && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {total > 0
                ? `Showing ${products.length} of ${total.toLocaleString('en-IN')} product${total !== 1 ? 's' : ''}`
                : 'No products found'}
            </p>
            <button
              type="button"
              onClick={() => void fetchProducts()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
            aria-label="Loading products"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-200 bg-rose-50 py-16 text-center">
            <p className="text-sm font-medium text-rose-700">{error}</p>
            <button
              onClick={() => void fetchProducts()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && products.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-20 text-center">
            <ShoppingBag className="h-12 w-12 text-slate-300" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-slate-700">No products found</p>
              <p className="mt-1 text-xs text-slate-400">
                Try adjusting your filters or search term
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                pushParams({ category: '', subcategory: '', search: '' });
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Product grid */}
        {!isLoading && !error && products.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Page {urlPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={urlPage <= 1}
                    onClick={() => pushParams({ page: String(urlPage - 1) })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={urlPage >= totalPages}
                    onClick={() => pushParams({ page: String(urlPage + 1) })}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

/**
 * Page shell — wraps MarketplaceContent in a Suspense boundary so that
 * useSearchParams() doesn't block static pre-rendering of the page shell.
 */
export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
