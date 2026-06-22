'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  User, Building2, MapPin, Loader2, Check, AlertCircle, ShieldCheck,
  Upload, Trash2, FileText, Phone, Mail, Plus, GitBranch,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CustomSelect } from '@/components/ui';
import BranchCard from '@/components/buyer/BranchCard';
import AddBranchModal from '@/components/buyer/AddBranchModal';
import type { UserProfile } from '@/types';
import type { BusinessDocument } from '@/types';
import type { CompanyDetails } from '@/app/api/buyer/company/route';
import type { BuyerClientItem } from '@/app/api/buyer/clients/route';
import type { BranchWithStats } from '@/app/api/buyer/clients/[clientId]/branches/route';

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'company' | 'branches';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh',
];

const SPEND_BANDS = [
  'Up to ₹50,000', '₹50,000 - ₹2,00,000', '₹2,00,000 - ₹5,00,000',
  '₹5,00,000 - ₹10,00,000', 'Above ₹10,00,000',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// ─── ProfileTab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');

  useEffect(() => {
    fetch('/api/buyer/profile')
      .then((r) => r.json())
      .then((j: { data: UserProfile | null; error: string | null }) => {
        const d = j.data;
        if (!d) throw new Error(j.error ?? 'Failed');
        setProfile(d);
        setFullName(d.full_name ?? '');
        setPhone(d.phone ?? '');
        setDesignation(d.designation ?? '');
        setAltPhone(d.alt_phone ?? '');
        setCompanyEmail(d.procurement_email ?? '');
        setInvoiceEmail(d.invoice_email ?? '');
      })
      .catch(() => toast.error('Could not load profile'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!fullName.trim()) { toast.error('Full name is required'); return; }
    if (!companyEmail.trim() || !EMAIL_REGEX.test(companyEmail)) { toast.error('Valid company email is required'); return; }
    if (!invoiceEmail.trim() || !EMAIL_REGEX.test(invoiceEmail)) { toast.error('Valid invoicing email is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/buyer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(), phone: phone.trim(), designation: designation.trim(),
          alt_phone: altPhone.trim(), procurement_email: companyEmail.trim(), invoice_email: invoiceEmail.trim(),
        }),
      });
      const j = await res.json() as { error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Failed');
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white transition-colors';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed';

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>;
  if (!profile) return <div className="text-center py-16 text-slate-400">Could not load profile. Please refresh.</div>;

  return (
    <div className="space-y-5">
      {/* Identity card */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-teal-700 via-teal-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-teal-400/20 blur-2xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-linear-to-br from-teal-400 to-teal-600 text-white font-bold text-xl flex items-center justify-center ring-4 ring-teal-500/30">
            {fullName.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{fullName || 'Your Name'}</p>
            {designation && <p className="text-sm text-teal-200/80 mt-0.5">{designation}</p>}
            <p className="text-xs text-slate-400 mt-0.5">{profile.email ?? ''}</p>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Personal Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Your full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation</label>
            <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls} placeholder="e.g. Procurement Manager" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Login Email <span className="text-slate-400 font-normal">(read-only)</span></label>
            <input type="email" value={profile.email ?? ''} readOnly className={readonlyCls} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Phone className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Contact Details</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Primary Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">WhatsApp / Alternate</label>
            <input type="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
        </div>
      </div>

      {/* Business emails */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <Mail className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Business Email Addresses</h3>
        </div>
        <p className="text-xs text-slate-400 mb-5 ml-6">Both emails are required for order communications and invoicing.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Company Email <span className="text-rose-500">*</span></label>
            <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className={inputCls} placeholder="orders@yourcompany.com" />
            <p className="mt-1 text-xs text-slate-400">For order updates and communications</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Invoicing Email <span className="text-rose-500">*</span></label>
            <input type="email" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} className={inputCls} placeholder="accounts@yourcompany.com" />
            <p className="mt-1 text-xs text-slate-400">For invoices and billing</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── CompanyTab ───────────────────────────────────────────────────────────────

function CompanyTab() {
  const [data, setData] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const gstFileRef = useRef<HTMLInputElement>(null);
  const panFileRef = useRef<HTMLInputElement>(null);

  const [legalCompanyName, setLegalCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [website, setWebsite] = useState('');
  const [incorporationYear, setIncorporationYear] = useState('');
  const [monthlySpend, setMonthlySpend] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panError, setPanError] = useState('');
  const [cinNumber, setCinNumber] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [shippingContact, setShippingContact] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');

  useEffect(() => {
    fetch('/api/buyer/company')
      .then((r) => r.json())
      .then((j: { data: CompanyDetails | null; error: string | null }) => {
        const d = j.data;
        if (!d) throw new Error(j.error ?? 'Failed');
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
      })
      .catch(() => toast.error('Could not load company details'))
      .finally(() => setLoading(false));
  }, []);

  function handleGstChange(val: string) {
    const upper = val.toUpperCase();
    setGstNumber(upper);
    setGstError('');
    if (GST_REGEX.test(upper)) {
      setPanNumber(upper.slice(2, 12));
      setPanError('');
    }
  }

  async function handleSave() {
    setGstError(''); setPanError('');
    const docs = (data?.business_documents ?? []) as BusinessDocument[];
    if (!legalCompanyName.trim()) { toast.error('Legal company name is required'); return; }
    if (!gstNumber.trim() || !GST_REGEX.test(gstNumber.toUpperCase())) { setGstError('Invalid GST format'); toast.error('Check GST number'); return; }
    if (!panNumber.trim() || !PAN_REGEX.test(panNumber.toUpperCase())) { setPanError('Invalid PAN format'); toast.error('Check PAN number'); return; }
    if (!cinNumber.trim()) { toast.error('CIN / registration number is required'); return; }
    if (!docs.some((d) => d.doc_type === 'gst_certificate')) { toast.error('Please upload your GST Certificate'); return; }
    if (!docs.some((d) => d.doc_type === 'pan_card')) { toast.error('Please upload your PAN Card'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/buyer/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_company_name: legalCompanyName.trim(), trade_name: tradeName.trim() || null,
          website: website.trim() || null,
          incorporation_year: incorporationYear ? parseInt(incorporationYear, 10) : null,
          expected_monthly_spend: monthlySpend || null,
          gst_number: gstNumber.trim().toUpperCase(), tax_id: panNumber.trim().toUpperCase(),
          cin_number: cinNumber.trim().toUpperCase(), msme_number: msmeNumber.trim() || null,
          address_line1: addressLine1.trim(), address_line2: addressLine2.trim() || null,
          city: city.trim(), state, pincode: pincode.trim(),
          branch_contact_person: shippingContact.trim() || null,
          delivery_contact_phone: shippingPhone.trim() || null,
        }),
      });
      const j = await res.json() as { error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Failed');
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
      const j = await res.json() as { data: BusinessDocument | null; error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Upload failed');
      toast.success('Document uploaded');
      setData((prev) => prev ? { ...prev, business_documents: [...(prev.business_documents ?? []), j.data!] } : prev);
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
      const j = await res.json() as { error: string | null };
      if (!res.ok || j.error) throw new Error(j.error ?? 'Failed');
      toast.success('Document removed');
      setData((prev) => prev ? { ...prev, business_documents: (prev.business_documents ?? []).filter((d) => (d as BusinessDocument).url !== docUrl) } : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setDeletingUrl(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>;

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white transition-colors';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed';
  const docs = (data?.business_documents ?? []) as BusinessDocument[];

  const DocRow = ({ docType, label, fileRef }: { docType: BusinessDocument['doc_type']; label: string; fileRef: React.RefObject<HTMLInputElement | null> }) => {
    const existing = docs.find((d) => d.doc_type === docType);
    const uploading = uploadingDoc === docType;
    const deleting = deletingUrl === existing?.url;
    return (
      <div className={`flex items-center justify-between p-4 rounded-xl border-2 border-dashed transition-colors ${existing ? 'border-teal-200 bg-teal-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-3">
          <FileText className={`w-5 h-5 ${existing ? 'text-teal-600' : 'text-slate-400'}`} />
          <div>
            <p className="text-sm font-medium text-slate-800">{label}</p>
            {existing ? (
              <p className="text-xs text-teal-600 font-medium flex items-center gap-1 mt-0.5">
                <Check className="w-3 h-3" /> Uploaded
              </p>
            ) : (
              <p className="text-xs text-slate-400">Required</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {existing && (
            <>
              <a href={existing.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline font-medium px-2 py-1 rounded hover:bg-teal-100 transition-colors">View</a>
              <button
                type="button"
                disabled={deleting}
                onClick={() => handleDocDelete(existing.url)}
                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                aria-label="Delete document"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-teal-600 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            {existing ? 'Replace' : 'Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDocUpload(docType, f); }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Company header card */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-950 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-12 -top-12 w-48 h-48 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{legalCompanyName || 'Your Company'}</p>
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

      {/* Business Identity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Business Identity</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(data?.client_name || data?.branch_name) && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Organisation <span className="font-normal text-slate-400">(assigned by admin)</span></label>
              <input type="text" value={`${data?.client_name ?? ''}${data?.branch_name ? ` — ${data.branch_name}` : ''}`} readOnly className={readonlyCls} />
            </div>
          )}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Legal Company Name <span className="text-rose-500">*</span></label>
            <input type="text" value={legalCompanyName} onChange={(e) => setLegalCompanyName(e.target.value)} className={inputCls} placeholder="As on MCA / Incorporation Certificate" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Trade Name</label>
            <input type="text" value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={inputCls} placeholder="Brand or DBA name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Website</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://yourcompany.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Incorporation Year <span className="text-rose-500">*</span></label>
            <input type="number" value={incorporationYear} onChange={(e) => setIncorporationYear(e.target.value)} className={inputCls} placeholder="e.g. 2018" min={1900} max={new Date().getFullYear()} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Expected Monthly Spend</label>
            <CustomSelect
              value={monthlySpend}
              onChange={setMonthlySpend}
              options={SPEND_BANDS.map((b) => ({ value: b, label: b }))}
              placeholder="Select a range"
            />
          </div>
        </div>
      </div>

      {/* Tax & Compliance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <AlertCircle className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Tax & Compliance</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">GST Number <span className="text-rose-500">*</span></label>
            <input type="text" value={gstNumber} onChange={(e) => handleGstChange(e.target.value)} className={`${inputCls} font-mono uppercase`} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            {gstError && <p className="mt-1 text-xs text-rose-500">{gstError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">PAN Number <span className="text-rose-500">*</span></label>
            <input type="text" value={panNumber} onChange={(e) => { setPanNumber(e.target.value.toUpperCase()); setPanError(''); }} className={`${inputCls} font-mono uppercase`} placeholder="ABCDE1234F" maxLength={10} />
            {panError && <p className="mt-1 text-xs text-rose-500">{panError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">CIN / LLPIN <span className="text-rose-500">*</span></label>
            <input type="text" value={cinNumber} onChange={(e) => setCinNumber(e.target.value.toUpperCase())} className={`${inputCls} font-mono uppercase`} placeholder="U74999KA2020PTC123456" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">MSME / Udyam Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="text" value={msmeNumber} onChange={(e) => setMsmeNumber(e.target.value.toUpperCase())} className={`${inputCls} font-mono uppercase`} placeholder="UDYAM-KA-00-0000000" />
          </div>
        </div>
      </div>

      {/* Shipping Address */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <MapPin className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Primary Shipping Address</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Address Line 1</label>
            <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputCls} placeholder="Building, Street" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Address Line 2</label>
            <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputCls} placeholder="Area, Landmark" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Bangalore" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">State</label>
            <CustomSelect value={state} onChange={setState} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} placeholder="Select state" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Pincode</label>
            <input type="text" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))} className={inputCls} placeholder="560034" maxLength={6} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contact Person</label>
            <input type="text" value={shippingContact} onChange={(e) => setShippingContact(e.target.value)} className={inputCls} placeholder="Name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Contact Phone</label>
            <input type="tel" value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-700">Business Documents</h3>
        </div>
        <p className="text-xs text-slate-400 mb-5">PDF, JPG, PNG or WebP · Max 10 MB each</p>
        <div className="space-y-3">
          <DocRow docType="gst_certificate" label="GST Registration Certificate" fileRef={gstFileRef} />
          <DocRow docType="pan_card" label="PAN Card" fileRef={panFileRef} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Company Details'}
        </button>
      </div>
    </div>
  );
}

// ─── BranchesTab ──────────────────────────────────────────────────────────────

function BranchesTab() {
  const [clients, setClients] = useState<BuyerClientItem[]>([]);
  const [branches, setBranches] = useState<BranchWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const loadBranches = useCallback(async (clientId: string) => {
    const res = await fetch(`/api/buyer/clients/${clientId}/branches`);
    const j = await res.json() as { data: BranchWithStats[] | null };
    return j.data ?? [];
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/buyer/clients');
        const j = await res.json() as { data: BuyerClientItem[] | null };
        const list = j.data ?? [];
        setClients(list);
        const primaryClient = list.find((c) => c.is_primary) ?? list[0];
        if (primaryClient) {
          setActiveClientId(primaryClient.id);
          const bs = await loadBranches(primaryClient.id);
          setBranches(bs);
        }
      } catch {
        toast.error('Could not load branches');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [loadBranches]);

  async function switchClient(clientId: string) {
    setActiveClientId(clientId);
    setLoading(true);
    try {
      const bs = await loadBranches(clientId);
      setBranches(bs);
    } finally {
      setLoading(false);
    }
  }

  async function refreshBranches() {
    if (!activeClientId) return;
    const bs = await loadBranches(activeClientId);
    setBranches(bs);
  }

  const activeClient = clients.find((c) => c.id === activeClientId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Branches & Outlets</h3>
          <p className="text-sm text-slate-500 mt-0.5">Manage all your physical locations for accurate procurement tracking</p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Branch
        </button>
      </div>

      {/* Company tabs (for multi-company founders) */}
      {clients.length > 1 && (
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => switchClient(c.id)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeClientId === c.id
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c.display_name ?? c.name}
            </button>
          ))}
        </div>
      )}

      {/* Branch grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-teal-600" /></div>
      ) : branches.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <GitBranch className="w-6 h-6 text-slate-400" />
          </div>
          <h4 className="text-base font-semibold text-slate-700 mb-1">No branches yet</h4>
          <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto">Add your first outlet to start tracking procurement per location. Each branch gets its own order history and spend analytics.</p>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {branches.map((b) => (
            <BranchCard key={b.id} branch={b} clientName={activeClient?.display_name ?? activeClient?.name} />
          ))}
        </div>
      )}

      {showModal && (
        <AddBranchModal
          clients={clients}
          defaultClientId={activeClientId ?? undefined}
          onClose={() => setShowModal(false)}
          onCreated={refreshBranches}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Personal Profile', icon: User },
  { id: 'company', label: 'Company Info', icon: Building2 },
  { id: 'branches', label: 'Branches & Outlets', icon: GitBranch },
];

export default function DetailsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get('tab') as Tab | null) ?? 'profile';

  function setTab(t: Tab) {
    router.replace(`/buyer/account/details?tab=${t}`, { scroll: false });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Details</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile, company information, and branch locations</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-7">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              tab === id
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profile' && <ProfileTab />}
      {tab === 'company' && <CompanyTab />}
      {tab === 'branches' && <BranchesTab />}
    </div>
  );
}
