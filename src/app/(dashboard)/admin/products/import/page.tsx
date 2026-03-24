/**
 * Admin — Import Products from Excel
 *
 * Lets the admin drag-and-drop (or browse for) a .xlsx catalog file and
 * upload it to POST /api/admin/products/import.
 *
 * States handled:
 *   idle     → file picker + instructions card
 *   selected → shows chosen file name + size + Import button
 *   loading  → progress indicator while uploading
 *   success  → summary card (imported / skipped / errors)
 *   error    → top-level error message (network / auth)
 */

'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportResult {
  imported: number;
  skipped:  number;
  errors:   { row: number; reason: string }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a file size in bytes into a human-readable string (KB / MB).
 *
 * @param bytes - File size in bytes
 * @returns Formatted string like "2.4 MB"
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ImportProductsPage() {
  const [dragOver,  setDragOver]  = useState(false);
  const [file,      setFile]      = useState<File | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [apiError,  setApiError]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ------ File selection helpers ------------------------------------------

  const handleFile = useCallback((chosen: File | null) => {
    if (!chosen) return;
    if (!chosen.name.endsWith('.xlsx')) {
      toast.error('Only .xlsx files are supported');
      return;
    }
    if (chosen.size > 10 * 1024 * 1024) {
      toast.error('File is too large (max 10 MB)');
      return;
    }
    setFile(chosen);
    setResult(null);
    setApiError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0] ?? null);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setApiError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  // ------ Upload ----------------------------------------------------------

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setApiError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        body:   form,
      });

      const json = (await res.json()) as {
        data: ImportResult | null;
        error: string | null;
      };

      if (!res.ok || json.error) {
        setApiError(json.error ?? 'Import failed');
        return;
      }

      setResult(json.data!);
      toast.success(`Imported ${json.data!.imported} products`);
    } catch {
      setApiError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  };

  // ------ Render ----------------------------------------------------------

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900">
          Import Products from Excel
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Bulk-add your product catalog by uploading the PrimeServe Excel file.
        </p>
      </div>

      {/* Instructions card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
        <p className="font-semibold">Before you upload, make sure your file has:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700">
          <li><strong>Housekeeping sheet</strong> — headers at row 5: SL.No | Item Descriptions | Size/Brand | Units | Category | Sub-category</li>
          <li><strong>Stationery sheet</strong> — headers at row 4: SL.No | Item Descriptions | Size/Brand | Qty | Category | Sub-category</li>
          <li>Section headers (non-product rows) are automatically skipped</li>
          <li>Prices will be set to ₹0 — you can update them in the catalog after import</li>
        </ul>
        <p className="text-blue-600 mt-2">
          Download a sample template:{' '}
          <span className="underline cursor-not-allowed opacity-60">
            Coming soon
          </span>
        </p>
      </div>

      {/* Drop zone */}
      {!result && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload Excel file"
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
            ${dragOver
              ? 'border-teal-500 bg-teal-50'
              : file
              ? 'border-teal-400 bg-teal-50/50'
              : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
            }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !file && inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx"
            className="sr-only"
            onChange={onInputChange}
          />

          {file ? (
            /* File selected state */
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-teal-600 shrink-0" />
                <div className="text-left">
                  <p className="font-medium text-slate-900 truncate max-w-xs">{file.name}</p>
                  <p className="text-sm text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="p-1 rounded-full hover:bg-slate-200 transition-colors"
                aria-label="Remove file"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          ) : (
            /* Empty drop zone */
            <div className="space-y-3">
              <Upload className="w-10 h-10 text-slate-400 mx-auto" />
              <div>
                <p className="text-slate-700 font-medium">
                  Drop your .xlsx file here or{' '}
                  <span className="text-teal-600 underline">click to browse</span>
                </p>
                <p className="text-sm text-slate-400 mt-1">Excel files only · max 10 MB</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top-level API error */}
      {apiError && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">{apiError}</p>
        </div>
      )}

      {/* Import button */}
      {file && !result && (
        <button
          type="button"
          disabled={loading}
          onClick={handleImport}
          className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {loading ? (
            <>
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Importing... Processing sheets
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              Import Products
            </>
          )}
        </button>
      )}

      {/* Success result card */}
      {result && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-lg font-semibold font-heading">Import Complete</h2>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-700 font-mono">{result.imported}</p>
                <p className="text-sm text-emerald-600 mt-1">Products imported</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600 font-mono">{result.skipped}</p>
                <p className="text-sm text-amber-600 mt-1">Duplicates skipped</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-bold font-mono ${result.errors.length > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {result.errors.length}
                </p>
                <p className="text-sm text-slate-500 mt-1">Row errors</p>
              </div>
            </div>
          </div>

          {/* Per-row error table */}
          {result.errors.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-20">Row</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Error Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.errors.map((err, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-mono text-slate-500">{err.row || '—'}</td>
                      <td className="px-4 py-3 text-rose-700">{err.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CTA buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin/products"
              className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
            >
              View Catalog <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={clearFile}
              className="py-2.5 px-5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
