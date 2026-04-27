/**
 * Admin — Product Catalog Manager
 *
 * Features:
 *   - Search by name, filter by category + subcategory + stock status
 *   - Paginated table (25 per page) with inline price editing
 *   - Toggle stock status per row
 *   - Bulk actions: set price, change category, delete
 *   - ₹0 price rows highlighted amber ("needs pricing")
 *   - Edit / Delete per-row actions
 *
 * Data flow: fetches from GET /api/admin/products
 * Mutations: PUT /api/admin/products/:id  (price, stock, soft-delete)
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Upload,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR } from '@/lib/utils/formatting';
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesByCategory,
} from '@/lib/constants/categories';
import type { Tables, Enums } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = Tables<'products'>;

interface PaginatedProducts {
  products: Product[];
  total:    number;
  page:     number;
  per_page: number;
}

const PER_PAGE = 25;

// ---------------------------------------------------------------------------
// Inline price editor cell
// ---------------------------------------------------------------------------

/**
 * Shows the price as text. On click, switches to an input that saves on
 * Enter or blur. Renders in red + "Set Price" when base_price is 0.
 */
function PriceCell({
  product,
  onSave,
}: {
  product: Product;
  onSave: (id: string, price: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(String(product.base_price));
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setValue(String(product.base_price));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commitEdit = async () => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== product.base_price) {
      await onSave(product.id, parsed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  { void commitEdit(); }
          if (e.key === 'Escape') { setEditing(false); }
        }}
        className="w-28 border border-teal-400 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
        autoFocus
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      title="Click to edit price"
      className={`font-mono text-sm px-1 rounded hover:bg-slate-100 transition-colors ${
        product.base_price === 0 ? 'text-rose-600 font-semibold' : 'text-slate-800'
      }`}
    >
      {product.base_price === 0 ? 'Set Price' : formatINR(product.base_price)}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Stock toggle
// ---------------------------------------------------------------------------

/**
 * Toggle switch that flips a product between in_stock and out_of_stock.
 */
function StockToggle({
  product,
  onToggle,
}: {
  product: Product;
  onToggle: (id: string, status: Enums<'stock_status'>) => Promise<void>;
}) {
  const isInStock = product.stock_status === 'in_stock';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isInStock}
      onClick={() => void onToggle(product.id, isInStock ? 'out_of_stock' : 'in_stock')}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        isInStock ? 'bg-emerald-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          isInStock ? 'translate-x-4.5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AdminProductsPage() {
  // Filters
  const [search,         setSearch]         = useState('');
  const [category,       setCategory]       = useState('');
  const [subcategory,    setSubcategory]    = useState('');
  const [stockFilter,    setStockFilter]    = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page,           setPage]           = useState(1);

  // Data
  const [data,    setData]    = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:     String(page),
        per_page: String(PER_PAGE),
      });
      if (category)        params.set('category',    category);
      if (subcategory)     params.set('subcategory', subcategory);
      if (debouncedSearch) params.set('search',      debouncedSearch);
      if (stockFilter)     params.set('stock',       stockFilter);
      if (includeInactive) params.set('include_inactive', 'true');

      const res  = await fetch(`/api/admin/products?${params.toString()}`);
      const json = (await res.json()) as { data: PaginatedProducts | null; error: string | null };
      if (!res.ok || json.error) { setError(json.error ?? 'Failed to load products'); return; }
      setData(json.data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [page, category, subcategory, debouncedSearch, stockFilter, includeInactive]);

  useEffect(() => { void fetchProducts(); }, [fetchProducts]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [category, subcategory, debouncedSearch, stockFilter, includeInactive]);

  // Reset subcategory when category changes
  useEffect(() => { setSubcategory(''); }, [category]);

  // Reset selection on page/filter change
  useEffect(() => { setSelected(new Set()); }, [page, category, subcategory, debouncedSearch]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const updateProduct = async (id: string, fields: Record<string, unknown>) => {
    const res  = await fetch(`/api/admin/products/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
    const json = (await res.json()) as { data: Product | null; error: string | null };
    if (!res.ok || json.error) throw new Error(json.error ?? 'Update failed');
    return json.data!;
  };

  const handlePriceSave = async (id: string, price: number) => {
    try {
      const updated = await updateProduct(id, { base_price: price });
      setData((prev) =>
        prev
          ? { ...prev, products: prev.products.map((p) => (p.id === id ? updated : p)) }
          : prev
      );
      toast.success('Price updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update price');
    }
  };

  const handleStockToggle = async (id: string, status: Enums<'stock_status'>) => {
    try {
      const updated = await updateProduct(id, { stock_status: status });
      setData((prev) =>
        prev
          ? { ...prev, products: prev.products.map((p) => (p.id === id ? updated : p)) }
          : prev
      );
      toast.success(status === 'in_stock' ? 'Marked in stock' : 'Marked out of stock');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update stock');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"? It will be hidden from the catalog.`)) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Delete failed');
      toast.success('Product deactivated');
      void fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const handleBulkDelete = async () => {
    if (!confirm(`Deactivate ${selected.size} products?`)) return;
    const ids = [...selected];
    let failed = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
        } catch { failed++; }
      })
    );
    toast.success(`Deactivated ${ids.length - failed} products`);
    setSelected(new Set());
    void fetchProducts();
  };

  /**
   * Permanently removes the selected products from the DB. Used to wipe the
   * catalog before a fresh Excel import. Products that are referenced by
   * existing orders will fail with a 409 — those rows are reported back to
   * the admin so they can be handled separately.
   */
  const handleBulkHardDelete = async () => {
    const msg =
      `Permanently delete ${selected.size} product${selected.size !== 1 ? 's' : ''}?\n\n` +
      `This cannot be undone. Products that appear in past orders will be skipped.`;
    if (!confirm(msg)) return;
    const ids = [...selected];
    let removed = 0;
    let blocked = 0;
    await Promise.all(
      ids.map(async (id) => {
        try {
          const res  = await fetch(`/api/admin/products/${id}?hard=true`, { method: 'DELETE' });
          const json = (await res.json()) as { error: string | null };
          if (res.ok && !json.error) {
            removed++;
          } else if (res.status === 409) {
            blocked++;
          }
        } catch {
          /* network errors silently grouped into the unaccounted-for remainder */
        }
      })
    );
    if (blocked > 0) {
      toast.error(`${blocked} product(s) skipped — they appear in past orders`);
    }
    toast.success(`Permanently deleted ${removed} products`);
    setSelected(new Set());
    void fetchProducts();
  };

  // ---------------------------------------------------------------------------
  // Selection helpers
  // ---------------------------------------------------------------------------

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    const pageIds = (data?.products ?? []).map((p) => p.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(pageIds));
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const subcats        = getSubcategoriesByCategory(category);
  const totalPages     = data ? Math.ceil(data.total / PER_PAGE) : 1;
  const products       = data?.products ?? [];
  const allOnPageSelected = products.length > 0 && products.every((p) => selected.has(p.id));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-heading font-bold text-slate-900">Product Catalog</h1>
          {data && (
            <span className="bg-teal-100 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full">
              {data.total.toLocaleString('en-IN')} products
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/import"
            className="flex items-center gap-1.5 border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import Excel
          </Link>
          <Link
            href="/admin/products/new"
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Categories</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {/* Subcategory */}
        {subcats.length > 0 && (
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Subcategories</option>
            {subcats.map((s) => (
              <option key={s.slug} value={s.slug}>{s.label}</option>
            ))}
          </select>
        )}

        {/* Stock status */}
        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50 text-sm">
          {[
            { value: '',              label: 'All' },
            { value: 'in_stock',      label: 'In Stock' },
            { value: 'out_of_stock',  label: 'Out of Stock' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStockFilter(opt.value)}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                stockFilter === opt.value
                  ? 'bg-white shadow text-teal-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Show inactive toggle */}
        <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Show inactive
        </label>

        <button
          type="button"
          onClick={() => void fetchProducts()}
          className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-teal-800">
            {selected.size} product{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              type="button"
              onClick={handleBulkDelete}
              className="text-sm text-amber-700 hover:text-amber-800 font-medium px-3 py-1.5 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
              title="Hide selected products from the catalog (recoverable)"
            >
              Deactivate
            </button>
            <button
              type="button"
              onClick={handleBulkHardDelete}
              className="text-sm text-white font-semibold px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              title="Permanently remove selected products from the database"
            >
              Delete permanently
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <span className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-4 text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <p className="text-slate-700 font-semibold">No products in catalog</p>
            <p className="text-slate-400 text-sm mt-1">
              Import your Excel file to get started
            </p>
          </div>
          <Link
            href="/admin/products/import"
            className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import from Excel
          </Link>
        </div>
      )}

      {/* Table — desktop */}
      {!loading && !error && products.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Subcategory</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Size/Brand</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Price (₹)</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, idx) => {
                  const rowNum    = (page - 1) * PER_PAGE + idx + 1;
                  const needsPrice = product.base_price === 0;
                  return (
                    <tr
                      key={product.id}
                      className={`border-b border-slate-100 last:border-0 transition-colors ${
                        selected.has(product.id) ? 'bg-teal-50' :
                        needsPrice               ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">{rowNum}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 max-w-xs truncate" title={product.name}>
                          {product.name}
                        </div>
                        {product.brand && (
                          <div className="text-xs text-slate-400">{product.brand}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">
                        {product.category.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {product.subcategory_slug?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {product.size_variant ?? product.brand ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs uppercase">
                        {product.unit_of_measure}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PriceCell product={product} onSave={handlePriceSave} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StockToggle product={product} onToggle={handleStockToggle} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/admin/products/${product.id}/edit`}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDelete(product.id, product.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards — mobile */}
          <div className="sm:hidden space-y-3">
            {products.map((product) => {
              const needsPrice = product.base_price === 0;
              return (
                <div
                  key={product.id}
                  className={`rounded-xl border p-4 space-y-2 ${
                    needsPrice ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{product.name}</p>
                      {product.brand && (
                        <p className="text-xs text-slate-400">{product.brand}</p>
                      )}
                    </div>
                    <StockToggle product={product} onToggle={handleStockToggle} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{product.category.replace(/_/g, ' ')}</span>
                    <PriceCell product={product} onSave={handlePriceSave} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="flex-1 text-center text-xs border border-slate-300 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleDelete(product.id, product.name)}
                      className="flex-1 text-center text-xs border border-rose-200 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages} · {data!.total.toLocaleString('en-IN')} products
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
