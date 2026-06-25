'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, BadgeCheck, FileText, ExternalLink, X, CheckCircle2,
  FileSearch, Video, XCircle, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils/formatting';
import type { AdminCreditApplicationItem } from '@/app/api/admin/credit-applications/route';
import type { AdminCreditApplicationDetail } from '@/app/api/admin/credit-applications/[id]/route';

// ─── Status display ─────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:              { label: 'Draft',              cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  submitted:          { label: 'Submitted',          cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  under_review:       { label: 'Under Review',        cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  documents_verified: { label: 'Docs Verified',       cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  meeting_scheduled:  { label: 'Meeting Scheduled',   cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  approved:           { label: 'Approved',            cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected:           { label: 'Rejected',            cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const FILTERS = [
  { key: '',                   label: 'All' },
  { key: 'submitted',          label: 'Submitted' },
  { key: 'documents_verified', label: 'Docs Verified' },
  { key: 'meeting_scheduled',  label: 'Meeting' },
  { key: 'approved',           label: 'Approved' },
  { key: 'rejected',           label: 'Rejected' },
];

const DOC_LABELS: Record<string, string> = {
  gst_certificate_url: 'GST Certificate',
  pan_card_url: 'PAN — Front',
  pan_card_back_url: 'PAN — Back',
  cin_document_url: 'CIN / LLP Deed',
  bank_statement_url: 'Bank Statement',
  itr_url: 'ITR',
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.cls}`}>{m.label}</span>;
}

// ─── Detail modal ───────────────────────────────────────────────────────────

function DetailModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<AdminCreditApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [limit, setLimit] = useState('');

  useEffect(() => {
    fetch(`/api/admin/credit-applications/${id}`)
      .then((r) => r.json())
      .then((j: { data: AdminCreditApplicationDetail | null; error: string | null }) => {
        if (j.error || !j.data) throw new Error(j.error ?? 'Not found');
        setDetail(j.data);
        setNotes(j.data.admin_notes ?? '');
        setMeetingLink(j.data.meeting_link ?? '');
        setLimit(j.data.requested_credit_limit ? String(j.data.requested_credit_limit) : '');
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/credit-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, admin_notes: notes.trim() || null, ...extra }),
      });
      const j = (await res.json()) as { error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Action failed');
      toast.success('Application updated');
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Credit Application</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {loading || !detail ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>
        ) : (
          <div className="space-y-5 px-6 py-5">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">{detail.buyer_name}</p>
                <p className="text-xs text-slate-500">{detail.buyer_email}</p>
              </div>
              <StatusBadge status={detail.status} />
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-200 p-4 text-sm">
              <div><dt className="text-xs text-slate-400">Entity</dt><dd className="font-medium text-slate-800">{detail.entity_type === 'llp' ? 'LLP' : 'Company'}</dd></div>
              <div><dt className="text-xs text-slate-400">{detail.entity_type === 'llp' ? 'LLPIN' : 'CIN'}</dt><dd className="font-medium text-slate-800">{detail.cin_number ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">GST</dt><dd className="font-medium text-slate-800">{detail.gst_number ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">PAN</dt><dd className="font-medium text-slate-800">{detail.pan_number ?? '—'}</dd></div>
              <div><dt className="text-xs text-slate-400">Submitted</dt><dd className="font-medium text-slate-800">{detail.submitted_at ? formatDate(detail.submitted_at) : '—'}</dd></div>
            </dl>

            {/* Documents */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Documents</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(DOC_LABELS).map((key) =>
                  detail.signed_documents[key] ? (
                    <a key={key} href={detail.signed_documents[key]} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-50">
                      <FileText className="h-3.5 w-3.5" /> {DOC_LABELS[key]} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null,
                )}
              </div>
            </div>

            {/* Admin notes */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Admin notes (shared with buyer on decision)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                placeholder="Optional note…" />
            </div>

            {/* Actions */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} onClick={() => act('verify_documents')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  <FileSearch className="h-3.5 w-3.5" /> Mark Documents Verified
                </button>
                <button disabled={busy} onClick={() => act('reject')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>

              {/* Schedule meeting */}
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Meeting link (Zoom/call)</label>
                  <input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://zoom.us/j/…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">When</label>
                  <input type="datetime-local" value={meetingAt} onChange={(e) => setMeetingAt(e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <button disabled={busy} onClick={() => act('schedule_meeting', { meeting_link: meetingLink.trim(), meeting_scheduled_at: meetingAt ? new Date(meetingAt).toISOString() : null })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
                  <Video className="h-3.5 w-3.5" /> Schedule
                </button>
              </div>

              {/* Approve */}
              <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-slate-500">Approved credit limit (₹)</label>
                  <input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="e.g. 100000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30" />
                </div>
                <button disabled={busy} onClick={() => act('approve', { credit_limit: limit ? Number(limit) : null })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Activate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AdminCreditApplicationsPage() {
  const [items, setItems] = useState<AdminCreditApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const qs = filter ? `?status=${filter}` : '';
    fetch(`/api/admin/credit-applications${qs}`)
      .then((r) => r.json())
      .then((j: { data: AdminCreditApplicationItem[] | null; error: string | null }) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setItems(j.data ?? []);
      })
      .catch((e: Error) => { if (!cancelled) toast.error(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filter, reloadKey]);

  const refresh = () => { setLoading(true); setReloadKey((k) => k + 1); };
  const changeFilter = (key: string) => { setLoading(true); setFilter(key); };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-200 bg-teal-50">
          <BadgeCheck className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Credit Applications</h1>
          <p className="text-sm text-slate-500">Review KYC, schedule discussions, and approve credit lines.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => changeFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key ? 'bg-teal-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-teal-500" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="mx-auto mb-3 h-9 w-9 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No applications here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <th className="px-5 py-3">Buyer</th>
                  <th className="px-5 py-3 hidden md:table-cell">Company</th>
                  <th className="px-5 py-3 hidden sm:table-cell">Submitted</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{it.buyer_name}</p>
                      <p className="text-xs text-slate-400">{it.buyer_email}</p>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-slate-600">{it.client_name ?? '—'}</td>
                    <td className="px-5 py-3 hidden sm:table-cell text-xs text-slate-500">{it.submitted_at ? formatDate(it.submitted_at) : '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={it.status} /></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setOpenId(it.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50">
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openId && <DetailModal id={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  );
}
