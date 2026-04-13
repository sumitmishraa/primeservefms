'use client';

/**
 * Buyer — My Profile page
 * Edit personal info, business details, and saved addresses.
 */

import { useEffect, useState } from 'react';
import { User, Building2, MapPin, Plus, Trash2, Loader2, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedAddress {
  id: string; label: string; contact_name: string; contact_phone: string;
  line1: string; line2: string; city: string; state: string; pincode: string;
  is_default: boolean;
}

interface ProfileWithMeta extends Omit<UserProfile, 'saved_addresses'> {
  client_name: string | null;
  branch_name: string | null;
  saved_addresses: SavedAddress[] | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUSINESS_TYPES = [
  'Hotel', 'Restaurant', 'Corporate Office', 'Hospital', 'Clinic', 'School',
  'College', 'Mall / Retail', 'Facility Management', 'Manufacturing', 'Other',
];

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BuyerProfilePage() {
  const [profile, setProfile] = useState<ProfileWithMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [gstError, setGstError] = useState('');

  // Saved addresses
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [addrForm, setAddrForm] = useState<Omit<SavedAddress, 'id' | 'is_default'>>({
    label: '', contact_name: '', contact_phone: '', line1: '', line2: '', city: '', state: '', pincode: '',
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/buyer/profile');
        const json = await res.json() as { data: ProfileWithMeta | null; error: string | null };
        if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed');
        setProfile(json.data);
        setFullName(json.data.full_name ?? '');
        setPhone(json.data.phone ?? '');
        setCompanyName(json.data.company_name ?? '');
        setCompanyType(json.data.company_type ?? '');
        setGstNumber(json.data.gst_number ?? '');
        setAddresses(json.data.saved_addresses ?? []);
      } catch {
        toast.error('Could not load profile');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSaveProfile() {
    if (!fullName.trim()) { toast.error('Name cannot be empty'); return; }
    if (gstNumber.trim() && !GST_REGEX.test(gstNumber.trim().toUpperCase())) {
      setGstError('Invalid GST format — expected: 29XXXXX1234X1Z5');
      return;
    }
    setGstError('');
    setSaving(true);
    try {
      const res = await fetch('/api/buyer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          company_name: companyName.trim(),
          company_type: companyType,
          gst_number: gstNumber.trim().toUpperCase() || null,
        }),
      });
      const json = await res.json() as { error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveAddresses(updated: SavedAddress[]) {
    setAddresses(updated);
    await fetch('/api/buyer/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saved_addresses: updated }),
    });
  }

  function openNewAddress() {
    setEditingAddress(null);
    setAddrForm({ label: '', contact_name: '', contact_phone: '', line1: '', line2: '', city: '', state: '', pincode: '' });
    setShowAddressForm(true);
  }

  function openEditAddress(addr: SavedAddress) {
    setEditingAddress(addr);
    setAddrForm({ label: addr.label, contact_name: addr.contact_name, contact_phone: addr.contact_phone, line1: addr.line1, line2: addr.line2, city: addr.city, state: addr.state, pincode: addr.pincode });
    setShowAddressForm(true);
  }

  async function handleSaveAddress() {
    if (!addrForm.label || !addrForm.line1 || !addrForm.city || !addrForm.pincode) {
      toast.error('Fill all required address fields'); return;
    }
    if (editingAddress) {
      const updated = addresses.map((a) => a.id === editingAddress.id ? { ...editingAddress, ...addrForm } : a);
      await saveAddresses(updated);
      toast.success('Address updated');
    } else {
      const updated = [...addresses, { id: crypto.randomUUID(), ...addrForm, is_default: addresses.length === 0 }];
      await saveAddresses(updated);
      toast.success('Address saved');
    }
    setShowAddressForm(false);
  }

  async function handleDeleteAddress(id: string) {
    const updated = addresses.filter((a) => a.id !== id);
    await saveAddresses(updated);
    toast.success('Address removed');
  }

  async function handleSetDefault(id: string) {
    const updated = addresses.map((a) => ({ ...a, is_default: a.id === id }));
    await saveAddresses(updated);
    toast.success('Default address set');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  if (!profile) return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center text-slate-500">Failed to load profile</div>
  );

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';
  const readonlyCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>

      {/* ── Personal Info ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Personal Information</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-teal-600 text-white font-bold text-2xl flex items-center justify-center select-none">
            {fullName.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700">{fullName || 'Your Name'}</p>
            <p className="text-xs text-slate-400">{profile.email ?? 'No email set'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-slate-400">(read-only)</span></label>
            <input type="email" value={profile.email ?? ''} readOnly className={readonlyCls} />
          </div>
        </div>
      </section>

      {/* ── Business Details ──────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-5">
          <Building2 className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Business Details</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Company Name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Business Type</label>
            <select value={companyType} onChange={(e) => setCompanyType(e.target.value)} className={inputCls}>
              <option value="">Select type</option>
              {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">GST Number <span className="text-slate-400">(optional)</span></label>
            <input
              type="text"
              value={gstNumber}
              onChange={(e) => { setGstNumber(e.target.value.toUpperCase()); setGstError(''); }}
              placeholder="29XXXXX1234X1Z5"
              maxLength={15}
              className={`${inputCls} font-mono ${gstError ? 'border-rose-400' : ''}`}
            />
            {gstError && (
              <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />{gstError}
              </p>
            )}
          </div>

          {/* Read-only: client + branch */}
          {profile.client_id && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Client <span className="text-slate-400">(assigned by admin)</span></label>
              <input type="text" value={(profile as ProfileWithMeta).client_name ?? profile.client_id} readOnly className={readonlyCls} />
            </div>
          )}
          {profile.branch_id && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Branch <span className="text-slate-400">(assigned by admin)</span></label>
              <input type="text" value={(profile as ProfileWithMeta).branch_name ?? profile.branch_id} readOnly className={readonlyCls} />
            </div>
          )}
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </section>

      {/* ── Saved Addresses ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-700">Saved Addresses</h2>
          </div>
          <button
            onClick={openNewAddress}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-teal-300 text-teal-700 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />Add New
          </button>
        </div>

        {addresses.length === 0 && !showAddressForm && (
          <p className="text-sm text-slate-400 text-center py-4">No saved addresses. Add one for faster checkout!</p>
        )}

        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className={`rounded-lg border p-4 ${addr.is_default ? 'border-teal-300 bg-teal-50' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800">{addr.label}</span>
                    {addr.is_default && <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded-full">Default</span>}
                  </div>
                  <p className="text-sm text-slate-600">{addr.contact_name} · {addr.contact_phone}</p>
                  <p className="text-sm text-slate-500">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                  <p className="text-sm text-slate-500">{addr.city}, {addr.state} {addr.pincode}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!addr.is_default && (
                    <button onClick={() => handleSetDefault(addr.id)} className="text-xs text-teal-600 hover:underline px-1 py-0.5">Default</button>
                  )}
                  <button onClick={() => openEditAddress(addr)} className="text-xs text-slate-500 hover:text-slate-800 px-1 py-0.5">Edit</button>
                  <button onClick={() => handleDeleteAddress(addr.id)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Address form */}
        {showAddressForm && (
          <div className="mt-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{editingAddress ? 'Edit Address' : 'New Address'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Label (e.g. Head Office) <span className="text-rose-500">*</span></label>
                <input type="text" value={addrForm.label} onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact Name</label>
                <input type="text" value={addrForm.contact_name} onChange={(e) => setAddrForm((f) => ({ ...f, contact_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Contact Phone</label>
                <input type="tel" value={addrForm.contact_phone} onChange={(e) => setAddrForm((f) => ({ ...f, contact_phone: e.target.value }))} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 1 <span className="text-rose-500">*</span></label>
                <input type="text" value={addrForm.line1} onChange={(e) => setAddrForm((f) => ({ ...f, line1: e.target.value }))} className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Address Line 2</label>
                <input type="text" value={addrForm.line2} onChange={(e) => setAddrForm((f) => ({ ...f, line2: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">City <span className="text-rose-500">*</span></label>
                <input type="text" value={addrForm.city} onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">State</label>
                <input type="text" value={addrForm.state} onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Pincode <span className="text-rose-500">*</span></label>
                <input type="text" inputMode="numeric" maxLength={6} value={addrForm.pincode} onChange={(e) => setAddrForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '') }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={handleSaveAddress} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
                Save Address
              </button>
              <button onClick={() => setShowAddressForm(false)} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
