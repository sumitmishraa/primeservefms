/**
 * Admin — Buyers Management
 *
 * Lists all registered buyers with their assigned client/branch.
 * Admin can assign/unassign buyers to clients and branches via AssignClientModal.
 *
 * Data: GET /api/admin/buyers
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Users,
  Building2,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { formatDate } from '@/lib/utils/formatting';
import AssignClientModal from '@/components/admin/AssignClientModal';
import type { BuyerRow } from '@/app/api/admin/buyers/route';

// ---------------------------------------------------------------------------
// Last active indicator
// ---------------------------------------------------------------------------

/**
 * Returns colour-coded "Last Active" badge based on most recent order date.
 * Green = ordered this week, Yellow = this month, Red = 30+ days, Gray = never.
 */
function LastActiveBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) {
    return <span className="text-xs text-slate-400">Never ordered</span>;
  }
  const now  = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        This week
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        This month
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
      <span className="h-2 w-2 rounded-full bg-rose-500" />
      {Math.floor(days)}d ago
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-slate-100 text-slate-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Admin buyers list page.
 * Shows all buyers, their client/branch assignment, and allows reassignment.
 */
export default function AdminBuyersPage() {
  const [buyers,     setBuyers]     = useState<BuyerRow[]>([]);
  const [filtered,   setFiltered]   = useState<BuyerRow[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerRow | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchBuyers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/admin/buyers');
      const json = (await res.json()) as { data: BuyerRow[] | null; error: string | null };
      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Failed to load buyers');
        return;
      }
      setBuyers(json.data);
      setFiltered(json.data);
    } catch {
      setError('Could not connect. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBuyers(); }, [fetchBuyers]);

  // ---------------------------------------------------------------------------
  // Client-side search filter
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(buyers);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      buyers.filter(
        (b) =>
          b.full_name.toLowerCase().includes(q) ||
          (b.email ?? '').toLowerCase().includes(q) ||
          (b.company_name ?? '').toLowerCase().includes(q) ||
          (b.client_name ?? '').toLowerCase().includes(q)
      )
    );
  }, [search, buyers]);

  // ---------------------------------------------------------------------------
  // Modal handlers
  // ---------------------------------------------------------------------------

  const openAssign = (buyer: BuyerRow) => {
    setSelectedBuyer(buyer);
    setModalOpen(true);
  };

  const unassignedCount = buyers.filter((b) => !b.client_id).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-2xl font-bold text-slate-900">Buyers</h1>
              {!isLoading && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-medium text-slate-600">
                  {buyers.length}
                </span>
              )}
              {!isLoading && unassignedCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800">
                  {unassignedCount} unassigned
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Manage buyer accounts and assign them to clients and branches.
            </p>
          </div>
          <button
            onClick={() => void fetchBuyers()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buyers, companies, clients…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
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
                Loading buyers…
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <AlertCircle className="h-10 w-10 text-rose-400" />
              <p className="text-sm text-rose-600">{error}</p>
              <button
                onClick={() => void fetchBuyers()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Try Again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                {search ? 'No buyers match your search.' : 'No buyers registered yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Branch</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Last Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((buyer) => (
                    <tr key={buyer.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{buyer.full_name}</p>
                        {buyer.company_name && (
                          <p className="text-xs text-slate-500">{buyer.company_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-700">{buyer.email ?? '—'}</p>
                        {buyer.phone && (
                          <p className="text-xs text-slate-500">{buyer.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {buyer.client_name ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-teal-600" />
                            <span className="text-slate-800">{buyer.client_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-amber-600">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {buyer.branch_name ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <LastActiveBadge dateStr={buyer.last_order_date} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(buyer.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <ActiveBadge active={buyer.is_active} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openAssign(buyer)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Assign modal */}
      {selectedBuyer && (
        <AssignClientModal
          userId={selectedBuyer.id}
          buyerName={selectedBuyer.full_name}
          currentClientId={selectedBuyer.client_id}
          currentBranchId={selectedBuyer.branch_id}
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedBuyer(null); }}
          onSuccess={() => void fetchBuyers()}
        />
      )}
    </div>
  );
}
