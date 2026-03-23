# Primeserve — Technical Decisions Log

> Record of architecture decisions made during development.
> Each entry explains what was decided, why, and what alternatives were rejected.
> Update this file when a significant architectural choice is made.

---

## Phase 1 — Database Schema

### 1. Categories expanded to 6 (from original housekeeping-only scope)

**Decision:** The product catalog covers 6 top-level categories, not just housekeeping.

**Why:** The real Excel data contains:
- Housekeeping Materials → 170 products
- Cleaning Chemicals → 56 products
- Office Stationeries → 160 products
- Pantry Items → 2 products
- Facility & Tools → 6 products
- Printing Solution → 0 products (roadmap placeholder)

Restricting to housekeeping-only would have required stripping out 54% of the existing product catalog. The B2B marketplace is stronger with all categories available.

**Constraint upheld:** No facility management features (plumbing, electrical, HVAC) are built. The `facility_and_tools` category covers only safety equipment and basic tools needed to *support* housekeeping work, not maintenance contracting.

---

### 2. Subcategories use a reference TABLE, not an ENUM

**Decision:** `subcategories` is a `CREATE TABLE` with 44 seeded rows. It is NOT an ENUM.

**Why:** PostgreSQL ENUMs are hard to extend — adding a new value requires a DDL migration (`ALTER TYPE ... ADD VALUE`), which takes a full Supabase migration, redeploy, and type regeneration. With 44 subcategories today and more coming as new vendor products are onboarded, this would create constant friction.

A reference table lets an admin add new subcategories from the Supabase dashboard or via an admin API endpoint — no migration required.

**Trade-off:** A slight join overhead when fetching subcategory metadata. Mitigated by the `subcategory_slug` denormalized column on the products table (see Decision 3).

---

### 3. `subcategory_slug` denormalized on the products table

**Decision:** `products.subcategory_slug` stores a copy of `subcategories.slug`.

**Why:** The most common marketplace query is:
```sql
SELECT * FROM products
WHERE category = 'housekeeping_materials'
  AND subcategory_slug = 'mops_and_mop_refills'
  AND is_approved = true
  AND is_active = true
ORDER BY created_at DESC;
```
Without the denormalized column, this query would require a JOIN to the subcategories table on every page load. With it, the query is a pure index scan on `products`.

**Risk:** If a subcategory slug is ever renamed, `subcategory_slug` on existing products becomes stale. Mitigation: slug changes are admin-controlled and rare. When a slug changes, a one-time update query is run on the products table.

---

### 4. `brand` and `size_variant` split into separate columns

**Decision:** The Excel "size/brand" column is split into `brand` (TEXT) and `size_variant` (TEXT) on the products table.

**Why:** The source Excel has entries like:
- "JK" → clearly a brand
- "500ml" → clearly a size
- "Scotch-Brite 900ml" → both brand and size in one string

Storing these as a single column makes brand-based filtering (`WHERE brand ILIKE 'scotch-brite'`) and size display impossible without string parsing at runtime. Splitting them at import time gives clean, indexable, filterable columns.

**Both can be set:** A product like "JK Copier Paper A4 80GSM" would have `brand = 'JK'` and `size_variant = 'A4 80GSM'`.

---

### 5. `unit_of_measure` includes 14 units derived from actual product data

**Decision:** The `unit_of_measure` ENUM has 14 values: `piece`, `kg`, `liter`, `pack`, `box`, `carton`, `roll`, `pair`, `set`, `ream`, `pkt`, `can`, `bottle`, `tube`.

**Why:** Derived directly from the "units" column in the Housekeeping Excel sheet and the "Qty" column in the Stationery sheet. Using a generic TEXT column was rejected because it would allow vendors to enter inconsistent values ("Litre", "litre", "Ltr", "1L") that break filtering and comparison.

**Special units:** `ream` (reams of paper), `pkt` (packets), `can` (chemical concentrates) are B2B-specific and not found in typical retail unit lists.

---

### 6. Orders use `ON DELETE RESTRICT` on buyer_id and vendor_id

**Decision:** `orders.buyer_id` and `orders.vendor_id` both use `ON DELETE RESTRICT`.

**Why:** Orders are financial records. In India, GST-compliant invoice records must be retained for a minimum of 6 years (Income Tax Act + GST rules). If a buyer or vendor account is deleted and `CASCADE` is used, those order records disappear permanently — a compliance violation.

`RESTRICT` forces the deletion to fail entirely. The admin must archive the user (soft-delete via `is_active = false`) and decide how to handle their order history before the account can be removed.

**Alternative rejected:** `ON DELETE SET NULL` was considered but rejected because an order with no buyer or vendor is meaningless for financial reconciliation.

---

### 7. `order_items.product_name` is a snapshot (immutable after INSERT)

**Decision:** When an order is created, the product name and SKU are copied into `order_items.product_name` and `order_items.product_sku`. These are never updated.

**Why:** Standard B2B practice. An invoice must accurately reflect what the buyer was shown at the time of purchase. If a vendor later renames "Scotch-Brite Multi-Purpose Scrubber" to "Scotch-Brite Heavy Duty Scrubber", all historical orders should still show the original name the buyer saw and agreed to pay for.

The FK `product_id` is kept so you can still join to the current product listing for analytics, but it uses `ON DELETE RESTRICT` — a vendor cannot delete a product that appears in any order.

---

### 8. `messages.order_id` is nullable with `ON DELETE SET NULL`

**Decision:** `messages.order_id` references `orders(id) ON DELETE SET NULL`.

**Why:** Messages serve two purposes:
1. **Pre-sale enquiry** — buyer asks about a product before ordering (`order_id = NULL`)
2. **Order support** — buyer asks about delivery status after ordering (`order_id` set)

If an order is ever archived or administratively deleted, the message history should be preserved (the conversation happened; deleting it would be confusing to both parties). `SET NULL` keeps the message row while removing the now-invalid FK link.

---

### 9. `pricing_tiers` stored as JSONB, not a separate table

**Decision:** Volume pricing tiers live in `products.pricing_tiers` as a JSONB array.

**Why:** Pricing tiers are always read and written together with the product — you never need to query or filter by individual tier values without also having the product context. A separate `product_pricing_tiers` table would add a JOIN on every product fetch for no practical benefit at MVP scale.

JSONB also lets vendors define any number of tiers without a schema change. The structure is validated at the API layer (Zod schema).

**Schema per tier element:**
```json
{ "min_qty": 10, "max_qty": 49, "price": 220.00 }
{ "min_qty": 50, "max_qty": null, "price": 195.00 }
```
`max_qty: null` means "no upper limit" (the highest-volume tier).

---

### 10. Firebase handles OTP; Supabase is the single source of truth

**Decision:** Firebase Auth is used exclusively for OTP delivery (phone + email). All application data, including user profiles, lives in Supabase PostgreSQL.

**Why:** This avoids having two databases to query. The auth flow is:
1. Firebase verifies the OTP and issues an ID token.
2. `/api/auth/verify` validates the token using Firebase Admin SDK.
3. The API upserts a user row in `users` (using the Supabase service role client).
4. A Supabase session cookie is set for all subsequent requests.
5. `auth.uid()` in RLS policies refers to the Supabase Auth UUID — never the Firebase UID.

`users.firebase_uid` stores the Firebase UID only as a lookup key during the verify step.

**Forbidden:** `getFirestore()`, `getDatabase()`, `getStorage()` from Firebase SDK. These would introduce a second database and violate the "Supabase is source of truth" principle.

---

*Last updated: 2026-03-22 — Phase 1 complete*
