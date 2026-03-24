'use client';

/**
 * ConfirmDialog — a reusable modal for confirming irreversible or important actions.
 *
 * Usage:
 *   <ConfirmDialog
 *     open={open}
 *     title="Approve Order?"
 *     message="This will approve the order and notify the buyer."
 *     confirmLabel="Approve"
 *     onConfirm={handleApprove}
 *     onCancel={() => setOpen(false)}
 *   />
 *
 * Destructive variant (red confirm button):
 *   <ConfirmDialog variant="destructive" confirmLabel="Cancel Order" ... />
 */

import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

interface ConfirmDialogProps {
  /** Whether the dialog is visible */
  open: boolean;
  /** Title shown at the top of the dialog */
  title: string;
  /** Body message below the title */
  message: string;
  /** Label on the confirm button (default: "Confirm") */
  confirmLabel?: string;
  /** Label on the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** 'default' shows teal confirm; 'destructive' shows red confirm */
  variant?: 'default' | 'destructive';
  /** Called when the user clicks the confirm button */
  onConfirm: () => void;
  /** Called when the user clicks the cancel button or the backdrop */
  onCancel: () => void;
  /** When true, the confirm button shows a loading spinner and is disabled */
  loading?: boolean;
}

/**
 * Modal confirmation dialog.
 * Traps focus, closes on Escape key, and blocks body scroll while open.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'default',
  onConfirm,
  onCancel,
  loading      = false,
}: ConfirmDialogProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const isDestructive = variant === 'destructive';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Dialog panel */}
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-3">
            {isDestructive ? (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
            ) : (
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100">
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
              </div>
            )}
            <div>
              <h2
                id="confirm-dialog-title"
                className="font-heading text-base font-semibold text-slate-900"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{message}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="ml-4 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              'flex min-w-[90px] items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60',
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-teal-600 hover:bg-teal-700',
            ].join(' ')}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12" cy="12" r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Working…
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
