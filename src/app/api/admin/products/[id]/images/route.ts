/**
 * POST /api/admin/products/[id]/images
 * Uploads an image to Supabase Storage and appends its URL to the product.
 *
 * DELETE /api/admin/products/[id]/images
 * Removes an image URL from the product's images array and deletes from storage.
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

function storagePathFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // URL shape: /storage/v1/object/public/product-images/<path>
    const marker = `/object/public/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return u.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ data: null, error: 'Admin only' }, { status: 403 });

    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ data: null, error: 'No file provided' }, { status: 400 });
    }
    const f = file as File;

    if (f.size > MAX_BYTES) {
      return NextResponse.json({ data: null, error: 'File too large (max 5 MB)' }, { status: 413 });
    }
    if (!ALLOWED_TYPES.includes(f.type)) {
      return NextResponse.json({ data: null, error: 'Only JPEG, PNG, WebP and GIF images are allowed' }, { status: 415 });
    }

    const ext      = f.name.split('.').pop() ?? 'jpg';
    const filename = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const supabase  = createAdminClient();
    const arrayBuf  = await f.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(filename, arrayBuf, { contentType: f.type, upsert: false });

    if (uploadErr) {
      console.error('[images POST] upload error:', uploadErr.message);
      return NextResponse.json({ data: null, error: 'Upload failed' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(filename);

    // Append URL to the product's images array and update thumbnail if not set
    const { data: existing } = await supabase
      .from('products')
      .select('images, thumbnail_url')
      .eq('id', id)
      .single();

    const currentImages: string[] = Array.isArray(existing?.images) ? existing.images as string[] : [];
    const newImages = [...currentImages, publicUrl];
    const thumbnail = existing?.thumbnail_url || publicUrl;

    const { error: updateErr } = await supabase
      .from('products')
      .update({ images: newImages, thumbnail_url: thumbnail })
      .eq('id', id);

    if (updateErr) {
      console.error('[images POST] update error:', updateErr.message);
      return NextResponse.json({ data: null, error: 'Saved image but failed to link to product' }, { status: 500 });
    }

    return NextResponse.json({ data: { url: publicUrl, thumbnail, images: newImages }, error: null });
  } catch (error) {
    console.error('[api/admin/products/[id]/images POST]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ data: null, error: 'Admin only' }, { status: 403 });

    const { id } = await params;
    const { url } = (await request.json()) as { url: string };
    if (!url) return NextResponse.json({ data: null, error: 'No URL provided' }, { status: 400 });

    const supabase = createAdminClient();

    // Remove from storage
    const storagePath = storagePathFromUrl(url);
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }

    // Remove from product's images array
    const { data: existing } = await supabase
      .from('products')
      .select('images, thumbnail_url')
      .eq('id', id)
      .single();

    const currentImages: string[] = Array.isArray(existing?.images) ? existing.images as string[] : [];
    const newImages = currentImages.filter((u) => u !== url);
    const newThumb  = existing?.thumbnail_url === url ? (newImages[0] ?? null) : existing?.thumbnail_url ?? null;

    const { error: updateErr } = await supabase
      .from('products')
      .update({ images: newImages, thumbnail_url: newThumb })
      .eq('id', id);

    if (updateErr) {
      console.error('[images DELETE] update error:', updateErr.message);
      return NextResponse.json({ data: null, error: 'Failed to update product images' }, { status: 500 });
    }

    return NextResponse.json({ data: { images: newImages, thumbnail: newThumb }, error: null });
  } catch (error) {
    console.error('[api/admin/products/[id]/images DELETE]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}
