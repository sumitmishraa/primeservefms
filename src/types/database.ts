/**
 * Supabase database types — hand-written to match all 5 migrations exactly.
 * Re-generate by running: pnpm supabase gen types typescript --project-id <id>
 *
 * Table inventory (10 tables, 7 enums):
 *   users, subcategories, vendor_applications   ← Migration 1
 *   products                                    ← Migration 2
 *   orders, order_items, messages               ← Migration 3
 *   vendor_directory                            ← Migration 4
 *   clients, branches                           ← Migration 5
 */

// ---------------------------------------------------------------------------
// JSON primitive — used for JSONB columns
// ---------------------------------------------------------------------------
type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

// ---------------------------------------------------------------------------
// Helpers for address JSONB (used in orders)
// ---------------------------------------------------------------------------
interface AddressJson {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string;
}

// ---------------------------------------------------------------------------
// Helper for business documents JSONB (used in users, vendor_applications)
// ---------------------------------------------------------------------------
interface BusinessDocumentJson {
  doc_type: string;
  url: string;
  uploaded_at: string;
}

// ---------------------------------------------------------------------------
// Helper for pricing tiers JSONB (used in products)
// ---------------------------------------------------------------------------
interface PricingTierJson {
  min_qty: number;
  max_qty: number | null;
  price: number;
}

// ---------------------------------------------------------------------------
// Main Database type
// ---------------------------------------------------------------------------
export type Database = {
  public: {
    Tables: {

      // -----------------------------------------------------------------------
      // users — all platform participants (admins, buyers, vendors)
      // Migration 1, Section 4
      // -----------------------------------------------------------------------
      users: {
        Row: {
          id: string;
          firebase_uid: string | null;
          role: Database['public']['Enums']['user_role'];
          email: string | null;
          phone: string | null;
          full_name: string;
          avatar_url: string | null;
          company_name: string | null;
          company_type: string | null;
          gst_number: string | null;
          tax_id: string | null;
          business_verified: boolean;
          business_documents: BusinessDocumentJson[];
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          pincode: string | null;
          password_hash: string | null;
          is_active: boolean;
          client_id: string | null;
          branch_id: string | null;
          saved_addresses: Json | null;
          // ── Migration 8: extended buyer profile/KYC fields ──────────────
          designation: string | null;
          department: string | null;
          alt_phone: string | null;
          procurement_email: string | null;
          invoice_email: string | null;
          legal_company_name: string | null;
          trade_name: string | null;
          cin_number: string | null;
          msme_number: string | null;
          website: string | null;
          incorporation_year: number | null;
          expected_monthly_spend: string | null;
          payment_contact_name: string | null;
          payment_contact_email: string | null;
          payment_contact_phone: string | null;
          finance_approver_name: string | null;
          finance_approver_email: string | null;
          finance_approver_phone: string | null;
          po_required: boolean;
          billing_cycle_notes: string | null;
          branch_contact_person: string | null;
          delivery_contact_phone: string | null;
          delivery_window_notes: string | null;
          loading_unloading_notes: string | null;
          branch_purchase_notes: string | null;
          // ────────────────────────────────────────────────────────────────
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firebase_uid?: string | null;
          role?: Database['public']['Enums']['user_role'];
          email?: string | null;
          phone?: string | null;
          full_name: string;
          avatar_url?: string | null;
          company_name?: string | null;
          company_type?: string | null;
          gst_number?: string | null;
          tax_id?: string | null;
          business_verified?: boolean;
          business_documents?: Json;
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          pincode?: string | null;
          password_hash?: string | null;
          is_active?: boolean;
          client_id?: string | null;
          branch_id?: string | null;
          saved_addresses?: Json | null;
          designation?: string | null;
          department?: string | null;
          alt_phone?: string | null;
          procurement_email?: string | null;
          invoice_email?: string | null;
          legal_company_name?: string | null;
          trade_name?: string | null;
          cin_number?: string | null;
          msme_number?: string | null;
          website?: string | null;
          incorporation_year?: number | null;
          expected_monthly_spend?: string | null;
          payment_contact_name?: string | null;
          payment_contact_email?: string | null;
          payment_contact_phone?: string | null;
          finance_approver_name?: string | null;
          finance_approver_email?: string | null;
          finance_approver_phone?: string | null;
          po_required?: boolean;
          billing_cycle_notes?: string | null;
          branch_contact_person?: string | null;
          delivery_contact_phone?: string | null;
          delivery_window_notes?: string | null;
          loading_unloading_notes?: string | null;
          branch_purchase_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // subcategories — reference table for all 44 subcategories
      // Migration 1, Section 1
      // -----------------------------------------------------------------------
      subcategories: {
        Row: {
          id: string;
          category: Database['public']['Enums']['product_category'];
          name: string;
          slug: string;
          display_name: string;
          description: string | null;
          icon_name: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          category: Database['public']['Enums']['product_category'];
          name: string;
          slug: string;
          display_name: string;
          description?: string | null;
          icon_name?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['subcategories']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // vendor_applications — onboarding applications for admin review
      // Migration 1, Section 5
      // -----------------------------------------------------------------------
      vendor_applications: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          gst_number: string | null;
          business_type: string | null;
          business_documents: BusinessDocumentJson[];
          product_categories: Database['public']['Enums']['product_category'][] | null;
          description: string | null;
          status: Database['public']['Enums']['vendor_application_status'];
          reviewed_by: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_name: string;
          gst_number?: string | null;
          business_type?: string | null;
          business_documents?: Json;
          product_categories?: Database['public']['Enums']['product_category'][] | null;
          description?: string | null;
          status?: Database['public']['Enums']['vendor_application_status'];
          reviewed_by?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vendor_applications']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // products — vendor product listings on the marketplace
      // Migration 2
      // -----------------------------------------------------------------------
      products: {
        Row: {
          id: string;
          vendor_id: string | null;
          uploaded_by: string | null;
          name: string;
          slug: string;
          description: string | null;
          short_description: string | null;
          sku: string | null;
          category: Database['public']['Enums']['product_category'];
          subcategory_id: string | null;
          subcategory_slug: string | null;
          brand: string | null;
          size_variant: string | null;
          /** Groups variant products together on the PDP. Null = standalone. */
          group_slug: string | null;
          unit_of_measure: Database['public']['Enums']['unit_of_measure'];
          base_price: number;
          moq: number;
          pricing_tiers: PricingTierJson[];
          images: string[];
          thumbnail_url: string | null;
          stock_status: Database['public']['Enums']['stock_status'];
          stock_quantity: number;
          is_approved: boolean;
          is_active: boolean;
          hsn_code: string | null;
          gst_rate: number;
          specifications: Record<string, string>;
          tags: string[];
          total_orders: number;
          avg_rating: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_id?: string | null;
          uploaded_by?: string | null;
          name: string;
          slug?: string;
          description?: string | null;
          short_description?: string | null;
          sku?: string | null;
          category: Database['public']['Enums']['product_category'];
          subcategory_id?: string | null;
          subcategory_slug?: string | null;
          brand?: string | null;
          size_variant?: string | null;
          group_slug?: string | null;
          unit_of_measure?: Database['public']['Enums']['unit_of_measure'];
          base_price: number;
          moq?: number;
          pricing_tiers?: Json;
          images?: string[];
          thumbnail_url?: string | null;
          stock_status?: Database['public']['Enums']['stock_status'];
          stock_quantity?: number;
          is_approved?: boolean;
          is_active?: boolean;
          hsn_code?: string | null;
          gst_rate?: number;
          specifications?: Json;
          tags?: string[];
          total_orders?: number;
          avg_rating?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // orders — one per buyer-vendor checkout session
      // Migration 3, Section 2
      // -----------------------------------------------------------------------
      orders: {
        Row: {
          id: string;
          order_number: string;
          buyer_id: string;
          vendor_id: string;
          status: Database['public']['Enums']['order_status'];
          payment_status: Database['public']['Enums']['payment_status'];
          subtotal: number;
          gst_amount: number;
          shipping_amount: number;
          total_amount: number;
          shipping_address: AddressJson;
          billing_address: AddressJson | null;
          notes: string | null;
          cancelled_reason: string | null;
          delivered_at: string | null;
          assigned_vendor_name: string | null;
          assigned_vendor_phone: string | null;
          admin_notes: string | null;
          forwarded_at: string | null;
          dispatched_at: string | null;
          client_id: string | null;
          branch_id: string | null;
          razorpay_order_id: string | null;
          razorpay_payment_id: string | null;
          gst_number: string | null;
          payment_method: 'razorpay' | 'credit_45day';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          buyer_id: string;
          vendor_id?: string | null;
          status?: Database['public']['Enums']['order_status'];
          payment_status?: Database['public']['Enums']['payment_status'];
          subtotal?: number;
          gst_amount?: number;
          shipping_amount?: number;
          total_amount?: number;
          shipping_address: Json;
          billing_address?: Json | null;
          notes?: string | null;
          cancelled_reason?: string | null;
          delivered_at?: string | null;
          assigned_vendor_name?: string | null;
          assigned_vendor_phone?: string | null;
          admin_notes?: string | null;
          forwarded_at?: string | null;
          dispatched_at?: string | null;
          client_id?: string | null;
          branch_id?: string | null;
          razorpay_order_id?: string | null;
          razorpay_payment_id?: string | null;
          gst_number?: string | null;
          payment_method?: 'razorpay' | 'credit_45day';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // order_items — line items for each order (product name is a snapshot)
      // Migration 3, Section 5
      // -----------------------------------------------------------------------
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string;
          product_name: string;
          product_sku: string | null;
          quantity: number;
          unit_price: number;
          gst_rate: number;
          gst_amount: number;
          total_amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          product_sku?: string | null;
          quantity: number;
          unit_price: number;
          gst_rate: number;
          gst_amount: number;
          total_amount: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // vendor_directory — internal admin contact book for offline vendors
      // Migration 4
      // -----------------------------------------------------------------------
      vendor_directory: {
        Row: {
          id: string;
          name: string;
          company_name: string;
          phone: string;
          whatsapp: string | null;
          email: string | null;
          address: string | null;
          city: string;
          categories: Database['public']['Enums']['product_category'][];
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          company_name: string;
          phone: string;
          whatsapp?: string | null;
          email?: string | null;
          address?: string | null;
          city?: string;
          categories?: Database['public']['Enums']['product_category'][];
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['vendor_directory']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // clients — company accounts (Blinkit, Zomato, Taj Hotels)
      // Migration 5
      // -----------------------------------------------------------------------
      clients: {
        Row: {
          id: string;
          name: string;
          display_name: string;
          industry: string | null;
          logo_url: string | null;
          contact_person: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          address: string | null;
          city: string;
          gst_number: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          display_name: string;
          industry?: string | null;
          logo_url?: string | null;
          contact_person?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          address?: string | null;
          city?: string;
          gst_number?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // branches — locations under a client (e.g. Blinkit Koramangala)
      // Migration 5
      // -----------------------------------------------------------------------
      branches: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          branch_code: string | null;
          address: string | null;
          city: string;
          area: string | null;
          pincode: string | null;
          contact_person: string | null;
          contact_phone: string | null;
          contact_email: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          branch_code?: string | null;
          address?: string | null;
          city?: string;
          area?: string | null;
          pincode?: string | null;
          contact_person?: string | null;
          contact_phone?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['branches']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // messages — buyer ↔ vendor inbox, optionally tied to an order
      // Migration 3, Section 7
      // -----------------------------------------------------------------------
      messages: {
        Row: {
          id: string;
          sender_id: string;
          receiver_id: string;
          order_id: string | null;
          subject: string | null;
          content: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          receiver_id: string;
          order_id?: string | null;
          subject?: string | null;
          content: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // contact_messages — public Contact form submissions
      // Migration 6
      // -----------------------------------------------------------------------
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          message: string;
          source: string;
          is_resolved: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          message: string;
          source?: string;
          is_resolved?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contact_messages']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // newsletter_subscribers — PublicFooter newsletter signups
      // Migration 6
      // -----------------------------------------------------------------------
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          source: string;
          is_active: boolean;
          subscribed_at: string;
          unsubscribed_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          source?: string;
          is_active?: boolean;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['newsletter_subscribers']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // credit_accounts — admin-assigned credit limits per buyer
      // Migration 7
      // -----------------------------------------------------------------------
      credit_accounts: {
        Row: {
          id: string;
          buyer_id: string;
          credit_limit: number;
          used_amount: number;
          status: 'pending' | 'active' | 'suspended';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          credit_limit?: number;
          used_amount?: number;
          status?: 'pending' | 'active' | 'suspended';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['credit_accounts']['Insert']>;
        Relationships: never[];
      };

      // -----------------------------------------------------------------------
      // quote_requests — buyer monthly requirement uploads / quote requests
      // Migration 7
      // -----------------------------------------------------------------------
      quote_requests: {
        Row: {
          id: string;
          buyer_id: string;
          title: string;
          status: 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected';
          items: Json;
          notes: string | null;
          document_url: string | null;
          admin_notes: string | null;
          quoted_amount: number | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          title: string;
          status?: 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected';
          items?: Json;
          notes?: string | null;
          document_url?: string | null;
          admin_notes?: string | null;
          quoted_amount?: number | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['quote_requests']['Insert']>;
        Relationships: never[];
      };
    };

    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };

    Enums: {
      /** Platform user role — determines dashboard and permissions */
      user_role: 'admin' | 'buyer' | 'vendor';

      /** Top-level product categories (stable — stored as ENUM in DB) */
      product_category:
        | 'housekeeping_materials'
        | 'cleaning_chemicals'
        | 'pantry_items'
        | 'office_stationeries'
        | 'facility_and_tools'
        | 'printing_solution';

      /**
       * Order lifecycle — admin-centric flow (Migration 4).
       * Active values: pending → approved → forwarded_to_vendor → dispatched → delivered (or cancelled).
       * Legacy values (confirmed, processing, shipped) remain in DB but are no longer used.
       */
      order_status:
        | 'pending'
        | 'approved'
        | 'forwarded_to_vendor'
        | 'dispatched'
        | 'delivered'
        | 'cancelled'
        | 'confirmed'    // legacy — do not use
        | 'processing'   // legacy — do not use
        | 'shipped';     // legacy — do not use

      /** Payment state alongside order status */
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded';

      /** Product inventory availability */
      stock_status: 'in_stock' | 'out_of_stock' | 'low_stock';

      /** Vendor onboarding application review state */
      vendor_application_status: 'pending' | 'approved' | 'rejected';

      /**
       * Units of measure derived from the real product catalog.
       * ream = paper; pkt = packets; can = chemical cans.
       */
      unit_of_measure:
        | 'piece'
        | 'kg'
        | 'liter'
        | 'pack'
        | 'box'
        | 'carton'
        | 'roll'
        | 'pair'
        | 'set'
        | 'ream'
        | 'pkt'
        | 'can'
        | 'bottle'
        | 'tube';
    };
  };
};

// ---------------------------------------------------------------------------
// Convenience type aliases — import these in components and API routes
// ---------------------------------------------------------------------------
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];
