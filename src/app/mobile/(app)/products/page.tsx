'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatINR } from '@/lib/utils/formatting';
import { useMobileCart } from '@/hooks/useMobileCart';

interface Product {
  id: string; name: string; slug: string; base_price: number;
  unit_of_measure: string; moq: number; stock_status: string;
  category: string; size_variant: string | null; thumbnail_url: string | null;
}

const CATEGORIES = ['All', 'Cleaning', 'Hygiene', 'Paper Products', 'Equipment', 'Chemicals', 'Other'];

const STOCK_BADGE: Record<string, string> = {
  in_stock: 'bg-emerald-50 text-emerald-700',
  low_stock: 'bg-amber-50 text-amber-700',
  out_of_stock: 'bg-rose-50 text-rose-700',
};
const STOCK_LABEL: Record<string, string> = {
  in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock',
};

export default function MobileProductsPage() {
  const router = useRouter();
  const { addItem } = useMobileCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [modal, setModal] = useState<{ product: Product; qty: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { router.replace('/mobile/login'); return null; }
        return fetch('/api/products?per_page=200').then((r) => r.json());
      })
      .then((d) => {
        if (d?.data?.products) setProducts(d.data.products);
        setLoading(false);
      })
      .catch(() => router.replace('/mobile/login'));
  }, [router]);

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === 'All' || p.category === category;
    return matchSearch && matchCat;
  });

  function openModal(p: Product) {
    if (p.stock_status === 'out_of_stock') return;
    setModal({ product: p, qty: p.moq });
  }

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky search header */}
      <div className="sticky top-0 z-30 bg-teal-600 px-4 pt-10 pb-3 shadow-md">
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5">
          <span className="text-slate-400 text-lg">🔍</span>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="flex-1 text-slate-900 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 text-sm font-bold">✕</button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                category === cat
                  ? 'bg-white text-teal-700 border-white'
                  : 'bg-teal-700/40 text-teal-100 border-teal-500/30'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <p className="text-slate-500 text-xs">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
          {search ? ` for "${search}"` : ''}
        </p>
        {(search || category !== 'All') && (
          <button onClick={() => { setSearch(''); setCategory('All'); }} className="text-teal-600 text-xs font-semibold">
            Clear filters
          </button>
        )}
      </div>

      {/* Product Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="text-5xl">🔍</span>
          <p className="text-slate-500 font-medium">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-3 pb-4">
          {filtered.map((product) => {
            const isOut = product.stock_status === 'out_of_stock';
            const sku = product.id.slice(0, 8).toUpperCase();
            return (
              <div
                key={product.id}
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100"
              >
                {/* Image */}
                <div className="aspect-square bg-slate-50 relative flex items-center justify-center">
                  {product.thumbnail_url ? (
                    <Image
                      src={product.thumbnail_url}
                      alt={product.name}
                      fill
                      className="object-contain p-2"
                      sizes="(max-width: 480px) 50vw, 200px"
                    />
                  ) : (
                    <span className="text-4xl">📦</span>
                  )}
                  <span className={`absolute top-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STOCK_BADGE[product.stock_status] ?? 'bg-slate-50 text-slate-600'}`}>
                    {STOCK_LABEL[product.stock_status] ?? product.stock_status}
                  </span>
                </div>

                {/* Info */}
                <div className="p-2.5 space-y-1">
                  <p className="text-[10px] text-slate-400 font-mono">{sku}</p>
                  <p className="text-slate-900 text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
                  {product.size_variant && (
                    <span className="inline-block text-[10px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                      {product.size_variant}
                    </span>
                  )}
                  <p className="text-teal-700 font-heading font-bold text-base">
                    {formatINR(product.base_price)}
                    <span className="text-slate-400 font-normal text-xs"> /{product.unit_of_measure}</span>
                  </p>
                  <p className="text-slate-400 text-[10px]">Min. {product.moq} {product.unit_of_measure}</p>
                  <button
                    onClick={() => openModal(product)}
                    disabled={isOut}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-colors mt-1 ${
                      isOut
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    {isOut ? 'Out of Stock' : '+ Add to Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add to Cart Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setModal(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-3xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <p className="font-heading font-bold text-slate-900 text-lg mb-0.5">Add to Cart</p>
            <p className="text-slate-600 text-sm mb-1 line-clamp-2">{modal.product.name}</p>
            <p className="font-mono font-bold text-teal-700 text-base mb-5">
              {formatINR(modal.product.base_price)} / {modal.product.unit_of_measure}
            </p>

            {/* Qty stepper */}
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setModal((m) => m && { ...m, qty: Math.max(m.product.moq, m.qty - 1) })}
                className="w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-xl flex items-center justify-center"
              >
                −
              </button>
              <input
                type="number"
                value={modal.qty}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v)) setModal((m) => m && { ...m, qty: v });
                }}
                className="flex-1 h-11 text-center font-mono font-bold text-xl rounded-xl border-2 border-teal-500 focus:outline-none"
              />
              <button
                onClick={() => setModal((m) => m && { ...m, qty: m.qty + 1 })}
                className="w-11 h-11 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-xl flex items-center justify-center"
              >
                +
              </button>
            </div>
            <p className="text-slate-400 text-xs text-center mb-5">
              Minimum: {modal.product.moq} {modal.product.unit_of_measure}
            </p>

            <button
              onClick={confirmAdd}
              className="w-full h-13 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl text-base py-3.5"
            >
              Add — {formatINR(modal.product.base_price * modal.qty)}
            </button>
            <button
              onClick={() => setModal(null)}
              className="w-full mt-3 py-2.5 text-slate-500 font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
