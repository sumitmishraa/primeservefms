'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Check, Loader2 } from 'lucide-react';
import type { BuyerClientItem } from '@/app/api/buyer/clients/route';

interface CompanySwitcherProps {
  /** Called when the user picks a different company. Pass null to mean "all companies". */
  onClientChange?: (clientId: string | null) => void;
  /** Currently selected client ID (controlled externally, e.g. from URL param). */
  selectedClientId?: string | null;
  /** Compact mode — used inside the sidebar (no label text). */
  compact?: boolean;
}

export default function CompanySwitcher({
  onClientChange,
  selectedClientId,
  compact = false,
}: CompanySwitcherProps) {
  const [clients, setClients] = useState<BuyerClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/buyer/clients')
      .then((r) => r.json())
      .then((j: { data: BuyerClientItem[] | null }) => {
        setClients(j.data ?? []);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Don't render if the buyer only has one company (or none yet)
  if (!loading && clients.length <= 1) return null;

  const selected = clients.find((c) => c.id === selectedClientId);
  const displayName = selected?.display_name ?? selected?.name ?? 'All Companies';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 w-full text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-white hover:border-teal-300 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
        ) : (
          <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-hidden="true" />
        )}
        <span className="flex-1 font-medium text-slate-700 truncate">{displayName}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {/* All Companies option */}
          <button
            role="option"
            aria-selected={!selectedClientId}
            type="button"
            className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors ${!selectedClientId ? 'text-teal-700 font-medium' : 'text-slate-700'}`}
            onClick={() => { onClientChange?.(null); setOpen(false); }}
          >
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="flex-1">All Companies</span>
            {!selectedClientId && <Check className="w-3.5 h-3.5 text-teal-600" aria-hidden="true" />}
          </button>

          <div className="border-t border-slate-100" />

          {clients.map((client) => (
            <button
              key={client.id}
              role="option"
              aria-selected={selectedClientId === client.id}
              type="button"
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors ${selectedClientId === client.id ? 'text-teal-700 font-medium' : 'text-slate-700'}`}
              onClick={() => { onClientChange?.(client.id); setOpen(false); }}
            >
              <div className="w-5 h-5 rounded-md bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center shrink-0">
                {client.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate">{client.display_name ?? client.name}</p>
                <p className="text-xs text-slate-400">{client.branches_count} branch{client.branches_count !== 1 ? 'es' : ''}</p>
              </div>
              {selectedClientId === client.id && (
                <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
