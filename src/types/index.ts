/**
 * Primeserve application types.
 * Clean named interfaces derived from the Database Row types.
 * Import these in components, hooks, and API routes — not the raw Database type.
 */

import type { Tables, Enums } from './database';

// ---------------------------------------------------------------------------
// Re-export enum types for convenient use throughout the app
// ---------------------------------------------------------------------------

export type UserRole = Enums<'user_role'>;
export type ProductCategory = Enums<'product_category'>;
export type OrderStatus = Enums<'order_status'>;
export type PaymentStatus = Enums<'payment_status'>;
export type StockStatus = Enums<'stock_status'>;
export type VendorApplicationStatus = Enums<'vendor_application_status'>;
export type UnitOfMeasure = Enums<'unit_of_measure'>;

// ---------------------------------------------------------------------------
// Core entity interfaces (mapped 1:1 from database Row types)
// ---------------------------------------------------------------------------

/**
 * A registered user in Primeserve.
 * Authenticated via Firebase OTP; all profile data lives in Supabase.
 * client_id and branch_id link buyers to their company and location (Migration 5).
 */
export type UserProfile = Tables<'users'>;

/**
 * A product subcategory from the reference table.
 * Belongs to one of the 6 top-level product_category enum values.
 * 44 rows are seeded in Migration 1.
 */
export type Subcategory = Tables<'subcategories'>;

/**
 * A vendor product listing on the marketplace.
 * Only visible to the public when is_approved = true AND is_active = true.
 */
export type Product = Tables<'products'>;

/**
 * A purchase order placed by a buyer.
 * Fulfilled by PrimeServe admin who assigns an offline vendor.
 * Tracks the full admin-centric flow: pending → approved → forwarded_to_vendor → dispatched → delivered.
 * Financial record — never deleted.
 */
export type Order = Tables<'orders'>;

/**
 * A line item within an order.
 * product_name and product_sku are snapshots taken at checkout time
 * and never change — even if the vendor later renames the product.
 */
export type OrderItem = Tables<'order_items'>;

/**
 * A direct message between a buyer and vendor.
 * Can be a pre-sale enquiry (order_id = null) or order-linked support message.
 */
export type Message = Tables<'messages'>;

/**
 * A vendor onboarding application submitted for admin review.
 */
export type VendorApplication = Tables<'vendor_applications'>;

/**
 * An entry in the admin's internal vendor contact book.
 * NOT a platform account — vendors are managed offline via WhatsApp/phone.
 * Admin uses this to look up who to forward an order to.
 */
export type VendorContact = Tables<'vendor_directory'>;

/**
 * A client company in the Primeserve system (e.g. Blinkit, Zomato, Taj Hotels).
 * Admin assigns registered buyers to a client for B2B order tracking.
 */
export type Client = Tables<'clients'>;

/**
 * A branch/location under a client (e.g. Blinkit Koramangala, Blinkit HSR Layout).
 * Buyers are assigned to a specific branch so orders are tracked per location.
 */
export type Branch = Tables<'branches'>;

// ---------------------------------------------------------------------------
// Embedded / JSONB shape interfaces
// ---------------------------------------------------------------------------

/**
 * Volume pricing tier stored in products.pricing_tiers JSONB array.
 * Buyers see the lowest applicable price based on their order quantity.
 *
 * @example
 *   { min_qty: 1,   max_qty: 9,    price: 250 }  ← single unit
 *   { min_qty: 10,  max_qty: null, price: 220 }  ← bulk (no upper limit)
 */
export interface PricingTier {
  /** Minimum quantity (inclusive) for this tier to apply */
  min_qty: number;
  /** Maximum quantity (inclusive). null = no upper limit */
  max_qty: number | null;
  /** Price per unit in INR for this quantity range */
  price: number;
}

/**
 * Shipping or billing address — stored as JSONB snapshot in orders.
 * Captured at checkout so the order reflects where it was actually sent,
 * regardless of any later changes to the buyer's profile address.
 */
export interface ShippingAddress {
  /** Full name of the person receiving the delivery */
  name: string;
  /** Building, street, locality */
  line1: string;
  /** Area, landmark — optional */
  line2?: string | null;
  /** City name */
  city: string;
  /** State name */
  state: string;
  /** Indian 6-digit postal code */
  pincode: string;
  /** Contact phone number (E.164 format preferred) */
  phone: string;
}

/**
 * Business document uploaded as part of a vendor application or user profile.
 * File is stored in Supabase Storage; only the URL is persisted here.
 */
export interface BusinessDocument {
  /** Human-readable document type label */
  doc_type: 'gst_certificate' | 'trade_license' | 'pan_card' | 'bank_statement' | 'other';
  /** Supabase Storage public URL */
  url: string;
  /** ISO 8601 timestamp of upload */
  uploaded_at: string;
}

// ---------------------------------------------------------------------------
// Input / form shapes (used when creating new records via API)
// ---------------------------------------------------------------------------

/**
 * One line item submitted when creating an order via POST /api/orders.
 * The API reads current product data and validates these values before inserting.
 */
export interface OrderItemInput {
  /** products.id of the item being ordered */
  product_id: string;
  /** Snapshot of the product name at checkout (copied from products.name) */
  product_name: string;
  /** Snapshot of the SKU at checkout — undefined if the product had no SKU */
  product_sku?: string;
  /** Number of units being ordered (must be ≥ product.moq) */
  quantity: number;
  /** Resolved unit price in INR — from pricing_tiers or base_price */
  unit_price: number;
  /** GST rate that applied at time of checkout */
  gst_rate: number;
  /** Calculated GST: (unit_price × quantity) × (gst_rate / 100) */
  gst_amount: number;
  /** Line total inclusive of GST: (unit_price × quantity) + gst_amount */
  total_amount: number;
}

// ---------------------------------------------------------------------------
// Client-side cart shapes
// ---------------------------------------------------------------------------

/**
 * A product in the buyer's shopping cart (Zustand cartStore).
 * Flat/denormalized so the cart can be persisted to localStorage without
 * embedding the full Product record. Prices recalculate when quantity changes.
 */
export interface CartItem {
  /** products.id */
  product_id: string;
  /** Snapshot of product name at add-to-cart time */
  product_name: string;
  /** products.slug — used to link back to the product page */
  product_slug: string;
  /** Brand label, e.g. "Scotch-Brite" */
  brand: string | null;
  /** Size or variant label, e.g. "500ml" */
  size_variant: string | null;
  /** Primary image thumbnail URL */
  thumbnail_url: string | null;
  /** Top-level product category enum */
  category: ProductCategory;
  /** Unit of measure enum, e.g. "piece", "litre" */
  unit_of_measure: UnitOfMeasure;
  /** Listed base price in INR (before tier discounts) */
  base_price: number;
  /** Applicable GST rate as a percentage (0 | 5 | 12 | 18 | 28) */
  gst_rate: number;
  /** Minimum order quantity — enforced on add and update */
  moq: number;
  /** Buyer's chosen quantity (must be >= moq) */
  quantity: number;
  /** Resolved price per unit based on current quantity and pricing_tiers */
  unit_price: number;
  /** Full pricing tier array — kept so price can recalculate on qty change */
  pricing_tiers: PricingTier[];
}

// ---------------------------------------------------------------------------
// Filter / query shapes
// ---------------------------------------------------------------------------

/**
 * Filter and sort options for the marketplace product listing API.
 * All fields are optional — omitting a field means no filter on that dimension.
 */
export interface ProductFilters {
  /** Filter by top-level category enum value */
  category?: ProductCategory;
  /** Filter by subcategory slug (denormalized on products.subcategory_slug) */
  subcategory?: string;
  /** Full-text search on product name (case-insensitive ILIKE) */
  search?: string;
  /** Minimum base_price in INR (inclusive) */
  min_price?: number;
  /** Maximum base_price in INR (inclusive) */
  max_price?: number;
  /** Filter by inventory availability */
  stock_status?: StockStatus;
  /** Filter by brand name (exact, case-insensitive) */
  brand?: string;
  /** Sort order for results */
  sort_by?: 'newest' | 'price_low' | 'price_high' | 'most_ordered' | 'name_az';
  /** 1-indexed page number (default: 1) */
  page?: number;
  /** Results per page (default: 20, max: 100) */
  per_page?: number;
}

// ---------------------------------------------------------------------------
// Auth session types
// ---------------------------------------------------------------------------

/**
 * Payload encoded inside the httpOnly session cookie.
 * Signed with HMAC-SHA256 using SESSION_SECRET env var.
 */
export interface SessionPayload {
  /** Supabase users.id (UUID) */
  userId: string;
  role: UserRole;
  /** Unix timestamp (seconds) when the session expires */
  exp: number;
}

/**
 * Slim user object returned in auth API responses.
 * Contains only what the frontend needs — no internal DB fields.
 */
export interface AuthUser {
  id: string;
  role: UserRole;
  full_name: string;
  company_name: string | null;
  business_verified: boolean;
  email: string | null;
  phone: string | null;
}

// ---------------------------------------------------------------------------
// API response wrappers
// ---------------------------------------------------------------------------

/**
 * Standard envelope for all API route responses.
 * Always check `error` before accessing `data`.
 *
 * @example
 *   const { data, error } = await res.json() as ApiResponse<Product[]>;
 *   if (error) { toast.error(error); return; }
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

/**
 * Paginated list response — combines data rows with pagination metadata.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    /** Current page number (1-indexed) */
    page: number;
    /** Items per page */
    per_page: number;
    /** Total matching items across all pages */
    total: number;
    /** Total number of pages */
    total_pages: number;
  };
  error: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard stats shapes
// ---------------------------------------------------------------------------

/** Stats shown on the admin dashboard */
export interface AdminDashboardStats {
  total_users: number;
  total_vendors: number;
  total_buyers: number;
  total_products: number;
  total_orders: number;
  pending_vendor_applications: number;
  total_revenue: number;
}

/** Stats shown on the vendor dashboard */
export interface VendorDashboardStats {
  total_orders: number;
  pending_orders: number;
  confirmed_orders: number;
  total_revenue: number;
  total_products: number;
  active_products: number;
}

/** Stats shown on the buyer dashboard */
export interface BuyerDashboardStats {
  total_orders: number;
  pending_orders: number;
  delivered_orders: number;
  total_spent: number;
}

/** Stats computed for a single client */
export interface ClientStats {
  total_branches: number;
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
  last_order_date: string | null;
}

/** Client with computed stats — returned by GET /api/admin/clients */
export interface ClientWithStats extends Client {
  total_branches: number;
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
  last_order_date: string | null;
}

/** Branch with computed stats */
export interface BranchWithStats extends Branch {
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
  last_order_date: string | null;
}

// ---------------------------------------------------------------------------
// Message conversation grouping
// ---------------------------------------------------------------------------

/** A conversation thread — all messages between two users, optionally for one order */
export interface MessageThread {
  /** The other party in the conversation */
  other_user_id: string;
  /** Order this thread is about — null for general enquiries */
  order_id: string | null;
  /** Order number for display — null for general enquiries */
  order_number: string | null;
  /** Number of unread messages in this thread (for the current user) */
  unread_count: number;
  /** Most recent message for preview */
  latest_message: Message;
  /** All messages in chronological order */
  messages: Message[];
}
