/**
 * Admin — Add New Client
 *
 * Form for creating a new client company.
 * POSTs to /api/admin/clients.
 * On success, redirects to /admin/clients/[newId].
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRY_OPTIONS = [
  'Hotel',
  'Restaurant',
  'Corporate Office',
  'Hospital',
  'Warehouse',
  'Cloud Kitchen',
  'Co-working Space',
  'Other',
] as const;

// ---------------------------------------------------------------------------
// Form shape
// ---------------------------------------------------------------------------

interface ClientFormData {
  name: string;
  display_name: string;
  industry: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  gst_number: string;
  notes: string;
}

interface FieldErrors {
  name?: string;
  display_name?: string;
  contact_email?: string;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

/**
 * New client form page.
 * Validates required fields inline, submits via fetch, and redirects on success.
 */
export default function NewClientPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [form, setForm] = useState<ClientFormData>({
    name: '',
    display_name: '',
    industry: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    city: 'Bangalore',
    gst_number: '',
    notes: '',
  });

  // Auto-fill display_name from name if it hasn't been manually edited
  const [displayNameTouched, setDisplayNameTouched] = useState(false);

  /** Update a single form field. Auto-syncs display_name from name if untouched. */
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-fill display_name from name if the user hasn't manually set it
      if (name === 'name' && !displayNameTouched) {
        next.display_name = value;
      }
      return next;
    });
    // Clear field-level error on change
    if (name in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  /** Validates the form and returns an errors object. Empty = valid. */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = 'Company name is required';
    if (!form.display_name.trim()) errors.display_name = 'Display name is required';
    if (form.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      errors.contact_email = 'Enter a valid email address';
    }
    return errors;
  }

  /** Submits the form to the API. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          display_name: form.display_name.trim(),
          industry: form.industry || null,
          contact_person: form.contact_person.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          address: form.address.trim() || null,
          city: form.city.trim() || 'Bangalore',
          gst_number: form.gst_number.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      const json = (await res.json()) as { data: { id: string } | null; error: string | null };

      if (!res.ok || json.error || !json.data) {
        toast.error(json.error ?? 'Failed to create client');
        return;
      }

      toast.success(`Client "${form.display_name}" created`);
      router.push(`/admin/clients/${json.data.id}`);
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Clients
          </Link>
          <h1 className="mt-3 font-heading text-2xl font-bold text-slate-900">Add Client</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a new client company to track orders and branches.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">

            {/* Section: Company Info */}
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Company Information</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2">

              {/* Company Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="name">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Blinkit India Pvt Ltd"
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    fieldErrors.name ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-rose-500">{fieldErrors.name}</p>
                )}
              </div>

              {/* Display Name */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="display_name">
                  Display Name <span className="text-rose-500">*</span>
                  <span className="ml-1 text-xs font-normal text-slate-400">(shown on cards and orders)</span>
                </label>
                <input
                  id="display_name"
                  name="display_name"
                  type="text"
                  value={form.display_name}
                  onChange={(e) => {
                    setDisplayNameTouched(true);
                    handleChange(e);
                  }}
                  placeholder="e.g. Blinkit"
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    fieldErrors.display_name ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.display_name && (
                  <p className="mt-1 text-xs text-rose-500">{fieldErrors.display_name}</p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="industry">
                  Industry
                </label>
                <select
                  id="industry"
                  name="industry"
                  value={form.industry}
                  onChange={handleChange}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select industry...</option>
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="city">
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Bangalore"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* GST Number */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="gst_number">
                  GST Number
                </label>
                <input
                  id="gst_number"
                  name="gst_number"
                  type="text"
                  value={form.gst_number}
                  onChange={handleChange}
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Section: Contact */}
            <div className="border-b border-slate-100 border-t px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Contact Person</h2>
            </div>
            <div className="grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2">

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700" htmlFor="contact_person">
                  Contact Person Name
                </label>
                <input
                  id="contact_person"
                  name="contact_person"
                  type="text"
                  value={form.contact_person}
                  onChange={handleChange}
                  placeholder="e.g. Ramesh Kumar"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="contact_email">
                  Contact Email
                </label>
                <input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={handleChange}
                  placeholder="ops@company.com"
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    fieldErrors.contact_email ? 'border-rose-400 focus:ring-rose-400' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.contact_email && (
                  <p className="mt-1 text-xs text-rose-500">{fieldErrors.contact_email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="contact_phone">
                  Contact Phone
                </label>
                <input
                  id="contact_phone"
                  name="contact_phone"
                  type="tel"
                  value={form.contact_phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Section: Address & Notes */}
            <div className="border-b border-slate-100 border-t px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-700">Address &amp; Notes</h2>
            </div>
            <div className="space-y-5 px-6 py-5">

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="address">
                  Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Building, street, locality"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="notes">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Any internal notes about this client..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <Link
                href="/admin/clients"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Client
                  </>
                )}
              </button>
            </div>

          </div>
        </form>

      </div>
    </div>
  );
}
