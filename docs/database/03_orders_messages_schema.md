# Migration 3 — Orders, Order Items & Messages

**File:** `supabase/migrations/20260322000003_orders_and_messages.sql`
**Depends on:** Migration 1 (enums, users), Migration 2 (products)

---

## What this migration builds

Three tables that power the core transaction and communication flows:

| Table | Purpose |
|---|---|
| `orders` | One record per buyer-vendor checkout session |
| `order_items` | Line items (products) within each order |
| `messages` | Buyer ↔ vendor inbox, optionally tied to an order |

---

## orders

### What it is
A single order represents a buyer purchasing one or more products from one vendor in a single checkout. Primeserve's B2B model means one cart checkout can generate multiple orders (one per vendor).

### Key columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `order_number` | TEXT UNIQUE | Human-readable: `PS-ORD-XXXXXX`. Auto-generated. |
| `buyer_id` | UUID → users | ON DELETE RESTRICT — never lose order history |
| `vendor_id` | UUID → users | ON DELETE RESTRICT — same reason |
| `status` | order_status enum | `pending → confirmed → processing → shipped → delivered` |
| `payment_status` | payment_status enum | `pending → paid → refunded / failed` |
| `subtotal` | DECIMAL(12,2) | Sum of line items before tax and shipping |
| `gst_amount` | DECIMAL(12,2) | Total GST across all items |
| `shipping_amount` | DECIMAL(12,2) | Flat shipping charge (0 = free shipping) |
| `total_amount` | DECIMAL(12,2) | Grand total: subtotal + GST + shipping |
| `shipping_address` | JSONB | Snapshot of delivery address at checkout |
| `billing_address` | JSONB | Snapshot of billing address (defaults to shipping) |
| `notes` | TEXT | Optional buyer instructions |
| `cancelled_reason` | TEXT | Populated when status → `cancelled` |
| `delivered_at` | TIMESTAMPTZ | Set when status → `delivered` |

### Why ON DELETE RESTRICT for buyer_id and vendor_id?
Orders are financial records. If a buyer or vendor account is deleted, you could face legal and accounting problems if you lose the order data. RESTRICT prevents the deletion entirely — an admin must handle the account archival first.

### Order number format
`PS-ORD-` followed by 6 random uppercase alphanumeric characters (A–Z, 0–9). Examples: `PS-ORD-K7BX2Q`, `PS-ORD-A3RNF1`. The `generate_order_number()` function loops until it finds a value not already in the table.

### Address JSONB structure
```json
{
  "name": "Ramesh Kumar",
  "line1": "Plot 12, MIDC Industrial Area",
  "line2": "Near Gate No. 3",
  "city": "Pune",
  "state": "Maharashtra",
  "pincode": "411019",
  "phone": "+919876543210"
}
```

### Triggers
- `set_order_number` — BEFORE INSERT, calls `generate_order_number()`
- `set_orders_updated_at` — BEFORE UPDATE, keeps `updated_at` current

---

## order_items

### What it is
Line items that belong to an order. Each row = one product at one quantity and price.

### Key design decision: snapshot columns
`product_name` and `product_sku` are copied from the products table **at the moment the order is created**. They never change after that. This means:
- The order always shows what the buyer actually purchased, even if the vendor later renames or edits the product.
- This is standard B2B practice (invoices must reflect the original transaction).

### Key columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `order_id` | UUID → orders | ON DELETE CASCADE — items deleted with order |
| `product_id` | UUID → products | ON DELETE RESTRICT — can't delete ordered products |
| `product_name` | TEXT | **Snapshot** — immutable after INSERT |
| `product_sku` | TEXT | **Snapshot** — immutable after INSERT |
| `quantity` | INTEGER | Must be ≥ 1 |
| `unit_price` | DECIMAL(10,2) | Per-unit INR price at time of purchase |
| `gst_rate` | DECIMAL(4,2) | GST % that applied at purchase time |
| `gst_amount` | DECIMAL(10,2) | `(unit_price × quantity) × (gst_rate / 100)` |
| `total_amount` | DECIMAL(12,2) | `(unit_price × quantity) + gst_amount` |

---

## messages

### What it is
A simple inbox between buyers and vendors. A message can be:
- A **pre-sale enquiry** — not linked to any order (`order_id = NULL`)
- An **order-related message** — linked to a specific order (`order_id` set)

### Key columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `sender_id` | UUID → users | ON DELETE CASCADE |
| `receiver_id` | UUID → users | ON DELETE CASCADE |
| `order_id` | UUID → orders | Optional. ON DELETE SET NULL |
| `subject` | TEXT | Optional subject line for inbox list view |
| `content` | TEXT | Required — the message body |
| `is_read` | BOOLEAN | FALSE until receiver opens the message |

### Why order_id uses ON DELETE SET NULL?
If an order is ever archived or deleted, you still want to keep the message history intact. Setting `order_id = NULL` preserves the message without creating an orphaned foreign key.

---

## Indexes

### Orders (6 indexes)
| Index | Column(s) | Use case |
|---|---|---|
| `idx_orders_buyer_id` | buyer_id | Buyer dashboard — "My Orders" |
| `idx_orders_vendor_id` | vendor_id | Vendor order queue |
| `idx_orders_status` | status | Status filter tabs on dashboards |
| `idx_orders_order_number` | order_number | Search bar / deep-link lookup |
| `idx_orders_created_at` | created_at DESC | Default sort: newest first |
| `idx_orders_payment_status` | payment_status | Finance / admin payment views |

### Order Items (2 indexes)
| Index | Column | Use case |
|---|---|---|
| `idx_order_items_order_id` | order_id | Load all items for an order detail page |
| `idx_order_items_product_id` | product_id | Product-level order history reports |

### Messages (5 indexes)
| Index | Column | Use case |
|---|---|---|
| `idx_messages_sender_id` | sender_id | "Sent" tab in messaging UI |
| `idx_messages_receiver_id` | receiver_id | Inbox / "Received" tab |
| `idx_messages_order_id` | order_id | Order detail page conversation thread |
| `idx_messages_created_at` | created_at DESC | Sort by newest message |
| `idx_messages_unread` | is_read WHERE is_read = FALSE | Unread badge count query |

The last index is a **partial index** — it only includes rows where `is_read = FALSE`. Since most messages eventually get read, this index stays small and fast regardless of total message volume.

---

## RLS Policies

### orders (5 policies)

| Policy | Operation | Rule |
|---|---|---|
| Buyers can view own orders | SELECT | `buyer_id = auth.uid()` |
| Vendors can view assigned orders | SELECT | `vendor_id = auth.uid()` |
| Buyers can create orders | INSERT | `buyer_id = auth.uid()` |
| Vendors can update order status | UPDATE | `vendor_id = auth.uid()` |
| Admins have full access | ALL | User has `role = 'admin'` |

### order_items (2 policies)

| Policy | Operation | Rule |
|---|---|---|
| Users can view items of their orders | SELECT | `order_id IN (orders where buyer or vendor = auth.uid())` |
| Admins have full access | ALL | User has `role = 'admin'` |

Note: order_items has no INSERT policy — items are always created by the server-side API using the admin client (service role), which bypasses RLS. End users never insert line items directly.

### messages (4 policies)

| Policy | Operation | Rule |
|---|---|---|
| Users can view sent or received | SELECT | `sender_id = auth.uid() OR receiver_id = auth.uid()` |
| Users can send messages | INSERT | `sender_id = auth.uid()` |
| Receiver can mark as read | UPDATE | `receiver_id = auth.uid()` |
| Admins can view all | SELECT | User has `role = 'admin'` |

---

## How the financial columns stay consistent

The API is responsible for calculating and writing all financial fields consistently:

1. For each order item: `gst_amount = (unit_price × quantity) × (gst_rate / 100)` and `total_amount = (unit_price × quantity) + gst_amount`
2. For the order: `subtotal = sum of (unit_price × quantity)` across all items, `gst_amount = sum of item gst_amounts`, `total_amount = subtotal + gst_amount + shipping_amount`

These are stored denormalised (calculated and saved, not computed on the fly) for fast retrieval on dashboards and invoices without needing to re-sum every time.
