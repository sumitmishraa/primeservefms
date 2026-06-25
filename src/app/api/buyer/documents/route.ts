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
  'pan_card_back',
  'bank_statement',
  'incorporation_proof',
  'cin_document',
  'cancelled_cheque',
  'itr',
  'msme_certificate',
  'other',
];

// ── Per-document-type format rules ──────────────────────────────────────────
// Certificates accept images, PDF, or Excel. Bank statements accept PDF/Excel
// only (a 6-month statement is never a photo) — enforced server-side so a wrong
// file is rejected even if the client `accept` attribute is bypassed.
const CERT_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'xls', 'xlsx'];
const BANK_EXTS = ['pdf', 'xls', 'xlsx'];

const EXCEL_MIMES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const CERT_MIMES = ['application/pdf', 'image/jpeg', 'image/png', ...EXCEL_MIMES];
const BANK_MIMES = ['application/pdf', ...EXCEL_MIMES];

function allowedFormatsFor(docType: BusinessDocument['doc_type']) {
  if (docType === 'bank_statement') {
    return { exts: BANK_EXTS, mimes: BANK_MIMES, label: 'a PDF or Excel file' };
  }
  return { exts: CERT_EXTS, mimes: CERT_MIMES, label: 'a JPG, PNG, PDF, or Excel file' };
}

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

    // Server-side format guard (extension + MIME, when the browser provides one)
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const { exts, mimes, label } = allowedFormatsFor(doc_type);
    const extOk = exts.includes(ext);
    const mimeOk = !file.type || mimes.includes(file.type);
    if (!extOk || !mimeOk) {
      return NextResponse.json(
        { data: null, error: `Invalid file type. Please upload ${label}.` },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_SIZE_BYTES });

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
