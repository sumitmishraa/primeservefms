/**
 * Primeserve Product Matching Engine
 *
 * Matches buyer Excel rows to the Supabase product catalog in two layers:
 *
 * Layer 1 — In-memory keyword + synonym matching (instant, free)
 *   Loads the entire catalog in ONE query, then scores every product
 *   against each buyer item purely in JS. Replaces the old N×4 query approach.
 *
 * Layer 2 — OpenAI fallback (for items that Layer 1 misses)
 *   Sends all still-unmatched items to GPT-4o-mini in a SINGLE API call.
 *   Results are cached in the product_aliases table so the same term is
 *   never sent to OpenAI again (Supabase as persistent cache).
 *
 * Usage:
 *   import { matchItems } from '@/lib/matching/matcher';
 *   const results = await matchItems(requestedItems, supabaseAdminClient);
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestedItem {
  name: string;
  description: string;
  qty: number;
  unit: string;
  brand: string;
}

export interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  size_variant: string | null;
  base_price: number;
  gst_rate: number;
  tags: string[];
  total_orders: number;
}

export type MatchStrategy = 'alias' | 'keyword' | 'ai' | 'unmatched';

export interface MatchResult {
  item: RequestedItem;
  product: CatalogProduct | null;
  score: number;
  strategy: MatchStrategy;
}

// ---------------------------------------------------------------------------
// Synonym map — common Indian B2B buyer terms → catalog search terms
// Brand names used as category names, Hindi terms, regional shortcuts.
// ---------------------------------------------------------------------------

const SYNONYMS: Record<string, string> = {
  // Floor cleaners
  'phenyl': 'floor cleaner',
  'white phenyl': 'floor cleaner',
  'black phenyl': 'floor cleaner disinfectant',
  'lizol': 'floor cleaner disinfectant',
  // Toilet / bathroom
  'harpic': 'toilet bowl cleaner',
  'wc cleaner': 'toilet bowl cleaner',
  'pan cleaner': 'toilet bowl cleaner',
  'domex': 'toilet cleaner',
  'bathroom acid': 'toilet bowl cleaner',
  // Glass & surface
  'colin': 'glass cleaner',
  'window cleaner': 'glass cleaner',
  'mirror cleaner': 'glass cleaner',
  // Dishwash
  'vim': 'dishwash liquid',
  'pril': 'dishwash liquid',
  'dish soap': 'dishwash liquid',
  'bartan cleaner': 'dishwash liquid',
  'bartan saaf': 'dishwash liquid',
  'vessel cleaner': 'dishwash liquid',
  'utensil cleaner': 'dishwash liquid',
  // Laundry
  'surf': 'laundry detergent',
  'ariel': 'laundry detergent',
  'tide': 'laundry detergent',
  'washing powder': 'laundry detergent',
  'detergent powder': 'laundry detergent',
  // Disinfectants
  'dettol': 'antiseptic disinfectant',
  'savlon': 'antiseptic disinfectant',
  'bleach': 'sodium hypochlorite',
  'chlorine solution': 'sodium hypochlorite',
  // Hand hygiene
  'hand rub': 'hand sanitizer',
  'alcohol gel': 'hand sanitizer',
  'hand wash liquid': 'liquid hand wash',
  'liquid soap': 'liquid hand wash',
  'foam soap': 'foaming hand wash',
  // Mops & tools
  'pochha': 'mop cloth',
  'telia': 'mop cloth',
  'swab': 'mop cloth',
  'jhadu': 'sweeping broom',
  'kharata': 'sweeping broom',
  // Garbage bags
  'trash bag': 'garbage bag',
  'dustbin liner': 'garbage bag',
  'bin bag': 'garbage bag',
  'kachra bag': 'garbage bag',
  // Paper & tissue
  'toilet paper': 'toilet tissue roll',
  'bathroom tissue': 'toilet tissue roll',
  'tp roll': 'toilet tissue roll',
  // Scrubbers
  'scotch brite': 'scouring pad',
  'steel scrubber': 'steel wool scrubber',
  'wire scrubber': 'steel wool scrubber',
  // Gloves
  'rubber gloves': 'latex gloves',
  'hand gloves': 'latex gloves',
  // Air freshener
  'room freshener': 'air freshener',
  'deodorizer': 'air freshener',
  // Pest control
  'naphthalene': 'naphthalene balls',
  'moth balls': 'naphthalene balls',
  'cockroach killer': 'cockroach spray',
  'mosquito spray': 'insecticide spray',
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'with', 'of', 'and', 'or', 'in', 'on',
  'at', 'to', 'by', 'is', 'are', 'it', 'as', 'be',
  'ml', 'gm', 'kg', 'ltr', 'lts', 'nos', 'pcs', 'pkt', 'pc', 'liter',
  'piece', 'pieces', 'pack', 'box', 'bottle', 'can', 'roll',
]);

const MIN_KEYWORD_SCORE = 35;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expandSynonym(name: string): string {
  const lower = name.toLowerCase().trim();
  return SYNONYMS[lower] ?? name;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[()[\]/\\|#@%*+]/g, ' ')
    .split(/[\s,.\-_]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreMatch(product: CatalogProduct, item: RequestedItem): number {
  let score = 0;
  const pName    = product.name.toLowerCase();
  const expanded = expandSynonym(item.name).toLowerCase();
  const original = item.name.toLowerCase();
  const reqBrand = item.brand.toLowerCase();

  // ── Name similarity ────────────────────────────────────────────────────
  if (pName === expanded || pName === original) {
    score += 100;
  } else if (pName.includes(expanded) || expanded.includes(pName)) {
    score += 65;
  } else if (pName.includes(original) || original.includes(pName)) {
    score += 55;
  } else {
    // Shared token count (use expanded term first, fall back to original)
    const expTokens = new Set(tokenize(expanded));
    const pTokens   = tokenize(pName);
    const shared    = pTokens.filter((t) => expTokens.has(t)).length;
    score += shared * 18;

    if (shared === 0) {
      const origTokens = new Set(tokenize(original));
      const origShared = pTokens.filter((t) => origTokens.has(t)).length;
      score += origShared * 12;
    }
  }

  // ── Brand match ────────────────────────────────────────────────────────
  if (reqBrand && product.brand) {
    const pBrand = product.brand.toLowerCase();
    if (pBrand === reqBrand)                                      score += 35;
    else if (pBrand.includes(reqBrand) || reqBrand.includes(pBrand)) score += 18;
  }

  // ── Size / description hint ────────────────────────────────────────────
  if (item.description && product.size_variant) {
    const desc = item.description.toLowerCase();
    const sv   = product.size_variant.toLowerCase();
    if (sv === desc)                           score += 15;
    else if (sv.includes(desc) || desc.includes(sv)) score += 8;
  }

  // ── Tag overlap ────────────────────────────────────────────────────────
  if (Array.isArray(product.tags) && product.tags.length > 0) {
    const reqWords = new Set(tokenize(expanded));
    const tagHits  = product.tags.filter((t) =>
      [...reqWords].some((w) => w.length > 2 && t.toLowerCase().includes(w)),
    ).length;
    score += tagHits * 10;
  }

  // ── Popularity tiebreaker (tiny — doesn't override accuracy) ──────────
  if (product.total_orders > 100) score += 3;
  else if (product.total_orders > 10) score += 1;

  return score;
}

// ---------------------------------------------------------------------------
// OpenAI fallback
// ---------------------------------------------------------------------------

interface AiRow {
  requested_name: string;
  matched_id: string | null;
  confidence: number;
}

async function openAiFallback(
  unmatched: RequestedItem[],
  catalog: CatalogProduct[],
  supabase: SupabaseClient,
): Promise<Map<string, string | null>> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[matcher] OPENAI_API_KEY not set — skipping AI fallback');
    return new Map();
  }

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Send compact catalog to keep token usage low
  const catalogSlim = catalog.map((p) => ({
    id:   p.id,
    name: p.name,
    brand: p.brand ?? null,
    size: p.size_variant ?? null,
    tags: (p.tags ?? []).slice(0, 4),
  }));

  const systemPrompt =
    `You are a B2B housekeeping supply matching expert for the Indian market.
Match each buyer product name to the closest item in our catalog.
Know that buyers often use:
- Brand names as categories: Harpic=toilet bowl cleaner, Colin=glass cleaner,
  Vim/Pril=dishwash liquid, Dettol=antiseptic, Lizol=floor cleaner.
- Indian/Hindi terms: phenyl=floor cleaner, pochha=mop cloth, jhadu=broom,
  bartan=utensil, bleach=sodium hypochlorite.
- Pack-size descriptors alongside product names (ignore them for matching).
Return ONLY a valid JSON array. No markdown, no explanation.`;

  const userPrompt =
    `CATALOG (${catalog.length} products):
${JSON.stringify(catalogSlim)}

UNMATCHED BUYER ITEMS:
${JSON.stringify(unmatched.map((i) => ({
  name: i.name,
  description: i.description,
  brand: i.brand,
})))}

Return: [{"requested_name":"...","matched_id":"<uuid or null>","confidence":<0-100>}]
Rules: confidence >= 70 means reasonably sure. If unsure, set matched_id to null.`;

  let parsed: AiRow[] = [];
  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0,
    });
    const raw = completion.choices[0]?.message?.content ?? '[]';
    parsed = JSON.parse(raw) as AiRow[];
  } catch (err) {
    console.error('[matcher] OpenAI call or JSON parse failed', err);
    return new Map();
  }

  // Cache confident matches in product_aliases so they're free next time
  const toCache = parsed
    .filter((r) => r.matched_id && r.confidence >= 70)
    .map((r) => ({
      alias:      r.requested_name.toLowerCase().trim(),
      product_id: r.matched_id,
      created_by: 'openai',
      confidence: r.confidence,
      approved:   false, // admin reviews before these are treated as confirmed
    }));

  if (toCache.length > 0) {
    const { error } = await supabase
      .from('product_aliases')
      .upsert(toCache, { onConflict: 'alias_lower', ignoreDuplicates: true });
    if (error) console.error('[matcher] alias cache write failed', error.message);
  }

  const resultMap = new Map<string, string | null>();
  for (const r of parsed) {
    resultMap.set(
      r.requested_name.toLowerCase().trim(),
      r.confidence >= 70 ? r.matched_id : null,
    );
  }
  return resultMap;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Match a list of buyer-requested items to the Supabase product catalog.
 *
 * Strategy:
 *   1. Load approved aliases + full catalog in 2 parallel queries.
 *   2. For each item: check alias → score all catalog products in memory.
 *   3. Items with score < MIN_KEYWORD_SCORE → batch to OpenAI in one call.
 *   4. OpenAI results cached as aliases for free future matches.
 */
export async function matchItems(
  items: RequestedItem[],
  supabase: SupabaseClient,
): Promise<MatchResult[]> {
  // 1. Parallel fetch: aliases + full catalog
  const [aliasRes, catalogRes] = await Promise.all([
    supabase
      .from('product_aliases')
      .select('alias_lower, product_id')
      .eq('approved', true),
    supabase
      .from('products')
      .select('id, name, brand, size_variant, base_price, gst_rate, tags, total_orders')
      .eq('is_active', true)
      .eq('is_approved', true)
      .gt('base_price', 0),
  ]);

  const aliasMap  = new Map<string, string>(
    (aliasRes.data ?? []).map((a: { alias_lower: string; product_id: string }) => [a.alias_lower, a.product_id]),
  );
  const catalog   = (catalogRes.data ?? []) as CatalogProduct[];
  const productById = new Map<string, CatalogProduct>(catalog.map((p) => [p.id, p]));

  // 2. In-memory match pass
  const results:    MatchResult[] = [];
  const toFallback: RequestedItem[] = [];

  for (const item of items) {
    // Alias lookup (exact, case-insensitive)
    const aliasProductId = aliasMap.get(item.name.toLowerCase().trim());
    if (aliasProductId) {
      const p = productById.get(aliasProductId);
      if (p) {
        results.push({ item, product: p, score: 110, strategy: 'alias' });
        continue;
      }
    }

    // Score all catalog products in memory
    let best: CatalogProduct | null = null;
    let bestScore = 0;
    for (const p of catalog) {
      const s = scoreMatch(p, item);
      if (s > bestScore) { bestScore = s; best = p; }
    }

    if (bestScore >= MIN_KEYWORD_SCORE && best) {
      results.push({ item, product: best, score: bestScore, strategy: 'keyword' });
    } else {
      toFallback.push(item);
    }
  }

  // 3. OpenAI fallback for items still unmatched
  if (toFallback.length > 0) {
    const aiMap = await openAiFallback(toFallback, catalog, supabase);

    for (const item of toFallback) {
      const productId = aiMap.get(item.name.toLowerCase().trim());
      if (productId) {
        const p = productById.get(productId);
        if (p) {
          results.push({ item, product: p, score: 75, strategy: 'ai' });
          continue;
        }
      }
      results.push({ item, product: null, score: 0, strategy: 'unmatched' });
    }
  }

  return results;
}
