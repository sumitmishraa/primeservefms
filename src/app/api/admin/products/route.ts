/**
 * Admin product management API — /api/admin/products
 *
 * GET  — List all products (admin sees everything, including inactive).
 *         Supports query params: category, subcategory, search, page, per_page
 *         Returns paginated results with total count.
 *
 * POST — Create a single product manually.
 *         Validates required fields: name, category, base_price.
 *         Auto-generates slug. Sets uploaded_by and is_approved = true.
 *
 * Admin-only — both methods return 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Enums } from '@/types/database';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a product name to a URL-safe slug.
 * Appends a 4-char random suffix to prevent collisions.
 *
 * @param name - Product name
 * @returns Hyphenated lowercase slug with random suffix
 */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// GET — List all products
// ---------------------------------------------------------------------------

/**
 * Returns paginated product list. Admin sees all products (active + inactive).
 * Supports filters: category, subcategory, search, page, per_page.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { data: null, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    if (user.role !== 'admin') {
      return NextResponse.json(
        { data: null, error: 'Forbidden — admin access only' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category        = searchParams.get('category') ?? '';
    const subcategory     = searchParams.get('subcategory') ?? '';
    const search          = searchParams.get('search') ?? '';
    const stockFilter     = searchParams.get('stock') ?? '';
    const groupSlug       = searchParams.get('group_slug') ?? '';
    // By default, hide soft-deleted (is_active=false) rows from the admin
    // catalog so the trash-icon button visibly removes them. Pass
    // ?include_inactive=true to see deactivated rows too (e.g. to restore them).
    const includeInactive = searchParams.get('include_inactive') === 'true';
    const page            = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage         = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '25', 10)));
    const from            = (page - 1) * perPage;
    const to              = from + perPage - 1;

    const supabase = createAdminClient();

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    if (category) {
      query = query.eq('category', category as Enums<'product_category'>);
    }
    if (subcategory) {
      query = query.eq('subcategory_slug', subcategory);
    }
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (stockFilter === 'in_stock') {
      query = query.eq('stock_status', 'in_stock');
    } else if (stockFilter === 'out_of_stock') {
      query = query.eq('stock_status', 'out_of_stock');
    }
    if (groupSlug) {
      query = query.eq('group_slug', groupSlug);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[api/admin/products GET] Supabase error:', error.message);
      return NextResponse.json(
        { data: null, error: 'Failed to fetch products' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: {
        products: data ?? [],
        total:    count ?? 0,
        page,
        per_page: perPage,
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/admin/products GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — Create single product
// ---------------------------------------------------------------------------

/**
 * Creates a single product. Admin-only.
 * Required fields: name, category, base_price.
 * Sets uploaded_by = admin user id, is_approved = true, is_active = true.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { data: null, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    if (user.role !== 'admin') {
      return NextResponse.json(
        { data: null, error: 'Forbidden — admin access only' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { data: null, error: 'Product name is required' },
        { status: 400 }
      );
    }
    if (!body.category || typeof body.category !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Category is required' },
        { status: 400 }
      );
    }
    if (body.base_price === undefined || body.base_price === null) {
      return NextResponse.json(
        { data: null, error: 'Base price is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const product = {
      name:             body.name.trim() as string,
      slug:             generateSlug(body.name as string),
      category:         body.category as Enums<'product_category'>,
      base_price:       Number(body.base_price),
      uploaded_by:      user.id,
      is_approved:      true,
      is_active:        true,
      stock_status:     (body.stock_status as Enums<'stock_status'>) ?? 'in_stock',
      unit_of_measure:  (body.unit_of_measure as Enums<'unit_of_measure'>) ?? 'piece',
      moq:              typeof body.moq === 'number' ? body.moq : 1,
      brand:            (body.brand as string | null) ?? null,
      size_variant:     (body.size_variant as string | null) ?? null,
      description:      (body.description as string | null) ?? null,
      short_description:(body.short_description as string | null) ?? null,
      sku:              (body.sku as string | null) ?? null,
      subcategory_id:   (body.subcategory_id as string | null) ?? null,
      subcategory_slug: (body.subcategory_slug as string | null) ?? null,
      hsn_code:         (body.hsn_code as string | null) ?? null,
      gst_rate:         typeof body.gst_rate === 'number' ? body.gst_rate : 0,
      tags:             Array.isArray(body.tags) ? (body.tags as string[]) : [],
    };

    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) {
      console.error('[api/admin/products POST] Supabase error:', error.message);
      return NextResponse.json(
        { data: null, error: 'Failed to create product' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/admin/products POST]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
