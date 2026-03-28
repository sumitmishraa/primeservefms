/**
 * AddBranchModal — form modal for adding a new branch to a client.
 *
 * POSTs to /api/admin/clients/[clientId]/branches on submit.
 * Calls onSuccess with the new branch data on completion.
 *
 * Usage:
 *   <AddBranchModal
 *     clientId="abc-123"
 *     isOpen={open}
 *     onClose={() => setOpen(false)}
 *     onSuccess={(branch) => refreshBranches()}
 *   />
 */

'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, GitBranch } from 'lucide-react';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AddBranchModalProps {
  /** The client this branch belongs to */
  clientId: string;
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called to close the modal (without saving) */
  onClose: () => void;
  /** Called with the newly created branch after a successful save */
  onSuccess: (branch: { id: string; name: string }) => void;
}

interface BranchFormData {
  name: string;
  branch_code: string;
  area: string;
  address: string;
  pincode: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  notes: string;
}

interface FieldErrors {
  name?: string;
  area?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Modal dialog for adding a branch to an existing client.
 * Closes on Escape key or backdrop click.
 */
export default function AddBranchModal({
  clientId,
  isOpen,
  onClose,
  onSuccess,
}: AddBranchModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<BranchFormData>({
    name: '',
    branch_code: '',
    area: '',
    address: '',
    pincode: '',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    notes: '',
  });

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        name: '',
        branch_code: '',
        area: '',
        address: '',
        pincode: '',
        contact_person: '',
        contact_phone: '',
        contact_email: '',
        notes: '',
      });
      setFieldErrors({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /** Update a single form field. */
  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  /** Validates required fields. Returns error object — empty means valid. */
  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!form.name.trim()) errors.name = 'Branch name is required';
    if (!form.area.trim()) errors.area = 'Area is required';
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
      const res = await fetch(`/api/admin/clients/${clientId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          branch_code: form.branch_code.trim() || null,
          area: form.area.trim(),
          address: form.address.trim() || null,
          pincode: form.pincode.trim() || null,
          contact_person: form.contact_person.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          contact_email: form.contact_email.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });

      const json = (await res.json()) as {
        data: { id: string; name: string } | null;
        error: string | null;
      };

      if (!res.ok || json.error || !json.data) {
        toast.error(json.error ?? 'Failed to add branch');
        return;
      }

      toast.success(`Branch "${form.name}" added`);
      onSuccess(json.data);
      onClose();
    } catch {
      toast.error('Network error — please try again');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="add-branch-title"
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-lg rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100">
              <GitBranch className="h-4 w-4 text-teal-600" />
            </div>
            <h2 id="add-branch-title" className="font-heading text-base font-semibold text-slate-900">
              Add Branch
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="max-h-[65vh] overflow-y-auto px-6 py-5 space-y-4">

            {/* Branch Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="branch-name">
                Branch Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="branch-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Koramangala Branch"
                className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  fieldErrors.name ? 'border-rose-400' : 'border-slate-300'
                }`}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-rose-500">{fieldErrors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Branch Code */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="branch-code">
                  Branch Code
                </label>
                <input
                  id="branch-code"
                  name="branch_code"
                  type="text"
                  value={form.branch_code}
                  onChange={handleChange}
                  placeholder="e.g. BLK-KRM-01"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Area */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="branch-area">
                  Area <span className="text-rose-500">*</span>
                </label>
                <input
                  id="branch-area"
                  name="area"
                  type="text"
                  value={form.area}
                  onChange={handleChange}
                  placeholder="e.g. Koramangala"
                  className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                    fieldErrors.area ? 'border-rose-400' : 'border-slate-300'
                  }`}
                />
                {fieldErrors.area && (
                  <p className="mt-1 text-xs text-rose-500">{fieldErrors.area}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="branch-address">
                Address
              </label>
              <input
                id="branch-address"
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                placeholder="Building, street, locality"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Pincode */}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="branch-pincode">
                Pincode
              </label>
              <input
                id="branch-pincode"
                name="pincode"
                type="text"
                value={form.pincode}
                onChange={handleChange}
                placeholder="560001"
                maxLength={6}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Contact Person */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="branch-contact-person">
                  Contact Person
                </label>
                <input
                  id="branch-contact-person"
                  name="contact_person"
                  type="text"
                  value={form.contact_person}
                  onChange={handleChange}
                  placeholder="Manager name"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700" htmlFor="branch-contact-phone">
                  Contact Phone
                </label>
                <input
                  id="branch-contact-phone"
                  name="contact_phone"
                  type="tel"
                  value={form.contact_phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="branch-contact-email">
                Contact Email
              </label>
              <input
                id="branch-contact-email"
                name="contact_email"
                type="email"
                value={form.contact_email}
                onChange={handleChange}
                placeholder="branch@company.com"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700" htmlFor="branch-notes">
                Notes
              </label>
              <textarea
                id="branch-notes"
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={2}
                placeholder="Any internal notes about this branch..."
                className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex min-w-[110px] items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60 transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Add Branch'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
