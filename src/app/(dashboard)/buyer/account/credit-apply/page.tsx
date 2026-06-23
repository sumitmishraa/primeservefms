'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BadgeCheck, Loader2, Check, CheckCircle2, Clock, AlertCircle,
  XCircle, Upload, FileText, ChevronRight, Shield, Zap, TrendingUp, Lock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CreditApplicationRecord } from '@/app/api/buyer/credit-application/route';

// ─── Constants ────────────────────────────────────────────────────────────────

const CREDIT_LIMITS = [
  { value: 25000,  label: '₹25K' },
  { value: 50000,  label: '₹50K' },
  { value: 100000, label: '₹1L' },
  { value: 200000, label: '₹2L' },
  { value: 500000, label: '₹5L' },
];

const TURNOVER_OPTIONS = [
  'Under ₹25 Lakhs',
  '₹25 Lakhs – ₹1 Crore',
  '₹1 Crore – ₹5 Crore',
  '₹5 Crore – ₹25 Crore',
  'Above ₹25 Crore',
];

// ─── Status display ───────────────────────────────────────────────────────────

function ApplicationStatus({ app }: { app: CreditApplicationRecord }) {
  const statusConfig: Record<string, { icon: React.ElementType; color: string; border: string; bg: string; title: string; body: string }> = {
    submitted: {
      icon: Clock, color: 'text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-500/10',
      title: 'Application Under Review',
      body: "Your application is under review. We'll notify you within 3–5 business days.",
    },
    under_review: {
      icon: Clock, color: 'text-blue-300', border: 'border-blue-500/30', bg: 'bg-blue-500/10',
      title: 'Being Reviewed',
      body: 'Our team is actively reviewing your documents and business details.',
    },
    approved: {
      icon: CheckCircle2, color: 'text-emerald-300', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10',
      title: 'Approved! Your credit line is active.',
      body: 'Congratulations! You can now place orders on 45-day credit terms.',
    },
    rejected: {
      icon: XCircle, color: 'text-rose-300', border: 'border-rose-500/30', bg: 'bg-rose-500/10',
      title: 'Application Not Approved',
      body: app.admin_notes ?? 'Your application was not approved at this time. Please contact support for details.',
    },
  };

  const cfg = statusConfig[app.status] ?? statusConfig.submitted;
  const Icon = cfg.icon;
  const submittedDate = new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="max-w-2xl mx-auto">
      <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} backdrop-blur-md p-8`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
            <Icon className={`w-6 h-6 ${cfg.color}`} />
          </div>
          <div className="flex-1">
            <h2 className={`text-lg font-bold ${cfg.color}`}>{cfg.title}</h2>
            <p className="text-slate-400 text-sm mt-1">{cfg.body}</p>
            <p className="text-xs text-slate-600 mt-3">Submitted on {submittedDate}</p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Link href="/buyer/account/dashboard" className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-500 transition-colors">
          Back to Dashboard
        </Link>
        <Link href="/buyer/account/credit" className="flex items-center gap-2 px-5 py-2.5 border border-white/10 text-slate-400 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors">
          View Credit Overview
        </Link>
      </div>
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen() {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="w-16 h-16 bg-emerald-500/15 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Application Submitted!</h2>
      <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-sm mx-auto">
        Thank you for applying for a PrimeServe credit line. We&apos;ve received your documents and will review your application within <strong className="text-white">3–5 business days</strong>.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/buyer/account/dashboard" className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-500 transition-colors">
          Back to Dashboard
        </Link>
        <Link href="/buyer/account/credit" className="flex items-center gap-2 px-5 py-2.5 border border-white/10 text-slate-400 text-sm font-medium rounded-xl hover:bg-white/5 transition-colors">
          View Credit Overview
        </Link>
      </div>
    </div>
  );
}

// ─── Document upload row ──────────────────────────────────────────────────────

interface DocUploadRowProps {
  label: string;
  required?: boolean;
  uploaded: boolean;
  uploading: boolean;
  onFile: (f: File) => void;
  preUploaded?: boolean;
}

function DocUploadRow({ label, required, uploaded, uploading, onFile, preUploaded }: DocUploadRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 ${
      uploaded || preUploaded
        ? 'border-teal-500/30 bg-teal-500/10'
        : 'border-white/8 bg-white/4 hover:bg-white/6'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          uploaded || preUploaded ? 'bg-teal-500/20' : 'bg-white/8'
        }`}>
          {uploaded || preUploaded
            ? <Check className="w-4 h-4 text-teal-400" />
            : <FileText className="w-4 h-4 text-slate-500" />
          }
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {required && !uploaded && !preUploaded && <p className="text-xs text-rose-400 mt-0.5">Required</p>}
          {preUploaded && <p className="text-xs text-teal-400 mt-0.5">Already on file</p>}
          {uploaded && !preUploaded && <p className="text-xs text-teal-400 mt-0.5">Ready to submit</p>}
        </div>
      </div>
      {!preUploaded && (
        <>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-teal-500/40 text-teal-400 hover:bg-teal-500/15 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {uploaded ? 'Replace' : 'Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreditApplyPage() {
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [existing, setExisting] = useState<CreditApplicationRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [requestedLimit, setRequestedLimit] = useState<number>(100000);
  const [businessYears, setBusinessYears] = useState('');
  const [annualTurnover, setAnnualTurnover] = useState('');
  const [notes, setNotes] = useState('');

  const [gstUrl, setGstUrl] = useState('');
  const [panUrl, setPanUrl] = useState('');
  const [cinUrl, setCinUrl] = useState('');
  const [chequeUrl, setChequeUrl] = useState('');
  const [itrUrl, setItrUrl] = useState('');
  const [bankUrl, setBankUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/buyer/credit-application')
      .then((r) => r.json())
      .then((j: { data: CreditApplicationRecord | null }) => { if (j.data) setExisting(j.data); })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, []);

  async function uploadDoc(docKey: string, file: File, setter: (url: string) => void) {
    setUploadingDoc(docKey);
    try {
      const form = new FormData();
      form.append('doc_type', docKey);
      form.append('file', file);
      const res = await fetch('/api/buyer/documents', { method: 'POST', body: form });
      const j = await res.json() as { data: { url: string } | null; error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Upload failed');
      setter(j.data?.url ?? '');
      toast.success('Document uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gstUrl && !chequeUrl) {
      toast.error('Please upload at least your GST certificate and cancelled cheque');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/buyer/credit-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_credit_limit: requestedLimit,
          business_years: businessYears ? parseInt(businessYears, 10) : null,
          annual_turnover: annualTurnover || null,
          notes: notes.trim() || null,
          gst_certificate_url: gstUrl || null,
          pan_card_url: panUrl || null,
          cin_document_url: cinUrl || null,
          cancelled_cheque_url: chequeUrl || null,
          itr_url: itrUrl || null,
          bank_statement_url: bankUrl || null,
        }),
      });
      const j = await res.json() as { error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Submission failed');
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
            <BadgeCheck className="w-5 h-5 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Apply for Credit</h1>
        </div>
        <p className="text-sm text-slate-500 ml-12">Get a 45-day credit line to place orders now and pay later</p>
      </div>

      {submitted && <SuccessScreen />}
      {!submitted && existing && <ApplicationStatus app={existing} />}

      {!submitted && !existing && (
        <form onSubmit={handleSubmit}>
          {/* 3-column grid */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

            {/* ── Column 1: What you need ──────────────────────────────── */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-5">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">What You Need</h2>

                <div className="space-y-2.5 mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Required</p>
                  {[
                    'GST Registration Certificate',
                    'PAN Card (Company or Director)',
                    'CIN / LLP Deed',
                    'Cancelled Cheque',
                  ].map((doc) => (
                    <div key={doc} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border-2 border-teal-500/60 bg-teal-500/15 flex items-center justify-center shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      </div>
                      <span className="text-sm text-slate-300">{doc}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/8 pt-4 space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Optional</p>
                  {[
                    'Last 2 years ITR',
                    '6-month Bank Statement',
                    'MSME / Udyam Certificate',
                  ].map((doc) => (
                    <div key={doc} className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full border-2 border-white/15 shrink-0" />
                      <span className="text-sm text-slate-500">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* How it works */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">How It Works</h3>
                <div className="space-y-4">
                  {[
                    'Submit application with KYC documents',
                    'Team reviews in 3–5 business days',
                    'Place orders on 45-day credit terms',
                    'Consolidated invoice at month-end',
                  ].map((step, i) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Column 2: Form ───────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">
              {/* Credit details */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Credit Details</h2>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-2">Requested Credit Limit <span className="text-rose-400">*</span></label>
                    <div className="grid grid-cols-5 gap-2">
                      {CREDIT_LIMITS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRequestedLimit(opt.value)}
                          className={`py-2.5 text-sm font-bold rounded-xl border-2 transition-all duration-150 ${
                            requestedLimit === opt.value
                              ? 'border-teal-500/60 bg-teal-500/20 text-teal-400 shadow-lg shadow-teal-500/10'
                              : 'border-white/10 bg-white/4 text-slate-400 hover:border-teal-500/30 hover:text-teal-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Years in Business</label>
                      <input
                        type="number"
                        value={businessYears}
                        onChange={(e) => setBusinessYears(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
                        placeholder="e.g. 5"
                        min={0}
                        max={100}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Annual Turnover</label>
                      <select
                        value={annualTurnover}
                        onChange={(e) => setAnnualTurnover(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
                      >
                        <option value="">Select range</option>
                        {TURNOVER_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Additional Notes <span className="text-slate-600 font-normal">(optional)</span></label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm bg-white/5 border border-white/10 text-white placeholder:text-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50 resize-none"
                      rows={3}
                      placeholder="Anything you'd like us to know about your business"
                    />
                  </div>
                </div>
              </div>

              {/* Document uploads */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Upload Documents</h2>
                <p className="text-xs text-slate-600 mb-5">PDF, JPG, PNG or WebP · Max 10 MB each</p>

                <div className="space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Required</p>
                  <DocUploadRow label="GST Registration Certificate" required uploaded={!!gstUrl} uploading={uploadingDoc === 'gst_certificate'} onFile={(f) => uploadDoc('gst_certificate', f, setGstUrl)} />
                  <DocUploadRow label="PAN Card" required uploaded={!!panUrl} uploading={uploadingDoc === 'pan_card'} onFile={(f) => uploadDoc('pan_card', f, setPanUrl)} />
                  <DocUploadRow label="CIN / LLP Deed" required uploaded={!!cinUrl} uploading={uploadingDoc === 'cin_document'} onFile={(f) => uploadDoc('cin_document', f, setCinUrl)} />
                  <DocUploadRow label="Cancelled Cheque" required uploaded={!!chequeUrl} uploading={uploadingDoc === 'cancelled_cheque'} onFile={(f) => uploadDoc('cancelled_cheque', f, setChequeUrl)} />

                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-4 mb-2">Optional</p>
                  <DocUploadRow label="Last 2 Years ITR" uploaded={!!itrUrl} uploading={uploadingDoc === 'itr'} onFile={(f) => uploadDoc('itr', f, setItrUrl)} />
                  <DocUploadRow label="6-Month Bank Statement" uploaded={!!bankUrl} uploading={uploadingDoc === 'bank_statement'} onFile={(f) => uploadDoc('bank_statement', f, setBankUrl)} />
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between p-5 bg-teal-500/10 border border-teal-500/20 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-white">Ready to apply?</p>
                  <p className="text-xs text-slate-500 mt-0.5">By submitting, you confirm all documents are genuine.</p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-500 disabled:opacity-60 transition-colors shadow-lg shadow-teal-500/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {saving ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </div>

            {/* ── Column 3: Trust & Timeline ───────────────────────────── */}
            <div className="lg:col-span-1 space-y-4">
              {/* Why Credit? */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Why Apply?</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/15 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Buy Now, Pay Later</p>
                      <p className="text-xs text-slate-500 mt-0.5">Order supplies and pay 45 days after delivery</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Expand Procurement</p>
                      <p className="text-xs text-slate-500 mt-0.5">Stock more branches without upfront capital</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                      <BadgeCheck className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Track Per Branch</p>
                      <p className="text-xs text-slate-500 mt-0.5">Consolidated invoices broken down by location</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Approval Timeline */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-5">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Approval Timeline</h3>
                <div className="relative pl-4">
                  <div className="absolute left-1.75 top-2 bottom-2 w-px bg-white/10" />
                  {[
                    { label: 'Application Submitted', sub: 'Immediately', active: true },
                    { label: 'Document Verification', sub: '1–2 business days', active: false },
                    { label: 'Credit Decision', sub: '3–5 business days', active: false },
                    { label: 'Credit Line Activated', sub: 'Upon approval', active: false },
                  ].map((step, i) => (
                    <div key={step.label} className={`relative flex items-start gap-3 pb-4 last:pb-0 ${i === 0 ? '' : ''}`}>
                      <div className={`absolute -left-1.25 top-1 w-3 h-3 rounded-full border-2 ${step.active ? 'border-teal-400 bg-teal-400/30' : 'border-white/20 bg-white/5'}`} />
                      <div className="ml-3">
                        <p className={`text-xs font-semibold ${step.active ? 'text-teal-400' : 'text-slate-400'}`}>{step.label}</p>
                        <p className="text-[11px] text-slate-600">{step.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security badge */}
              <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-200">Secure & Encrypted</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  All documents are stored in encrypted storage. Your financial information is never shared with third parties.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400/70">
                  <Shield className="w-3.5 h-3.5" />
                  <span>256-bit AES encryption</span>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
