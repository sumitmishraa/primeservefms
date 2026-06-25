'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Receipt, CreditCard, FileCheck, Landmark, ClipboardCheck,
  Upload, Check, Loader2, ChevronLeft, ChevronRight, ArrowLeft,
  CheckCircle2, ShieldCheck, FileText, RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CreditApplicationRecord } from '@/app/api/buyer/credit-application/route';
import type { CompanyDetails } from '@/app/api/buyer/company/route';
import type { UserProfile, BusinessDocument } from '@/types';
import {
  companyStepSchema, gstStepSchema, panStepSchema, cinStepSchema,
  type EntityType,
} from '@/lib/validation/credit';
import CreditStatusTracker from '@/components/buyer/CreditStatusTracker';

// ─── Constants ──────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'Company',    Icon: Building2 },
  { n: 2, label: 'GST',        Icon: Receipt },
  { n: 3, label: 'PAN',        Icon: CreditCard },
  { n: 4, label: 'CIN / LLP',  Icon: FileCheck },
  { n: 5, label: 'Bank',       Icon: Landmark },
  { n: 6, label: 'Review',     Icon: ClipboardCheck },
] as const;

const TOTAL_STEPS = STEPS.length;
const CERT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.xls,.xlsx';
const BANK_ACCEPT = '.pdf,.xls,.xlsx';
const CERT_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx'];
const BANK_EXTS = ['pdf', 'xls', 'xlsx'];

// ─── Upload field ───────────────────────────────────────────────────────────

interface UploadFieldProps {
  label: string;
  hint: string;
  accept: string;
  exts: string[];
  uploaded: boolean;
  fileName?: string;
  uploading: boolean;
  onFile: (f: File) => void;
}

function UploadField({ label, hint, accept, exts, uploaded, fileName, uploading, onFile }: UploadFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    const ext = (f.name.split('.').pop() ?? '').toLowerCase();
    if (!exts.includes(ext)) {
      toast.error(`Invalid file type. Allowed: ${exts.join(', ').toUpperCase()}`);
      return;
    }
    onFile(f);
  }

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        uploaded ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${uploaded ? 'bg-teal-100' : 'bg-slate-100'}`}>
            {uploaded ? <Check className="h-4 w-4 text-teal-600" /> : <FileText className="h-4 w-4 text-slate-500" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{label}</p>
            {uploaded
              ? <p className="truncate text-xs text-teal-600">Uploaded{fileName ? ` — ${fileName}` : ''}</p>
              : <p className="text-xs text-slate-400">{hint}</p>}
          </div>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => ref.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-600 transition-colors hover:bg-teal-50 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploaded ? 'Replace' : 'Upload'}
        </button>
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
        />
      </div>
    </div>
  );
}

// ─── Field helpers ──────────────────────────────────────────────────────────

function Field({ label, error, children, required }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-600">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30';

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CreditApplyWizardPage() {
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<CreditApplicationRecord | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const [step, setStep] = useState(1);
  const [resumedFrom, setResumedFrom] = useState(0); // step we resumed at (for banner)

  // Step 1 — company & applicant
  const [entityType, setEntityType] = useState<EntityType>('company');
  const [legalName, setLegalName] = useState('');
  const [fullName, setFullName] = useState('');
  const [designation, setDesignation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Identity numbers
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [cinNumber, setCinNumber] = useState('');

  // Document URLs + names
  const [gstUrl, setGstUrl] = useState('');
  const [panFrontUrl, setPanFrontUrl] = useState('');
  const [panBackUrl, setPanBackUrl] = useState('');
  const [cinUrl, setCinUrl] = useState('');
  const [bankUrl, setBankUrl] = useState('');
  const [docNames, setDocNames] = useState<Record<string, string>>({});

  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Initial load: application + profile + company ──────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [appRes, profRes, compRes, docRes] = await Promise.all([
          fetch('/api/buyer/credit-application').then((r) => r.json()) as Promise<{ data: CreditApplicationRecord | null }>,
          fetch('/api/buyer/profile').then((r) => r.json()) as Promise<{ data: (UserProfile & { client_name: string | null }) | null }>,
          fetch('/api/buyer/company').then((r) => r.json()) as Promise<{ data: CompanyDetails | null }>,
          fetch('/api/buyer/documents').then((r) => r.json()) as Promise<{ data: BusinessDocument[] | null }>,
        ]);

        const existing = appRes.data;
        const prof = profRes.data;
        const comp = compRes.data;
        const docs = docRes.data ?? [];

        // Prefill step-1 fields from profile/company
        const ct = comp?.company_type;
        setEntityType(ct === 'llp' ? 'llp' : 'company');
        setLegalName(comp?.legal_company_name ?? comp?.company_name ?? '');
        setFullName(prof?.full_name ?? '');
        setDesignation(prof?.designation ?? '');
        setEmail(prof?.procurement_email ?? prof?.email ?? '');
        setPhone(prof?.phone ?? '');
        setGstNumber(comp?.gst_number ?? '');
        setPanNumber(comp?.tax_id ?? '');
        setCinNumber(comp?.cin_number ?? '');

        // Pre-existing profile docs (offered as already-on-file for new applications)
        const findDoc = (t: BusinessDocument['doc_type']) => docs.find((d) => d.doc_type === t);
        const profileGst = findDoc('gst_certificate');
        const profilePan = findDoc('pan_card');

        if (existing && existing.status !== 'draft') {
          // Active / terminal — show tracker, not the form
          setApp(existing);
        } else if (existing && existing.status === 'draft') {
          // Resume the draft — overlay saved values
          if (existing.entity_type) setEntityType(existing.entity_type);
          if (existing.gst_number) setGstNumber(existing.gst_number);
          if (existing.pan_number) setPanNumber(existing.pan_number);
          if (existing.cin_number) setCinNumber(existing.cin_number);
          setGstUrl(existing.gst_certificate_url ?? profileGst?.url ?? '');
          setPanFrontUrl(existing.pan_card_url ?? profilePan?.url ?? '');
          setPanBackUrl(existing.pan_card_back_url ?? '');
          setCinUrl(existing.cin_document_url ?? '');
          setBankUrl(existing.bank_statement_url ?? '');
          setApp(existing);
          const resumeStep = Math.min(Math.max(existing.current_step ?? 1, 1), TOTAL_STEPS);
          setStep(resumeStep);
          if (resumeStep > 1) setResumedFrom(resumeStep);
        } else {
          // Brand-new — offer any profile docs already on file
          setGstUrl(profileGst?.url ?? '');
          setPanFrontUrl(profilePan?.url ?? '');
        }
      } catch {
        toast.error('Could not load your application. Please refresh.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Draft autosave (PUT) ───────────────────────────────────────────────────
  async function saveDraft(patch: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch('/api/buyer/credit-application', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = (await res.json()) as { data: CreditApplicationRecord | null; error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Failed to save');
      if (j.data) setApp(j.data);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save progress');
      return false;
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function uploadDoc(
    docType: BusinessDocument['doc_type'],
    file: File,
    setUrl: (u: string) => void,
    draftKey: string,
  ) {
    setUploadingDoc(docType);
    try {
      const form = new FormData();
      form.append('doc_type', docType);
      form.append('file', file);
      const res = await fetch('/api/buyer/documents', { method: 'POST', body: form });
      const j = (await res.json()) as { data: { url: string } | null; error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Upload failed');
      const url = j.data?.url ?? '';
      setUrl(url);
      setDocNames((m) => ({ ...m, [docType]: file.name }));
      toast.success('Document uploaded');
      // Autosave the link so a resume keeps it
      void saveDraft({ [draftKey]: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(null);
    }
  }

  // ── Step navigation ────────────────────────────────────────────────────────
  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  async function next() {
    setErrors({});
    setSaving(true);
    try {
      if (step === 1) {
        const parsed = companyStepSchema.safeParse({
          entity_type: entityType,
          legal_company_name: legalName,
          full_name: fullName,
          designation,
          contact_email: email,
          contact_phone: phone,
        });
        if (!parsed.success) return setFieldErrors(parsed.error);
        if (!(await saveDraft({
          entity_type: entityType,
          legal_company_name: legalName,
          full_name: fullName,
          designation,
          contact_email: email,
          contact_phone: phone,
          current_step: 2,
        }))) return;
      } else if (step === 2) {
        const parsed = gstStepSchema.safeParse({ gst_number: gstNumber });
        if (!parsed.success) return setFieldErrors(parsed.error);
        if (!gstUrl) return void setErrors({ gst_doc: 'Please upload your GST certificate' });
        if (!(await saveDraft({ gst_number: gstNumber, gst_certificate_url: gstUrl, current_step: 3 }))) return;
      } else if (step === 3) {
        const parsed = panStepSchema.safeParse({ pan_number: panNumber });
        if (!parsed.success) return setFieldErrors(parsed.error);
        if (!panFrontUrl) return void setErrors({ pan_front: 'Please upload the front of the PAN card' });
        if (!panBackUrl) return void setErrors({ pan_back: 'Please upload the back of the PAN card' });
        if (!(await saveDraft({ pan_number: panNumber, pan_card_url: panFrontUrl, pan_card_back_url: panBackUrl, current_step: 4 }))) return;
      } else if (step === 4) {
        const parsed = cinStepSchema.safeParse({ entity_type: entityType, cin_number: cinNumber });
        if (!parsed.success) return setFieldErrors(parsed.error);
        if (!cinUrl) return void setErrors({ cin_doc: 'Please upload your Certificate of Incorporation / LLP Deed' });
        if (!(await saveDraft({ cin_number: cinNumber, cin_document_url: cinUrl, current_step: 5 }))) return;
      } else if (step === 5) {
        if (!bankUrl) return void setErrors({ bank_doc: 'Please upload your 6-month bank statement' });
        if (!(await saveDraft({ bank_statement_url: bankUrl, current_step: 6 }))) return;
      }
      setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    } finally {
      setSaving(false);
    }
  }

  function setFieldErrors(err: import('zod').ZodError) {
    const map: Record<string, string> = {};
    for (const issue of err.issues) map[String(issue.path[0])] = issue.message;
    setErrors(map);
    toast.error('Please fix the highlighted fields');
  }

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/buyer/credit-application', { method: 'POST' });
      const j = (await res.json()) as { data: CreditApplicationRecord | null; error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Submission failed');
      if (j.data) setApp(j.data);
      setJustSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  function startNewApplication() {
    setApp(null);
    setJustSubmitted(false);
    setStep(1);
    setResumedFrom(0);
    setGstUrl(''); setPanFrontUrl(''); setPanBackUrl(''); setCinUrl(''); setBankUrl('');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-teal-500" />
      </div>
    );
  }

  const isActive = app && app.status !== 'draft' && app.status !== 'rejected';

  // Thank-you (just submitted) or status tracker for active applications
  if (isActive && app) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        {justSubmitted && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-2 border-emerald-200 bg-white">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Thank you for submitting the application</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              We have received your details and documents. <strong>We will contact you shortly</strong> to
              take your credit line forward.
            </p>
          </div>
        )}

        {!justSubmitted && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your credit application</h1>
            <p className="mt-0.5 text-sm text-slate-500">Track your application status below.</p>
          </div>
        )}

        <CreditStatusTracker app={app} />

        <div className="flex flex-wrap gap-3">
          <Link href="/buyer/account/credit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700">
            View Credit Overview
          </Link>
          <Link href="/buyer/account/dashboard" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Rejected — allow a fresh start
  if (app && app.status === 'rejected') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-6">
        <CreditStatusTracker app={app} />
        <button
          onClick={startNewApplication}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
        >
          <RotateCcw className="h-4 w-4" /> Start a new application
        </button>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/buyer/account/credit-apply"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-teal-600"
      >
        <ArrowLeft className="h-4 w-4" /> Back to credit overview
      </Link>

      <h1 className="text-2xl font-bold text-slate-900">Apply for Credit</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        Step {step} of {TOTAL_STEPS} — your progress is saved automatically.
      </p>

      {resumedFrom > 1 && step === resumedFrom && (
        <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
          Welcome back! You completed {resumedFrom - 1} of {TOTAL_STEPS} steps — let&apos;s continue.
        </div>
      )}

      {/* Progress stepper */}
      <div className="mt-6 mb-7">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = s.n < step;
            const current = s.n === step;
            const Icon = s.Icon;
            return (
              <div key={s.n} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                      done
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : current
                          ? 'border-teal-600 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`hidden text-[11px] font-medium sm:block ${current ? 'text-teal-700' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mx-1.5 h-0.5 flex-1 rounded-full ${s.n < step ? 'bg-teal-600' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-5">
            <StepHeader Icon={Building2} title="Company & applicant details" sub="We've pre-filled what we know from your account." />
            <Field label="Entity type" required>
              <div className="grid grid-cols-2 gap-2">
                {(['company', 'llp'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntityType(t)}
                    className={`rounded-lg border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                      entityType === t ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-teal-300'
                    }`}
                  >
                    {t === 'company' ? 'Private / Public Company' : 'LLP'}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Legal company name" required error={errors.legal_company_name}>
              <input className={inputCls} value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="As on Certificate of Incorporation" />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Your full name" required error={errors.full_name}>
                <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Your designation" required error={errors.designation}>
                <input className={inputCls} value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g. Procurement Manager" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Contact email" required error={errors.contact_email}>
                <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </Field>
              <Field label="Contact phone" required error={errors.contact_phone}>
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <StepHeader Icon={Receipt} title="GST details" sub="Enter your GSTIN and upload the GST registration certificate." />
            <Field label="GST number (GSTIN)" required error={errors.gst_number}>
              <input className={`${inputCls} uppercase`} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </Field>
            <UploadField
              label="GST Registration Certificate" hint="JPG, PNG, PDF or Excel · max 10 MB"
              accept={CERT_ACCEPT} exts={CERT_EXTS}
              uploaded={!!gstUrl} fileName={docNames.gst_certificate}
              uploading={uploadingDoc === 'gst_certificate'}
              onFile={(f) => uploadDoc('gst_certificate', f, setGstUrl, 'gst_certificate_url')}
            />
            {errors.gst_doc && <p className="-mt-2 text-xs text-rose-600">{errors.gst_doc}</p>}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <StepHeader Icon={CreditCard} title="PAN details" sub="Enter the company PAN and upload both sides of the card." />
            <Field label="PAN number" required error={errors.pan_number}>
              <input className={`${inputCls} uppercase`} value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} placeholder="AAAAA0000A" maxLength={10} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <UploadField
                label="PAN card — front" hint="JPG, PNG, PDF or Excel"
                accept={CERT_ACCEPT} exts={CERT_EXTS}
                uploaded={!!panFrontUrl} fileName={docNames.pan_card}
                uploading={uploadingDoc === 'pan_card'}
                onFile={(f) => uploadDoc('pan_card', f, setPanFrontUrl, 'pan_card_url')}
              />
              <UploadField
                label="PAN card — back" hint="JPG, PNG, PDF or Excel"
                accept={CERT_ACCEPT} exts={CERT_EXTS}
                uploaded={!!panBackUrl} fileName={docNames.pan_card_back}
                uploading={uploadingDoc === 'pan_card_back'}
                onFile={(f) => uploadDoc('pan_card_back', f, setPanBackUrl, 'pan_card_back_url')}
              />
            </div>
            {(errors.pan_front || errors.pan_back) && (
              <p className="-mt-2 text-xs text-rose-600">{errors.pan_front ?? errors.pan_back}</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <StepHeader Icon={FileCheck} title={entityType === 'llp' ? 'LLP details' : 'CIN details'} sub={entityType === 'llp' ? 'Enter your LLPIN and upload the LLP Deed.' : 'Enter your CIN and upload the Certificate of Incorporation.'} />
            <Field label={entityType === 'llp' ? 'LLPIN' : 'CIN'} required error={errors.cin_number}>
              <input className={`${inputCls} uppercase`} value={cinNumber} onChange={(e) => setCinNumber(e.target.value.toUpperCase())} placeholder={entityType === 'llp' ? 'AAA-1234' : 'U72200KA2013PTC097389'} maxLength={21} />
            </Field>
            <UploadField
              label={entityType === 'llp' ? 'LLP Deed' : 'Certificate of Incorporation'} hint="JPG, PNG, PDF or Excel · max 10 MB"
              accept={CERT_ACCEPT} exts={CERT_EXTS}
              uploaded={!!cinUrl} fileName={docNames.cin_document}
              uploading={uploadingDoc === 'cin_document'}
              onFile={(f) => uploadDoc('cin_document', f, setCinUrl, 'cin_document_url')}
            />
            {errors.cin_doc && <p className="-mt-2 text-xs text-rose-600">{errors.cin_doc}</p>}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <StepHeader Icon={Landmark} title="Bank statement" sub="Upload your last 6 months' bank statement. PDF or Excel only." />
            <UploadField
              label="6-Month Bank Statement" hint="PDF or Excel only · max 10 MB"
              accept={BANK_ACCEPT} exts={BANK_EXTS}
              uploaded={!!bankUrl} fileName={docNames.bank_statement}
              uploading={uploadingDoc === 'bank_statement'}
              onFile={(f) => uploadDoc('bank_statement', f, setBankUrl, 'bank_statement_url')}
            />
            {errors.bank_doc && <p className="-mt-2 text-xs text-rose-600">{errors.bank_doc}</p>}
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
              Only PDF or Excel statements are accepted — anything else will be rejected.
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <StepHeader Icon={ClipboardCheck} title="Review & submit" sub="Please confirm everything is correct before submitting." />
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {[
                { k: 'Entity type', v: entityType === 'llp' ? 'LLP' : 'Company' },
                { k: 'Company', v: legalName },
                { k: 'Applicant', v: `${fullName}${designation ? ` · ${designation}` : ''}` },
                { k: 'GST', v: gstNumber, doc: !!gstUrl },
                { k: 'PAN', v: panNumber, doc: !!panFrontUrl && !!panBackUrl },
                { k: entityType === 'llp' ? 'LLPIN' : 'CIN', v: cinNumber, doc: !!cinUrl },
                { k: 'Bank statement', v: bankUrl ? 'Uploaded' : '—', doc: !!bankUrl },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{row.k}</dt>
                  <dd className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <span className="max-w-48 truncate">{row.v || '—'}</span>
                    {'doc' in row && (
                      row.doc
                        ? <Check className="h-4 w-4 text-teal-600" />
                        : <span className="text-xs text-rose-500">missing</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-slate-400">By submitting, you confirm all details and documents are genuine.</p>
          </div>
        )}

        {/* Nav buttons */}
        <div className="mt-7 flex items-center justify-between border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={back}
            disabled={step === 1 || saving || submitting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={next}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/20 transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Save & Continue <ChevronRight className="h-4 w-4" /></>}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-500/20 transition-colors hover:bg-teal-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Submit Application <Check className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeader({ Icon, title, sub }: { Icon: React.ElementType; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-teal-50">
        <Icon className="h-5 w-5 text-teal-600" />
      </div>
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500">{sub}</p>
      </div>
    </div>
  );
}
