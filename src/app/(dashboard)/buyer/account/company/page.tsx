'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Building2, Loader2, Check, AlertCircle, ShieldCheck, Upload,
  Trash2, FileText, ChevronDown, MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CompanyDetails } from '@/app/api/buyer/company/route';
import type { BusinessDocument } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh',
];

const SPEND_BANDS = [
  'Up to ₹50,000',
  '₹50,000 – ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  '₹5,00,000 – ₹10,00,000',
  'Above ₹10,00,000',
];

const REQUIRED_DOCS: { value: BusinessDocument['doc_type']; label: string }[] = [
  { value: 'gst_certificate', label: 'GST Certificate' },
  { value: 'pan_card', label: 'PAN Card' },
];

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// ─── Styled Select ───────────────────────────────────────────────────────────

function SelectField({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-2.5 pr-9 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white transition-colors text-slate-700"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AccountCompanyPage() {
  const [data, setData] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const gstFileRef = useRef<HTMLInputElement>(null);
  const panFileRef = useRef<HTMLInputElement>(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [legalCompanyName, setLegalCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [website, setWebsite] = useState('');
  const [incorporationYear, setIncorporationYear] = useState('');
  const [monthlySpend, setMonthlySpend] = useState('');
  // Tax & Compliance
  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panError, setPanError] = useState('');
  const [cinNumber, setCinNumber] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');
  // Shipping Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [shippingContact, setShippingContact] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/buyer/company');
        const json = await res.json() as { data: CompanyDetails | null; error: string | null };
        if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed');
        const d = json.data;
        setData(d);
        setLegalCompanyName(d.legal_company_name ?? '');
        setTradeName(d.trade_name ?? '');
        setWebsite(d.website ?? '');
        setIncorporationYear(d.incorporation_year ? String(d.incorporation_year) : '');
        setMonthlySpend(d.expected_monthly_spend ?? '');
        setGstNumber(d.gst_number ?? '');
        setPanNumber(d.tax_id ?? '');
        setCinNumber(d.cin_number ?? '');
        setMsmeNumber(d.msme_number ?? '');
        setAddressLine1(d.address_line1 ?? '');
        setAddressLine2(d.address_line2 ?? '');
        setCity(d.city ?? '');
        setState(d.state ?? '');
        setPincode(d.pincode ?? '');
        setShippingContact(d.branch_contact_person ?? '');
        setShippingPhone(d.delivery_contact_phone ?? '');
      } catch {
        toast.error('Could not load company details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleGstChange(val: string) {
    const upper = val.toUpperCase();
    setGstNumber(upper);
    setGstError('');
    if (GST_REGEX.test(upper)) {
      // PAN is embedded in GST chars 2–11 (0-indexed)
      const pan = upper.slice(2, 12);
      setPanNumber(pan);
      setPanError('');
    }
  }

  function validate(): boolean {
    const docs = (data?.business_documents ?? []) as BusinessDocument[];

    if (!legalCompanyName.trim()) { toast.error('Legal company name is required'); return false; }
    if (!incorporationYear.trim()) { toast.error('Incorporation year is required'); return false; }
    const yr = parseInt(incorporationYear, 10);
    if (isNaN(yr) || yr < 1900 || yr > new Date().getFullYear()) {
      toast.error('Invalid incorporation year'); return false;
    }

    if (!gstNumber.trim()) { toast.error('GST number is required'); return false; }
    if (!GST_REGEX.test(gstNumber.trim().toUpperCase())) {
      setGstError('Invalid GST format — expected: 22AAAAA0000A1Z5'); return false;
    }
    if (!panNumber.trim()) { toast.error('PAN number is required'); return false; }
    if (!PAN_REGEX.test(panNumber.trim().toUpperCase())) {
      setPanError('Invalid PAN format — expected: ABCDE1234F'); return false;
    }
    if (!cinNumber.trim()) { toast.error('CIN / Company registration number is required'); return false; }

    if (pincode.trim() && pincode.replace(/\D/g, '').length !== 6) {
      toast.error('Pincode must be exactly 6 digits'); return false;
    }

    const hasGst = docs.some((d) => d.doc_type === 'gst_certificate');
    const hasPan = docs.some((d) => d.doc_type === 'pan_card');
    if (!hasGst) { toast.error('Please upload your GST Certificate before saving'); return false; }
    if (!hasPan) { toast.error('Please upload your PAN Card before saving'); return false; }

    return true;
  }

  async function handleSave() {
    setGstError(''); setPanError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/buyer/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_company_name: legalCompanyName.trim(),
          trade_name: tradeName.trim() || null,
          website: website.trim() || null,
          incorporation_year: incorporationYear.trim() ? parseInt(incorporationYear, 10) : null,
          expected_monthly_spend: monthlySpend || null,
          gst_number: gstNumber.trim().toUpperCase(),
          tax_id: panNumber.trim().toUpperCase(),
          cin_number: cinNumber.trim().toUpperCase(),
          msme_number: msmeNumber.trim() || null,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || null,
          city: city.trim(),
          state,
          pincode: pincode.trim(),
          branch_contact_person: shippingContact.trim() || null,
          delivery_contact_phone: shippingPhone.trim() || null,
        }),
      });
      const json = await res.json() as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Company details saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDocUpload(docType: BusinessDocument['doc_type'], file: File) {
    setUploadingDoc(docType);
    try {
      const form = new FormData();
      form.append('doc_type', docType);
      form.append('file', file);
      const res = await fetch('/api/buyer/documents', { method: 'POST', body: form });
      const json = await res.json() as { data: BusinessDocument | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Upload failed');
      toast.success('Document uploaded');
      setData((prev) => prev
        ? { ...prev, business_documents: [...(prev.business_documents ?? []), json.data!] }
        : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(null);
      if (gstFileRef.current) gstFileRef.current.value = '';
      if (panFileRef.current) panFileRef.current.value = '';
    }
  }

  async function handleDocDelete(docUrl: string) {
    setDeletingUrl(docUrl);
    try {
      const res = await fetch(`/api/buyer/documents?url=${encodeURIComponent(docUrl)}`, { method: 'DELETE' });
      const json = await res.json() as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Document removed');
      setData((prev) => prev
        ? { ...prev, business_documents: (prev.business_documents ?? []).filter((d) => (d as BusinessDocument).url !== docUrl) }
        : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setDeletingUrl(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors bg-white';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed';

  const docs = (data?.business_documents ?? []) as BusinessDocument[];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Company Details</h1>
        <p className="text-sm text-slate-500 mt-1">Business identity, KYC, and shipping information</p>
      </div>

      {/* ── Page header card — teal-navy glass ────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-950 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-white/5 blur-xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <p className="text-lg font-bold text-white tracking-tight">
                {legalCompanyName || 'Your Company'}
              </p>
              {tradeName && <p className="text-xs text-teal-200/70 mt-0.5">{tradeName}</p>}
            </div>
          </div>
          {data?.business_verified && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-full font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          )}
        </div>
      </div>

      {/* ── Business Identity ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Business Identity</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data?.client_name || data?.branch_name) && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Organisation <span className="font-normal text-slate-400">(assigned by admin)</span>
              </label>
              <input
                type="text"
                value={[data.client_name, data.branch_name].filter(Boolean).join(' — ')}
                readOnly
                className={readonlyCls}
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Legal Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={legalCompanyName}
              onChange={(e) => setLegalCompanyName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Taj Hotels & Resorts Private Limited"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Trade Name <span className="text-slate-400 font-normal">(if different from legal name)</span>
            </label>
            <input
              type="text"
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Taj Hotels"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Website <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={inputCls}
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Incorporation Year <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={incorporationYear}
              onChange={(e) => setIncorporationYear(e.target.value)}
              className={inputCls}
              placeholder="2005"
              min={1900}
              max={new Date().getFullYear()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Expected Monthly Spend</label>
            <SelectField
              value={monthlySpend}
              onChange={setMonthlySpend}
              placeholder="Select spend range…"
            >
              {SPEND_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </SelectField>
          </div>
        </div>
      </div>

      {/* ── Tax & Compliance ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Tax &amp; Compliance</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5 ml-6">GST, PAN, and CIN are mandatory. MSME is optional.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              GST Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => handleGstChange(e.target.value)}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className={`${inputCls} uppercase tracking-widest ${gstError ? 'border-rose-400 focus:ring-rose-400' : ''}`}
            />
            {gstError
              ? <p className="mt-1 text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{gstError}</p>
              : <p className="mt-1 text-xs text-slate-400">PAN will be auto-filled from GST</p>
            }
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              PAN Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => { setPanNumber(e.target.value.toUpperCase()); setPanError(''); }}
              placeholder="ABCDE1234F"
              maxLength={10}
              className={`${inputCls} uppercase tracking-widest ${panError ? 'border-rose-400 focus:ring-rose-400' : ''}`}
            />
            {panError && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{panError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              CIN / LLPIN <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={cinNumber}
              onChange={(e) => setCinNumber(e.target.value.toUpperCase())}
              className={`${inputCls} uppercase tracking-wider`}
              placeholder="U74999MH2005PTC123456"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              MSME / Udyam Number <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={msmeNumber}
              onChange={(e) => setMsmeNumber(e.target.value)}
              className={inputCls}
              placeholder="UDYAM-XX-00-0000000"
            />
          </div>
        </div>
      </div>

      {/* ── Shipping Address ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Shipping Address</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Address Line 1</label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className={inputCls}
              placeholder="Building, street"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Address Line 2 <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              className={inputCls}
              placeholder="Area, landmark"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputCls}
              placeholder="Bengaluru"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">State</label>
            <SelectField value={state} onChange={setState} placeholder="Select state…">
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectField>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Pincode</label>
            <input
              type="text"
              inputMode="numeric"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputCls} tracking-widest`}
              placeholder="560001"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contact Person</label>
            <input
              type="text"
              value={shippingContact}
              onChange={(e) => setShippingContact(e.target.value)}
              className={inputCls}
              placeholder="Site contact name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contact Phone</label>
            <input
              type="tel"
              value={shippingPhone}
              onChange={(e) => setShippingPhone(e.target.value)}
              className={inputCls}
              placeholder="+91 98765 43210"
            />
          </div>
        </div>
      </div>

      {/* ── Business Documents ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Business Documents</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5 ml-6">
          Both documents are mandatory before saving. PDF, JPG, or PNG up to 10 MB.
        </p>

        <div className="space-y-4">
          {REQUIRED_DOCS.map(({ value: docType, label }) => {
            const uploaded = docs.find((d) => d.doc_type === docType);
            const fileRef = docType === 'gst_certificate' ? gstFileRef : panFileRef;
            const isUploading = uploadingDoc === docType;

            return (
              <div
                key={docType}
                className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${
                  uploaded
                    ? 'bg-emerald-50/50 border-emerald-200'
                    : 'bg-slate-50 border-slate-200 border-dashed'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    uploaded ? 'bg-emerald-100' : 'bg-slate-200'
                  }`}>
                    <FileText className={`w-4 h-4 ${uploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">
                      {label} <span className="text-rose-500 text-xs">*</span>
                    </p>
                    {uploaded ? (
                      <p className="text-xs text-slate-400 truncate">{uploaded.file_name ?? 'Uploaded'}</p>
                    ) : (
                      <p className="text-xs text-slate-400">Not yet uploaded</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {uploaded && (
                    <>
                      <a
                        href={uploaded.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-teal-600 hover:underline font-semibold"
                      >
                        View
                      </a>
                      <button
                        onClick={() => handleDocDelete(uploaded.url)}
                        disabled={deletingUrl === uploaded.url}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                        aria-label="Remove"
                      >
                        {deletingUrl === uploaded.url
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleDocUpload(docType, f);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={isUploading}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      uploaded
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                    } disabled:opacity-60`}
                  >
                    {isUploading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{uploaded ? 'Replacing…' : 'Uploading…'}</>
                      : <><Upload className="w-3.5 h-3.5" />{uploaded ? 'Replace' : 'Upload'}</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-slate-400">
          <span className="text-rose-500">*</span> Required fields — upload both documents before saving
        </p>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Company Details'}
        </button>
      </div>
    </div>
  );
}
