'use client';

/**
 * Account > Company Details
 * Business identity, tax numbers, and registered address.
 */

import { useEffect, useState } from 'react';
import { Building2, Loader2, Check, AlertCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CompanyDetails } from '@/app/api/buyer/company/route';

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

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export default function AccountCompanyPage() {
  const [data, setData] = useState<CompanyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
      setGstError('Invalid GST format — expected: 22AAAAA0000A1Z5');
      return false;
    }
    if (panNumber.trim() && !PAN_REGEX.test(panNumber.trim().toUpperCase())) {
      setPanError('Invalid PAN format — expected: ABCDE1234F');
      return false;
    }
    if (pincode.trim() && pincode.replace(/\D/g, '').length !== 6) {
      toast.error('Pincode must be exactly 6 digits');
      return false;
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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-heading">Company Details</h1>
        <p className="text-sm text-slate-500 mt-1">Your business identity, tax numbers, and registered address</p>
      </div>

      {/* Business Identity */}
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
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Taj Hotels Pvt Ltd"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Business Type</label>
            <select value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={inputCls}>
              <option value="">Select type…</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Organisation (admin-assigned) */}
          {(data?.client_name || data?.branch_name) && (
            <div>
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
        </div>
      </div>

      {/* Tax Numbers */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-5">Tax & Compliance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              GST Number <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => { setGstNumber(e.target.value.toUpperCase()); setGstError(''); }}
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
              className={`${inputCls} font-mono ${gstError ? 'border-rose-400 focus:ring-rose-500' : ''}`}
            />
            {gstError && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />{gstError}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              PAN Number <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => { setPanNumber(e.target.value.toUpperCase()); setPanError(''); }}
              placeholder="ABCDE1234F"
              maxLength={10}
              className={`${inputCls} font-mono ${panError ? 'border-rose-400 focus:ring-rose-500' : ''}`}
            />
            {panError && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />{panError}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          GST and PAN are used for B2B invoicing and tax compliance. They are not shared publicly.
        </p>
      </div>

      {/* Registered Address */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-5">Registered Business Address</h2>
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
              Address Line 2 <span className="font-normal text-slate-400">(optional)</span>
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
            <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Pincode</label>
            <input
              type="text"
              inputMode="numeric"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`${inputCls} font-mono`}
              placeholder="560001"
              maxLength={6}
            />
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Company Details'}
          </button>
        </div>
      </div>
    </div>
  );
}
