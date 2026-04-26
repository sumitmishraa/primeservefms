'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Building2, Loader2, Check, AlertCircle, ShieldCheck, Upload,
  Trash2, FileText, Users, Truck, CreditCard,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CompanyDetails } from '@/app/api/buyer/company/route';
import type { BusinessDocument } from '@/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  'Hotel', 'Restaurant', 'Corporate Office', 'Hospital', 'Clinic',
  'School', 'College', 'Mall / Retail', 'Facility Management',
  'Manufacturing', 'Other',
];

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

const DOC_TYPE_LABELS: Record<string, string> = {
  gst_certificate: 'GST Certificate',
  trade_license: 'Trade License',
  pan_card: 'PAN Card',
  bank_statement: 'Bank Statement',
  incorporation_proof: 'Incorporation Proof',
  cancelled_cheque: 'Cancelled Cheque',
  msme_certificate: 'MSME / Udyam Certificate',
  other: 'Other Document',
};

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// ─── Component ───────────────────────────────────────────────────────────────

export default function AccountCompanyPage() {
  const [data, setData] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState<BusinessDocument['doc_type']>('gst_certificate');

  // ── Form state ─────────────────────────────────────────────────────────────
  // Legacy
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panError, setPanError] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  // Extended KYC
  const [legalCompanyName, setLegalCompanyName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cinNumber, setCinNumber] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [incorporationYear, setIncorporationYear] = useState('');
  const [monthlySpend, setMonthlySpend] = useState('');
  // Finance contacts
  const [payContactName, setPayContactName] = useState('');
  const [payContactEmail, setPayContactEmail] = useState('');
  const [payContactPhone, setPayContactPhone] = useState('');
  const [finApproverName, setFinApproverName] = useState('');
  const [finApproverEmail, setFinApproverEmail] = useState('');
  const [finApproverPhone, setFinApproverPhone] = useState('');
  // Purchasing
  const [poRequired, setPoRequired] = useState(false);
  const [billingNotes, setBillingNotes] = useState('');
  // Branch ops
  const [branchContact, setBranchContact] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryWindow, setDeliveryWindow] = useState('');
  const [loadingNotes, setLoadingNotes] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/buyer/company');
        const json = await res.json() as { data: CompanyDetails | null; error: string | null };
        if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed');
        const d = json.data;
        setData(d);
        setCompanyName(d.company_name ?? '');
        setCompanyType(d.company_type ?? '');
        setGstNumber(d.gst_number ?? '');
        setPanNumber(d.tax_id ?? '');
        setAddressLine1(d.address_line1 ?? '');
        setAddressLine2(d.address_line2 ?? '');
        setCity(d.city ?? '');
        setState(d.state ?? '');
        setPincode(d.pincode ?? '');
        setLegalCompanyName(d.legal_company_name ?? '');
        setTradeName(d.trade_name ?? '');
        setCinNumber(d.cin_number ?? '');
        setMsmeNumber(d.msme_number ?? '');
        setWebsite(d.website ?? '');
        setIncorporationYear(d.incorporation_year ? String(d.incorporation_year) : '');
        setMonthlySpend(d.expected_monthly_spend ?? '');
        setPayContactName(d.payment_contact_name ?? '');
        setPayContactEmail(d.payment_contact_email ?? '');
        setPayContactPhone(d.payment_contact_phone ?? '');
        setFinApproverName(d.finance_approver_name ?? '');
        setFinApproverEmail(d.finance_approver_email ?? '');
        setFinApproverPhone(d.finance_approver_phone ?? '');
        setPoRequired(d.po_required ?? false);
        setBillingNotes(d.billing_cycle_notes ?? '');
        setBranchContact(d.branch_contact_person ?? '');
        setDeliveryPhone(d.delivery_contact_phone ?? '');
        setDeliveryWindow(d.delivery_window_notes ?? '');
        setLoadingNotes(d.loading_unloading_notes ?? '');
        setPurchaseNotes(d.branch_purchase_notes ?? '');
      } catch {
        toast.error('Could not load company details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function validate(): boolean {
    if (gstNumber.trim() && !GST_REGEX.test(gstNumber.trim().toUpperCase())) {
      setGstError('Invalid GST format — expected: 22AAAAA0000A1Z5'); return false;
    }
    if (panNumber.trim() && !PAN_REGEX.test(panNumber.trim().toUpperCase())) {
      setPanError('Invalid PAN format — expected: ABCDE1234F'); return false;
    }
    if (pincode.trim() && pincode.replace(/\D/g, '').length !== 6) {
      toast.error('Pincode must be exactly 6 digits'); return false;
    }
    if (incorporationYear.trim()) {
      const yr = parseInt(incorporationYear, 10);
      if (isNaN(yr) || yr < 1900 || yr > new Date().getFullYear()) {
        toast.error('Invalid incorporation year'); return false;
      }
    }
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
          company_name: companyName.trim(),
          company_type: companyType,
          gst_number: gstNumber.trim().toUpperCase() || null,
          tax_id: panNumber.trim().toUpperCase() || null,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim(),
          city: city.trim(),
          state,
          pincode: pincode.trim(),
          legal_company_name: legalCompanyName.trim() || null,
          trade_name: tradeName.trim() || null,
          cin_number: cinNumber.trim().toUpperCase() || null,
          msme_number: msmeNumber.trim() || null,
          website: website.trim() || null,
          incorporation_year: incorporationYear.trim() ? parseInt(incorporationYear, 10) : null,
          expected_monthly_spend: monthlySpend || null,
          payment_contact_name: payContactName.trim() || null,
          payment_contact_email: payContactEmail.trim() || null,
          payment_contact_phone: payContactPhone.trim() || null,
          finance_approver_name: finApproverName.trim() || null,
          finance_approver_email: finApproverEmail.trim() || null,
          finance_approver_phone: finApproverPhone.trim() || null,
          po_required: poRequired,
          billing_cycle_notes: billingNotes.trim() || null,
          branch_contact_person: branchContact.trim() || null,
          delivery_contact_phone: deliveryPhone.trim() || null,
          delivery_window_notes: deliveryWindow.trim() || null,
          loading_unloading_notes: loadingNotes.trim() || null,
          branch_purchase_notes: purchaseNotes.trim() || null,
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

  async function handleDocUpload(file: File) {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const form = new FormData();
      form.append('doc_type', pendingDocType);
      form.append('file', file);
      const res = await fetch('/api/buyer/documents', { method: 'POST', body: form });
      const json = await res.json() as { data: BusinessDocument | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Upload failed');
      toast.success('Document uploaded');
      setData((prev) => prev ? {
        ...prev,
        business_documents: [...(prev.business_documents ?? []), json.data!],
      } : prev);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDocDelete(docUrl: string) {
    setDeletingUrl(docUrl);
    try {
      const res = await fetch(`/api/buyer/documents?url=${encodeURIComponent(docUrl)}`, { method: 'DELETE' });
      const json = await res.json() as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Document removed');
      setData((prev) => prev ? {
        ...prev,
        business_documents: (prev.business_documents ?? []).filter((d) => (d as BusinessDocument).url !== docUrl),
      } : prev);
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
        <p className="text-sm text-slate-500 mt-1">Business identity, KYC, contacts, and branch operations</p>
      </div>

      {/* ── Business Identity ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Business Identity</h2>
          {data?.business_verified && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />Verified
            </span>
          )}
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
                readOnly className={readonlyCls}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Trade / Display Name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} placeholder="e.g. Taj Hotels" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Type</label>
            <select value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={inputCls}>
              <option value="">Select type…</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Legal Company Name</label>
            <input type="text" value={legalCompanyName} onChange={(e) => setLegalCompanyName(e.target.value)} className={inputCls} placeholder="e.g. Taj Hotels & Resorts Ltd" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Trade Name <span className="font-normal text-slate-400">(if different)</span></label>
            <input type="text" value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={inputCls} placeholder="DBA / operating name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Website</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://example.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Incorporation Year</label>
            <input
              type="number"
              value={incorporationYear}
              onChange={(e) => setIncorporationYear(e.target.value)}
              className={`${inputCls} font-mono`}
              placeholder="2005"
              min={1900} max={new Date().getFullYear()}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Expected Monthly Spend</label>
            <select value={monthlySpend} onChange={(e) => setMonthlySpend(e.target.value)} className={inputCls}>
              <option value="">Select band…</option>
              {SPEND_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tax & Compliance ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-5">Tax &amp; Compliance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">GST Number</label>
            <input
              type="text" value={gstNumber}
              onChange={(e) => { setGstNumber(e.target.value.toUpperCase()); setGstError(''); }}
              placeholder="22AAAAA0000A1Z5" maxLength={15}
              className={`${inputCls} font-mono ${gstError ? 'border-rose-400' : ''}`}
            />
            {gstError && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{gstError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">PAN Number</label>
            <input
              type="text" value={panNumber}
              onChange={(e) => { setPanNumber(e.target.value.toUpperCase()); setPanError(''); }}
              placeholder="ABCDE1234F" maxLength={10}
              className={`${inputCls} font-mono ${panError ? 'border-rose-400' : ''}`}
            />
            {panError && <p className="mt-1 text-xs text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{panError}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">CIN / LLPIN</label>
            <input type="text" value={cinNumber} onChange={(e) => setCinNumber(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} placeholder="U74999MH2005PTC123456" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">MSME / Udyam Number</label>
            <input type="text" value={msmeNumber} onChange={(e) => setMsmeNumber(e.target.value)} className={`${inputCls} font-mono`} placeholder="UDYAM-XX-00-0000000" />
          </div>
        </div>
      </div>

      {/* ── Registered Address ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-5">Registered Business Address</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Address Line 1</label>
            <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputCls} placeholder="Building, street" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Address Line 2 <span className="font-normal text-slate-400">(optional)</span></label>
            <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputCls} placeholder="Area, landmark" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} placeholder="Bengaluru" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">State</label>
            <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Pincode</label>
            <input
              type="text" inputMode="numeric" value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputCls} font-mono`} placeholder="560001" maxLength={6}
            />
          </div>
        </div>
      </div>

      {/* ── Payment / Finance Contacts ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Payment &amp; Finance Contacts</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />Payment Contact</span>
            </label>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input type="text" value={payContactName} onChange={(e) => setPayContactName(e.target.value)} className={inputCls} placeholder="Accounts Manager" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email</label>
            <input type="email" value={payContactEmail} onChange={(e) => setPayContactEmail(e.target.value)} className={inputCls} placeholder="pay@company.com" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Phone</label>
            <input type="tel" value={payContactPhone} onChange={(e) => setPayContactPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Finance Approver</label>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Name</label>
            <input type="text" value={finApproverName} onChange={(e) => setFinApproverName(e.target.value)} className={inputCls} placeholder="CFO / Finance Head" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email</label>
            <input type="email" value={finApproverEmail} onChange={(e) => setFinApproverEmail(e.target.value)} className={inputCls} placeholder="cfo@company.com" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Phone</label>
            <input type="tel" value={finApproverPhone} onChange={(e) => setFinApproverPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={poRequired}
              onChange={(e) => setPoRequired(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-700">We require a Purchase Order (PO) before order fulfillment</span>
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Billing Cycle Notes</label>
            <textarea value={billingNotes} onChange={(e) => setBillingNotes(e.target.value)} rows={2} className={inputCls} placeholder="e.g. Invoice by 25th, payment by last working day of month" />
          </div>
        </div>
      </div>

      {/* ── Branch Operational ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Truck className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Branch &amp; Delivery Details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Branch Contact Person</label>
            <input type="text" value={branchContact} onChange={(e) => setBranchContact(e.target.value)} className={inputCls} placeholder="Site Manager name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Delivery Contact Phone</label>
            <input type="tel" value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Delivery Window Notes</label>
            <input type="text" value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} className={inputCls} placeholder="e.g. Mon–Fri, 9am–6pm only" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Loading / Unloading Notes</label>
            <input type="text" value={loadingNotes} onChange={(e) => setLoadingNotes(e.target.value)} className={inputCls} placeholder="e.g. Ground floor only, dock access available" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Branch Purchase Notes</label>
            <textarea value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} rows={2} className={inputCls} placeholder="Special instructions for this branch's orders" />
          </div>
        </div>
      </div>

      {/* ── Business Documents ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Business Documents</h2>
        </div>

        {/* Uploaded docs list */}
        {docs.length > 0 && (
          <div className="space-y-2 mb-5">
            {docs.map((doc) => (
              <div key={doc.url} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700">{DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}</p>
                  <p className="text-xs text-slate-400 truncate">{doc.file_name ?? 'Document'}</p>
                </div>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline shrink-0">
                  View
                </a>
                <button
                  onClick={() => handleDocDelete(doc.url)}
                  disabled={deletingUrl === doc.url}
                  className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors shrink-0"
                  aria-label="Remove document"
                >
                  {deletingUrl === doc.url
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload new document */}
        <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Document Type</label>
            <select
              value={pendingDocType}
              onChange={(e) => setPendingDocType(e.target.value as BusinessDocument['doc_type'])}
              className={inputCls}
            >
              {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleDocUpload(f);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDoc}
              className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {uploadingDoc
                ? <><Loader2 className="w-4 h-4 animate-spin" />Uploading…</>
                : <><Upload className="w-4 h-4" />Upload</>
              }
            </button>
          </div>
          <p className="text-xs text-slate-400 w-full">PDF, JPG, PNG up to 10 MB</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Company Details'}
        </button>
      </div>
    </div>
  );
}
