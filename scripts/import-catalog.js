#!/usr/bin/env node
'use strict';

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lpjvevrxpjgdhoogdvgu.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwanZldnJ4cGpnZGhvb2dkdmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA1MjcwMywiZXhwIjoyMDg4NjI4NzAzfQ.SSEUY-DV1Hrw09AJ8vzT3NgSrjzN8s152y8OX_aJJPA';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ─── helpers ─────────────────────────────────────────────────────────────────

function slugify(t) {
  return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const UNIT_MAP = {
  '1 no':'piece','1no':'piece','1 nos':'piece','nos':'piece','no':'piece','piece':'piece',
  'ream':'ream','1 pkt':'pkt','1pkt':'pkt','pkt':'pkt','packet':'pkt',
  '1 box':'box','box':'box','1 kg':'kg','kg':'kg',
  '1 pair':'pair','pair':'pair','set':'set',
  '1 ltr':'liter','ltr':'liter','1 litre':'liter','litre':'liter','liter':'liter',
};
function mapUnit(raw) { return UNIT_MAP[String(raw||'').trim().toLowerCase()] || 'piece'; }

function normaliseGst(raw) {
  const n = parseFloat(String(raw).replace(/[^0-9.]/g,''));
  if (!isFinite(n)) return 18;
  return n > 0 && n < 1 ? Math.round(n*100) : Math.round(n)||18;
}

// ─── section → category/subcategory ──────────────────────────────────────────

const HK_MAP = {
  'BROOMS & CLOTH':                 { cat: 'housekeeping_materials', sub: 'brooms_and_cleaning_cloths' },
  'PAPER PRODUCTS':                 { cat: 'housekeeping_materials', sub: 'paper_and_tissue_products' },
  'PLASTIC Items':                  { cat: 'housekeeping_materials', sub: 'plastic_ware_and_bins' },
  'GARBAGE BAGS':                   { cat: 'housekeeping_materials', sub: 'garbage_bags_black' },
  'GARBAGE BAGS  COULORC':          { cat: 'housekeeping_materials', sub: 'garbage_bags_colour_coded' },
  'MOPS & BRUSHES':                 { cat: 'housekeeping_materials', sub: 'mops_and_mop_refills' },
  'HYPRO CHEMICALS':                { cat: 'cleaning_chemicals',     sub: 'housekeeping_and_general_cleaners' },
  'LIQUIDS & CHEMICALS':            { cat: 'cleaning_chemicals',     sub: 'housekeeping_and_general_cleaners' },
  'SOAPS & POWDERS':                { cat: 'cleaning_chemicals',     sub: 'soaps_and_detergent_powders' },
  'AIR FRESHNER & ROOM FRESHNERS':  { cat: 'housekeeping_materials', sub: 'air_and_room_fresheners' },
  'CONSUMABLES PRODUCTS':           { cat: 'housekeeping_materials', sub: 'wipers_and_dusters' },
  'DISPENSERS':                     { cat: 'housekeeping_materials', sub: 'dispensers_and_hand_dryers' },
};

const ST_MAP = {
  'Xerox Paper':                { cat: 'office_stationeries', sub: 'copier_and_printing_paper' },
  'Writing  Pen & Pencil':      { cat: 'office_stationeries', sub: 'pens_pencils_and_markers' },
  'Note Books / Pads':          { cat: 'office_stationeries', sub: 'notebooks_and_writing_pads' },
  'Punching Machine / Stapler': { cat: 'office_stationeries', sub: 'staplers_and_punching_machines' },
  'Paper Clip':                 { cat: 'office_stationeries', sub: 'clips_pins_and_fasteners' },
  'Post It Pad':                { cat: 'office_stationeries', sub: 'sticky_notes_and_postits' },
  'Packing Materials':          { cat: 'office_stationeries', sub: 'tapes_and_adhesives' },
  'File / Folders':             { cat: 'office_stationeries', sub: 'files_and_folders' },
  'Stationery Items':           { cat: 'office_stationeries', sub: 'general_stationery' },
  'Envelop Covers':             { cat: 'office_stationeries', sub: 'envelopes_and_covers' },
};

// ─── variant grouping ─────────────────────────────────────────────────────────

// Strip these from the name to find the "family" base
const STRIP_RE = /\b(extra\s+large|super\s+king|monkey\s+brand|good\s+quality|heavy\s+duty|hanuman|monkey|regulars?|premium|economic|jumbo|small|medium|large|big|mini|super|xl|3m|dc[-\s]?\d+|sd[-\s]?\d+|ct[-\s]?\d+|dp\s*\d+|ss\s*\d+|prima[-\s]?\d+)\b/gi;
const MEASURE_RE = /\b\d+\s*(ml|lts?|l\b|kg|gms?|g\b|pull|mm|cm|gsm|mtr|gm|nos?|pcs?|pkt|pack|liter|litre)\b/gi;
const DIM_RE = /\d+[/"']*\s*[x×]\s*\d+[/"']*/gi;
const PARENS_RE = /\s*\([^)]*\)\s*/g;
const NUM_RE = /\b\d+\b/g;

function normKey(name) {
  let n = String(name).toLowerCase();
  n = n.replace(PARENS_RE, ' ');
  n = n.replace(STRIP_RE, ' ');
  n = n.replace(MEASURE_RE, ' ');
  n = n.replace(DIM_RE, ' ');
  n = n.replace(NUM_RE, ' ');
  n = n.replace(/[-\/\\]+/g, ' ');
  return n.replace(/\s+/g, ' ').trim();
}

// Variant label = what makes this product different (size from name + brand/size col)
function variantLabel(name, brandCol) {
  const parts = [];
  const clean = String(name).replace(PARENS_RE, '').trim();
  // Extract stripped tokens (size words, measurements, dimensions) from name
  const sizeTokens = [];
  const withParens = String(name);
  const colors = (withParens.match(PARENS_RE) || []).map(s => s.replace(/[()]/g,'').trim()).filter(Boolean);

  let tmp = clean;
  let m;
  const regexes = [new RegExp(STRIP_RE.source,'gi'), new RegExp(MEASURE_RE.source,'gi'), new RegExp(DIM_RE.source,'gi')];
  for (const re of regexes) {
    while ((m = re.exec(tmp)) !== null) sizeTokens.push(m[0].trim());
  }

  if (sizeTokens.length > 0) parts.push(sizeTokens.map(t => t.replace(/\b\w/g, c => c.toUpperCase())).join(' '));
  if (brandCol && String(brandCol).trim()) parts.push(String(brandCol).trim());
  if (colors.length > 0) parts.push(colors[0]);

  return parts.length > 0 ? parts.join(' / ') : clean;
}

// ─── parse sheet ─────────────────────────────────────────────────────────────

function parseSheet(sheetName, rawRows, sectionMap, subcatLookup, uploadedBy) {
  const headerIdx = rawRows.findIndex(r =>
    Array.isArray(r) && r.some(c => typeof c === 'string' && c.toLowerCase().includes('item descriptions'))
  );
  if (headerIdx === -1) return [];

  // Collect products with their section
  const products = [];
  let currentSection = '';
  let currentMeta = { cat: 'housekeeping_materials', sub: 'brooms_and_cleaning_cloths' };

  for (let i = headerIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const sl = row[0];
    const nameRaw = row[1];

    // Section header: string in col A, empty col B
    if (typeof sl === 'string' && sl.trim() && !nameRaw) {
      currentSection = sl.trim();
      currentMeta = sectionMap[currentSection] || currentMeta;
      continue;
    }

    if (typeof sl !== 'number' || !isFinite(sl)) continue;

    const name = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw||'').trim();
    if (!name) continue;

    const brandCol = String(row[2]||'').trim();
    const qtyCol   = String(row[3]||'').trim();
    const rate     = parseFloat(String(row[4]).replace(/[^0-9.]/g,''));
    const gst      = normaliseGst(row[5]);

    if (!isFinite(rate) || rate < 0) continue;

    products.push({
      sl, name, brandCol, qtyCol, rate, gst,
      section: currentSection,
      cat: currentMeta.cat,
      sub: currentMeta.sub,
      normKey: normKey(name) + '|' + currentSection,
    });
  }

  // Group by normKey within same section → assign group_slug
  const groupCount = {};
  for (const p of products) {
    groupCount[p.normKey] = (groupCount[p.normKey]||0) + 1;
  }

  // Family name = first product's clean name (colors stripped, size stripped)
  const familyName = {};
  for (const p of products) {
    if (!familyName[p.normKey]) {
      // Clean name: remove parens, keep base
      let base = p.name.replace(PARENS_RE, '').trim();
      // Strip trailing size words
      base = base.replace(/\s+(Small|Medium|Big|Large|Jumbo|Extra Large|Regular|Regulars|Super King|Hanuman|Monkey Brand|Premium|Economic|Super|3M|Mini)\s*$/i, '').trim();
      base = base.replace(/\s+\d+['"]*\s*x\s*\d+['"]*\s*$/i, '').trim();
      base = base.replace(/\s+\d+\s*(ml|lts?|l|kg|gms?|g|pull)\s*$/i, '').trim();
      familyName[p.normKey] = base || p.name;
    }
  }

  // Build final product rows
  const rows = [];
  const batchSlugs = new Set();

  for (const p of products) {
    const isVariant  = groupCount[p.normKey] > 1;
    const family     = familyName[p.normKey];
    const groupSlug  = isVariant ? `crescent-${slugify(family)}-${slugify(p.section)}` : null;
    const sizeVar    = isVariant ? variantLabel(p.name, p.brandCol) : (p.brandCol || null);
    const subcatId   = subcatLookup.get(p.sub) || null;

    let slug = slugify(p.name + (p.brandCol ? '-' + p.brandCol : '') + '-' + sheetName);
    if (!slug) slug = 'product-' + p.sl;
    const origSlug = slug;
    let suffix = 1;
    while (batchSlugs.has(slug)) slug = origSlug + '-' + (++suffix);
    batchSlugs.add(slug);

    const brand = sheetName === 'Stationery' && p.brandCol ? p.brandCol : null;

    rows.push({
      name:              family,
      slug,
      sku:               `${sheetName.toUpperCase().slice(0,2)}-${p.sl}`,
      short_description: p.name,
      description:       `${p.name}. Professional-grade ${p.sub.replace(/_/g,' ')} for B2B facility procurement. GST invoice included. Fast delivery.`,
      category:          p.cat,
      subcategory_slug:  p.sub,
      subcategory_id:    subcatId,
      brand,
      size_variant:      sizeVar,
      group_slug:        groupSlug,
      unit_of_measure:   mapUnit(p.qtyCol),
      base_price:        p.rate,
      moq:               1,
      gst_rate:          p.gst,
      stock_status:      'in_stock',
      is_approved:       true,
      is_active:         true,
      thumbnail_url:     null,
      images:            [],
      specifications:    p.brandCol ? { 'Size / Pack': p.brandCol } : {},
      tags:              [sheetName.toLowerCase(), p.sub.replace(/_/g,'-')],
      uploaded_by:       uploadedBy,
      vendor_id:         null,
      hsn_code:          null,
      pricing_tiers:     [],
    });
  }

  return rows;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting catalog import...\n');

  // 1. Get admin user ID
  const { data: adminUsers } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .limit(1);
  const uploadedBy = adminUsers?.[0]?.id;
  if (!uploadedBy) { console.error('❌ No admin user found'); process.exit(1); }
  console.log('✅ Admin user:', uploadedBy);

  // 2. Fetch subcategory IDs
  const { data: subcatRows } = await supabase.from('subcategories').select('id, slug');
  const subcatLookup = new Map((subcatRows||[]).map(r => [r.slug, r.id]));
  console.log('✅ Subcategories loaded:', subcatLookup.size);

  // 3. Fetch existing slugs to skip duplicates
  const { data: existingSlugs } = await supabase
    .from('products')
    .select('slug')
    .eq('is_active', true);
  const dbSlugs = new Set((existingSlugs||[]).map(r => r.slug));
  console.log('✅ Existing active products:', dbSlugs.size);

  // 4. Parse Excel
  const wb = XLSX.readFile('PrimeServe Houskeeping & Stationaries.xlsx');
  let allRows = [];

  for (const [sheetName, sectionMap] of [['Housekeeping', HK_MAP], ['Stationery', ST_MAP]]) {
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, defval:'' });
    const rows = parseSheet(sheetName, rawRows, sectionMap, subcatLookup, uploadedBy);
    console.log(`\n📋 ${sheetName}: ${rows.length} products parsed`);
    allRows = allRows.concat(rows);
  }

  // 5. Filter out existing
  const toInsert = allRows.filter(r => !dbSlugs.has(r.slug));
  const skipped  = allRows.length - toInsert.length;
  console.log(`\n📦 Total: ${allRows.length} | To insert: ${toInsert.length} | Already exist: ${skipped}`);

  if (toInsert.length === 0) { console.log('Nothing new to insert.'); return; }

  // 6. Insert in chunks of 50
  let inserted = 0, errors = 0;
  const CHUNK = 50;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { error } = await supabase.from('products').insert(chunk);
    if (!error) {
      inserted += chunk.length;
      process.stdout.write(`\r✅ Inserted ${inserted}/${toInsert.length}...`);
    } else {
      console.error(`\n⚠️  Chunk error: ${error.message}`);
      // Row-by-row fallback
      for (const row of chunk) {
        const { error: e2 } = await supabase.from('products').insert(row);
        if (!e2) { inserted++; }
        else { errors++; console.error(`  ❌ ${row.name}: ${e2.message}`); }
      }
    }
  }

  console.log(`\n\n✅ Done! Inserted: ${inserted} | Errors: ${errors} | Skipped (existing): ${skipped}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
