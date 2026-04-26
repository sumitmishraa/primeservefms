/**
 * POST /api/buyer/quotes/upload
 *
 * Accepts a multipart form with:
 *   - title: string
 *   - file: .xlsx or .xls Excel file
 *
 * Uploads the file to Supabase Storage (bucket: quote-documents),
 * then inserts a quote_request record with the document_url.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

const BUCKET = 'quote-documents';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const title = (form.get('title') as string | null)?.trim();
    const file = form.get('file') as File | null;

    if (!title) {
      return NextResponse.json({ data: null, error: 'Quote title is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ data: null, error: 'Excel file is required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      return NextResponse.json({ data: null, error: 'Only .xlsx and .xls files are accepted' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ data: null, error: 'File size must be under 5 MB' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Ensure the bucket exists (no-op if already created)
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_SIZE_BYTES });

    const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });

    if (uploadError) {
      console.error('[api/buyer/quotes/upload] storage upload error', uploadError);
      return NextResponse.json({ data: null, error: 'Failed to upload file. Please try again.' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    const insertRow = {
      buyer_id: user.id,
      title,
      items: [] as Record<string, unknown>[],
      status: 'submitted' as const,
      document_url: publicUrl,
      notes: null,
    };

    const { data, error: insertError } = await supabase
      .from('quote_requests')
      .insert(insertRow as never)
      .select('id')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ data: { id: (data as { id: string }).id }, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/quotes/upload POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to submit quote request' }, { status: 500 });
  }
}
