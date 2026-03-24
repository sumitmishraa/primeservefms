/**
 * Admin — Orders Command Center
 *
 * Features:
 *   - Status filter tabs with live counts (Pending badge is amber if count > 0)
 *   - Search by order number or buyer company name
 *   - Date range quick filter (Last 7 days / Last 30 days / This Month / All Time)
 *   - Orders table with status badges; pending rows highlighted amber
 *   - Click row or "View" button → order detail page
 *   - Pagination (20 per page)
 *
 * Data: GET /api/admin/orders
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Calendar,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { OrderWithBuyer, OrdersListResponse } from '@/app/api/admin/orders/route';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PER_PAGE = 20;

interface StatusTab {
  key:   string;
  label: string;
}

const STATUS_TABS: StatusTab[] = [
  { key: 'all',                 label: 'All' },
  { key: 'pending',             label: 'Pending' },
  { key: 'approved',            label: 'Approved' },
  { key: 'forwarded_to_vendor', label: 'Forwarded' },
  { key: 'dispatched',          label: 'Dispatched' },
  { key: 'delivered',           label: 'Delivered' },
  { key: 'cancelled',           label: 'Cancelled' },
];

type DateRange = '7d' | '30d' | 'month' | 'all';

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all',   label: 'All Time' },
  { value: '7d',    label: 'Last 7 days' },
  { value: '30d',   label: 'Last 30 days' },
  { value: 'month', label: 'This Month' },
];

// ---------------------------------------------------------------------------
// Status badge styling
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending:             { bg: 'bg-amber-100',   text: 'text-amber-800',  label: 'Pending' },
  approved:            { bg: 'bg-blue-100',    text: 'text-blue-800',   label: 'Approved' },
  forwarded_to_vendor: { bg: 'bg-purple-100',  text: 'text-purple-800', label: 'Forwarded' },
  dispatched:          { bg: 'bg-orange-100',  text: 'text-orange-800', label: 'Dispatched' },
  delivered:           { bg: 'bg-emerald-100', text: 'text-emerald-800',label: 'Delivered' },
  cancelled:           { bg: 'bg-rose-100',    text: 'text-rose-800',   label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

function getDateRange(range: DateRange): { date_from: string; date_to: string } | null {
  if (range === 'all') return null;

  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  if (range === '7d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { date_from: d.toISOString().split('T')[0], date_to: today };
  }
  if (range === '30d') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return { date_from: d.toISOString().split('T')[0], date_to: today };
  }
  if (range === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_from: d.toISOString().split('T')[0], date_to: today };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function AdminOrdersPage() {
  const [orders,       setOrders]       = useState<OrderWithBuyer[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // Filters
  const [activeTab,  setActiveTab]  = useState<string>('all');
  const [search,     setSearch]     = useState('');
  const [searchInput,setSearchInput]= useState('');
  const [dateRange,  setDateRange]  = useState<DateRange>('all');

  const totalPages = Math.ceil(total / PER_PAGE);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page:     String(page),
        per_page: String(PER_PAGE),
      });

      if (activeTab !== 'all') params.set('status', activeTab);
      if (search)              params.set('search', search);

      const dr = getDateRange(dateRange);
      if (dr) {
        params.set('date_from', dr.date_from);
        params.set('date_to',   dr.date_to);
      }

      const res  = await fetch(`/api/admin/orders?${params.toString()}`);
      const json = (await res.json()) as { data: OrdersListResponse | null; error: string | null };

      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Failed to load orders');
        return;
      }

      setOrders(json.data.orders);
      setTotal(json.data.total);
      setStatusCounts(json.data.status_counts);
    } catch {
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [page, activeTab, search, dateRange]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [activeTab, search, dateRange]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">Orders</h1>
            <p className="mt-1 text-sm text-slate-500">
              {total > 0 ? `${total} order${total !== 1 ? 's' : ''} total` : 'No orders yet'}
            </p>
          </div>
          <button
            onClick={() => void fetchOrders()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Status tabs */}
        <div className="mb-4 flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {STATUS_TABS.map((tab) => {
            const count   = statusCounts[tab.key] ?? 0;
            const isActive = activeTab === tab.key;
            const isPending = tab.key === 'pending' && count > 0;

            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={[
                  'flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                ].join(' ')}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={[
                      'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold',
                      isPending
                        ? 'bg-amber-500 text-white'
                        : isActive
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-slate-100 text-slate-600',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + Date filter row */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by order number or company name…"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSearchInput(''); }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
            )}
          </form>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              {DATE_RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-slate-500">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Loading orders…
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <p className="text-sm text-rose-600">{error}</p>
              <button
                onClick={() => void fetchOrders()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Try Again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <ShoppingCart className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                {search || activeTab !== 'all'
                  ? 'No orders match your filters.'
                  : 'No orders yet. Orders will appear here when buyers start ordering.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Order #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Buyer Company
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Items
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Total (₹)
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Placed Date
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((order) => {
                      const isPending = order.status === 'pending';
                      return (
                        <tr
                          key={order.id}
                          onClick={() => { window.location.href = `/admin/orders/${order.id}`; }}
                          className={[
                            'cursor-pointer transition-colors hover:bg-slate-50',
                            isPending ? 'bg-amber-50' : '',
                          ].join(' ')}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-slate-900">
                              {order.order_number}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {order.buyer?.company_name ?? '—'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {order.buyer?.full_name ?? ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            —
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                            {formatINR(order.total_amount)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDate(order.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                  <p className="text-xs text-slate-500">
                    Page {page} of {totalPages} &bull; {total} orders
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Toast placement note for screen readers */}
        {error && toast.error(error)}

      </div>
    </div>
  );
}
