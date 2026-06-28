'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, Trash2, Loader2, Check, ChevronDown, ChevronUp,
  X, Upload, FileSpreadsheet, Info, CheckCircle2, AlertCircle, ArrowLeft,
  Search, Sparkles, ShoppingCart, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import { CustomSelect } from '@/components/ui';
import { useCartStore } from '@/stores/cartStore';
import type { QuoteRequest, QuoteItem } from '@/app/api/buyer/quotes/route';
import type { PreviewMatchedItem, PreviewUnmatchedItem } from '@/app/api/buyer/quotes/preview/route';
import type { MarketplaceProduct } from '@/app/api/products/route';
import type { Product } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  quoted: 'bg-purple-50 text-purple-700 border-purple-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};
const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  quoted: 'Quoted',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const UNITS = [
  { value: 'piece', label: 'Piece' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'liter', label: 'Litre' },
  { value: 'pack', label: 'Pack' },
  { value: 'box', label: 'Box' },
  { value: 'carton', label: 'Carton' },
  { value: 'roll', label: 'Roll' },
  { value: 'pair', label: 'Pair' },
  { value: 'set', label: 'Set' },
  { value: 'ream', label: 'Ream' },
  { value: 'pkt', label: 'Packet' },
  { value: 'can', label: 'Can' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'tube', label: 'Tube' },
];

function emptyItem(): QuoteItem {
  return { product_name: '', description: '', unit: 'piece', quantity: 1, preferred_brand: '', target_price: 0, notes: '' };
}

interface CatalogSearchResult {
  id: string;
  name: string;
  brand: string | null;
  size_variant: string | null;
  base_price: number;
  gst_rate: number;
}

interface AdditionalItem {
  product: CatalogSearchResult;
  qty: number;
}

// VariantPicker — lets buyer swap a matched row to a different catalog product
interface VariantPickerProps {
  catalogName: string;
  selected: CatalogSearchResult | null;
  onSelect: (r: CatalogSearchResult) => void;
  onClear: () => void;
}

function VariantPicker({ catalogName, selected, onSelect, onClear }: VariantPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  function runSearch(q: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&per_page=8`);
        const json = await res.json() as { data: { products: CatalogSearchResult[] } | null };
        setResults(json.data?.products ?? []);
      } finally { setSearching(false); }
    }, 300);
  }

  function openPicker() { setOpen(true); setQuery(catalogName); runSearch(catalogName); }

  function handleSelect(r: CatalogSearchResult) {
    onSelect(r); setOpen(false); setQuery(''); setResults([]);
  }

  if (open) {
    return (
      <div ref={wrapRef} className="relative mt-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); runSearch(e.target.value); }}
            className="w-full pl-6 pr-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            placeholder="Search catalog..."
          />
          {searching && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-slate-400" />}
        </div>
        {results.length > 0 && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-teal-50 text-left border-b border-slate-100 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{r.name}</p>
                  {(r.brand || r.size_variant) && (
                    <p className="text-[10px] text-slate-400">{[r.brand, r.size_variant].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <span className="text-xs font-bold text-teal-700 font-heading shrink-0">{formatINR(r.base_price)}</span>
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setOpen(false)} className="mt-0.5 text-[10px] text-slate-400 hover:text-slate-600">Cancel</button>
      </div>
    );
  }

  if (selected) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold">Swapped</span>
        <button onClick={onClear} className="text-[10px] text-slate-400 hover:text-rose-500 underline">reset</button>
      </div>
    );
  }

  return (
    <button
      onClick={openPicker}
      className="mt-1 flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-teal-600 transition-colors"
    >
      <RefreshCw className="w-2.5 h-2.5" /> swap variant
    </button>
  );
}

// AddMoreProducts — catalog search to add extra items
function AddMoreProducts({ onAdd }: { onAdd: (item: AdditionalItem) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}&per_page=8`);
        const json = await res.json() as { data: { products: CatalogSearchResult[] } | null };
        const prods = json.data?.products ?? [];
        setResults(prods);
        setOpen(prods.length > 0);
      } finally { setSearching(false); }
    }, 350);
  }

  function handleSelect(r: CatalogSearchResult) {
    onAdd({ product: r, qty: 1 });
    setQuery(''); setResults([]); setOpen(false);
    toast.success(`Added: ${r.name}`);
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-teal-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-400 bg-white"
          placeholder="Search and add more products to this order..."
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-teal-50 text-left border-b border-slate-100 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                {(r.brand || r.size_variant) && (
                  <p className="text-xs text-slate-400">{[r.brand, r.size_variant].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <span className="text-sm font-bold text-teal-700 font-heading shrink-0">{formatINR(r.base_price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Main page
export default function AccountQuotesPage() {
  const router = useRouter();
  const { addItem: addToCart } = useCartStore();

  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'manual' | 'excel'>('manual');
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);

  const [excelTitle, setExcelTitle] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    matched: PreviewMatchedItem[];
    unmatched: PreviewUnmatchedItem[];
  } | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Map<number, CatalogSearchResult>>(new Map());
  const [additionalItems, setAdditionalItems] = useState<AdditionalItem[]>([]);

  useEffect(() => { loadQuotes(); }, []);

  async function loadQuotes() {
    try {
      const res = await fetch('/api/buyer/quotes');
      const json = await res.json() as { data: QuoteRequest[] | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      setQuotes(json.data ?? []);
    } catch { toast.error('Could not load quote requests'); }
    finally { setLoading(false); }
  }

  function resetForm() {
    setTitle(''); setNotes(''); setItems([emptyItem()]);
    setExcelTitle(''); setExcelFile(null);
    setPreviewResult(null); setPreviewing(false);
    setSelectedVariants(new Map()); setAdditionalItems([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(false);
  }

  function addItem() { setItems((p) => [...p, emptyItem()]); }
  function removeItem(idx: number) {
    if (items.length === 1) { toast.error('At least one item is required'); return; }
    setItems((p) => p.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setItems((p) => p.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleManualSubmit() {
    if (!title.trim()) { toast.error('Please add a title'); return; }
    for (const item of items) {
      if (!item.product_name.trim()) { toast.error('Every item needs a product name'); return; }
      if (item.quantity <= 0) { toast.error(`Quantity for "${item.product_name}" must be > 0`); return; }
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/buyer/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), items, notes: notes.trim() }),
      });
      const json = await res.json() as { data: { id: string } | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Quote request submitted!');
      resetForm(); await loadQuotes();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Submit failed'); }
    finally { setSubmitting(false); }
  }

  async function handleExcelPreview() {
    if (!excelTitle.trim()) { toast.error('Please add a title'); return; }
    if (!excelFile) { toast.error('Please select an Excel file'); return; }
    const ext = excelFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') { toast.error('Only .xlsx or .xls files are accepted'); return; }
    setPreviewing(true);
    try {
      const form = new FormData();
      form.append('file', excelFile);
      const res = await fetch('/api/buyer/quotes/preview', { method: 'POST', body: form });
      const json = await res.json() as {
        data: { matched: PreviewMatchedItem[]; unmatched: PreviewUnmatchedItem[] } | null;
        error: string | null;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Preview failed');
      setPreviewResult(json.data);
      setSelectedVariants(new Map()); setAdditionalItems([]);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not preview products'); }
    finally { setPreviewing(false); }
  }

  // Option 1: add matched items to cart, submit unmatched as separate quote
  async function handleOrderNow() {
    if (!previewResult) return;
    setSubmitting(true);
    try {
      const effectiveMatched = previewResult.matched.map((item, i) => ({
        productId: selectedVariants.get(i)?.id ?? item.product_id,
        qty: item.requested_qty,
      }));
      const allIds = [
        ...effectiveMatched.map((m) => m.productId),
        ...additionalItems.map((a) => a.product.id),
      ];

      let productMap = new Map<string, MarketplaceProduct>();
      if (allIds.length > 0) {
        const res = await fetch(`/api/products?ids=${allIds.join(',')}`);
        const json = await res.json() as { data: { products: MarketplaceProduct[] } | null };
        productMap = new Map((json.data?.products ?? []).map((p) => [p.id, p]));
      }

      let addedCount = 0;
      for (const m of effectiveMatched) {
        const p = productMap.get(m.productId);
        if (p) { addToCart(p as unknown as Product, m.qty); addedCount++; }
      }
      for (const a of additionalItems) {
        const p = productMap.get(a.product.id);
        if (p) { addToCart(p as unknown as Product, a.qty); addedCount++; }
      }

      if (previewResult.unmatched.length > 0) {
        const quoteItems: QuoteItem[] = previewResult.unmatched.map((u) => ({
          product_name: u.requested_name,
          description: '',
          unit: u.requested_unit,
          quantity: u.requested_qty,
          preferred_brand: '',
          target_price: 0,
          notes: 'To be priced by Primeserve',
        }));
        await fetch('/api/buyer/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${excelTitle.trim()} — Items to Quote`, items: quoteItems }),
        });
        toast.success(`${addedCount} product(s) added to cart. ${previewResult.unmatched.length} item(s) sent for quoting.`);
      } else {
        toast.success(`${addedCount} product(s) added to cart!`);
      }

      router.push('/buyer/cart');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setSubmitting(false); }
  }

  // Option 2: submit all as a full quote request
  async function handleGetFullQuote() {
    if (!excelTitle.trim()) { toast.error('Please add a title'); return; }
    if (!previewResult) return;
    setSubmitting(true);
    try {
      const allItems: QuoteItem[] = [
        ...previewResult.matched.map((item, i) => {
          const v = selectedVariants.get(i);
          return {
            product_name: v?.name ?? item.catalog_name,
            description: v?.size_variant ?? item.size_variant ?? '',
            unit: item.requested_unit,
            quantity: item.requested_qty,
            preferred_brand: v?.brand ?? item.brand ?? '',
            target_price: v
              ? v.base_price * (1 + v.gst_rate / 100)
              : item.gross_per_unit,
            notes: `catalog_id:${v?.id ?? item.product_id}`,
          };
        }),
        ...additionalItems.map((a) => ({
          product_name: a.product.name,
          description: a.product.size_variant ?? '',
          unit: 'piece',
          quantity: a.qty,
          preferred_brand: a.product.brand ?? '',
          target_price: a.product.base_price * (1 + a.product.gst_rate / 100),
          notes: `catalog_id:${a.product.id}`,
        })),
        ...previewResult.unmatched.map((u) => ({
          product_name: u.requested_name,
          description: '',
          unit: u.requested_unit,
          quantity: u.requested_qty,
          preferred_brand: '',
          target_price: 0,
          notes: '',
        })),
      ];

      const res = await fetch('/api/buyer/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: excelTitle.trim(), items: allItems }),
      });
      const json = await res.json() as { data: { id: string } | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Full quote request submitted! Our team will respond shortly.');
      resetForm(); await loadQuotes();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Submit failed'); }
    finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors bg-white';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Request a Quotation</h1>
          <p className="text-sm text-slate-500 mt-1">Submit your product requirements and get competitive bulk pricing.</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors shrink-0 shadow-sm">
            <Plus className="w-4 h-4" />New Request
          </button>
        )}
      </div>

      {/* New Quote Form */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-teal-300 shadow-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-teal-50/50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-700">New Quote Request</h3>
            </div>
            <button onClick={resetForm} className="p-1 text-slate-400 hover:text-slate-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-slate-100">
            {(['manual', 'excel'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFormMode(mode)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  formMode === mode
                    ? 'border-b-2 border-teal-600 text-teal-700 bg-teal-50/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode === 'manual' ? <><Plus className="w-4 h-4" />Manual Entry</> : <><FileSpreadsheet className="w-4 h-4" />Upload Excel</>}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">
            {formMode === 'manual' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Request Title <span className="text-rose-500">*</span></label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. April Monthly Requirements" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-600">Products Needed <span className="text-rose-500">*</span></label>
                    <button onClick={addItem} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium">
                      <Plus className="w-3.5 h-3.5" />Add item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Product Name <span className="text-rose-400">*</span></label>
                            <input type="text" value={item.product_name} onChange={(e) => updateItem(idx, 'product_name', e.target.value)} className={inputCls} placeholder="e.g. Floor Mop" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Size / Description</label>
                            <input type="text" value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className={inputCls} placeholder="e.g. 400g, Heavy-duty" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Unit</label>
                            <CustomSelect value={item.unit} onChange={(v) => updateItem(idx, 'unit', v)} className={inputCls} options={UNITS.map((u) => ({ value: u.value, label: u.label }))} />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Quantity <span className="text-rose-400">*</span></label>
                            <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)} className={`${inputCls} font-heading`} />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Preferred Brand</label>
                            <input type="text" value={item.preferred_brand} onChange={(e) => updateItem(idx, 'preferred_brand', e.target.value)} className={inputCls} placeholder="Any / Scotch-Brite" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Target Price (&#8377;)</label>
                            <input type="number" min={0} step={0.01} value={item.target_price || ''} onChange={(e) => updateItem(idx, 'target_price', parseFloat(e.target.value) || 0)} className={`${inputCls} font-heading`} placeholder="0" />
                          </div>
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Notes</label>
                            <input type="text" value={item.notes} onChange={(e) => updateItem(idx, 'notes', e.target.value)} className={inputCls} placeholder="Optional notes" />
                          </div>
                          <button onClick={() => removeItem(idx)} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors shrink-0 mb-0.5">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Additional Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} placeholder="Delivery preferences, special requirements..." />
                </div>
                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <button onClick={handleManualSubmit} disabled={submitting} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button onClick={resetForm} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                </div>
              </>
            ) : (
              <>
                {/* Excel guide */}
                <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
                  <Info className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-teal-800 mb-2">Expected Excel Format</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {['Product Name', 'Size / Description', 'Unit', 'Quantity', 'Preferred Brand'].map((col) => (
                        <span key={col} className="bg-white border border-teal-200 rounded px-2 py-1 text-xs font-heading text-teal-800">{col}</span>
                      ))}
                    </div>
                    <p className="text-xs text-teal-600">Each row after the header is one product. We match each item to our catalog and show pricing before you submit.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Request Title <span className="text-rose-500">*</span></label>
                  <input type="text" value={excelTitle} onChange={(e) => setExcelTitle(e.target.value)} className={inputCls} placeholder="e.g. April Monthly Requirements" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Excel File <span className="text-rose-500">*</span> <span className="text-slate-400 font-normal">(.xlsx or .xls)</span></label>
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {excelFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileSpreadsheet className="w-8 h-8 text-teal-600" />
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-800">{excelFile.name}</p>
                          <p className="text-xs text-slate-400">{(excelFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setExcelFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="ml-2 p-1 text-slate-400 hover:text-rose-500 rounded">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-600">Click to select your Excel file</p>
                        <p className="text-xs text-slate-400 mt-1">.xlsx or .xls, up to 5MB</p>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)} />
                </div>

                {/* Step 1 — preview button */}
                {!previewResult && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={handleExcelPreview}
                      disabled={previewing || !excelFile}
                      className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                      {previewing ? 'Please wait, finding your products...' : 'Preview Products'}
                    </button>
                    <button onClick={resetForm} className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
                )}

                {/* Step 2 — preview results */}
                {previewResult && (() => {
                  const effectiveMatched = previewResult.matched.map((item, i) => {
                    const v = selectedVariants.get(i);
                    const basePrice = v?.base_price ?? item.base_price;
                    const gstRate = v?.gst_rate ?? item.gst_rate;
                    const grossPerUnit = basePrice * (1 + gstRate / 100);
                    return {
                      ...item,
                      resolvedId: v?.id ?? item.product_id,
                      resolvedName: v?.name ?? item.catalog_name,
                      resolvedBrand: v?.brand ?? item.brand,
                      resolvedSize: v?.size_variant ?? item.size_variant,
                      resolvedBasePrice: basePrice,
                      resolvedGstRate: gstRate,
                      resolvedGrossPerUnit: grossPerUnit,
                      resolvedGrossTotal: grossPerUnit * item.requested_qty,
                      isSwapped: !!v,
                    };
                  });

                  const matchedTotal = effectiveMatched.reduce((s, m) => s + m.resolvedGrossTotal, 0);
                  const additionalTotal = additionalItems.reduce((s, a) => s + a.product.base_price * (1 + a.product.gst_rate / 100) * a.qty, 0);
                  const grandTotal = matchedTotal + additionalTotal;
                  const totalCatalogItems = effectiveMatched.length + additionalItems.length;

                  return (
                    <div className="space-y-5 pt-2 border-t border-slate-100">

                      {/* Matched + additional table */}
                      {totalCatalogItems > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                              Available in catalog &mdash; {totalCatalogItems} item{totalCatalogItems !== 1 ? 's' : ''}
                            </p>
                          </div>

                          {/* Full-width table with fixed columns — no horizontal scroll */}
                          <div className="w-full rounded-xl border-2 border-teal-300 overflow-hidden shadow-sm">
                            <table className="w-full table-fixed">
                              <colgroup>
                                <col style={{ width: '42%' }} />
                                <col style={{ width: '11%' }} />
                                <col style={{ width: '21%' }} />
                                <col style={{ width: '22%' }} />
                                <col style={{ width: '4%' }} />
                              </colgroup>
                              <thead>
                                <tr className="bg-teal-700">
                                  <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Product Name</th>
                                  <th className="px-2 py-3 text-center text-xs font-bold text-white uppercase tracking-wider">Qty</th>
                                  <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider">Unit Rate (+ GST)</th>
                                  <th className="px-3 py-3 text-right text-xs font-bold text-white uppercase tracking-wider">Total incl. GST</th>
                                  <th className="px-1 py-3"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {effectiveMatched.map((item, i) => (
                                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="px-4 py-3">
                                      <div className="flex items-start gap-1.5 flex-wrap min-w-0">
                                        <p className="font-heading text-sm font-semibold text-slate-900 leading-snug truncate max-w-full">{item.resolvedName}</p>
                                        {item.match_strategy === 'ai' && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold shrink-0">
                                            <Sparkles className="w-2.5 h-2.5" />AI
                                          </span>
                                        )}
                                        {item.isSwapped && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold shrink-0">Swapped</span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                        {[item.resolvedBrand, item.resolvedSize].filter(Boolean).join(' · ') || 'No brand / size info'}
                                      </p>
                                      {item.requested_name.toLowerCase() !== item.resolvedName.toLowerCase() && (
                                        <p className="text-[10px] text-slate-400 truncate">Asked: {item.requested_name}</p>
                                      )}
                                      <VariantPicker
                                        catalogName={item.catalog_name}
                                        selected={selectedVariants.get(i) ?? null}
                                        onSelect={(r) => setSelectedVariants((prev) => new Map(prev).set(i, r))}
                                        onClear={() => setSelectedVariants((prev) => { const next = new Map(prev); next.delete(i); return next; })}
                                      />
                                    </td>
                                    <td className="px-2 py-3 text-center">
                                      <span className="font-heading text-sm font-semibold text-slate-700 block">{item.requested_qty}</span>
                                      <span className="text-[10px] text-slate-400">{item.requested_unit}</span>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                      <span className="font-heading text-sm font-semibold text-teal-700 block">{formatINR(item.resolvedBasePrice)}</span>
                                      <span className="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">+{item.resolvedGstRate}%</span>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                      <span className="font-heading text-sm font-bold text-slate-900">{formatINR(item.resolvedGrossTotal)}</span>
                                    </td>
                                    <td className="px-1 py-3"></td>
                                  </tr>
                                ))}

                                {/* Additional items added by buyer */}
                                {additionalItems.map((a, i) => {
                                  const grossUnit = a.product.base_price * (1 + a.product.gst_rate / 100);
                                  return (
                                    <tr key={`add-${i}`} className="bg-emerald-50/30 hover:bg-emerald-50/50 transition-colors">
                                      <td className="px-4 py-3">
                                        <p className="font-heading text-sm font-semibold text-slate-900 leading-snug truncate">{a.product.name}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                          {[a.product.brand, a.product.size_variant].filter(Boolean).join(' · ') || 'No brand / size info'}
                                        </p>
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-semibold">Added</span>
                                      </td>
                                      <td className="px-2 py-3 text-center">
                                        <input
                                          type="number"
                                          min={1}
                                          value={a.qty}
                                          onChange={(e) => {
                                            const qty = Math.max(1, parseInt(e.target.value, 10) || 1);
                                            setAdditionalItems((prev) => prev.map((x, j) => j === i ? { ...x, qty } : x));
                                          }}
                                          className="w-12 text-center text-sm font-semibold border border-slate-300 rounded-md py-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                                        />
                                      </td>
                                      <td className="px-3 py-3 text-right">
                                        <span className="font-heading text-sm font-semibold text-teal-700 block">{formatINR(a.product.base_price)}</span>
                                        <span className="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">+{a.product.gst_rate}%</span>
                                      </td>
                                      <td className="px-3 py-3 text-right">
                                        <span className="font-heading text-sm font-bold text-slate-900">{formatINR(grossUnit * a.qty)}</span>
                                      </td>
                                      <td className="px-1 py-3 text-center">
                                        <button
                                          onClick={() => setAdditionalItems((prev) => prev.filter((_, j) => j !== i))}
                                          className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-teal-700 border-t-2 border-teal-600">
                                  <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider text-teal-100">
                                    Grand Total (incl. GST)
                                  </td>
                                  <td className="px-3 py-3 text-right">
                                    <p className="font-heading text-xl font-extrabold text-white">{formatINR(grandTotal)}</p>
                                  </td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Unmatched — will be quoted */}
                      {previewResult.unmatched.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                              To be quoted &mdash; {previewResult.unmatched.length} item{previewResult.unmatched.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="rounded-xl border-2 border-amber-200 overflow-hidden">
                            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200">
                              <p className="text-xs text-amber-800 font-medium">
                                These items could not be auto-matched. Primeserve will contact you with pricing.
                              </p>
                            </div>
                            {previewResult.unmatched.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-amber-100 last:border-b-0 bg-amber-50/30">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="font-heading text-sm font-semibold text-slate-800 flex-1 truncate">{item.requested_name}</span>
                                <span className="shrink-0 text-xs text-slate-500 font-heading">{item.requested_qty} {item.requested_unit}</span>
                                <span className="shrink-0 text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Will be quoted</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add more products */}
                      <div>
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                          Add More Products to This Order
                        </p>
                        <AddMoreProducts onAdd={(item) => setAdditionalItems((prev) => [...prev, item])} />
                      </div>

                      {/* Two submit options */}
                      <div className="pt-4 border-t-2 border-slate-100 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={handleOrderNow}
                            disabled={submitting || totalCatalogItems === 0}
                            className="flex items-start gap-3 px-5 py-4 bg-teal-600 text-white rounded-xl text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-left"
                          >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" /> : <ShoppingCart className="w-5 h-5 shrink-0 mt-0.5" />}
                            <div>
                              <p className="font-bold leading-tight">Order Available Products</p>
                              <p className="text-xs text-teal-200 font-normal leading-snug mt-0.5">
                                {totalCatalogItems} item{totalCatalogItems !== 1 ? 's' : ''} go to cart immediately
                                {previewResult.unmatched.length > 0 && ` · ${previewResult.unmatched.length} item(s) quoted separately`}
                              </p>
                            </div>
                          </button>

                          <button
                            onClick={handleGetFullQuote}
                            disabled={submitting}
                            className="flex items-start gap-3 px-5 py-4 bg-slate-700 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-left"
                          >
                            {submitting ? <Loader2 className="w-5 h-5 animate-spin shrink-0 mt-0.5" /> : <FileText className="w-5 h-5 shrink-0 mt-0.5" />}
                            <div>
                              <p className="font-bold leading-tight">Get Full Quote</p>
                              <p className="text-xs text-slate-300 font-normal leading-snug mt-0.5">
                                Submit all {previewResult.matched.length + previewResult.unmatched.length + additionalItems.length} items for team review &mdash; we&apos;ll send a complete quote
                              </p>
                            </div>
                          </button>
                        </div>

                        <button
                          onClick={() => { setPreviewResult(null); setSelectedVariants(new Map()); setAdditionalItems([]); }}
                          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />Back to file selection
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Quote history list */}
      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium text-sm">No quote requests yet</p>
          <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">Submit your product requirements and our team will respond with competitive pricing.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" />Create First Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div key={quote.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === quote.id ? null : quote.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{quote.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[quote.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {STATUS_LABELS[quote.status] ?? quote.status}
                    </span>
                    {quote.quoted_amount && (
                      <span className="text-xs font-bold text-teal-700 font-heading">Quoted: {formatINR(quote.quoted_amount)}</span>
                    )}
                    {quote.document_url && (
                      <span className="flex items-center gap-1 text-xs text-slate-400"><FileSpreadsheet className="w-3 h-3" />Excel</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {(quote.items as QuoteItem[]).length} item{(quote.items as QuoteItem[]).length !== 1 ? 's' : ''} &middot; {formatDate(quote.created_at)}
                  </p>
                </div>
                {expandedId === quote.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>

              {expandedId === quote.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {quote.document_url && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <FileSpreadsheet className="w-4 h-4 text-teal-600 shrink-0" />
                      <p className="text-xs text-slate-600 flex-1">Excel file uploaded</p>
                      <a href={quote.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline font-medium">Download</a>
                    </div>
                  )}

                  {(quote.items as QuoteItem[]).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items</p>
                      <div className="rounded-lg border-2 border-slate-200 overflow-hidden">
                        <table className="w-full text-sm table-fixed">
                          <colgroup>
                            <col style={{ width: '32%' }} />
                            <col style={{ width: '22%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '10%' }} />
                            <col style={{ width: '26%' }} />
                          </colgroup>
                          <thead>
                            <tr className="bg-slate-700">
                              <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wider">Product</th>
                              <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wider">Size / Desc</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wider">Qty</th>
                              <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wider">Unit</th>
                              <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase tracking-wider">Brand / Target</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(quote.items as QuoteItem[]).map((item, i) => (
                              <tr key={i} className="text-slate-700 hover:bg-slate-50">
                                <td className="px-3 py-2.5 font-medium truncate">{item.product_name}</td>
                                <td className="px-3 py-2.5 text-slate-500 truncate">{item.description || '—'}</td>
                                <td className="px-3 py-2.5 text-center font-heading">{item.quantity}</td>
                                <td className="px-3 py-2.5 text-center text-slate-500">{item.unit}</td>
                                <td className="px-3 py-2.5 text-right">
                                  <span className="block text-slate-500 truncate">{item.preferred_brand || '—'}</span>
                                  {item.target_price > 0 && (
                                    <span className="text-xs font-heading text-teal-700">{formatINR(item.target_price)}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(quote.admin_notes || quote.quoted_amount) && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-xs font-semibold text-purple-700 mb-2">PrimeServe Response</p>
                      {quote.quoted_amount && (
                        <p className="text-sm font-bold text-purple-900 font-heading mb-1">
                          Quoted: {formatINR(quote.quoted_amount)}
                          {quote.valid_until && (
                            <span className="font-normal text-purple-600 ml-2">valid until {new Date(quote.valid_until).toLocaleDateString('en-IN')}</span>
                          )}
                        </p>
                      )}
                      {quote.admin_notes && <p className="text-sm text-purple-800">{quote.admin_notes}</p>}
                    </div>
                  )}

                  {quote.notes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Your Notes</p>
                      <p className="text-sm text-slate-600">{quote.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
