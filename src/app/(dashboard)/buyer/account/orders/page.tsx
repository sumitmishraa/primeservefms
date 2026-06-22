'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Package, ChevronLeft, ChevronRight, Building2,
  Search, X, Download, FileText, RotateCcw,
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
  pending:             'bg-amber-50   text-amber-700   border-amber-200',
  approved:            'bg-blue-50    text-blue-700    border-blue-200',
  forwarded_to_vendor: 'bg-purple-50  text-purple-700  border-purple-200',
  dispatched:          'bg-orange-50  text-orange-700  border-orange-200',
  delivered:           'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:           'bg-rose-50    text-rose-700    border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved',
  forwarded_to_vendor: 'Forwarded', dispatched: 'Dispatched',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

const PAYMENT_STYLES: Record<string, string> = {
  paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50   text-amber-700   border-amber-200',
  overdue: 'bg-rose-50    text-rose-700    border-rose-200',
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
  const [loading,     setLoading]     = useState(true);
  const [pdfLoading,  setPdfLoading]  = useState<string | null>(null);

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

  /* ─── Render ─── */
  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500 mt-0.5">Track and manage all procurement orders across your branches.</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">

        {/* Row 1: Search + Company + Branch + Clear */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by order number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Company filter (only if multi-company) */}
          {clients.length > 1 && (
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="py-2 pl-3 pr-8 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            >
              <option value="">All Companies</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.display_name ?? c.name}</option>
              ))}
            </select>
          )}

          {/* Branch filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="py-2 pl-3 pr-8 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Clear */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Row 2: Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activeStatus === tab.value
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Branch summary bar */}
      {selectedBranch && !loading && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold text-teal-800">
            {branches.find((b) => b.id === selectedBranch)?.name ?? 'Branch'}
          </span>
          <span className="text-teal-700">{branchTotal} order{branchTotal !== 1 ? 's' : ''}</span>
          <span className="text-teal-700">Total: <span className="font-mono font-semibold">{formatINR(branchSpend)}</span></span>
          <span className="text-teal-700">{branchPending} in progress</span>
          <span className="text-teal-700">{branchDelivered} delivered</span>
        </div>
      )}

      {/* Order list */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-14 text-center">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading orders…</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="py-14 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium text-sm">No orders found</p>
            <p className="text-slate-400 text-xs mt-1">
              {hasFilters ? 'Try adjusting your filters.' : "You haven't placed any orders yet."}
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-3 text-xs text-teal-600 hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => {
              const statusStyle = STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-600 border-slate-200';
              const payStyle    = PAYMENT_STYLES[order.payment_status] ?? PAYMENT_STYLES.pending;
              const isDelivered = order.status === 'delivered';
              const pdfKey      = `${order.id}-invoice`;
              const dcKey       = `${order.id}-dc`;

              return (
                <div key={order.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                    {/* Left: main info */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: order number + badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-sm font-bold font-mono text-slate-900">{order.order_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyle}`}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${payStyle}`}>
                          {paymentLabel(order.payment_status)}
                        </span>
                      </div>

                      {/* Row 2: branch + company */}
                      {(order.branch_name || order.client_name) && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-sm text-slate-600">
                            {order.branch_name ?? 'Unknown Branch'}
                            {order.client_name && (
                              <span className="text-slate-400"> · {order.client_name}</span>
                            )}
                          </span>
                        </div>
                      )}

                      {/* Row 3: items + date */}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="text-xs text-slate-500">{itemsPreview(order.order_items)}</span>
                        <span className="text-xs text-slate-400">{formatDate(order.created_at)}</span>
                      </div>
                    </div>

                    {/* Right: amount + actions */}
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <span className="text-base font-bold font-mono text-slate-900">{formatINR(order.total_amount)}</span>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/buyer/orders/${order.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors font-medium"
                        >
                          View Details
                        </Link>

                        <button
                          onClick={() => handleDownload(order.id, 'invoice', order.order_number)}
                          disabled={pdfLoading === pdfKey}
                          title="Download Invoice"
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:opacity-50 transition-colors"
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
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 disabled:opacity-50 transition-colors"
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
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-xs text-slate-500 font-medium">
            Page {page} of {totalPages} &nbsp;·&nbsp; {total} order{total !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
