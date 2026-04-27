/**
 * Admin product detail API — /api/admin/products/[id]
 *
 * PUT    — Update any field on a product. Admin-only.
 * DELETE — Soft-delete a product (sets is_active = false). Admin-only.
 *
 * Both methods return 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// PUT — Update product
// ---------------------------------------------------------------------------

/**
 * Updates any product field. Admin-only.
 * The request body may contain any subset of product columns.
 *
 * @param request - Incoming request with JSON body
 * @param params  - Route params containing `id`
 * @returns Updated product row
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { data: null, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Strip out fields that should never be set via this endpoint
    const { id: _id, created_at: _ca, slug: _slug, ...updates } = body;
    void _id; void _ca; void _slug; // intentionally unused

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { data: null, error: 'No fields provided to update' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[api/admin/products/[id] PUT] Supabase error:', error.message);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { data: null, error: 'Product not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { data: null, error: 'Failed to update product' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/admin/products/[id] PUT]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — Soft-delete product
// ---------------------------------------------------------------------------

/**
 * Removes a product. Admin-only.
 *
 * Default mode (no query): SOFT delete — sets is_active = false. The row
 * stays in the DB and order_items still join cleanly. This is the safe
 * default and matches the project's "soft deletes only" rule.
 *
 * Hard mode (`?hard=true`): permanently removes the row from the products
 * table. Used when the admin wants to wipe the catalog and re-import a
 * fresh workbook. order_items.product_id has ON DELETE RESTRICT, so any
 * product referenced by a real order will be refused at the DB level —
 * the response surfaces that as a 409 with a friendly message.
 *
 * @param request - Incoming request
 * @param params  - Route params containing `id`
 * @returns Success message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { data: null, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === 'true';

    const supabase = createAdminClient();

    if (hard) {
      const { error } = await supabase.from('products').delete().eq('id', id);

      if (error) {
        console.error('[api/admin/products/[id] DELETE hard] Supabase error:', error.message);
        // 23503 = foreign_key_violation (product is referenced in order_items)
        const isFkBlock =
          error.code === '23503' ||
          error.message.toLowerCase().includes('foreign key');
        return NextResponse.json(
          {
            data: null,
            error: isFkBlock
              ? 'This product appears in past orders and cannot be permanently deleted. Use the standard delete to deactivate it instead.'
              : 'Failed to permanently delete product',
          },
          { status: isFkBlock ? 409 : 500 },
        );
      }

      return NextResponse.json({
        data: { message: 'Product permanently deleted' },
        error: null,
      });
    }

    // Default: soft-delete
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('[api/admin/products/[id] DELETE] Supabase error:', error.message);
      return NextResponse.json(
        { data: null, error: 'Failed to delete product' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: { message: 'Product deactivated successfully' },
      error: null,
    });
  } catch (error) {
    console.error('[api/admin/products/[id] DELETE]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
