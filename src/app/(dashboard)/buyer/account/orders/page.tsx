'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, ChevronLeft, ChevronRight, ChevronDown, Building2,
  Search, X, Download, FileText, RotateCcw, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { OrderStatus } from '@/types';

/* ─── Types ─── */
interface OrderPreviewItem { id: string; product_name: string; quantity: number; }
interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: 'razorpay' | 'credit_45day';
  total_amount: number;
  created_at: string;
  branch_name: string | null;
  client_name: string | null;
  order_items: OrderPreviewItem[];
}
interface BranchOption { id: string; name: string; }
interface ClientOption { id: string; name: string; display_name: string | null; is_primary: boolean; }

/* ─── Constants ─── */
const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all',                  label: 'All'        },
  { value: 'pending',              label: 'Pending'    },
  { value: 'approved',             label: 'Approved'   },
  { value: 'forwarded_to_vendor',  label: 'Forwarded'  },
  { value: 'dispatched',           label: 'Dispatched' },
  { value: 'delivered',            label: 'Delivered'  },
  { value: 'cancelled',            label: 'Cancelled'  },
];

const STATUS_STYLES: Record<string, string> = {
  pending:             'bg-amber-500/15  text-amber-300  border-amber-500/20',
  approved:            'bg-blue-500/15   text-blue-300   border-blue-500/20',
  forwarded_to_vendor: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  dispatched:          'bg-orange-500/15 text-orange-300 border-orange-500/20',
  delivered:           'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  cancelled:           'bg-rose-500/15   text-rose-300   border-rose-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved',
  forwarded_to_vendor: 'Forwarded', dispatched: 'Dispatched',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

const PAYMENT_STYLES: Record<string, string> = {
  paid:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  pending: 'bg-amber-500/15   text-amber-300   border-amber-500/20',
  overdue: 'bg-rose-500/15    text-rose-300    border-rose-500/20',
};

const PER_PAGE = 10;

/* ─── Helpers ─── */
function itemsPreview(items: OrderPreviewItem[]): string {
  if (!items.length) return 'No items';
  const first = `${items[0].product_name} ×${items[0].quantity}`;
  if (items.length === 1) return first;
  return `${first} +${items.length - 1} more`;
}

function paymentLabel(status: string): string {
  if (status === 'paid') return 'Paid';
  if (status === 'overdue') return 'Overdue';
  return 'Payment Pending';
}

/* ─── PDF download helpers ─── */
function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/* ─── Page component ─── */
export default function AccountOrdersPage() {
  /* Data */
  const [orders,      setOrders]      = useState<OrderRow[]>([]);
  const [clients,     setClients]     = useState<ClientOption[]>([]);
  const [branches,    setBranches]    = useState<BranchOption[]>([]);
  /* Filters */
  const [search,      setSearch]      = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<OrderStatus | 'all'>('all');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  /* Pagination */
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  /* UI state */
  const [loading,          setLoading]          = useState(true);
  const [pdfLoading,       setPdfLoading]       = useState<string | null>(null);
  const [trackOrdersOpen,  setTrackOrdersOpen]  = useState(true);
  const [branchDropOpen,   setBranchDropOpen]   = useState(false);

  /* ── Debounce search ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  /* ── Reset to page 1 on filter change ── */
  useEffect(() => { setPage(1); }, [activeStatus, selectedBranch, selectedClient, debouncedSearch]);

  /* ── Load clients once ── */
  useEffect(() => {
    fetch('/api/buyer/clients')
      .then((r) => r.json())
      .then((j: { data: ClientOption[] | null; error: string | null }) => {
        if (j.data) setClients(j.data);
      })
      .catch(() => {/* silent */});
  }, []);

  /* ── Load branches when client changes ── */
  useEffect(() => {
    setBranches([]);
    setSelectedBranch('');
    if (!selectedClient) return;
    fetch(`/api/buyer/clients/${selectedClient}/branches`)
      .then((r) => r.json())
      .then((j: { data: { branches: BranchOption[] } | null; error: string | null }) => {
        if (j.data?.branches) setBranches(j.data.branches);
      })
      .catch(() => {/* silent */});
  }, [selectedClient]);

  /* ── Load orders ── */
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (activeStatus !== 'all') params.set('status', activeStatus);
      if (selectedClient)         params.set('client_id', selectedClient);
      if (selectedBranch)         params.set('branch_id', selectedBranch);
      if (debouncedSearch)        params.set('search', debouncedSearch);

      const res  = await fetch(`/api/buyer/orders?${params}`);
      const json = await res.json() as {
        data: { orders: OrderRow[]; total: number } | null;
        error: string | null;
      };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      const rows = json.data?.orders ?? [];
      const tot  = json.data?.total  ?? 0;
      setOrders(rows);
      setTotal(tot);
      setTotalPages(Math.max(1, Math.ceil(tot / PER_PAGE)));
    } catch {
      toast.error('Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [page, activeStatus, selectedClient, selectedBranch, debouncedSearch]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  /* ── PDF handlers ── */
  async function handleDownload(orderId: string, type: 'invoice' | 'dc', orderNumber: string) {
    const key = `${orderId}-${type}`;
    setPdfLoading(key);
    try {
      const res = await fetch(`/api/buyer/orders/${orderId}/${type}`);
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const filename = type === 'invoice'
        ? `invoice-${orderNumber}.pdf`
        : `dc-${orderNumber}.pdf`;
      downloadFile(url, filename);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Could not generate ${type === 'invoice' ? 'invoice' : 'delivery challan'}`);
    } finally {
      setPdfLoading(null);
    }
  }

  /* ── Filters active? ── */
  const hasFilters = activeStatus !== 'all' || selectedClient || selectedBranch || debouncedSearch;

  function clearFilters() {
    setActiveStatus('all');
    setSelectedClient('');
    setSelectedBranch('');
    setSearch('');
  }

  /* ── Branch summary (shown when a branch is selected) ── */
  const branchOrders   = orders; // already server-filtered
  const branchTotal    = total;
  const branchPending  = orders.filter((o) => ['pending', 'approved', 'forwarded_to_vendor', 'dispatched'].includes(o.status)).length;
  const branchDelivered = orders.filter((o) => o.status === 'delivered').length;
  const branchSpend    = orders.reduce((s, o) => s + o.total_amount, 0);

  const selectedBranchName = branches.find((b) => b.id === selectedBranch)?.name ?? 'All Branches';

  /* ─── Render ─── */
  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Orders</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track and manage all procurement orders across your branches.</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">

        {/* Top row: Track Orders + All Branches + Search */}
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-white/8">

          {/* Track Orders toggle */}
          <button
            onClick={() => setTrackOrdersOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-400 text-sm font-semibold transition-all hover:bg-teal-500/20 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Package className="w-4 h-4" />
            Track Orders
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${trackOrdersOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* All Branches dropdown */}
          <div className="relative">
            <button
              onClick={() => setBranchDropOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-medium transition-all hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              {selectedBranch ? selectedBranchName : 'All Branches'}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-150 ${branchDropOpen ? 'rotate-180' : ''}`} />
            </button>
            {branchDropOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-navy-800 border border-white/10 rounded-xl shadow-2xl shadow-black/40 z-20 overflow-hidden py-1">
                <button
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${!selectedBranch ? 'bg-teal-500/20 text-teal-400 font-semibold' : 'text-slate-300 hover:bg-teal-500/10 hover:text-teal-400'}`}
                  onClick={() => { setSelectedBranch(''); setBranchDropOpen(false); }}
                >
                  All Branches
                </button>
                {branches.map((b) => (
                  <button
                    key={b.id}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${selectedBranch === b.id ? 'bg-teal-500/20 text-teal-400 font-semibold' : 'text-slate-300 hover:bg-teal-500/10 hover:text-teal-400'}`}
                    onClick={() => { setSelectedBranch(b.id); setBranchDropOpen(false); }}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Company filter */}
          {clients.length > 1 && (
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="py-2 pl-3 pr-8 text-sm bg-white/5 border border-white/10 text-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Companies</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name ?? c.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-45">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by order number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 px-3 py-2 rounded-xl border border-white/8 hover:border-white/15 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Collapsible status pills */}
        <div className={`overflow-hidden transition-all duration-200 ${trackOrdersOpen ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="flex flex-wrap gap-1.5 px-3 py-3">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveStatus(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all duration-150 ${
                  activeStatus === tab.value
                    ? 'bg-teal-500/20 text-teal-400 border-teal-500/30'
                    : 'bg-white/4 text-slate-500 border-white/8 hover:border-teal-500/30 hover:text-teal-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Branch summary bar */}
      {selectedBranch && !loading && (
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold text-teal-300">{selectedBranchName}</span>
          <span className="text-teal-400/70">{branchTotal} order{branchTotal !== 1 ? 's' : ''}</span>
          <span className="text-teal-400/70">Total: <span className="font-bold text-teal-300 tabular-nums">{formatINR(branchSpend)}</span></span>
          <span className="text-teal-400/70">{branchPending} in progress</span>
          <span className="text-teal-400/70">{branchDelivered} delivered</span>
        </div>
      )}

      {/* Order list */}
      <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl shadow-xl shadow-black/20 overflow-hidden">
        {loading ? (
          <div className="py-14 text-center">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-500">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-14 text-center">
            <Package className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium text-sm">No orders found</p>
            <p className="text-slate-600 text-xs mt-1">
              {hasFilters ? 'Try adjusting your filters.' : "You haven't placed any orders yet."}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {orders.map((order) => {
              const statusStyle = STATUS_STYLES[order.status] ?? 'bg-white/8 text-slate-400 border-white/10';
              const payStyle    = PAYMENT_STYLES[order.payment_status] ?? PAYMENT_STYLES.pending;
              const isDelivered = order.status === 'delivered';
              const pdfKey      = `${order.id}-invoice`;
              const dcKey       = `${order.id}-dc`;

              return (
                <div key={order.id} className="px-5 py-4 hover:bg-white/4 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                    {/* Left: main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold text-teal-400 tabular-nums tracking-tight">{order.order_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyle}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${payStyle}`}>
                          {paymentLabel(order.payment_status)}
                        </span>
                      </div>

                      {(order.branch_name || order.client_name) && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="text-sm text-slate-400">
                            {order.branch_name ?? 'Unknown Branch'}
                            {order.client_name && (
                              <span className="text-slate-600"> · {order.client_name}</span>
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="text-xs text-slate-500">{itemsPreview(order.order_items)}</span>
                        <span className="text-xs text-slate-600">{formatDate(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-base font-bold text-white tabular-nums tracking-tight">{formatINR(order.total_amount)}</span>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/buyer/orders/${order.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:border-teal-500/30 hover:text-teal-400 transition-colors font-medium"
                        >
                          View Details
                        </Link>

                        <button
                          onClick={() => handleDownload(order.id, 'invoice', order.order_number)}
                          disabled={pdfLoading === pdfKey}
                          title="Download Invoice"
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:border-teal-500/30 hover:text-teal-400 disabled:opacity-50 transition-colors"
                        >
                          {pdfLoading === pdfKey
                            ? <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                            : <Download className="w-3 h-3" />
                          }
                          <span>Invoice</span>
                        </button>

                        {isDelivered && (
                          <button
                            onClick={() => handleDownload(order.id, 'dc', order.order_number)}
                            disabled={pdfLoading === dcKey}
                            title="Download Delivery Challan"
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:border-teal-500/30 hover:text-teal-400 disabled:opacity-50 transition-colors"
                          >
                            {pdfLoading === dcKey
                              ? <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                              : <FileText className="w-3 h-3" />
                            }
                            <span>DC</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white/5 border border-white/8 rounded-2xl px-5 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-xs text-slate-500 font-medium">
            Page {page} of {totalPages} &nbsp;·&nbsp; {total} order{total !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
