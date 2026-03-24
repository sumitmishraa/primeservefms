/**
 * Admin — Add New Product
 *
 * Empty ProductForm that POSTs to /api/admin/products on submit.
 * Redirects to the catalog page with a success toast after saving.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductForm, { type ProductFormValues } from '@/components/admin/ProductForm';
import type { Tables } from '@/types/database';

type Product = Tables<'products'>;

export default function NewProductPage() {
  const router    = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: ProductFormValues) => {
    setSaving(true);
    try {
      const body = {
        name:              values.name,
        description:       values.description || null,
        short_description: values.short_description || null,
        category:          values.category || undefined,
        subcategory_slug:  values.subcategory_slug || null,
        brand:             values.brand || null,
        size_variant:      values.size_variant || null,
        sku:               values.sku || null,
        base_price:        parseFloat(values.base_price) || 0,
        moq:               parseInt(values.moq, 10) || 1,
        gst_rate:          parseInt(values.gst_rate, 10) || 0,
        unit_of_measure:   values.unit_of_measure,
        stock_status:      values.stock_status,
        tags:              values.tags
          ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
        pricing_tiers: values.pricing_tiers
          .filter((t) => t.min_qty && t.price)
          .map((t) => ({
            min_qty:  parseInt(t.min_qty, 10),
            max_qty:  t.max_qty ? parseInt(t.max_qty, 10) : null,
            price:    parseFloat(t.price),
          })),
      };

      const res  = await fetch('/api/admin/products', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const json = (await res.json()) as { data: Product | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to create product');

      toast.success('Product added successfully');
      router.push('/admin/products');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/products"
          className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">Add New Product</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manually add a single product to the catalog
          </p>
        </div>
      </div>

      <ProductForm
        onSubmit={(values) => void handleSubmit(values)}
        isLoading={saving}
        submitLabel="Add Product"
      />
    </div>
  );
}
