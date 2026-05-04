/**
 * GET /api/products — Public product listing API
 *
 * Returns approved + active products for the marketplace.
 * No authentication required — this is the public-facing API.
 *
 * Query params:
 *   category     - product_category enum value
 *   subcategory  - subcategory_slug string
 *   search       - full-text search on name (ILIKE)
 *   is_approved  - 'true' (default) | 'false'
 *   is_active    - 'true' (default) | 'false'
 *   stock_status - 'in_stock' | 'out_of_stock' | 'low_stock'
 *   page         - 1-indexed page number (default: 1)
 *   per_page     - results per page (default: 20, max: 100)
 *
 * Returns:
 *   { data: { products: Product[], total, page, per_page }, error }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Enums } from '@/types/database';

export const dynamic = 'force-dynamic';

/** Slim product shape returned for the marketplace grid */
export interface MarketplaceProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  size_variant: string | null;
  /** Non-null when this product belongs to a variant group */
  group_slug: string | null;
  /** Number of visible variants collapsed behind this marketplace card */
  variant_count?: number;
  base_price: number;
  unit_of_measure: string;
  moq: number;
  thumbnail_url: string | null;
  images: string[];
  category: string;
  subcategory_slug: string | null;
  stock_status: string;
  gst_rate: number;
  specifications: Record<string, string>;
  pricing_tiers: Array<{ min_qty: number; max_qty: number | null; price: number }>;
}

export interface ProductsApiResponse {
  products: MarketplaceProduct[];
  total: number;
  page: number;
  per_page: number;
}

/**
 * Returns paginated approved+active products for the public marketplace.
 * @returns Paginated product list with filter support
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);

    const category    = searchParams.get('category') ?? '';
    const subcategory = searchParams.get('subcategory') ?? '';
    const search      = searchParams.get('search') ?? '';
    const sort        = searchParams.get('sort') ?? 'relevance';
    const stockStatus = searchParams.get('stock_status') ?? '';
    const isApproved  = searchParams.get('is_approved') !== 'false'; // default true
    const isActive    = searchParams.get('is_active') !== 'false';   // default true
    const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage     = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
    const from        = (page - 1) * perPage;

    const supabase = createAdminClient();

    let query = supabase
      .from('products')
      .select(
        'id, slug, name, description, brand, size_variant, group_slug, base_price, unit_of_measure, moq, thumbnail_url, images, category, subcategory_slug, stock_status, gst_rate, specifications, pricing_tiers, created_at, total_orders'
      );

    // Always filter to approved + active + priced for the public marketplace
    if (isApproved) query = query.eq('is_approved', true);
    if (isActive)   query = query.eq('is_active', true);
    // Hide products with no price set — they're not ready for the marketplace
    query = query.gt('base_price', 0);

    // Category filter
    if (category && category !== '') {
      query = query.eq('category', category as Enums<'product_category'>);
    }

    // Subcategory filter
    if (subcategory) {
      query = query.eq('subcategory_slug', subcategory);
    }

    // Stock status filter
    if (stockStatus && stockStatus !== '') {
      query = query.eq('stock_status', stockStatus as Enums<'stock_status'>);
    }

    // Search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (sort === 'price_asc') {
      query = query.order('base_price', { ascending: true });
    } else if (sort === 'price_desc') {
      query = query.order('base_price', { ascending: false });
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('total_orders', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data: products, error } = await query.limit(5000);

    if (error) {
      console.error('[api/products GET] Supabase error:', error.message);
      return NextResponse.json(
        { data: null, error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    const rows = (products ?? []) as Array<MarketplaceProduct & {
      created_at?: string;
      total_orders?: number;
    }>;
    const variantCounts = new Map<string, number>();
    for (const product of rows) {
      const key = product.group_slug ?? product.id;
      variantCounts.set(key, (variantCounts.get(key) ?? 0) + 1);
    }

    const seenGroups = new Set<string>();
    const collapsed: MarketplaceProduct[] = [];
    for (const product of rows) {
      const key = product.group_slug ?? product.id;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);
      collapsed.push({
        ...product,
        variant_count: variantCounts.get(key) ?? 1,
      });
    }

    const pagedProducts = collapsed.slice(from, from + perPage);

    return NextResponse.json({
      data: {
        products: pagedProducts,
        total:    collapsed.length,
        page,
        per_page: perPage,
      } as ProductsApiResponse,
      error: null,
    });
  } catch (error) {
    console.error('[api/products GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
