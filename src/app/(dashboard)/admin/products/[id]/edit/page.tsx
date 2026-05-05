'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Unlink, RefreshCw, Images } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductForm, { type ProductFormValues } from '@/components/admin/ProductForm';
import { formatINR } from '@/lib/utils/formatting';
import type { Tables } from '@/types/database';

type Product = Tables<'products'>;

// ---------------------------------------------------------------------------
// Variant Group Panel — shows all siblings and lets admin fix groupings
// ---------------------------------------------------------------------------

function VariantGroupPanel({
  currentProductId,
  groupSlug,
}: {
  currentProductId: string;
  groupSlug:        string | null;
}) {
  const [siblings,      setSiblings]      = useState<Product[]>([]);
  const [loadingList,   setLoadingList]   = useState(false);
  const [removing,      setRemoving]      = useState<string | null>(null);
  const [applyingImage, setApplyingImage] = useState(false);

  const fetchSiblings = useCallback(async (slug: string) => {
    setLoadingList(true);
    try {
      const res  = await fetch(`/api/admin/products?group_slug=${encodeURIComponent(slug)}&per_page=50`);
      const json = (await res.json()) as { data: { products: Product[] } | null; error: string | null };
      setSiblings(json.data?.products ?? []);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (groupSlug) void fetchSiblings(groupSlug);
    else setSiblings([]);
  }, [groupSlug, fetchSiblings]);

  const removeFromGroup = async (productId: string) => {
    setRemoving(productId);
    try {
      const res  = await fetch(`/api/admin/products/${productId}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ group_slug: null, size_variant: null }),
      });
      const json = (await res.json()) as { error: string | null };
      if (!res.ok || json.error) { toast.error(json.error ?? 'Failed to remove'); return; }
      toast.success('Removed from variant group');
      setSiblings((prev) => prev.filter((p) => p.id !== productId));
    } finally {
      setRemoving(null);
    }
  };

  // Fetch fresh data for this product and copy its image to all siblings
  const applyImageToAll = async () => {
    if (!groupSlug) return;
    setApplyingImage(true);
    try {
      const res  = await fetch(`/api/admin/products?group_slug=${encodeURIComponent(groupSlug)}&per_page=50`);
      const json = (await res.json()) as { data: { products: Product[] } | null; error: string | null };
      const all  = json.data?.products ?? [];
      const source = all.find((p) => p.id === currentProductId);
      if (!source?.thumbnail_url) {
        toast.error('Upload an image for this product first, then apply to all variants.');
        return;
      }
      const targets = all.filter((p) => p.id !== currentProductId);
      await Promise.all(
        targets.map((t) =>
          fetch(`/api/admin/products/${t.id}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ thumbnail_url: source.thumbnail_url, images: source.images }),
          })
        )
      );
      toast.success(`Image applied to all ${targets.length} other variant${targets.length !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Failed to apply image');
    } finally {
      setApplyingImage(false);
    }
  };

  if (!groupSlug) return null;
  if (loadingList) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-3 text-slate-400">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading variant group…</span>
      </div>
    );
  }
  if (siblings.length <= 1) return null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Variant Group Members</h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-400 break-all">{groupSlug}</p>
        </div>
        <button
          type="button"
          disabled={applyingImage}
          onClick={() => void applyImageToAll()}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50"
          title="Copy this product's image to every other variant in the group"
        >
          {applyingImage
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : <Images className="w-3.5 h-3.5" />
          }
          Apply image to all variants
        </button>
      </div>

      <p className="text-xs text-slate-500">
        All products below share this Group ID and appear together as one marketplace card.
        Use <strong>Remove</strong> to unlink a product that doesn&apos;t belong here —
        it will become a standalone listing.
        To fix a wrong label or price, click <strong>Edit</strong>.
        Upload an image on this product first, then click <strong>Apply image to all variants</strong>
        to copy it to every variant automatically.
      </p>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
        {siblings
          .sort((a, b) => Number(a.base_price) - Number(b.base_price))
          .map((sibling) => {
            const isCurrent = sibling.id === currentProductId;
            return (
              <div
                key={sibling.id}
                className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? 'bg-teal-50' : 'bg-white'}`}
              >
                {/* Variant label */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {sibling.size_variant || sibling.short_description || sibling.name}
                    {isCurrent && (
                      <span className="ml-2 inline-block rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                        editing now
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{sibling.name}</p>
                </div>

                {/* Price */}
                <span className="font-mono text-sm font-bold text-slate-700 shrink-0">
                  {formatINR(Number(sibling.base_price))}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/admin/products/${sibling.id}/edit`}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Edit <ExternalLink className="w-3 h-3" />
                  </Link>
                  {!isCurrent && (
                    <button
                      type="button"
                      disabled={removing === sibling.id}
                      onClick={() => void removeFromGroup(sibling.id)}
                      className="flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      {removing === sibling.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Unlink className="w-3 h-3" />
                      )}
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main edit page
// ---------------------------------------------------------------------------

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [product,    setProduct]    = useState<Product | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [productId,  setProductId]  = useState<string | null>(null);
  const [liveGroupSlug, setLiveGroupSlug] = useState<string | null>(null);

  // Resolve params
  useEffect(() => {
    void params.then(({ id }) => setProductId(id));
  }, [params]);

  // Fetch product
  useEffect(() => {
    if (!productId) return;
    void (async () => {
      try {
        // Fetch all products across pages to find by ID (≤400 products total)
        const allRes  = await fetch(`/api/admin/products?per_page=100&page=1`);
        const allJson = (await allRes.json()) as {
          data: { products: Product[]; total: number } | null;
          error: string | null;
        };
        if (!allRes.ok || allJson.error || !allJson.data) {
          setFetchError(allJson.error ?? 'Failed to load product');
          return;
        }
        let found: Product | null = allJson.data.products.find((p) => p.id === productId) ?? null;
        if (!found) {
          const pages = Math.ceil(allJson.data.total / 100);
          for (let pg = 2; pg <= pages && !found; pg++) {
            const pgRes  = await fetch(`/api/admin/products?per_page=100&page=${pg}`);
            const pgJson = (await pgRes.json()) as { data: { products: Product[] } | null; error: string | null };
            found = pgJson.data?.products.find((p) => p.id === productId) ?? null;
          }
        }
        if (!found) { setFetchError('Product not found'); return; }
        setProduct(found);
        setLiveGroupSlug(found.group_slug ?? null);
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
      const newGroupSlug = values.group_slug.trim() || null;
      const body = {
        name:              values.name,
        description:       values.description || null,
        short_description: values.short_description || null,
        category:          values.category || undefined,
        subcategory_slug:  values.subcategory_slug || null,
        brand:             values.brand || null,
        size_variant:      values.size_variant || null,
        group_slug:        newGroupSlug,
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
            min_qty: parseInt(t.min_qty, 10),
            max_qty: t.max_qty ? parseInt(t.max_qty, 10) : null,
            price:   parseFloat(t.price),
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
      setLiveGroupSlug(newGroupSlug);
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
        <Link href="/admin/products" className="text-sm text-teal-600 hover:underline">
          Back to catalog
        </Link>
      </div>
    );
  }

  const initial: Partial<ProductFormValues> = {
    name:              product.name,
    description:       product.description ?? '',
    short_description: product.short_description ?? '',
    category:          product.category,
    subcategory_slug:  product.subcategory_slug ?? '',
    brand:             product.brand ?? '',
    size_variant:      product.size_variant ?? '',
    group_slug:        product.group_slug ?? '',
    sku:               product.sku ?? '',
    base_price:        String(product.base_price),
    moq:               String(product.moq),
    gst_rate:          String(product.gst_rate),
    unit_of_measure:   product.unit_of_measure,
    stock_status:      product.stock_status,
    tags:              product.tags?.join(', ') ?? '',
    thumbnail_url:     product.thumbnail_url ?? '',
    images:            Array.isArray(product.images) ? product.images as string[] : [],
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
        productId={productId!}
        initialValues={initial}
        onSubmit={(values) => void handleSubmit(values)}
        isLoading={saving}
        submitLabel="Save Changes"
      />

      {/* Variant group members panel — shown below the form when in a group */}
      <VariantGroupPanel
        currentProductId={productId!}
        groupSlug={liveGroupSlug}
      />
    </div>
  );
}
