/**
 * Admin — Client Detail Page
 *
 * Shows full client info, branch-wise breakdown table with per-branch stats,
 * and recent orders for this client.
 *
 * Data: GET /api/admin/clients/[id]
 */

'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Plus,
  TrendingUp,
  ShoppingCart,
  Clock,
  GitBranch,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import AddBranchModal from '@/components/admin/AddBranchModal';
import type { ClientDetail, ClientDetailBranch, ClientDetailOrder } from '@/app/api/admin/clients/[id]/route';

// ---------------------------------------------------------------------------
// Status badge
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
// Quick stat card
// ---------------------------------------------------------------------------

interface StatMiniProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}

function StatMini({ label, value, icon, highlight }: StatMiniProps) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className={`text-xs font-medium ${highlight ? 'text-amber-700' : 'text-slate-500'}`}>{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${highlight ? 'bg-amber-100' : 'bg-slate-100'}`}>
          {icon}
        </div>
      </div>
      <p className={`text-xl font-bold font-mono ${highlight ? 'text-amber-900' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-pulse">
      <div className="h-4 w-48 bg-slate-200 rounded" />
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="h-8 w-64 bg-slate-200 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="h-48 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Client detail page. Shows client info, branch stats table, and recent orders.
 */
export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [data,         setData]         = useState<ClientDetail | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [branchModal,  setBranchModal]  = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchClient = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/clients/${id}`);
      const json = (await res.json()) as { data: ClientDetail | null; error: string | null };
      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Failed to load client');
        return;
      }
      setData(json.data);
    } catch {
      setError('Could not connect. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchClient(); }, [fetchClient]);

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-rose-400 mx-auto mb-4" />
        <p className="text-slate-800 font-semibold">{error ?? 'Client not found'}</p>
        <button
          onClick={() => void fetchClient()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const { stats, branches, recent_orders } = data;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/admin/clients" className="hover:text-teal-600 flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Clients
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-slate-700 font-medium">{data.name}</span>
        </nav>

        {/* Client header card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-heading text-2xl font-bold text-slate-900">{data.name}</h1>
                {data.industry && (
                  <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                    {data.industry}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${data.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                  {data.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {data.display_name !== data.name && (
                <p className="mt-1 text-sm text-slate-500">{data.display_name}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/admin/orders?client_id=${data.id}`}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                View Orders
              </Link>
            </div>
          </div>

          {/* Contact info row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 mb-6">
            {data.contact_person && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-400" />
                {data.contact_person}
              </span>
            )}
            {data.contact_phone && (
              <a href={`tel:${data.contact_phone}`} className="flex items-center gap-1.5 hover:text-teal-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {data.contact_phone}
              </a>
            )}
            {data.contact_email && (
              <a href={`mailto:${data.contact_email}`} className="flex items-center gap-1.5 hover:text-teal-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {data.contact_email}
              </a>
            )}
            {data.city && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                {data.city}
              </span>
            )}
            {data.gst_number && (
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-400" />
                GST: {data.gst_number}
              </span>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatMini
              label="Total Orders"
              value={stats.total_orders}
              icon={<ShoppingCart className="h-4 w-4 text-teal-600" />}
            />
            <StatMini
              label="Total Revenue"
              value={stats.total_revenue > 0 ? formatINR(stats.total_revenue) : '₹0'}
              icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            />
            <StatMini
              label="Pending Amount"
              value={stats.pending_amount > 0 ? formatINR(stats.pending_amount) : '₹0'}
              icon={<Clock className="h-4 w-4 text-amber-600" />}
              highlight={stats.pending_amount > 0}
            />
            <StatMini
              label="Active Branches"
              value={stats.active_branches}
              icon={<GitBranch className="h-4 w-4 text-violet-600" />}
            />
          </div>
        </div>

        {/* Branch-wise breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <h2 className="font-semibold text-slate-900">Branches</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {branches.length}
              </span>
            </div>
            <button
              onClick={() => setBranchModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-medium text-white hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Branch
            </button>
          </div>

          {branches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <GitBranch className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No branches yet</p>
              <p className="text-xs text-slate-400 mt-1">Add the first branch for this client.</p>
              <button
                onClick={() => setBranchModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" />
                Add Branch
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Area</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Orders</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Pending</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branches.map((branch: ClientDetailBranch) => (
                    <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{branch.name}</p>
                        {branch.branch_code && (
                          <p className="text-xs text-slate-400 font-mono">{branch.branch_code}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{branch.area ?? '—'}</td>
                      <td className="px-4 py-3">
                        {branch.contact_person ? (
                          <div>
                            <p className="text-slate-700">{branch.contact_person}</p>
                            {branch.contact_phone && (
                              <p className="text-xs text-slate-400">{branch.contact_phone}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{branch.total_orders}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800">
                        {branch.total_revenue > 0 ? formatINR(branch.total_revenue) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {branch.pending_amount > 0 ? (
                          <span className="font-mono font-medium text-amber-700">{formatINR(branch.pending_amount)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {branch.last_order_date ? formatDate(branch.last_order_date) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Orders</h2>
            <Link
              href={`/admin/orders?client_id=${data.id}`}
              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              View All <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recent_orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No orders yet for this client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Buyer</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Items</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent_orders.map((order: ClientDetailOrder) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-900">{order.order_number}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{order.branch_name ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{order.buyer_name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{order.items_count}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatINR(order.total_amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Notes */}
        {data.notes && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.notes}</p>
          </div>
        )}

      </div>

      {/* Add Branch Modal */}
      <AddBranchModal
        clientId={id}
        isOpen={branchModal}
        onClose={() => setBranchModal(false)}
        onSuccess={() => {
          setBranchModal(false);
          toast.success('Branch added successfully');
          void fetchClient();
        }}
      />
    </div>
  );
}
