/**
 * Marketplace — public product listing page.
 *
 * Features:
 *   - URL-synced filter state (category, subcategory, search, page)
 *   - Sidebar category/subcategory accordions + search
 *   - 4-col desktop grid of ProductCards
 *   - Active filter chip row + sort dropdown
 *   - Skeleton / empty / error states
 *   - Prev/Next pagination
 */

'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingBag, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import ProductCard from '@/components/marketplace/ProductCard';
import ProductSidebar from '@/components/marketplace/ProductSidebar';
import { PublicHeader, PublicFooter } from '@/components/layout';
import {
  getCategoryLabel,
  getSubcategoryLabel,
} from '@/lib/constants/categories';
import type { CartableProduct } from '@/components/marketplace/AddToCartButton';

type MarketplaceProduct = CartableProduct;

interface ProductsApiResponse {
  products: MarketplaceProduct[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 24;
const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price — Low to High' },
  { value: 'price_desc', label: 'Price — High to Low' },
  { value: 'newest', label: 'Newest First' },
];

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white">
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

function MarketplaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlCategory = searchParams.get('category') ?? '';
  const urlSubcategory = searchParams.get('subcategory') ?? '';
  const urlSearch = searchParams.get('search') ?? '';
  const urlSort = searchParams.get('sort') ?? 'relevance';
  const urlPage = parseInt(searchParams.get('page') ?? '1', 10);

  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);

  const pushParams = useCallback(
    (updates: Record<string, string>) => {
      // Read from window.location.search rather than the React searchParams
      // snapshot. searchParams is stable across re-renders within the same
      // event loop tick, so two pushParams calls fired back-to-back from a
      // single onChange would both start from the *original* URL — the
      // second would silently revert anything the first just set.
      // window.location.search reflects whatever router.push has just
      // mutated, so consecutive calls compose correctly.
      const current =
        typeof window !== 'undefined'
          ? window.location.search
          : `?${searchParams.toString()}`;
      const params = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, val]) => {
        if (val) params.set(key, val);
        else params.delete(key);
      });
      if (!('page' in updates)) params.delete('page');
      router.push(`/marketplace?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleCategoryChange = (cat: string) =>
    pushParams({ category: cat, subcategory: '' });
  const handleSubcategoryChange = (sub: string) =>
    pushParams({ subcategory: sub });
  const handleSortChange = (s: string) => pushParams({ sort: s });
  const handleSearchChange = (q: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => pushParams({ search: q }), 400);
  };

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        is_approved: 'true',
        is_active: 'true',
        page: String(urlPage),
        per_page: String(PER_PAGE),
      });
      if (urlCategory) params.set('category', urlCategory);
      if (urlSubcategory) params.set('subcategory', urlSubcategory);
      if (urlSearch) params.set('search', urlSearch);
      if (urlSort && urlSort !== 'relevance') params.set('sort', urlSort);

      const res = await fetch(`/api/products?${params.toString()}`);
      const json = (await res.json()) as {
        data: ProductsApiResponse | null;
        error: string | null;
      };

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
  }, [urlPage, urlCategory, urlSubcategory, urlSearch, urlSort]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const hasActiveFilter = !!urlCategory || !!urlSubcategory || !!urlSearch;
  const fromIdx = (urlPage - 1) * PER_PAGE + 1;
  const toIdx = Math.min(urlPage * PER_PAGE, total);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader />

      <div className="w-full flex-1 py-5">
        {/* Active filter chips */}
        {hasActiveFilter && (
          <div className="mb-4 flex flex-wrap items-center gap-2 px-4 sm:px-5 lg:pl-0 lg:pr-5">
            {urlCategory && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                {getCategoryLabel(urlCategory)}
                <button
                  type="button"
                  onClick={() => pushParams({ category: '', subcategory: '' })}
                  className="text-teal-600 hover:text-teal-800"
                  aria-label="Remove category filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {urlSubcategory && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                {getSubcategoryLabel(urlCategory, urlSubcategory)}
                <button
                  type="button"
                  onClick={() => pushParams({ subcategory: '' })}
                  className="text-teal-600 hover:text-teal-800"
                  aria-label="Remove subcategory filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {urlSearch && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                “{urlSearch}”
                <button
                  type="button"
                  onClick={() => pushParams({ search: '' })}
                  className="text-slate-500 hover:text-slate-700"
                  aria-label="Remove search filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                pushParams({ category: '', subcategory: '', search: '' })
              }
              className="text-xs font-semibold text-slate-500 hover:text-teal-600"
            >
              Clear all
            </button>
          </div>
        )}

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-6">
          <div className="px-4 sm:px-5 lg:px-0">
            <ProductSidebar
              selectedCategory={urlCategory}
              selectedSubcategory={urlSubcategory}
              searchQuery={urlSearch}
              onCategoryChange={handleCategoryChange}
              onSubcategoryChange={handleSubcategoryChange}
              onSearchChange={handleSearchChange}
            />
          </div>

          <div className="min-w-0 flex-1 px-4 sm:px-5 lg:pl-0 lg:pr-5">
            {/* Header row */}
            <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-600">
                {isLoading ? (
                  <span className="text-slate-400">Loading products…</span>
                ) : total > 0 ? (
                  <>
                    Showing{' '}
                    <span className="font-semibold text-slate-900">
                      {fromIdx.toLocaleString('en-IN')}–{toIdx.toLocaleString('en-IN')}
                    </span>{' '}
                    of{' '}
                    <span className="font-semibold text-slate-900">
                      {total.toLocaleString('en-IN')}
                    </span>
                  </>
                ) : (
                  'No products'
                )}
              </p>

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="whitespace-nowrap">Sort:</span>
                <select
                  value={urlSort}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {SORT_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Loading */}
            {isLoading && (
              <div
                className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                aria-label="Loading products"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            )}

            {/* Error */}
            {!isLoading && error && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-rose-200 bg-rose-50 py-20 text-center">
                <p className="text-sm font-medium text-rose-700">{error}</p>
                <button
                  onClick={() => void fetchProducts()}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Empty */}
            {!isLoading && !error && products.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-20 text-center">
                <ShoppingBag
                  className="h-12 w-12 text-slate-300"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    No products found
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Try adjusting your filters or search term.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    pushParams({ category: '', subcategory: '', search: '' })
                  }
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Grid */}
            {!isLoading && !error && products.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-sm text-slate-500">
                      Page{' '}
                      <span className="font-semibold text-slate-900">
                        {urlPage}
                      </span>{' '}
                      of{' '}
                      <span className="font-semibold text-slate-900">
                        {totalPages}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={urlPage <= 1}
                        onClick={() =>
                          pushParams({ page: String(urlPage - 1) })
                        }
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={urlPage >= totalPages}
                        onClick={() =>
                          pushParams({ page: String(urlPage + 1) })
                        }
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Next page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}
