/**
 * ProductForm — shared form used by both the "new product" and "edit product" pages.
 *
 * Covers:
 *   - Name, description, short_description
 *   - Category + subcategory dropdowns (subcategory resets when category changes)
 *   - Brand, size_variant, SKU
 *   - Price (₹), MOQ, GST rate
 *   - Unit of measure dropdown
 *   - Stock status toggle
 *   - Bulk pricing tiers (add / remove rows)
 *   - Tags (comma-separated free text)
 *   - Images placeholder section
 *
 * Props:
 *   initialValues — populated when editing an existing product
 *   onSubmit      — called with the form data on Save
 *   isLoading     — shows spinner on the submit button
 *   submitLabel   — "Add Product" or "Save Changes"
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesByCategory,
} from '@/lib/constants/categories';
import type { Enums } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PricingTierRow {
  min_qty:  string;
  max_qty:  string;
  price:    string;
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
}

interface ProductFormProps {
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
  label: string;
  required?: boolean;
  hint?: string;
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
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a product form and calls onSubmit with the current values.
 * Handles all field state internally.
 */
export default function ProductForm({
  initialValues = {},
  onSubmit,
  isLoading,
  submitLabel,
}: ProductFormProps) {
  const [values, setValues] = useState<ProductFormValues>({
    ...EMPTY_FORM,
    ...initialValues,
    pricing_tiers: initialValues.pricing_tiers ?? [],
  });

  // Reset subcategory fields when category changes
  useEffect(() => {
    setValues((v) => ({ ...v, subcategory_id: '', subcategory_slug: '' }));
  }, [values.category]);

  const set = (field: keyof ProductFormValues, val: string | Enums<'stock_status'> | Enums<'unit_of_measure'> | PricingTierRow[]) =>
    setValues((v) => ({ ...v, [field]: val }));

  // Subcategory options
  const subcats = values.category ? getSubcategoriesByCategory(values.category) : [];

  // Pricing tier helpers
  const addTier = () =>
    setValues((v) => ({
      ...v,
      pricing_tiers: [...v.pricing_tiers, { min_qty: '', max_qty: '', price: '' }],
    }));

  const removeTier = (idx: number) =>
    setValues((v) => ({
      ...v,
      pricing_tiers: v.pricing_tiers.filter((_, i) => i !== idx),
    }));

  const updateTier = (idx: number, field: keyof PricingTierRow, val: string) =>
    setValues((v) => ({
      ...v,
      pricing_tiers: v.pricing_tiers.map((t, i) =>
        i === idx ? { ...t, [field]: val } : t
      ),
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* Section: Basic Info */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Basic Information</h2>

        <Field label="Product Name" required>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            required
            placeholder="e.g. Heavy Duty Garbage Bag 24x30"
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
                const match = subcats.find((s) => s.slug === slug);
                setValues((v) => ({
                  ...v,
                  subcategory_slug: slug,
                  subcategory_id:   '',  // ID resolved server-side on save
                }));
                void match; // match used only for slug reference
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
            placeholder="Detailed product description..."
            className={inputCls}
          />
        </Field>
      </section>

      {/* Section: Product Details */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Product Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Brand" hint="e.g. Scotch-Brite, 3M">
            <input
              type="text"
              value={values.brand}
              onChange={(e) => set('brand', e.target.value)}
              placeholder="Brand name"
              className={inputCls}
            />
          </Field>

          <Field label="Size / Variant" hint="e.g. 24x30 inches, 500ml">
            <input
              type="text"
              value={values.size_variant}
              onChange={(e) => set('size_variant', e.target.value)}
              placeholder="Size or variant"
              className={inputCls}
            />
          </Field>

          <Field label="SKU" hint="Optional internal code">
            <input
              type="text"
              value={values.sku}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="e.g. HK-GB-001"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Unit of Measure">
            <select
              value={values.unit_of_measure}
              onChange={(e) => set('unit_of_measure', e.target.value as Enums<'unit_of_measure'>)}
              className={inputCls}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Stock Status">
            <select
              value={values.stock_status}
              onChange={(e) => set('stock_status', e.target.value as Enums<'stock_status'>)}
              className={inputCls}
            >
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="low_stock">Low Stock</option>
            </select>
          </Field>
        </div>
      </section>

      {/* Section: Pricing */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-base font-semibold text-slate-800">Pricing</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Base Price (₹)" required>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.base_price}
                onChange={(e) => set('base_price', e.target.value)}
                required
                placeholder="0.00"
                className={`${inputCls} pl-7`}
              />
            </div>
          </Field>

          <Field label="MOQ" hint="Minimum order quantity">
            <input
              type="number"
              min="1"
              step="1"
              value={values.moq}
              onChange={(e) => set('moq', e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="GST Rate">
            <select
              value={values.gst_rate}
              onChange={(e) => set('gst_rate', e.target.value)}
              className={inputCls}
            >
              {GST_RATES.map((r) => (
                <option key={r} value={r}>{r}%</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Bulk pricing tiers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Bulk Pricing Tiers</p>
            <button
              type="button"
              onClick={addTier}
              className="flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Tier
            </button>
          </div>
          {values.pricing_tiers.length === 0 && (
            <p className="text-xs text-slate-400">No bulk pricing configured. Standard price applies to all quantities.</p>
          )}
          {values.pricing_tiers.map((tier, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min Qty"
                value={tier.min_qty}
                onChange={(e) => updateTier(idx, 'min_qty', e.target.value)}
                className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <span className="text-slate-400 text-xs">—</span>
              <input
                type="number"
                placeholder="Max Qty"
                value={tier.max_qty}
                onChange={(e) => updateTier(idx, 'max_qty', e.target.value)}
                className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <div className="relative w-32">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">₹</span>
                <input
                  type="number"
                  placeholder="Price"
                  value={tier.price}
                  onChange={(e) => updateTier(idx, 'price', e.target.value)}
                  className="w-full pl-6 border border-slate-300 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <span className="text-xs text-slate-400">per unit</span>
              <button
                type="button"
                onClick={() => removeTier(idx)}
                className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Section: Images placeholder */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="text-base font-semibold text-slate-800">Product Images</h2>
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400">
          <p className="text-sm">Image upload coming soon</p>
          <p className="text-xs mt-1">Images can be managed after product is saved</p>
        </div>
      </section>

      {/* Section: Tags */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <Field
          label="Tags"
          hint="Comma-separated — e.g. cleaning, floor, mop"
        >
          <input
            type="text"
            value={values.tags}
            onChange={(e) => set('tags', e.target.value)}
            placeholder="tag1, tag2, tag3"
            className={inputCls}
          />
        </Field>
      </section>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {isLoading && (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
