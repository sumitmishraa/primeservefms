/**
 * Reusable Supabase query functions for Primeserve.
 *
 * All functions:
 *   - Accept a typed SupabaseClient as the first argument (pass the admin client
 *     from admin.ts for server-side API routes, or the server client for
 *     RLS-enforced reads).
 *   - Return typed results matching the interfaces in src/types/index.ts.
 *   - Handle errors internally and return null / empty arrays instead of throwing.
 *   - Log errors to console.error for debugging in development.
 *
 * Usage in an API route:
 *   import { createAdminClient } from '@/lib/supabase/admin';
 *   import { getProductBySlug } from '@/lib/supabase/queries';
 *   const supabase = createAdminClient();
 *   const product = await getProductBySlug(supabase, 'scotch-brite-scrubber');
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  UserProfile,
  Product,
  ProductCategory,
  Subcategory,
  Order,
  OrderStatus,
  OrderItem,
  Message,
  VendorApplication,
  ProductFilters,
  AdminDashboardStats,
  VendorDashboardStats,
  BuyerDashboardStats,
  MessageThread,
} from '@/types/index';

/** Typed Supabase client — used for all query function signatures */
type DbClient = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Default pagination constants
// ---------------------------------------------------------------------------
const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

// ---------------------------------------------------------------------------
// 1. getUserById
// ---------------------------------------------------------------------------

/**
 * Fetches a user profile by their Supabase UUID.
 *
 * @param supabase - Typed Supabase client
 * @param userId - The user's Supabase UUID (users.id)
 * @returns UserProfile or null if not found
 */
export async function getUserById(
  supabase: DbClient,
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[getUserById]', error.message);
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// 2. getUserByFirebaseUid
// ---------------------------------------------------------------------------

/**
 * Fetches a user profile by their Firebase Auth UID.
 * Used during /api/auth/verify to look up (or confirm) the user record
 * after a Firebase OTP token is validated.
 *
 * @param supabase - Typed Supabase client
 * @param firebaseUid - Firebase Auth UID from verifyIdToken()
 * @returns UserProfile or null if no matching record exists
 */
export async function getUserByFirebaseUid(
  supabase: DbClient,
  firebaseUid: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (error) {
    // PGRST116 = no rows found — not a real error in this context
    if (error.code !== 'PGRST116') {
      console.error('[getUserByFirebaseUid]', error.message);
    }
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// 3. getProducts (marketplace — approved + active only)
// ---------------------------------------------------------------------------

/**
 * Fetches paginated, filtered products for the public marketplace.
 * Only returns products where is_approved = true AND is_active = true.
 *
 * @param supabase - Typed Supabase client
 * @param filters - Optional filters and pagination
 * @returns { products, total } — total is the count of all matching rows
 */
export async function getProducts(
  supabase: DbClient,
  filters: ProductFilters = {}
): Promise<{ products: Product[]; total: number }> {
  const {
    category,
    subcategory,
    search,
    min_price,
    max_price,
    stock_status,
    brand,
    sort_by = 'newest',
    page = DEFAULT_PAGE,
    per_page = DEFAULT_PER_PAGE,
  } = filters;

  const safePerPage = Math.min(per_page, MAX_PER_PAGE);
  const offset = (page - 1) * safePerPage;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('is_approved', true)
    .eq('is_active', true);

  if (category)     query = query.eq('category', category);
  if (subcategory)  query = query.eq('subcategory_slug', subcategory);
  if (search)       query = query.ilike('name', `%${search}%`);
  if (min_price !== undefined) query = query.gte('base_price', min_price);
  if (max_price !== undefined) query = query.lte('base_price', max_price);
  if (stock_status) query = query.eq('stock_status', stock_status);
  if (brand)        query = query.ilike('brand', brand);

  switch (sort_by) {
    case 'price_low':    query = query.order('base_price', { ascending: true });  break;
    case 'price_high':   query = query.order('base_price', { ascending: false }); break;
    case 'most_ordered': query = query.order('total_orders', { ascending: false }); break;
    case 'name_az':      query = query.order('name', { ascending: true });        break;
    default:             query = query.order('created_at', { ascending: false }); break; // newest
  }

  const { data, error, count } = await query.range(offset, offset + safePerPage - 1);

  if (error) {
    console.error('[getProducts]', error.message);
    return { products: [], total: 0 };
  }
  return { products: data ?? [], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// 4. getVendorProducts (all products for a vendor, including unapproved)
// ---------------------------------------------------------------------------

/**
 * Fetches all products for a specific vendor, including unapproved ones.
 * Used on the vendor dashboard product management page.
 *
 * @param supabase - Typed Supabase client (admin client recommended)
 * @param vendorId - The vendor's users.id
 * @param filters - Optional filters and pagination
 * @returns { products, total }
 */
export async function getVendorProducts(
  supabase: DbClient,
  vendorId: string,
  filters: Pick<ProductFilters, 'category' | 'search' | 'page' | 'per_page'> = {}
): Promise<{ products: Product[]; total: number }> {
  const {
    category,
    search,
    page = DEFAULT_PAGE,
    per_page = DEFAULT_PER_PAGE,
  } = filters;

  const safePerPage = Math.min(per_page, MAX_PER_PAGE);
  const offset = (page - 1) * safePerPage;

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .eq('vendor_id', vendorId);

  if (category) query = query.eq('category', category);
  if (search)   query = query.ilike('name', `%${search}%`);

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + safePerPage - 1);

  if (error) {
    console.error('[getVendorProducts]', error.message);
    return { products: [], total: 0 };
  }
  return { products: data ?? [], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// 5. getProductBySlug
// ---------------------------------------------------------------------------

/**
 * Fetches a single product by its URL slug, joined with minimal vendor info.
 * Used on the product detail page (/marketplace/[slug]).
 *
 * @param supabase - Typed Supabase client
 * @param slug - The product's URL-safe slug (products.slug)
 * @returns Product with vendor pick, or null if not found / not approved
 */
export async function getProductBySlug(
  supabase: DbClient,
  slug: string
): Promise<(Product & { vendor: Pick<UserProfile, 'id' | 'company_name' | 'business_verified'> }) | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      vendor:users!vendor_id (
        id,
        company_name,
        business_verified
      )
    `)
    .eq('slug', slug)
    .eq('is_approved', true)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[getProductBySlug]', error.message);
    }
    return null;
  }
  return data as unknown as Product & { vendor: Pick<UserProfile, 'id' | 'company_name' | 'business_verified'> };
}

// ---------------------------------------------------------------------------
// 6. getSubcategories
// ---------------------------------------------------------------------------

/**
 * Fetches subcategories from the database.
 * If a category is provided, returns only subcategories for that category.
 * Otherwise returns all 44 subcategories, ordered by category + sort_order.
 *
 * @param supabase - Typed Supabase client
 * @param category - Optional product_category enum value to filter by
 * @returns Array of Subcategory rows
 */
export async function getSubcategories(
  supabase: DbClient,
  category?: ProductCategory
): Promise<Subcategory[]> {
  let query = supabase
    .from('subcategories')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getSubcategories]', error.message);
    return [];
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// 7. getOrders
// ---------------------------------------------------------------------------

/**
 * Fetches paginated orders for a user based on their role.
 *
 * - buyer  → orders where buyer_id = userId
 * - vendor → orders where vendor_id = userId
 * - admin  → all orders (use admin client to bypass RLS)
 *
 * @param supabase - Typed Supabase client
 * @param userId - The user's Supabase UUID
 * @param role - The user's platform role ('buyer' | 'vendor' | 'admin')
 * @param filters - Optional status filter and pagination
 * @returns { orders, total }
 */
export async function getOrders(
  supabase: DbClient,
  userId: string,
  role: 'buyer' | 'vendor' | 'admin',
  filters: { status?: OrderStatus; page?: number; per_page?: number } = {}
): Promise<{ orders: Order[]; total: number }> {
  const {
    status,
    page = DEFAULT_PAGE,
    per_page = DEFAULT_PER_PAGE,
  } = filters;

  const safePerPage = Math.min(per_page, MAX_PER_PAGE);
  const offset = (page - 1) * safePerPage;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' });

  if (role === 'buyer')  query = query.eq('buyer_id', userId);
  if (role === 'vendor') query = query.eq('vendor_id', userId);
  // admin: no user filter — returns all orders

  if (status) query = query.eq('status', status);

  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + safePerPage - 1);

  if (error) {
    console.error('[getOrders]', error.message);
    return { orders: [], total: 0 };
  }
  return { orders: data ?? [], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// 8. getOrderById
// ---------------------------------------------------------------------------

/**
 * Fetches a single order by its UUID, joining order items and party details.
 * Used on the order detail page for both buyers and vendors.
 *
 * @param supabase - Typed Supabase client
 * @param orderId - The order's UUID (orders.id)
 * @returns Order with items, buyer info, and vendor info — or null if not found
 */
export async function getOrderById(
  supabase: DbClient,
  orderId: string
): Promise<(Order & {
  items: OrderItem[];
  buyer: Pick<UserProfile, 'company_name' | 'email' | 'phone'>;
  vendor: Pick<UserProfile, 'company_name'>;
}) | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items (*),
      buyer:users!buyer_id (
        company_name,
        email,
        phone
      ),
      vendor:users!vendor_id (
        company_name
      )
    `)
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      console.error('[getOrderById]', error.message);
    }
    return null;
  }
  return data as unknown as Order & {
    items: OrderItem[];
    buyer: Pick<UserProfile, 'company_name' | 'email' | 'phone'>;
    vendor: Pick<UserProfile, 'company_name'>;
  };
}

// ---------------------------------------------------------------------------
// 9. getMessages (grouped into conversation threads)
// ---------------------------------------------------------------------------

/**
 * Fetches all messages for a user and groups them into conversation threads.
 * Each thread represents a conversation with one other user, optionally
 * linked to a specific order.
 *
 * @param supabase - Typed Supabase client
 * @param userId - The current user's UUID
 * @returns Array of MessageThread objects, sorted by most recent message first
 */
export async function getMessages(
  supabase: DbClient,
  userId: string
): Promise<MessageThread[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getMessages]', error.message);
    return [];
  }

  const messages = (data ?? []) as Message[];

  // Group by (other_user_id, order_id) to build conversation threads
  const threadMap = new Map<string, MessageThread>();

  for (const msg of messages) {
    const otherUserId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
    const threadKey = `${otherUserId}__${msg.order_id ?? 'none'}`;

    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, {
        other_user_id: otherUserId,
        order_id: msg.order_id,
        order_number: null, // populated separately if needed
        unread_count: 0,
        latest_message: msg,
        messages: [],
      });
    }

    const thread = threadMap.get(threadKey)!;
    thread.messages.push(msg);

    // Count messages where this user is the receiver and hasn't read yet
    if (msg.receiver_id === userId && !msg.is_read) {
      thread.unread_count++;
    }

    // Keep latest_message as the most recent (messages are desc-ordered)
    if (new Date(msg.created_at) > new Date(thread.latest_message.created_at)) {
      thread.latest_message = msg;
    }
  }

  // Sort threads by most recent message
  return Array.from(threadMap.values()).sort(
    (a, b) =>
      new Date(b.latest_message.created_at).getTime() -
      new Date(a.latest_message.created_at).getTime()
  );
}

// ---------------------------------------------------------------------------
// 10. getVendorApplications
// ---------------------------------------------------------------------------

/**
 * Fetches vendor applications, optionally filtered by status.
 * Used on the admin vendor approval dashboard.
 *
 * @param supabase - Typed Supabase client (use admin client — admin-only operation)
 * @param status - Optional status filter ('pending' | 'approved' | 'rejected')
 * @returns Array of VendorApplication rows, ordered newest first
 */
export async function getVendorApplications(
  supabase: DbClient,
  status?: 'pending' | 'approved' | 'rejected'
): Promise<VendorApplication[]> {
  let query = supabase
    .from('vendor_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getVendorApplications]', error.message);
    return [];
  }
  return data ?? [];
}

// ---------------------------------------------------------------------------
// 11. getDashboardStats
// ---------------------------------------------------------------------------

/**
 * Returns role-specific dashboard statistics for a user.
 * Each role receives different metrics relevant to their workflow.
 *
 * @param supabase - Typed Supabase client (use admin client for accurate counts)
 * @param userId - The user's Supabase UUID
 * @param role - The user's platform role
 * @returns Role-specific stats object, or null on error
 */
export async function getDashboardStats(
  supabase: DbClient,
  userId: string,
  role: 'admin' | 'vendor' | 'buyer'
): Promise<AdminDashboardStats | VendorDashboardStats | BuyerDashboardStats | null> {

  if (role === 'admin') {
    const [
      { count: totalUsers },
      { count: totalVendors },
      { count: totalBuyers },
      { count: totalProducts },
      { count: totalOrders },
      { count: pendingApplications },
      revenueResult,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'buyer'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('vendor_applications').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('orders').select('total_amount').eq('payment_status', 'paid'),
    ]);

    const totalRevenue = (revenueResult.data ?? []).reduce(
      (sum: number, row: { total_amount: number }) => sum + (row.total_amount ?? 0),
      0
    );

    return {
      total_users: totalUsers ?? 0,
      total_vendors: totalVendors ?? 0,
      total_buyers: totalBuyers ?? 0,
      total_products: totalProducts ?? 0,
      total_orders: totalOrders ?? 0,
      pending_vendor_applications: pendingApplications ?? 0,
      total_revenue: totalRevenue,
    };
  }

  if (role === 'vendor') {
    const [
      { count: totalOrders },
      { count: pendingOrders },
      { count: confirmedOrders },
      { count: totalProducts },
      { count: activeProducts },
      revenueResult,
    ] = await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('vendor_id', userId),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('vendor_id', userId).eq('status', 'pending'),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('vendor_id', userId).eq('status', 'confirmed'),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('vendor_id', userId),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('vendor_id', userId).eq('is_active', true),
      supabase.from('orders').select('total_amount').eq('vendor_id', userId).eq('payment_status', 'paid'),
    ]);

    const totalRevenue = (revenueResult.data ?? []).reduce(
      (sum: number, row: { total_amount: number }) => sum + (row.total_amount ?? 0),
      0
    );

    return {
      total_orders: totalOrders ?? 0,
      pending_orders: pendingOrders ?? 0,
      confirmed_orders: confirmedOrders ?? 0,
      total_revenue: totalRevenue,
      total_products: totalProducts ?? 0,
      active_products: activeProducts ?? 0,
    };
  }

  // buyer
  const [
    { count: totalOrders },
    { count: pendingOrders },
    { count: deliveredOrders },
    spentResult,
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_id', userId),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_id', userId).eq('status', 'pending'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_id', userId).eq('status', 'delivered'),
    supabase.from('orders').select('total_amount').eq('buyer_id', userId).eq('payment_status', 'paid'),
  ]);

  const totalSpent = (spentResult.data ?? []).reduce(
    (sum: number, row: { total_amount: number }) => sum + (row.total_amount ?? 0),
    0
  );

  return {
    total_orders: totalOrders ?? 0,
    pending_orders: pendingOrders ?? 0,
    delivered_orders: deliveredOrders ?? 0,
    total_spent: totalSpent,
  };
}
