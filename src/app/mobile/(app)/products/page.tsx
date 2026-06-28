'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  LoadingScreen,
  MobilePage,
  ProductThumb,
  ScreenHeader,
  categoryIconMap,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';
import { PRODUCT_CATEGORIES, getCategoryLabel, getSubcategoryLabel } from '@/lib/constants/categories';
import { formatINR } from '@/lib/utils/formatting';
import { useMobileCart } from '@/hooks/useMobileCart';

interface Product {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  unit_of_measure: string;
  moq: number;
  stock_status: string;
  category: string;
  subcategory_slug: string | null;
  size_variant: string | null;
  thumbnail_url: string | null;
  variant_count?: number;
}

const stockTone: Record<string, 'teal' | 'amber' | 'rose' | 'slate'> = {
  in_stock: 'teal',
  low_stock: 'amber',
  out_of_stock: 'rose',
};

const stockLabel: Record<string, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out',
};

function ProductsContent() {
  const searchParams = useSearchParams();
  const { addItem } = useMobileCart();
  const initialCategory = searchParams.get('category') ?? '';
  const initialSubcategory = searchParams.get('subcategory') ?? '';
  const initialSearch = searchParams.get('search') ?? '';

  const [search, setSearch] = useState(initialSearch);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ product: Product; qty: number } | null>(null);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('per_page', '100');
    if (initialCategory) params.set('category', initialCategory);
    if (initialSubcategory) params.set('subcategory', initialSubcategory);
    if (initialSearch) params.set('search', initialSearch);
    setLoading(true);
    fetch(`/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setProducts(d?.data?.products ?? []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [initialCategory, initialSearch, initialSubcategory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q === initialSearch.toLowerCase()) return products;
    return products.filter((product) => product.name.toLowerCase().includes(q));
  }, [initialSearch, products, search]);

  function confirmAdd() {
    if (!modal) return;
    addItem({
      product_id: modal.product.id,
      name: modal.product.name,
      price: modal.product.base_price,
      quantity: modal.qty,
      unit: modal.product.unit_of_measure,
      moq: modal.product.moq,
      thumbnail_url: modal.product.thumbnail_url,
    });
    setModal(null);
  }

  const title = initialSubcategory
    ? getSubcategoryLabel(initialCategory, initialSubcategory)
    : initialCategory
      ? getCategoryLabel(initialCategory)
      : 'Browse Catalog';

  return (
    <MobilePage>
      <ScreenHeader
        title={title}
        subtitle={initialCategory ? 'Filtered product marketplace' : 'Search all PrimeServe products'}
        variant="dark"
      />

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-[#F8FAFC]/95 px-5 py-3 backdrop-blur">
        <div className="flex h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
          <mobileIcons.Search className="h-5 w-5 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            type="search"
          />
        </div>
        <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto">
          <Link
            href="/mobile/products"
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-extrabold ${!initialCategory ? 'border-transparent bg-[#0D9488] text-white' : 'border-slate-200 bg-white text-slate-500'}`}
          >
            All
          </Link>
          {PRODUCT_CATEGORIES.map((category) => {
            const Icon = categoryIconMap[category.value] ?? mobileIcons.Box;
            const active = initialCategory === category.value;
            return (
              <Link
                key={category.value}
                href={`/mobile/products?category=${category.value}`}
                className={`ps-press flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-extrabold ${active ? 'border-transparent bg-[#0D9488] text-white' : 'border-slate-200 bg-white text-slate-500'}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {category.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            {loading ? 'Loading' : `${filtered.length} products`}
          </p>
          {(initialCategory || initialSubcategory || initialSearch) && (
            <Link href="/mobile/products" className="text-xs font-extrabold text-[#0D9488]">Clear filters</Link>
          )}
        </div>

        {loading ? (
          <Card className="flex items-center justify-center gap-3 p-8 text-sm font-bold text-slate-500">
            <mobileIcons.Sparkles className="h-5 w-5 animate-pulse text-[#0D9488]" />
            Loading catalog
          </Card>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={mobileIcons.Search}
            title="No products found"
            body="Try another search or browse all categories."
            action={<ButtonLink href="/mobile/categories">Browse categories</ButtonLink>}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product) => {
              const out = product.stock_status === 'out_of_stock';
              return (
                <Card key={product.id} className="overflow-hidden">
                  <ProductThumb src={product.thumbnail_url} alt={product.name} className="mx-3 mt-3 h-32" />
                  <div className="p-3">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <Badge tone={stockTone[product.stock_status] ?? 'slate'}>{stockLabel[product.stock_status] ?? product.stock_status}</Badge>
                      {!!product.variant_count && product.variant_count > 1 && <Badge tone="blue">{product.variant_count} variants</Badge>}
                    </div>
                    <p className="line-clamp-2 min-h-10 text-sm font-extrabold leading-5 text-slate-900">{product.name}</p>
                    {product.size_variant && <p className="mt-1 text-[11px] font-semibold text-slate-400">{product.size_variant}</p>}
                    <p className="mt-2 font-heading text-base font-extrabold text-[#0D9488]">
                      {formatINR(product.base_price)}
                      <span className="font-sans text-[11px] font-bold text-slate-400"> / {product.unit_of_measure}</span>
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-400">Min. {product.moq} {product.unit_of_measure}</p>
                    <button
                      type="button"
                      disabled={out}
                      onClick={() => setModal({ product, qty: product.moq })}
                      className={`ps-press mt-3 h-10 w-full rounded-xl text-xs font-extrabold ${out ? 'bg-slate-100 text-slate-400' : 'bg-[#14B8A6] text-white'}`}
                    >
                      {out ? 'Out of stock' : 'Add to cart'}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[80] flex items-end bg-black/45" onClick={() => setModal(null)}>
          <div className="ps-slide-up w-full rounded-t-[28px] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-slate-200" />
            <div className="flex gap-3">
              <ProductThumb src={modal.product.thumbnail_url} alt={modal.product.name} className="h-20 w-20 shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-extrabold text-slate-900">Add to cart</h2>
                <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-600">{modal.product.name}</p>
                <p className="mt-1 font-heading text-sm font-extrabold text-[#0D9488]">{formatINR(modal.product.base_price)} / {modal.product.unit_of_measure}</p>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                className="ps-press flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 text-xl font-extrabold text-slate-700"
                onClick={() => setModal((prev) => prev && { ...prev, qty: Math.max(prev.product.moq, prev.qty - 1) })}
              >
                -
              </button>
              <input
                value={modal.qty}
                onChange={(event) => {
                  const value = Number.parseInt(event.target.value, 10);
                  if (!Number.isNaN(value)) setModal((prev) => prev && { ...prev, qty: value });
                }}
                className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-[#14B8A6] text-center font-heading text-xl font-extrabold outline-none"
                inputMode="numeric"
              />
              <button
                type="button"
                className="ps-press flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 text-xl font-extrabold text-[#0D9488]"
                onClick={() => setModal((prev) => prev && { ...prev, qty: prev.qty + 1 })}
              >
                +
              </button>
            </div>
            <p className="mt-2 text-center text-xs font-semibold text-slate-400">Minimum {modal.product.moq} {modal.product.unit_of_measure}</p>
            <button
              type="button"
              onClick={confirmAdd}
              className="ps-press mt-5 h-14 w-full rounded-2xl bg-[#14B8A6] font-heading text-base font-extrabold text-white"
            >
              Add - {formatINR(modal.product.base_price * modal.qty)}
            </button>
          </div>
        </div>
      )}
    </MobilePage>
  );
}

export default function MobileProductsPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProductsContent />
    </Suspense>
  );
}
