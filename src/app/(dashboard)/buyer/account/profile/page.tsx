'use client';

/**
 * Account > Profile Settings
 * Edit personal information: name, phone. Email is read-only.
 */

import { useEffect, useState } from 'react';
import { Loader2, Check, User } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '@/types';

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/buyer/profile');
        const json = await res.json() as { data: UserProfile | null; error: string | null };
        if (!res.ok || !json.data) throw new Error(json.error ?? 'Failed');
        setProfile(json.data);
        setFullName(json.data.full_name ?? '');
        setPhone(json.data.phone ?? '');
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
        body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() }),
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
      Could not load profile. Please refresh.
    </div>
  );

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors';
  const readonlyCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-400 cursor-not-allowed';

  return (
    <div className="space-y-5">
      {/* Avatar + identity */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-700">Personal Information</h2>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-teal-600 text-white font-bold text-2xl flex items-center justify-center select-none shrink-0">
            {fullName.charAt(0).toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">{fullName || 'Your Name'}</p>
            <p className="text-sm text-slate-400 mt-0.5">{profile.email ?? 'No email on file'}</p>
            {profile.company_name && (
              <p className="text-sm text-teal-600 mt-0.5">{profile.company_name}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Email <span className="text-slate-400 font-normal">(read-only — contact support to change)</span>
            </label>
            <input
              type="email"
              value={profile.email ?? ''}
              readOnly
              className={readonlyCls}
            />
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Member since {new Date(profile.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Security info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Security</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <p className="text-sm font-medium text-slate-700">Authentication</p>
              <p className="text-xs text-slate-400 mt-0.5">Phone OTP via Firebase</p>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-700">Business Verification</p>
              <p className="text-xs text-slate-400 mt-0.5">Verified by PrimeServe admin</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              profile.business_verified
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {profile.business_verified ? 'Verified' : 'Pending'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
