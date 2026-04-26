'use client';

import { useEffect, useState } from 'react';
import { Loader2, Check, User, Mail, Phone, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '@/types';

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Personal fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [procurementEmail, setProcurementEmail] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/buyer/profile');
        const json = await res.json() as { data: UserProfile | null; error: string | null };
        if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed');
        const d = json.data;
        setProfile(d);
        setFullName(d.full_name ?? '');
        setPhone(d.phone ?? '');
        setDesignation(d.designation ?? '');
        setDepartment(d.department ?? '');
        setAltPhone(d.alt_phone ?? '');
        setProcurementEmail(d.procurement_email ?? '');
        setInvoiceEmail(d.invoice_email ?? '');
      } catch {
        toast.error('Could not load profile');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/buyer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          designation: designation.trim(),
          department: department.trim(),
          alt_phone: altPhone.trim(),
          procurement_email: procurementEmail.trim(),
          invoice_email: invoiceEmail.trim(),
        }),
      });
      const json = await res.json() as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  if (!profile) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
        Could not load profile. Please refresh.
      </div>
    </div>
  );

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors bg-white';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Update your personal information and contact details</p>
      </div>

      {/* Avatar + identity header */}
      <div className="bg-linear-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-teal-500 opacity-10" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-teal-600 text-white font-bold text-2xl flex items-center justify-center select-none shrink-0 ring-4 ring-teal-500/30">
            {fullName.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{fullName || 'Your Name'}</p>
            {designation && <p className="text-sm text-teal-300 mt-0.5">{designation}{department ? ` · ${department}` : ''}</p>}
            <p className="text-xs text-slate-400 mt-0.5">{profile.email ?? 'No email on file'}</p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Personal Information</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} placeholder="Your full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Designation</label>
            <input type="text" value={designation} onChange={(e) => setDesignation(e.target.value)} className={inputCls} placeholder="e.g. Procurement Manager" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Department</label>
            <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls} placeholder="e.g. Operations" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Email <span className="text-slate-400 font-normal">(read-only — contact support to change)</span>
            </label>
            <input type="email" value={profile.email ?? ''} readOnly className={readonlyCls} />
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Phone className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Contact Details</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Primary Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              WhatsApp / Alternate Phone
            </label>
            <input type="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} className={inputCls} placeholder="+91 98765 43210" />
          </div>
        </div>
      </div>

      {/* Business Contact Emails */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Mail className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Business Email Addresses</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Procurement Contact Email
              <span className="text-slate-400 font-normal ml-1">(for order comms)</span>
            </label>
            <input type="email" value={procurementEmail} onChange={(e) => setProcurementEmail(e.target.value)} className={inputCls} placeholder="procurement@company.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Invoice / Billing Email
              <span className="text-slate-400 font-normal ml-1">(for invoices)</span>
            </label>
            <input type="email" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} className={inputCls} placeholder="accounts@company.com" />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Account Details</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Authentication</p>
              <p className="text-xs text-slate-400 mt-0.5">Phone OTP via Firebase</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Business Verification</p>
              <p className="text-xs text-slate-400 mt-0.5">Verified by PrimeServe admin</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${profile.business_verified ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {profile.business_verified ? 'Verified' : 'Pending'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Member Since</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
