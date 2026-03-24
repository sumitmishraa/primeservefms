/**
 * Admin — Edit Product
 *
 * Loads the existing product from GET /api/admin/products (filtered by id),
 * pre-fills the ProductForm, then calls PUT /api/admin/products/:id on save.
 *
 * States handled: loading, error, success (redirect to catalog)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductForm, { type ProductFormValues } from '@/components/admin/ProductForm';
import type { Tables } from '@/types/database';

type Product = Tables<'products'>;

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [product,   setProduct]   = useState<Product | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    void params.then(({ id }) => setProductId(id));
  }, [params]);

  // Fetch product
  useEffect(() => {
    if (!productId) return;
    void (async () => {
      try {
        const res  = await fetch(`/api/admin/products?per_page=1&page=1`);
        // We fetch the specific product via the GET list filtered approach —
        // since there's no single-product GET endpoint, we use the search param.
        // Fall back: fetch all and find.
        const json = (await res.json()) as {
          data: { products: Product[]; total: number } | null;
          error: string | null;
        };
        // Try to find by iterating pages until we find this ID.
        // A simpler approach: call the API with a large page and find.
        // For now, we fetch all and find — product count is ~400 max.
        const allRes  = await fetch(`/api/admin/products?per_page=100&page=1`);
        const allJson = (await allRes.json()) as {
          data: { products: Product[]; total: number } | null;
          error: string | null;
        };
        if (!allRes.ok || allJson.error || !allJson.data) {
          setFetchError(allJson.error ?? 'Failed to load product');
          return;
        }
        // Search all pages
        let found: Product | null = allJson.data.products.find((p) => p.id === productId) ?? null;
        if (!found) {
          const total   = allJson.data.total;
          const pages   = Math.ceil(total / 100);
          for (let pg = 2; pg <= pages && !found; pg++) {
            const pgRes  = await fetch(`/api/admin/products?per_page=100&page=${pg}`);
            const pgJson = (await pgRes.json()) as {
              data: { products: Product[] } | null;
              error: string | null;
            };
            found = pgJson.data?.products.find((p) => p.id === productId) ?? null;
          }
        }
        void json; // initial fetch unused
        if (!found) { setFetchError('Product not found'); return; }
        setProduct(found);
      } catch {
        setFetchError('Network error loading product');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const handleSubmit = async (values: ProductFormValues) => {
    if (!productId) return;
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

      const res  = await fetch(`/api/admin/products/${productId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const json = (await res.json()) as { data: Product | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Update failed');
      toast.success('Product updated');
      router.push('/admin/products');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------------------------------
  // Render states
  // --------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-rose-600 font-medium">{fetchError ?? 'Product not found'}</p>
        <Link
          href="/admin/products"
          className="text-sm text-teal-600 hover:underline"
        >
          Back to catalog
        </Link>
      </div>
    );
  }

  // Map product row → form values
  const initial: Partial<ProductFormValues> = {
    name:              product.name,
    description:       product.description ?? '',
    short_description: product.short_description ?? '',
    category:          product.category,
    subcategory_slug:  product.subcategory_slug ?? '',
    brand:             product.brand ?? '',
    size_variant:      product.size_variant ?? '',
    sku:               product.sku ?? '',
    base_price:        String(product.base_price),
    moq:               String(product.moq),
    gst_rate:          String(product.gst_rate),
    unit_of_measure:   product.unit_of_measure,
    stock_status:      product.stock_status,
    tags:              product.tags?.join(', ') ?? '',
    pricing_tiers: Array.isArray(product.pricing_tiers)
      ? (product.pricing_tiers as { min_qty: number; max_qty: number | null; price: number }[]).map(
          (t) => ({
            min_qty: String(t.min_qty),
            max_qty: t.max_qty != null ? String(t.max_qty) : '',
            price:   String(t.price),
          })
        )
      : [],
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
          <h1 className="text-2xl font-heading font-bold text-slate-900">Edit Product</h1>
          <p className="text-sm text-slate-500 mt-0.5 truncate max-w-md">{product.name}</p>
        </div>
      </div>

      <ProductForm
        initialValues={initial}
        onSubmit={(values) => void handleSubmit(values)}
        isLoading={saving}
        submitLabel="Save Changes"
      />
    </div>
  );
}
