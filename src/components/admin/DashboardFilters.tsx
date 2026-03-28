/**
 * DashboardFilters — filter bar for the admin dashboard.
 *
 * Renders:
 *   - Client dropdown (fetched from /api/admin/clients)
 *   - Branch dropdown (fetched when a client is selected)
 *   - Date range selector with "Custom Range" date pickers
 *   - Order status selector
 *   - Clear Filters button
 *
 * Collapses to a single "Filters" button on mobile.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';
import type { ClientListItem } from '@/app/api/admin/clients/route';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DateRangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'all_time'
  | 'custom';

export interface DashboardFilterState {
  client_id: string;
  branch_id: string;
  date_range: DateRangePreset;
  date_from: string;
  date_to: string;
  status: string;
}

export const DEFAULT_FILTERS: DashboardFilterState = {
  client_id: '',
  branch_id: '',
  date_range: 'all_time',
  date_from: '',
  date_to: '',
  status: '',
};

interface DashboardFiltersProps {
  filters: DashboardFilterState;
  onChange: (filters: DashboardFilterState) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BranchOption { id: string; name: string; area: string | null }

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today',        label: 'Today' },
  { value: 'this_week',    label: 'This Week' },
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'last_3_months',label: 'Last 3 Months' },
  { value: 'all_time',     label: 'All Time' },
  { value: 'custom',       label: 'Custom Range' },
];

const STATUS_OPTIONS = [
  { value: '',                  label: 'All Statuses' },
  { value: 'pending',           label: 'Pending' },
  { value: 'approved',          label: 'Approved' },
  { value: 'forwarded_to_vendor', label: 'Forwarded' },
  { value: 'dispatched',        label: 'Dispatched' },
  { value: 'delivered',         label: 'Delivered' },
  { value: 'cancelled',         label: 'Cancelled' },
];

/**
 * Converts a preset date range into ISO date_from / date_to strings.
 * Returns empty strings for 'all_time' and 'custom' (custom is managed externally).
 */
export function resolveDateRange(preset: DateRangePreset, customFrom: string, customTo: string): { date_from: string; date_to: string } {
  if (preset === 'all_time') return { date_from: '', date_to: '' };
  if (preset === 'custom')   return { date_from: customFrom, date_to: customTo };

  const now   = new Date();
  const today = now.toISOString().split('T')[0];

  if (preset === 'today') {
    return { date_from: today, date_to: today };
  }
  if (preset === 'this_week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    return { date_from: d.toISOString().split('T')[0], date_to: today };
  }
  if (preset === 'this_month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { date_from: d.toISOString().split('T')[0], date_to: today };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 0);
    return { date_from: start.toISOString().split('T')[0], date_to: end.toISOString().split('T')[0] };
  }
  if (preset === 'last_3_months') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return { date_from: d.toISOString().split('T')[0], date_to: today };
  }
  return { date_from: '', date_to: '' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter bar for the admin dashboard. Exposes filter state to the parent via onChange.
 * Fetches client list on mount; fetches branch list when client changes.
 */
export default function DashboardFilters({ filters, onChange }: DashboardFiltersProps) {
  const [clients,       setClients]       = useState<ClientListItem[]>([]);
  const [branches,      setBranches]      = useState<BranchOption[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [expanded,      setExpanded]      = useState(false); // mobile toggle

  const isFiltered =
    !!filters.client_id ||
    !!filters.branch_id ||
    filters.date_range !== 'all_time' ||
    !!filters.status;

  // Load clients on mount
  useEffect(() => {
    setLoadingClients(true);
    fetch('/api/admin/clients')
      .then((r) => r.json())
      .then((json: { data: ClientListItem[] | null }) => {
        if (json.data) setClients(json.data);
      })
      .catch(() => { /* silent — filters still work without client list */ })
      .finally(() => setLoadingClients(false));
  }, []);

  // Load branches when client changes
  const loadBranches = useCallback((clientId: string) => {
    if (!clientId) { setBranches([]); return; }
    fetch(`/api/admin/clients/${clientId}/branches`)
      .then((r) => r.json())
      .then((json: { data: BranchOption[] | null }) => {
        if (json.data) setBranches(json.data);
      })
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    loadBranches(filters.client_id);
    if (!filters.client_id) {
      onChange({ ...filters, branch_id: '' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.client_id]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const set = (partial: Partial<DashboardFilterState>) => onChange({ ...filters, ...partial });

  const clearAll = () => onChange(DEFAULT_FILTERS);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const filterContent = (
    <div className="flex flex-wrap items-end gap-3">

      {/* Client */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
        <select
          value={filters.client_id}
          onChange={(e) => set({ client_id: e.target.value, branch_id: '' })}
          disabled={loadingClients}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:opacity-60"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Branch */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
        <select
          value={filters.branch_id}
          onChange={(e) => set({ branch_id: e.target.value })}
          disabled={!filters.client_id}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}{b.area ? ` (${b.area})` : ''}</option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">Date Range</label>
        <select
          value={filters.date_range}
          onChange={(e) => set({ date_range: e.target.value as DateRangePreset })}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          {DATE_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Custom date pickers */}
      {filters.date_range === 'custom' && (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => set({ date_from: e.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => set({ date_to: e.target.value })}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </>
      )}

      {/* Status */}
      <div className="min-w-[160px]">
        <label className="block text-xs font-medium text-slate-500 mb-1">Order Status</label>
        <select
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Clear */}
      {isFiltered && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Mobile toggle header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 sm:hidden"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter className="h-4 w-4 text-slate-400" />
          Filters
          {isFiltered && (
            <span className="rounded-full bg-teal-600 px-1.5 py-0.5 text-xs font-bold text-white">
              Active
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Filter content — always visible on desktop, toggle on mobile */}
      <div className={`px-5 py-4 ${expanded ? 'block' : 'hidden sm:block'}`}>
        {filterContent}
      </div>
    </div>
  );
}
