'use client';

import {
  CheckCircle2, Clock, FileSearch, Video, BadgeCheck, XCircle, ExternalLink,
} from 'lucide-react';
import type { CreditApplicationRecord } from '@/app/api/buyer/credit-application/route';

/**
 * Shared credit-application status tracker.
 *
 * Renders the 4-stage lifecycle (Submitted → Document Verification →
 * Credit Discussion → Credit Term Approved) with the current stage highlighted.
 * Used post-submit on the apply page and on the Credit Overview page so every
 * user state stays in sync. Handles the rejected case separately.
 */

const STAGES = [
  { key: 'submitted',          label: 'Application Submitted', sub: 'We have received your application',        Icon: CheckCircle2 },
  { key: 'documents_verified', label: 'Document Verification', sub: 'KYC review — under 24 hours',              Icon: FileSearch },
  { key: 'meeting_scheduled',  label: 'Credit Discussion',     sub: 'Zoom or call — within the next 24 hours',  Icon: Video },
  { key: 'approved',           label: 'Credit Term Approved',  sub: 'Your credit line is activated',            Icon: BadgeCheck },
] as const;

/** How many stages are complete + which is active, from a status value. */
function progressFor(status: CreditApplicationRecord['status']): number {
  switch (status) {
    case 'submitted':           return 1; // stage 0 done, stage 1 active
    case 'under_review':        return 1;
    case 'documents_verified':  return 2;
    case 'meeting_scheduled':   return 3;
    case 'approved':            return 4;
    default:                    return 1;
  }
}

export default function CreditStatusTracker({ app }: { app: CreditApplicationRecord }) {
  if (app.status === 'rejected') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100">
            <XCircle className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-rose-700">Application not approved</h2>
            <p className="mt-1 text-sm text-rose-600/90">
              {app.admin_notes ?? 'Unfortunately we could not approve your credit line at this time. Please contact support for details.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const active = progressFor(app.status); // index of the in-progress stage

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-slate-900 via-slate-900 to-teal-950 p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative">
        <div className="mb-6 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-300 backdrop-blur-sm">
            <Clock className="h-3.5 w-3.5" />
            Application Status
          </span>
        </div>

        <ol className="space-y-3">
          {STAGES.map((stage, i) => {
            const done = i < active;
            const current = i === active;
            const Icon = stage.Icon;
            return (
              <li
                key={stage.key}
                className={`flex items-start gap-4 rounded-xl border p-4 backdrop-blur-sm transition-colors ${
                  current
                    ? 'border-teal-400/40 bg-teal-500/15'
                    : done
                      ? 'border-white/10 bg-white/4'
                      : 'border-white/5 bg-white/2'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                    done
                      ? 'border-teal-400/40 bg-teal-500/20 text-teal-300'
                      : current
                        ? 'border-teal-300/60 bg-teal-400/20 text-teal-200 ps-pulse-dot'
                        : 'border-white/10 bg-white/4 text-slate-500'
                  }`}
                >
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${done || current ? 'text-white' : 'text-slate-400'}`}>
                    {stage.label}
                  </p>
                  <p className={`text-xs ${current ? 'text-teal-200' : 'text-slate-400'}`}>{stage.sub}</p>

                  {/* Meeting link surfaced on the credit-discussion stage */}
                  {current && stage.key === 'meeting_scheduled' && app.meeting_link && (
                    <a
                      href={app.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-400"
                    >
                      Join meeting <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {current && (
                  <span className="shrink-0 rounded-full bg-teal-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-200">
                    In progress
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {app.admin_notes && app.status !== 'approved' && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/4 p-4 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Note from PrimeServe</p>
            <p className="mt-1 text-sm text-slate-200">{app.admin_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
