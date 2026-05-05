/**
 * ProductForm — shared form for "new product" and "edit product" pages.
 *
 * Sections: Basic Info · Product Details · Pricing · Images · Tags
 *
 * Image upload flow (edit mode only):
 *   1. Admin picks a file → POST /api/admin/products/[id]/images
 *   2. File is stored in Supabase Storage and URL appended to product.images
 *   3. First image becomes thumbnail automatically
 *   4. Admin can remove any image (DELETE /api/admin/products/[id]/images)
 *   5. Admin can promote any image to thumbnail
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Upload, X, Star, ImageOff } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesByCategory,
} from '@/lib/constants/categories';
import type { Enums } from '@/types/database';
import toast from 'react-hot-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingTierRow {
  min_qty: string;
  max_qty: string;
  price:   string;
}

export interface ProductFormValues {
  name:              string;
  description:       string;
  short_description: string;
  category:          Enums<'product_category'> | '';
  subcategory_id:    string;
  subcategory_slug:  string;
  brand:             string;
  size_variant:      string;
  sku:               string;
  base_price:        string;
  moq:               string;
  gst_rate:          string;
  unit_of_measure:   Enums<'unit_of_measure'>;
  stock_status:      Enums<'stock_status'>;
  pricing_tiers:     PricingTierRow[];
  tags:              string;
  thumbnail_url:     string;
  images:            string[];
}

interface ProductFormProps {
  /** Product ID — required to enable image upload (edit mode) */
  productId?:     string;
  initialValues?: Partial<ProductFormValues>;
  onSubmit:       (values: ProductFormValues) => void;
  isLoading:      boolean;
  submitLabel:    string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNIT_OPTIONS: { value: Enums<'unit_of_measure'>; label: string }[] = [
  { value: 'piece',   label: 'Piece (No.)' },
  { value: 'kg',      label: 'Kilogram (kg)' },
  { value: 'liter',   label: 'Litre (ltr)' },
  { value: 'pack',    label: 'Pack' },
  { value: 'box',     label: 'Box' },
  { value: 'carton',  label: 'Carton' },
  { value: 'roll',    label: 'Roll' },
  { value: 'pair',    label: 'Pair' },
  { value: 'set',     label: 'Set' },
  { value: 'ream',    label: 'Ream (paper)' },
  { value: 'pkt',     label: 'Packet (pkt)' },
  { value: 'can',     label: 'Can' },
  { value: 'bottle',  label: 'Bottle' },
  { value: 'tube',    label: 'Tube' },
];

const GST_RATES = [0, 5, 12, 18, 28];

const EMPTY_FORM: ProductFormValues = {
  name:              '',
  description:       '',
  short_description: '',
  category:          '',
  subcategory_id:    '',
  subcategory_slug:  '',
  brand:             '',
  size_variant:      '',
  sku:               '',
  base_price:        '',
  moq:               '1',
  gst_rate:          '0',
  unit_of_measure:   'piece',
  stock_status:      'in_stock',
  pricing_tiers:     [],
  tags:              '',
  thumbnail_url:     '',
  images:            [],
};

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  hint,
  children,
}: {
  label:    string;
  required?: boolean;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent';

// ---------------------------------------------------------------------------
// ImageUploader sub-component
// ---------------------------------------------------------------------------

function ImageUploader({
  productId,
  images,
  thumbnailUrl,
  onChange,
}: {
  productId:    string;
  images:       string[];
  thumbnailUrl: string;
  onChange:     (images: string[], thumbnail: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large (max 5 MB)'); return; }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) { toast.error('Only JPEG, PNG, WebP, or GIF images'); return; }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`/api/admin/products/${productId}/images`, { method: 'POST', body: form });
      const json = (await res.json()) as { data: { url: string; thumbnail: string; images: string[] } | null; error: string | null };
      if (!res.ok || json.error || !json.data) { toast.error(json.error ?? 'Upload failed'); return; }
      onChange(json.data.images, json.data.thumbnail);
      toast.success('Image uploaded');
    } catch {
      toast.error('Upload failed — check your connection');
    } finally {
      setUploading(false);
    }
  }, [productId, onChange]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => void uploadFile(f));
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleRemove = async (url: string) => {
    try {
      const res  = await fetch(`/api/admin/products/${productId}/images`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url }),
      });
      const json = (await res.json()) as { data: { images: string[]; thumbnail: string | null } | null; error: string | null };
      if (!res.ok || json.error || !json.data) { toast.error(json.error ?? 'Remove failed'); return; }
      onChange(json.data.images, json.data.thumbnail ?? '');
      toast.success('Image removed');
    } catch {
      toast.error('Remove failed');
    }
  };

  const handleSetThumbnail = async (url: string) => {
    try {
      const res  = await fetch(`/api/admin/products/${productId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ thumbnail_url: url }),
      });
      const json = (await res.json()) as { data: { thumbnail_url: string } | null; error: string | null };
      if (!res.ok || json.error) { toast.error(json.error ?? 'Failed to set thumbnail'); return; }
      onChange(images, url);
      toast.success('Thumbnail updated');
    } catch {
      toast.error('Failed to set thumbnail');
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload product image"
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragOver
            ? 'border-teal-500 bg-teal-50'
            : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-teal-600">
            <span className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            <p className="text-sm font-medium">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload className="w-8 h-8" />
            <p className="text-sm font-medium text-slate-600">
              Drop images here or <span className="text-teal-600 underline">click to browse</span>
            </p>
            <p className="text-xs">JPEG · PNG · WebP · GIF · max 5 MB each</p>
          </div>
        )}
      </div>

      {/* Image grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((url) => {
            const isThumb = url === thumbnailUrl;
            return (
              <div key={url} className={`relative group rounded-xl overflow-hidden border-2 transition-colors ${isThumb ? 'border-teal-500' : 'border-slate-200'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="Product"
                  className="w-full h-32 object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />

                {/* Thumbnail badge */}
                {isThumb && (
                  <div className="absolute top-1.5 left-1.5 bg-teal-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-white" /> Thumbnail
                  </div>
                )}

                {/* Hover actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {!isThumb && (
                    <button
                      type="button"
                      onClick={() => void handleSetThumbnail(url)}
                      title="Set as thumbnail"
                      className="p-2 bg-white rounded-full text-teal-600 hover:bg-teal-50 transition-colors"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleRemove(url)}
                    title="Remove image"
                    className="p-2 bg-white rounded-full text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-3 text-slate-400 bg-slate-50 rounded-xl p-4">
          <ImageOff className="w-5 h-5 shrink-0" />
          <p className="text-sm">No images yet — upload one above</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ProductForm({
  productId,
  initialValues = {},
  onSubmit,
  isLoading,
  submitLabel,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY_FORM,
    ...initialValues,
    pricing_tiers: initialValues.pricing_tiers ?? [],
    images:        initialValues.images        ?? [],
    thumbnail_url: initialValues.thumbnail_url ?? '',
  });

  // Reset subcategory fields when category changes
  useEffect(() => {
    setValues((v) => ({ ...v, subcategory_id: '', subcategory_slug: '' }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.category]);

  const set = (
    field: keyof ProductFormValues,
    val: string | Enums<'stock_status'> | Enums<'unit_of_measure'> | PricingTierRow[] | string[],
  ) => setValues((v) => ({ ...v, [field]: val }));

  const subcats = values.category ? getSubcategoriesByCategory(values.category) : [];

  const addTier = () =>
    setValues((v) => ({ ...v, pricing_tiers: [...v.pricing_tiers, { min_qty: '', max_qty: '', price: '' }] }));

  const removeTier = (idx: number) =>
    setValues((v) => ({ ...v, pricing_tiers: v.pricing_tiers.filter((_, i) => i !== idx) }));

  const updateTier = (idx: number, field: keyof PricingTierRow, val: string) =>
    setValues((v) => ({
      ...v,
      pricing_tiers: v.pricing_tiers.map((t, i) => i === idx ? { ...t, [field]: val } : t),
    }));

  const handleImageChange = (images: string[], thumbnail: string) =>
    setValues((v) => ({ ...v, images, thumbnail_url: thumbnail }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Basic Information ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Basic Information</h2>

        <Field label="Product Name" required>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            required
            placeholder="e.g. Heavy Duty Garbage Bag 24×30"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Category" required>
            <select
              value={values.category}
              onChange={(e) => set('category', e.target.value as Enums<'product_category'>)}
              required
              className={inputCls}
            >
              <option value="">Select category</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Subcategory">
            <select
              value={values.subcategory_slug}
              onChange={(e) => {
                const slug = e.target.value;
                setValues((v) => ({ ...v, subcategory_slug: slug, subcategory_id: '' }));
              }}
              disabled={subcats.length === 0}
              className={inputCls}
            >
              <option value="">Select subcategory</option>
              {subcats.map((s) => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Short Description" hint="One-line summary shown in product cards">
          <input
            type="text"
            value={values.short_description}
            onChange={(e) => set('short_description', e.target.value)}
            placeholder="e.g. Black garbage bags for general waste"
            className={inputCls}
          />
        </Field>

        <Field label="Description" hint="Full product description">
          <textarea
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="Detailed product description…"
            className={inputCls}
          />
        </Field>
      </section>

      {/* ── Product Details ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Product Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Brand" hint="e.g. Scotch-Brite, 3M">
            <input type="text" value={values.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Brand name" className={inputCls} />
          </Field>
          <Field label="Size / Variant" hint="e.g. 24×30 inches, 500 ml">
            <input type="text" value={values.size_variant} onChange={(e) => set('size_variant', e.target.value)} placeholder="Size or variant" className={inputCls} />
          </Field>
          <Field label="SKU" hint="Optional internal code">
            <input type="text" value={values.sku} onChange={(e) => set('sku', e.target.value)} placeholder="e.g. HK-GB-001" className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Unit of Measure">
            <select value={values.unit_of_measure} onChange={(e) => set('unit_of_measure', e.target.value as Enums<'unit_of_measure'>)} className={inputCls}>
              {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </Field>
          <Field label="Stock Status">
            <select value={values.stock_status} onChange={(e) => set('stock_status', e.target.value as Enums<'stock_status'>)} className={inputCls}>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="low_stock">Low Stock</option>
            </select>
          </Field>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Pricing</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Base Price (₹)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input type="number" min="0" step="0.01" value={values.base_price} onChange={(e) => set('base_price', e.target.value)} required placeholder="0.00" className={`${inputCls} pl-7`} />
            </div>
          </Field>
          <Field label="MOQ" hint="Minimum order quantity">
            <input type="number" min="1" step="1" value={values.moq} onChange={(e) => set('moq', e.target.value)} className={inputCls} />
          </Field>
          <Field label="GST Rate">
            <select value={values.gst_rate} onChange={(e) => set('gst_rate', e.target.value)} className={inputCls}>
              {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </Field>
        </div>

        {/* Bulk pricing tiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Bulk Pricing Tiers</p>
            <button type="button" onClick={addTier} className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Tier
            </button>
          </div>
          {values.pricing_tiers.length === 0 && (
            <p className="text-xs text-slate-400">No bulk pricing configured. Standard price applies to all quantities.</p>
          )}
          {values.pricing_tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="number" placeholder="Min Qty" value={tier.min_qty} onChange={(e) => updateTier(idx, 'min_qty', e.target.value)} className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              <span className="text-slate-400 text-xs">—</span>
              <input type="number" placeholder="Max Qty" value={tier.max_qty} onChange={(e) => updateTier(idx, 'max_qty', e.target.value)} className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                <input type="number" placeholder="Price" value={tier.price} onChange={(e) => updateTier(idx, 'price', e.target.value)} className="w-full pl-6 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500" />
              </div>
              <span className="text-xs text-slate-400">per unit</span>
              <button type="button" onClick={() => removeTier(idx)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product Images ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Product Images</h2>
          {values.images.length > 0 && (
            <span className="text-xs text-slate-400">{values.images.length} image{values.images.length !== 1 ? 's' : ''} · hover to manage</span>
          )}
        </div>

        {productId ? (
          <ImageUploader
            productId={productId}
            images={values.images}
            thumbnailUrl={values.thumbnail_url}
            onChange={handleImageChange}
          />
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
            <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">Save the product first, then add images</p>
            <p className="text-xs mt-1">You&apos;ll be redirected to the edit page after saving</p>
          </div>
        )}
      </section>

      {/* ── Tags ── */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <Field label="Tags" hint="Comma-separated — e.g. cleaning, floor, mop">
          <input type="text" value={values.tags} onChange={(e) => set('tags', e.target.value)} placeholder="tag1, tag2, tag3" className={inputCls} />
        </Field>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {isLoading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
