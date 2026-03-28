/**
 * Admin — Clients List
 *
 * Fetches all clients from GET /api/admin/clients and renders them as cards.
 * Supports client-side search by name, contact person, or industry.
 * Shows loading skeletons, error state with retry, and an empty state.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  User,
  Package,
  TrendingUp,
  GitBranch,
  RefreshCw,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { ClientListItem } from '@/app/api/admin/clients/route';

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ClientCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-pulse">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="h-5 w-40 rounded bg-slate-200" />
        <div className="h-5 w-16 rounded-full bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-slate-200" />
        <div className="h-4 w-28 rounded bg-slate-200" />
      </div>
      <div className="mt-4 flex gap-4">
        <div className="h-4 w-20 rounded bg-slate-200" />
        <div className="h-4 w-20 rounded bg-slate-200" />
        <div className="h-4 w-24 rounded bg-slate-200" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
        <div className="h-8 w-24 rounded-lg bg-slate-200" />
        <div className="h-8 w-16 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client card
// ---------------------------------------------------------------------------

function ClientCard({ client }: { client: ClientListItem }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      {/* Header row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold text-slate-900 truncate">
            {client.display_name}
          </h2>
          {client.name !== client.display_name && (
            <p className="mt-0.5 text-xs text-slate-400 truncate">{client.name}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {client.industry && (
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
              {client.industry}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              client.is_active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {client.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-1.5 text-sm text-slate-500">
        {client.contact_person && (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.contact_person}</span>
          </div>
        )}
        {client.contact_phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{client.contact_phone}</span>
          </div>
        )}
        {client.contact_email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{client.contact_email}</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-slate-400" />
          <span>{client.total_branches} branch{client.total_branches !== 1 ? 'es' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Package className="h-3.5 w-3.5 text-slate-400" />
          <span>{client.total_orders} order{client.total_orders !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
          <span>Revenue: {formatINR(client.total_revenue)}</span>
        </div>
        {client.pending_amount > 0 && (
          <span className="font-medium text-amber-600">
            Pending: {formatINR(client.pending_amount)}
          </span>
        )}
      </div>

      {/* Last order */}
      {client.last_order_date && (
        <p className="mt-2 text-xs text-slate-400">
          Last order: {formatDate(client.last_order_date)}
        </p>
      )}

      {/* Footer actions */}
      <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
        <Link
          href={`/admin/clients/${client.id}`}
          className="flex-1 rounded-lg bg-teal-600 px-3 py-1.5 text-center text-xs font-medium text-white transition-colors hover:bg-teal-700"
        >
          View Details
        </Link>
        <Link
          href={`/admin/clients/${client.id}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

/**
 * Admin Clients list page.
 * Fetches clients from /api/admin/clients and renders cards with stats.
 * Search is performed client-side on the already-fetched list.
 */
export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/clients');
      const json = (await res.json()) as { data: ClientListItem[] | null; error: string | null };
      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Failed to load clients');
        return;
      }
      setClients(json.data);
    } catch {
      setError('Network error — could not load clients');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  // Client-side search filter
  const filtered = search.trim()
    ? clients.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.display_name.toLowerCase().includes(q) ||
          (c.contact_person?.toLowerCase().includes(q) ?? false) ||
          (c.industry?.toLowerCase().includes(q) ?? false) ||
          (c.contact_email?.toLowerCase().includes(q) ?? false) ||
          c.city.toLowerCase().includes(q)
        );
      })
    : clients;

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold text-slate-900">Clients</h1>
            {!isLoading && (
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700">
                {clients.length} total
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchClients()}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              href="/admin/clients/new"
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Client
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, contact, industry or city..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ClientCardSkeleton />
            <ClientCardSkeleton />
            <ClientCardSkeleton />
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Building2 className="h-10 w-10 text-rose-300" />
            <p className="text-sm font-medium text-rose-600">{error}</p>
            <button
              onClick={() => void fetchClients()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <Building2 className="h-12 w-12 text-slate-300" />
            {search ? (
              <>
                <p className="text-sm font-medium text-slate-600">
                  No clients match &ldquo;{search}&rdquo;
                </p>
                <button
                  onClick={() => setSearch('')}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Clear Search
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">No clients yet.</p>
                <p className="text-xs text-slate-400">
                  Add your first client to start tracking orders by company.
                </p>
                <Link
                  href="/admin/clients/new"
                  className="mt-2 flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Client
                </Link>
              </>
            )}
          </div>
        )}

        {/* Client grid */}
        {!isLoading && !error && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
