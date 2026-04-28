/**
 * GET /api/products/[slug] — Public single-product API
 *
 * Returns one approved+active product by slug, its variant siblings
 * (products sharing the same group_slug), and up to 4 related products
 * from the same category.
 *
 * Uses the admin client so RLS never blocks a public product page.
 * No authentication required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    // 1. Fetch the base product
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_approved', true)
      .eq('is_active', true)
      .single();

    if (productErr || !product) {
      return NextResponse.json(
        { data: null, error: 'Product not found' },
        { status: 404 },
      );
    }

    // 2. Fetch variant siblings (same group_slug)
    let variants = [product];
    if (product.group_slug) {
      const { data: siblings } = await supabase
        .from('products')
        .select('*')
        .eq('group_slug', product.group_slug)
        .eq('is_approved', true)
        .eq('is_active', true)
        .order('base_price', { ascending: true });
      if (siblings && siblings.length > 1) variants = siblings;
    }

    // 3. Fetch related products (same category, different product/group)
    let relatedQuery = supabase
      .from('products')
      .select('*')
      .eq('category', product.category)
      .eq('is_approved', true)
      .eq('is_active', true)
      .neq('id', product.id)
      .order('total_orders', { ascending: false })
      .limit(8);

    const { data: relatedRaw } = await relatedQuery;
    const related = (relatedRaw ?? [])
      .filter((r) => !product.group_slug || r.group_slug !== product.group_slug)
      .slice(0, 4);

    return NextResponse.json({
      data: { product, variants, related },
      error: null,
    });
  } catch (error) {
    console.error('[api/products/[slug] GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
