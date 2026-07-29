export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Timestamps = { created_at: string; updated_at: string };

export type UserRole = "customer" | "staff" | "admin";
export type ProductStatus = "draft" | "active" | "archived";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";
export type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "failed"
  | "refunded";

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        Timestamps & {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          avatar_url: string | null;
          preferred_language: "en" | "bn";
          role: UserRole;
        }
      >;
      addresses: Table<
        Timestamps & {
          id: string;
          user_id: string;
          recipient_name: string;
          phone: string;
          division: string;
          district: string;
          upazila: string;
          area: string;
          postal_code: string | null;
          full_address: string;
          delivery_note: string | null;
          is_default: boolean;
        }
      >;
      categories: Table<
        Timestamps & {
          id: string;
          slug: string;
          name_en: string;
          name_bn: string;
          description_en: string | null;
          description_bn: string | null;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
        }
      >;
      collections: Table<
        Timestamps & {
          id: string;
          slug: string;
          name_en: string;
          name_bn: string;
          description_en: string | null;
          description_bn: string | null;
          image_url: string | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          is_featured: boolean;
          sort_order: number;
        }
      >;
      products: Table<
        Timestamps & {
          id: string;
          slug: string;
          name_en: string;
          name_bn: string;
          description_en: string;
          description_bn: string;
          category_id: string;
          collection_id: string | null;
          base_price: number;
          compare_at_price: number | null;
          fabric_en: string;
          fabric_bn: string;
          product_code: string;
          status: ProductStatus;
          is_new: boolean;
          is_featured: boolean;
          is_best_seller: boolean;
          care_instructions_en: string;
          care_instructions_bn: string;
          tags: string[];
          unstitched_details: Json | null;
          ready_made_details: Json | null;
          average_rating: number;
          review_count: number;
        }
      >;
      product_images: Table<{
        id: string;
        product_id: string;
        image_url: string;
        storage_path: string | null;
        alt_en: string;
        alt_bn: string;
        sort_order: number;
        is_primary: boolean;
        created_at: string;
        updated_at: string;
      }>;
      product_variants: Table<
        Timestamps & {
          id: string;
          product_id: string;
          sku: string;
          size: string;
          colour_en: string;
          colour_bn: string;
          colour_hex: string;
          price_override: number | null;
          stock_quantity: number;
          low_stock_threshold: number;
          is_active: boolean;
        }
      >;
      carts: Table<Timestamps & { id: string; user_id: string }>;
      cart_items: Table<
        Timestamps & {
          id: string;
          cart_id: string;
          product_variant_id: string;
          quantity: number;
        }
      >;
      wishlist_items: Table<{
        id: string;
        user_id: string;
        product_id: string;
        created_at: string;
      }>;
      orders: Table<
        Timestamps & {
          id: string;
          order_number: string;
          user_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string;
          status: OrderStatus;
          payment_status: PaymentStatus;
          payment_method: "cash_on_delivery" | "online";
          delivery_method: "standard" | "express";
          subtotal: number;
          delivery_fee: number;
          discount_amount: number;
          total: number;
          currency: "BDT";
          shipping_address: Json;
          customer_note: string | null;
          tracking_token: string;
        }
      >;
      order_items: Table<{
        id: string;
        order_id: string;
        product_id: string;
        product_variant_id: string;
        product_name_en: string;
        product_name_bn: string;
        product_code: string;
        sku: string;
        size: string;
        colour_en: string;
        colour_bn: string;
        unit_price: number;
        quantity: number;
        line_total: number;
        product_image_url: string;
        created_at: string;
      }>;
      coupons: Table<
        Timestamps & {
          id: string;
          code: string;
          description_en: string;
          description_bn: string;
          discount_type: "fixed" | "percentage";
          discount_value: number;
          minimum_order_amount: number;
          maximum_discount_amount: number | null;
          starts_at: string | null;
          expires_at: string | null;
          usage_limit: number | null;
          usage_count: number;
          is_active: boolean;
        }
      >;
      coupon_redemptions: Table<{
        id: string;
        coupon_id: string;
        order_id: string;
        user_id: string | null;
        discount_amount: number;
        created_at: string;
      }>;
      reviews: Table<
        Timestamps & {
          id: string;
          product_id: string;
          user_id: string | null;
          order_item_id: string | null;
          author_name: string;
          rating: number;
          title: string | null;
          comment_en: string;
          comment_bn: string | null;
          status: "pending" | "approved" | "rejected";
        }
      >;
      order_tracking_events: Table<{
        id: string;
        order_id: string;
        status: OrderStatus;
        note_en: string | null;
        note_bn: string | null;
        created_by: string | null;
        created_at: string;
      }>;
      contact_messages: Table<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        message: string;
        status: "new" | "read" | "resolved";
        created_at: string;
        updated_at: string;
      }>;
      newsletter_subscribers: Table<{
        id: string;
        email: string;
        preferred_language: "en" | "bn";
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>;
      store_settings: Table<{
        key: string;
        value: Json;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      place_order: {
        Args: {
          p_customer: Json;
          p_shipping_address: Json;
          p_items: Json;
          p_delivery_method: string;
          p_payment_method: string;
          p_coupon_code?: string | null;
          p_customer_note?: string | null;
        };
        Returns: Json;
      };
      get_guest_order_tracking: {
        Args: { p_order_number: string; p_tracking_token: string };
        Returns: Json;
      };
      admin_update_order_status: {
        Args: {
          p_order_id: string;
          p_status: OrderStatus;
          p_payment_status: PaymentStatus;
          p_note?: string | null;
        };
        Returns: Json;
      };
      validate_coupon: {
        Args: { p_code: string; p_subtotal: number };
        Returns: Json;
      };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_full_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      ensure_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      set_profile_role: {
        Args: { p_profile_id: string; p_role: UserRole };
        Returns: undefined;
      };
      submit_contact_message: {
        Args: { p_name: string; p_email: string; p_phone: string; p_message: string };
        Returns: string;
      };
      subscribe_newsletter: {
        Args: { p_email: string; p_language?: string };
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      product_status: ProductStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
