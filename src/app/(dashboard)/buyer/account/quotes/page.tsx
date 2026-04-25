'use client';

/**
 * Account > Quote Requests (Monthly Requirement Upload)
 * Buyers submit a list of products they need regularly.
 * Admin reviews and responds with pricing.
 */

import { useEffect, useState } from 'react';
import { FileText, Plus, Trash2, Loader2, Check, ChevronDown, ChevronUp, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { QuoteRequest, QuoteItem } from '@/app/api/buyer/quotes/route';

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

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

const UNITS = ['piece', 'kg', 'litre', 'pack', 'box', 'carton', 'roll', 'pair', 'set', 'ream', 'packet', 'can', 'bottle', 'tube'];
const FREQUENCIES = ['One-time', 'Weekly', 'Monthly', 'Quarterly'];

// ---------------------------------------------------------------------------
// Empty item template
// ---------------------------------------------------------------------------

function emptyItem(): QuoteItem {
  return { product_name: '', quantity: 1, unit: 'piece', frequency: 'Monthly', notes: '' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([emptyItem()]);

  useEffect(() => {
    loadQuotes();
  }, []);

  async function loadQuotes() {
    try {
      const res = await fetch('/api/buyer/quotes');
      const json = await res.json() as { data: QuoteRequest[] | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      setQuotes(json.data ?? []);
    } catch {
      toast.error('Could not load quote requests');
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(idx: number) {
    if (items.length === 1) { toast.error('At least one item is required'); return; }
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof QuoteItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function handleSubmit() {
    if (!title.trim()) { toast.error('Please add a title for this request'); return; }
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
      setShowForm(false);
      setTitle(''); setNotes(''); setItems([emptyItem()]);
      await loadQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Quote Requests</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit your monthly product requirements and get a customised quote.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />New Request
          </button>
        )}
      </div>

      {/* New Quote Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-teal-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-700">New Quote Request</h3>
            </div>
            <button onClick={() => setShowForm(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Request Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. April Monthly Requirements — Floor Cleaning"
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">
                Products Needed <span className="text-rose-500">*</span>
              </label>
              <button
                onClick={addItem}
                className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />Add item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                  {/* Product name */}
                  <div className="col-span-12 sm:col-span-4">
                    <label className="block text-xs text-slate-500 mb-1">Product Name</label>
                    <input
                      type="text"
                      value={item.product_name}
                      onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                      className={inputCls}
                      placeholder="e.g. Floor Mop"
                    />
                  </div>
                  {/* Qty */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                      className={`${inputCls} font-mono`}
                    />
                  </div>
                  {/* Unit */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Unit</label>
                    <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className={inputCls}>
                      {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  {/* Frequency */}
                  <div className="col-span-4 sm:col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                    <select value={item.frequency} onChange={(e) => updateItem(idx, 'frequency', e.target.value)} className={inputCls}>
                      {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  {/* Delete */}
                  <div className="col-span-12 sm:col-span-2 flex items-end pb-0.5 gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">Notes</label>
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                        className={inputCls}
                        placeholder="Optional"
                      />
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Additional Notes <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="Delivery preferences, special requirements, preferred brands, etc."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quote list */}
      {quotes.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium text-sm">No quote requests yet</p>
          <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
            Submit your monthly product requirements and our team will get back with competitive pricing.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors mx-auto"
          >
            <Plus className="w-4 h-4" />Create First Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div key={quote.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Quote header */}
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
                      <span className="text-xs font-bold text-teal-700 font-mono">
                        Quoted: {formatINR(quote.quoted_amount)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {(quote.items as QuoteItem[]).length} item{(quote.items as QuoteItem[]).length !== 1 ? 's' : ''} · {formatDate(quote.created_at)}
                  </p>
                </div>
                {expandedId === quote.id
                  ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                }
              </button>

              {/* Expanded detail */}
              {expandedId === quote.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {/* Items table */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Items</p>
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs text-slate-500 font-medium">
                            <th className="px-3 py-2 text-left">Product</th>
                            <th className="px-3 py-2 text-right">Qty</th>
                            <th className="px-3 py-2 text-left">Unit</th>
                            <th className="px-3 py-2 text-left">Frequency</th>
                            <th className="px-3 py-2 text-left hidden sm:table-cell">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(quote.items as QuoteItem[]).map((item, i) => (
                            <tr key={i} className="text-slate-700">
                              <td className="px-3 py-2.5 font-medium">{item.product_name}</td>
                              <td className="px-3 py-2.5 text-right font-mono">{item.quantity}</td>
                              <td className="px-3 py-2.5 text-slate-500">{item.unit}</td>
                              <td className="px-3 py-2.5 text-slate-500">{item.frequency}</td>
                              <td className="px-3 py-2.5 text-slate-400 hidden sm:table-cell">{item.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quote response */}
                  {(quote.admin_notes || quote.quoted_amount) && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-xs font-semibold text-purple-700 mb-2">PrimeServe Response</p>
                      {quote.quoted_amount && (
                        <p className="text-sm font-bold text-purple-900 font-mono mb-1">
                          Quoted Amount: {formatINR(quote.quoted_amount)}
                          {quote.valid_until && (
                            <span className="font-normal text-purple-600 ml-2">valid until {new Date(quote.valid_until).toLocaleDateString('en-IN')}</span>
                          )}
                        </p>
                      )}
                      {quote.admin_notes && <p className="text-sm text-purple-800">{quote.admin_notes}</p>}
                    </div>
                  )}

                  {/* Buyer notes */}
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
