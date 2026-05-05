'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  ChevronDown,
  ChevronUp,
  Layers,
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

interface GroupEntry {
  key:            string;
  representative: Product;
  variants:       Product[];
  isGroup:        boolean;
}

const PER_PAGE = 25;

// ---------------------------------------------------------------------------
// Inline price editor cell
// ---------------------------------------------------------------------------

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
  const [search,          setSearch]          = useState('');
  const [category,        setCategory]        = useState('');
  const [subcategory,     setSubcategory]     = useState('');
  const [stockFilter,     setStockFilter]     = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page,            setPage]            = useState(1);

  // Data
  const [data,    setData]    = useState<PaginatedProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Group expand/collapse
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Bulk selection (operates on individual product IDs)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Fetch products — always fetch a full-ish page so grouping looks right
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
  useEffect(() => { setSubcategory(''); }, [category]);
  useEffect(() => { setSelected(new Set()); }, [page, category, subcategory, debouncedSearch]);
  // Collapse all groups when data refreshes
  useEffect(() => { setExpandedGroups(new Set()); }, [data]);

  // ---------------------------------------------------------------------------
  // Group products by group_slug (client-side)
  // ---------------------------------------------------------------------------

  const groupedProducts = useMemo<GroupEntry[]>(() => {
    const products = data?.products ?? [];
    const seen = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.group_slug ?? p.id;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(p);
    }
    return [...seen.entries()].map(([key, variants]) => {
      const sorted = [...variants].sort((a, b) => Number(a.base_price) - Number(b.base_price));
      return {
        key,
        representative: sorted[0],
        variants:       sorted,
        isGroup:        variants.length > 1,
      };
    });
  }, [data]);

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
        prev ? { ...prev, products: prev.products.map((p) => (p.id === id ? updated : p)) } : prev
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
        prev ? { ...prev, products: prev.products.map((p) => (p.id === id ? updated : p)) } : prev
      );
      toast.success(status === 'in_stock' ? 'Marked in stock' : 'Marked out of stock');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update stock');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"? It will be hidden from the catalog.`)) return;
    try {
      const res  = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Delete failed');
      toast.success('Product deactivated');
      void fetchProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const handleDeleteGroup = async (variants: Product[]) => {
    const label = variants[0].name;
    if (!confirm(`Deactivate all ${variants.length} variants of "${label}"?`)) return;
    await Promise.all(variants.map((v) => fetch(`/api/admin/products/${v.id}`, { method: 'DELETE' })));
    toast.success(`Deactivated ${variants.length} variants`);
    void fetchProducts();
  };

  // ---------------------------------------------------------------------------
  // Bulk actions
  // ---------------------------------------------------------------------------

  const handleBulkDelete = async () => {
    if (!confirm(`Deactivate ${selected.size} products?`)) return;
    await Promise.all([...selected].map((id) => fetch(`/api/admin/products/${id}`, { method: 'DELETE' })));
    toast.success(`Deactivated ${selected.size} products`);
    setSelected(new Set());
    void fetchProducts();
  };

  const handleBulkHardDelete = async () => {
    if (!confirm(`Permanently delete ${selected.size} product(s)? Cannot be undone.`)) return;
    let removed = 0; let blocked = 0;
    await Promise.all([...selected].map(async (id) => {
      const res  = await fetch(`/api/admin/products/${id}?hard=true`, { method: 'DELETE' });
      const json = (await res.json()) as { error: string | null };
      if (res.ok && !json.error) removed++; else if (res.status === 409) blocked++;
    }));
    if (blocked > 0) toast.error(`${blocked} product(s) skipped — they appear in past orders`);
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
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectGroup = (variants: Product[]) => {
    const ids = variants.map((v) => v.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const toggleAll = () => {
    const pageIds = (data?.products ?? []).map((p) => p.id);
    const allSelected = pageIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(pageIds));
  };

  const toggleGroupExpand = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const subcats        = getSubcategoriesByCategory(category);
  const totalPages     = data ? Math.ceil(data.total / PER_PAGE) : 1;
  const allProducts    = data?.products ?? [];
  const allOnPageSelected = allProducts.length > 0 && allProducts.every((p) => selected.has(p.id));

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const priceRange = (variants: Product[]) => {
    const prices = variants.map((v) => Number(v.base_price)).filter((p) => p > 0);
    if (prices.length === 0) return <span className="text-rose-600 font-semibold text-sm">Set Price</span>;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return (
      <span className="font-mono text-sm text-slate-800">
        {min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`}
      </span>
    );
  };

  const stockSummary = (variants: Product[]) => {
    const allIn  = variants.every((v) => v.stock_status === 'in_stock');
    const allOut = variants.every((v) => v.stock_status === 'out_of_stock');
    if (allIn)  return <span className="text-xs text-emerald-600 font-medium">All in stock</span>;
    if (allOut) return <span className="text-xs text-rose-600 font-medium">All out of stock</span>;
    return <span className="text-xs text-amber-600 font-medium">Mixed</span>;
  };

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
              {groupedProducts.length} listings · {data.total} SKUs
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

        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-slate-50 text-sm">
          {[
            { value: '',             label: 'All' },
            { value: 'in_stock',     label: 'In Stock' },
            { value: 'out_of_stock', label: 'Out of Stock' },
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
            >
              Deactivate
            </button>
            <button
              type="button"
              onClick={handleBulkHardDelete}
              className="text-sm text-white font-semibold px-3 py-1.5 bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
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
      {!loading && !error && groupedProducts.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <p className="text-slate-700 font-semibold">No products in catalog</p>
            <p className="text-slate-400 text-sm mt-1">Import your Excel file to get started</p>
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

      {/* Table */}
      {!loading && !error && groupedProducts.length > 0 && (
        <>
          {/* Desktop table */}
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
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-8">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Product</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Size / Brand</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Price (₹)</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Stock</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupedProducts.map((group, idx) => {
                  const { key, representative: rep, variants, isGroup } = group;
                  const expanded    = expandedGroups.has(key);
                  const rowNum      = (page - 1) * PER_PAGE + idx + 1;
                  const needsPrice  = variants.every((v) => v.base_price === 0);
                  const allSelected = variants.every((v) => selected.has(v.id));

                  return [
                    // ── Group / standalone header row ──
                    <tr
                      key={key}
                      className={`border-b border-slate-100 transition-colors ${
                        allSelected     ? 'bg-teal-50' :
                        needsPrice      ? 'bg-amber-50/60' :
                        isGroup         ? 'bg-slate-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox — selects ALL variants in the group */}
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => isGroup ? toggleSelectGroup(variants) : toggleSelect(rep.id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">{rowNum}</td>

                      {/* Name + thumbnail + variant badge */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                            {rep.thumbnail_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={rep.thumbnail_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-4 h-4 text-slate-300" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900 truncate max-w-50" title={rep.name}>
                                {rep.name}
                              </span>
                              {isGroup && (
                                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                                  <Layers className="w-3 h-3" />
                                  {variants.length} variants
                                </span>
                              )}
                            </div>
                            {rep.sku && (
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5">{rep.sku}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600 text-xs capitalize">
                        {rep.category.replace(/_/g, ' ')}
                      </td>

                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {isGroup
                          ? <span className="italic text-slate-400">see variants ↓</span>
                          : (rep.size_variant ?? rep.brand ?? '—')
                        }
                      </td>

                      {/* Price: range for groups, editable cell for standalone */}
                      <td className="px-4 py-3 text-right">
                        {isGroup
                          ? priceRange(variants)
                          : <PriceCell product={rep} onSave={handlePriceSave} />
                        }
                      </td>

                      {/* Stock: summary for groups, toggle for standalone */}
                      <td className="px-4 py-3 text-center">
                        {isGroup
                          ? stockSummary(variants)
                          : <StockToggle product={rep} onToggle={handleStockToggle} />
                        }
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`/admin/products/${rep.id}/edit`}
                            className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              isGroup
                                ? void handleDeleteGroup(variants)
                                : void handleDelete(rep.id, rep.name)
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {isGroup && (
                            <button
                              type="button"
                              onClick={() => toggleGroupExpand(key)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                              title={expanded ? 'Collapse variants' : 'Expand variants'}
                            >
                              {expanded
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,

                    // ── Expanded variant sub-rows ──
                    ...(isGroup && expanded
                      ? variants.map((variant) => (
                          <tr
                            key={variant.id}
                            className={`border-b border-slate-100 transition-colors ${
                              selected.has(variant.id) ? 'bg-teal-50/60' : 'bg-white hover:bg-slate-50/50'
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <input
                                type="checkbox"
                                checked={selected.has(variant.id)}
                                onChange={() => toggleSelect(variant.id)}
                                className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                            </td>
                            <td />
                            {/* Variant label — indented */}
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2 pl-14">
                                <span className="text-slate-300 text-xs">└</span>
                                <span className="text-sm text-slate-700 font-medium">
                                  {variant.size_variant || variant.short_description || variant.name}
                                </span>
                              </div>
                            </td>
                            <td />
                            <td className="px-4 py-2.5 text-xs text-slate-500">
                              {variant.size_variant ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <PriceCell product={variant} onSave={handlePriceSave} />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <StockToggle product={variant} onToggle={handleStockToggle} />
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Link
                                href={`/admin/products/${variant.id}/edit`}
                                className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors inline-flex"
                                title="Edit this variant"
                              >
                                <Pencil className="w-4 h-4" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      : []
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {groupedProducts.map((group) => {
              const { key, representative: rep, variants, isGroup } = group;
              const expanded = expandedGroups.has(key);
              return (
                <div
                  key={key}
                  className={`rounded-xl border p-4 space-y-2 ${
                    variants.every((v) => v.base_price === 0)
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-100 flex items-center justify-center">
                        {rep.thumbnail_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={rep.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{rep.name}</p>
                        {isGroup && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                            <Layers className="w-3 h-3" />{variants.length} variants
                          </span>
                        )}
                      </div>
                    </div>
                    {!isGroup && <StockToggle product={rep} onToggle={handleStockToggle} />}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{rep.category.replace(/_/g, ' ')}</span>
                    {isGroup ? priceRange(variants) : <PriceCell product={rep} onSave={handlePriceSave} />}
                  </div>

                  {isGroup && (
                    <button
                      type="button"
                      onClick={() => toggleGroupExpand(key)}
                      className="w-full text-xs text-teal-600 font-medium py-1 border border-teal-200 rounded-lg hover:bg-teal-50 transition-colors flex items-center justify-center gap-1"
                    >
                      {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {expanded ? 'Hide variants' : 'Show variants'}
                    </button>
                  )}

                  {isGroup && expanded && (
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      {variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between">
                          <span className="text-xs text-slate-700 font-medium">
                            {v.size_variant || v.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <PriceCell product={v} onSave={handlePriceSave} />
                            <StockToggle product={v} onToggle={handleStockToggle} />
                            <Link
                              href={`/admin/products/${v.id}/edit`}
                              className="p-1 text-slate-400 hover:text-teal-600 rounded transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isGroup && (
                    <div className="flex gap-2 pt-1">
                      <Link
                        href={`/admin/products/${rep.id}/edit`}
                        className="flex-1 text-center text-xs border border-slate-300 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(rep.id, rep.name)}
                        className="flex-1 text-center text-xs border border-rose-200 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages} · {data!.total.toLocaleString('en-IN')} SKUs
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
