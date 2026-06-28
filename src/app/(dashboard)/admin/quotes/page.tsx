'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FileText, Loader2, ChevronDown, ChevronUp, Search,
  Check, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { AdminQuote, AdminQuotesResponse, AdminQuoteItem } from '@/app/api/admin/quotes/route';

const STATUS_TABS = [
  { key: 'all',          label: 'All' },
  { key: 'submitted',    label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'quoted',       label: 'Quoted' },
  { key: 'accepted',     label: 'Accepted' },
  { key: 'rejected',     label: 'Rejected' },
];

const STATUS_STYLES: Record<string, string> = {
  submitted:    'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-amber-50 text-amber-700 border-amber-200',
  quoted:       'bg-purple-50 text-purple-700 border-purple-200',
  accepted:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:     'bg-rose-50 text-rose-700 border-rose-200',
};
const STATUS_LABELS: Record<string, string> = {
  submitted:    'Submitted',
  under_review: 'Under Review',
  quoted:       'Quoted',
  accepted:     'Accepted',
  rejected:     'Rejected',
};

interface RespondFormState {
  status: string;
  quoted_amount: string;
  admin_notes: string;
  valid_until: string;
}

function RespondPanel({ quote, onSaved }: { quote: AdminQuote; onSaved: () => void }) {
  const [form, setForm] = useState<RespondFormState>({
    status: quote.status,
    quoted_amount: quote.quoted_amount ? String(quote.quoted_amount) : '',
    admin_notes: quote.admin_notes ?? '',
    valid_until: quote.valid_until ? quote.valid_until.slice(0, 10) : '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { status: form.status };
      if (form.quoted_amount) body.quoted_amount = parseFloat(form.quoted_amount);
      else body.quoted_amount = null;
      body.admin_notes = form.admin_notes.trim() || null;
      body.valid_until = form.valid_until || null;

      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json() as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Quote updated');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white';

  return (
    <div className="p-4 bg-teal-50/40 border border-teal-200 rounded-xl space-y-3">
      <p className="text-xs font-bold text-teal-800 uppercase tracking-wider">Respond to Quote</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className={inputCls}
          >
            {STATUS_TABS.filter((t) => t.key !== 'all').map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Quoted Amount (&#8377;)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.quoted_amount}
            onChange={(e) => setForm((f) => ({ ...f, quoted_amount: e.target.value }))}
            className={`${inputCls} font-heading`}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Valid Until</label>
          <input
            type="date"
            value={form.valid_until}
            onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes to Buyer</label>
          <input
            type="text"
            value={form.admin_notes}
            onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))}
            className={inputCls}
            placeholder="Optional message..."
          />
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        {saving ? 'Saving...' : 'Save Response'}
      </button>
    </div>
  );
}

export default function AdminQuotesPage() {
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (activeTab !== 'all') params.set('status', activeTab);
      const res = await fetch(`/api/admin/quotes?${params}`);
      const json = await res.json() as { data: AdminQuotesResponse | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      setQuotes(json.data?.quotes ?? []);
      setStatusCounts(json.data?.status_counts ?? {});
    } catch {
      toast.error('Could not load quotes');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { void loadQuotes(); }, [loadQuotes]);

  const filtered = search.trim()
    ? quotes.filter((q) => {
        const s = search.toLowerCase();
        return (
          q.title.toLowerCase().includes(s) ||
          q.buyer?.full_name?.toLowerCase().includes(s) ||
          q.buyer?.company_name?.toLowerCase().includes(s) ||
          q.buyer?.email?.toLowerCase().includes(s)
        );
      })
    : quotes;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quote Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Review and respond to buyer quotation requests.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm outline-none w-48 placeholder:text-slate-400"
            placeholder="Search buyer, title..."
          />
          {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-slate-400" /></button>}
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {statusCounts[tab.key] != null && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                activeTab === tab.key ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {statusCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium text-sm">No quotes found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((quote) => (
            <div key={quote.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Row header */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 truncate">{quote.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_STYLES[quote.status] ?? ''}`}>
                      {STATUS_LABELS[quote.status] ?? quote.status}
                    </span>
                    {quote.quoted_amount && (
                      <span className="text-xs font-bold text-teal-700 font-heading">&#8377;{formatINR(quote.quoted_amount)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-slate-600 font-medium">{quote.buyer?.full_name ?? 'Unknown'}</span>
                    {quote.buyer?.company_name && (
                      <span className="text-xs text-slate-400">{quote.buyer.company_name}</span>
                    )}
                    {quote.buyer?.email && (
                      <span className="text-xs text-slate-400">{quote.buyer.email}</span>
                    )}
                    {quote.buyer?.phone && (
                      <span className="text-xs text-slate-400">{quote.buyer.phone}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {(quote.items as AdminQuoteItem[]).length} item{(quote.items as AdminQuoteItem[]).length !== 1 ? 's' : ''} &middot; {formatDate(quote.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setRespondingId(respondingId === quote.id ? null : quote.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      respondingId === quote.id
                        ? 'bg-teal-100 text-teal-700'
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Respond
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === quote.id ? null : quote.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    {expandedId === quote.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Respond panel */}
              {respondingId === quote.id && (
                <div className="px-5 pb-4">
                  <RespondPanel
                    quote={quote}
                    onSaved={() => { setRespondingId(null); loadQuotes(); }}
                  />
                </div>
              )}

              {/* Expanded items */}
              {expandedId === quote.id && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {(quote.items as AdminQuoteItem[]).length > 0 && (
                    <div className="rounded-lg border-2 border-slate-200 overflow-hidden">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: '30%' }} />
                          <col style={{ width: '20%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '15%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-slate-700">
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wider">Product</th>
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wider">Size / Desc</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wider">Qty</th>
                            <th className="px-3 py-2.5 text-center text-xs font-bold text-white uppercase tracking-wider">Unit</th>
                            <th className="px-3 py-2.5 text-left text-xs font-bold text-white uppercase tracking-wider">Brand</th>
                            <th className="px-3 py-2.5 text-right text-xs font-bold text-white uppercase tracking-wider">Target &#8377;</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(quote.items as AdminQuoteItem[]).map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 text-slate-700">
                              <td className="px-3 py-2.5 font-medium truncate">{item.product_name}</td>
                              <td className="px-3 py-2.5 text-slate-500 truncate">{item.description || '—'}</td>
                              <td className="px-3 py-2.5 text-center font-heading">{item.quantity}</td>
                              <td className="px-3 py-2.5 text-center text-slate-500">{item.unit}</td>
                              <td className="px-3 py-2.5 text-slate-500 truncate">{item.preferred_brand || '—'}</td>
                              <td className="px-3 py-2.5 text-right font-heading text-teal-700">
                                {item.target_price > 0 ? formatINR(item.target_price) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(quote.admin_notes || quote.quoted_amount) && (
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-xs font-semibold text-purple-700 mb-1">Your Response</p>
                      {quote.quoted_amount && (
                        <p className="text-sm font-bold text-purple-900 font-heading">{formatINR(quote.quoted_amount)}</p>
                      )}
                      {quote.admin_notes && <p className="text-sm text-purple-800 mt-1">{quote.admin_notes}</p>}
                    </div>
                  )}

                  {quote.notes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">Buyer Notes</p>
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
