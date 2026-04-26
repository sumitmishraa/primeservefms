/**
 * GET    /api/buyer/documents         — List buyer's business documents
 * POST   /api/buyer/documents         — Upload a new business document
 * DELETE /api/buyer/documents?url=... — Remove a document by URL
 *
 * Documents are stored in Supabase Storage (bucket: buyer-documents) and
 * their metadata is persisted in users.business_documents JSONB array.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse, BusinessDocument } from '@/types';

const BUCKET = 'buyer-documents';
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const VALID_DOC_TYPES: BusinessDocument['doc_type'][] = [
  'gst_certificate',
  'trade_license',
  'pan_card',
  'bank_statement',
  'incorporation_proof',
  'cancelled_cheque',
  'msme_certificate',
  'other',
];

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<BusinessDocument[]>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const docs = (user.business_documents ?? []) as unknown as BusinessDocument[];
    return NextResponse.json({ data: docs, error: null });
  } catch (error) {
    console.error('[api/buyer/documents GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<BusinessDocument>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const form = await request.formData();
    const doc_type = form.get('doc_type') as BusinessDocument['doc_type'] | null;
    const file = form.get('file') as File | null;

    if (!doc_type || !VALID_DOC_TYPES.includes(doc_type)) {
      return NextResponse.json({ data: null, error: `Invalid doc_type. Allowed: ${VALID_DOC_TYPES.join(', ')}` }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ data: null, error: 'File is required' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ data: null, error: 'File must be under 10 MB' }, { status: 400 });
    }

    const supabase = createAdminClient();
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_SIZE_BYTES });

    const ext = file.name.split('.').pop() ?? 'bin';
    const fileName = `${user.id}/${doc_type}_${Date.now()}.${ext}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, fileBuffer, { contentType: file.type || 'application/octet-stream', upsert: false });

    if (uploadError) {
      console.error('[api/buyer/documents] upload error', uploadError);
      return NextResponse.json({ data: null, error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    const newDoc: BusinessDocument = {
      doc_type,
      url: publicUrl,
      uploaded_at: new Date().toISOString(),
      file_name: file.name,
    };

    // Append to existing documents array
    const existing = (user.business_documents ?? []) as unknown as BusinessDocument[];
    const updated = [...existing, newDoc];

    const { error: updateErr } = await supabase
      .from('users')
      .update({ business_documents: updated as unknown as never })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    return NextResponse.json({ data: newDoc, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/documents POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to upload document' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const docUrl = searchParams.get('url');
    if (!docUrl) return NextResponse.json({ data: null, error: 'url query param required' }, { status: 400 });

    const existing = (user.business_documents ?? []) as unknown as BusinessDocument[];
    const filtered = existing.filter((d) => d.url !== docUrl);

    if (filtered.length === existing.length) {
      return NextResponse.json({ data: null, error: 'Document not found' }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('users')
      .update({ business_documents: filtered as unknown as never })
      .eq('id', user.id);

    if (error) throw error;

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error('[api/buyer/documents DELETE]', error);
    return NextResponse.json({ data: null, error: 'Failed to delete document' }, { status: 500 });
  }
}
