/**
 * AssignClientModal — modal for assigning a buyer to a client + branch.
 *
 * Fetches clients from GET /api/admin/clients.
 * When a client is selected, fetches its branches from GET /api/admin/clients/[id]/branches.
 * On confirm, PATCHes /api/admin/buyers/[userId].
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Building2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ClientListItem } from '@/app/api/admin/clients/route';

// ---------------------------------------------------------------------------
// Branch shape (slim — from branches API)
// ---------------------------------------------------------------------------

interface BranchOption {
  id: string;
  name: string;
  area: string | null;
  branch_code: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AssignClientModalProps {
  /** The buyer's user id */
  userId: string;
  /** The buyer's display name — shown in the modal heading */
  buyerName: string;
  /** Currently assigned client id (or null) */
  currentClientId: string | null;
  /** Currently assigned branch id (or null) */
  currentBranchId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a successful assignment so the parent can refresh */
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal that lets an admin assign (or re-assign / unassign) a buyer to a client + branch.
 *
 * @param userId - The buyer's Supabase user id
 * @param buyerName - Shown in the modal title
 * @param currentClientId - Pre-selects this client on open
 * @param currentBranchId - Pre-selects this branch on open
 * @param isOpen - Controls visibility
 * @param onClose - Called when the modal should be dismissed
 * @param onSuccess - Called after a successful save
 */
export default function AssignClientModal({
  userId,
  buyerName,
  currentClientId,
  currentBranchId,
  isOpen,
  onClose,
  onSuccess,
}: AssignClientModalProps) {
  const [clients,       setClients]       = useState<ClientListItem[]>([]);
  const [branches,      setBranches]      = useState<BranchOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>(currentClientId ?? '');
  const [selectedBranch, setSelectedBranch] = useState<string>(currentBranchId ?? '');
  const [loadingClients,  setLoadingClients]  = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [saving,          setSaving]          = useState(false);

  // ---------------------------------------------------------------------------
  // Load clients on open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return;
    setSelectedClient(currentClientId ?? '');
    setSelectedBranch(currentBranchId ?? '');

    setLoadingClients(true);
    fetch('/api/admin/clients')
      .then((r) => r.json())
      .then((json: { data: ClientListItem[] | null; error: string | null }) => {
        if (json.data) setClients(json.data);
      })
      .catch(() => toast.error('Failed to load clients'))
      .finally(() => setLoadingClients(false));
  }, [isOpen, currentClientId, currentBranchId]);

  // ---------------------------------------------------------------------------
  // Load branches when client changes
  // ---------------------------------------------------------------------------

  const loadBranches = useCallback((clientId: string) => {
    if (!clientId) { setBranches([]); return; }
    setLoadingBranches(true);
    fetch(`/api/admin/clients/${clientId}/branches`)
      .then((r) => r.json())
      .then((json: { data: BranchOption[] | null; error: string | null }) => {
        if (json.data) setBranches(json.data);
      })
      .catch(() => toast.error('Failed to load branches'))
      .finally(() => setLoadingBranches(false));
  }, []);

  useEffect(() => {
    loadBranches(selectedClient);
    setSelectedBranch('');
  }, [selectedClient, loadBranches]);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/buyers/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient || null,
          branch_id: selectedBranch || null,
        }),
      });
      const json = (await res.json()) as { data: unknown; error: string | null };
      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Failed to assign client');
        return;
      }
      toast.success('Client assigned successfully');
      onSuccess();
      onClose();
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id="assign-modal-title" className="font-semibold text-slate-900">
              Assign to Client
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{buyerName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Client select */}
          <div>
            <label htmlFor="client-select" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Building2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
              Client
            </label>
            {loadingClients ? (
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <select
                id="client-select"
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">— Unassigned —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Branch select */}
          <div>
            <label htmlFor="branch-select" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <GitBranch className="h-4 w-4 text-teal-600" aria-hidden="true" />
              Branch
            </label>
            {loadingBranches ? (
              <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <select
                id="branch-select"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={!selectedClient || branches.length === 0}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {!selectedClient
                    ? '— Select a client first —'
                    : branches.length === 0
                      ? '— No branches —'
                      : '— All branches —'}
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.area ? ` (${b.area})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving…
              </>
            ) : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
