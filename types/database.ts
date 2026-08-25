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

export type UserRole =
  | "customer"
  | "support"
  | "fulfilment"
  | "manager"
  | "staff"
  | "admin";
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
  | "refunded"
  | "partially_refunded";
export type PaymentMethod = "cash_on_delivery" | "online";
export type DeliveryMethod = "standard" | "express";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type MessageStatus = "new" | "read" | "replied" | "resolved";
export type DiscountType = "fixed" | "percentage";
export type NotificationStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

export type InventoryAdjustmentReason =
  | "restock"
  | "correction"
  | "damaged"
  | "lost"
  | "return_to_stock"
  | "transfer"
  | "other";

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
          role: UserRole;
          is_active: boolean;
          last_seen_at: string | null;
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
          description_en: string | null;
          image_url: string | null;
          is_active: boolean;
          sort_order: number;
          seo_title: string | null;
          seo_description: string | null;
        }
      >;
      collections: Table<
        Timestamps & {
          id: string;
          slug: string;
          name_en: string;
          description_en: string | null;
          image_url: string | null;
          starts_at: string | null;
          ends_at: string | null;
          is_active: boolean;
          is_featured: boolean;
          sort_order: number;
          seo_title: string | null;
          seo_description: string | null;
        }
      >;
      products: Table<
        Timestamps & {
          id: string;
          slug: string;
          name_en: string;
          description_en: string;
          category_id: string;
          collection_id: string | null;
          base_price: number;
          compare_at_price: number | null;
          fabric_en: string;
          product_code: string;
          status: ProductStatus;
          is_new: boolean;
          is_featured: boolean;
          is_best_seller: boolean;
          care_instructions_en: string;
          tags: string[];
          unstitched_details: Json | null;
          ready_made_details: Json | null;
          average_rating: number;
          review_count: number;
          seo_title: string | null;
          seo_description: string | null;
          material_en: string;
          size_guide_note_en: string;
          archived_at: string | null;
        }
      >;
      product_images: Table<{
        id: string;
        product_id: string;
        image_url: string;
        storage_path: string | null;
        alt_en: string;
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
          colour_hex: string;
          price_override: number | null;
          stock_quantity: number;
          reserved_quantity: number;
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
          normalized_phone: string | null;
          status: OrderStatus;
          payment_status: PaymentStatus;
          payment_method: PaymentMethod;
          delivery_method: DeliveryMethod;
          subtotal: number;
          delivery_fee: number;
          discount_amount: number;
          total: number;
          currency: "BDT";
          shipping_address: Json;
          customer_note: string | null;
          tracking_token: string;
          idempotency_key: string | null;
          client_fingerprint: string | null;
          stock_restored_at: string | null;
          cancelled_at: string | null;
          delivered_at: string | null;
          risk_flags: string[];
        }
      >;
      order_items: Table<{
        id: string;
        order_id: string;
        product_id: string;
        product_variant_id: string;
        product_name_en: string;
        product_code: string;
        sku: string;
        size: string;
        colour_en: string;
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
          discount_type: DiscountType;
          discount_value: number;
          minimum_order_amount: number;
          maximum_discount_amount: number | null;
          starts_at: string | null;
          expires_at: string | null;
          usage_limit: number | null;
          per_customer_limit: number | null;
          usage_count: number;
          is_active: boolean;
          archived_at: string | null;
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
          status: ReviewStatus;
          moderated_by: string | null;
          moderated_at: string | null;
          moderation_note: string | null;
        }
      >;
      order_tracking_events: Table<{
        id: string;
        order_id: string;
        status: OrderStatus;
        note_en: string | null;
        created_by: string | null;
        is_customer_visible: boolean;
        created_at: string;
      }>;
      order_internal_notes: Table<{
        id: string;
        order_id: string;
        author_id: string | null;
        author_name: string;
        note: string;
        created_at: string;
      }>;
      order_status_transitions: Table<{
        from_status: OrderStatus;
        to_status: OrderStatus;
        required_permission: string;
      }>;
      inventory_adjustments: Table<{
        id: string;
        product_variant_id: string;
        order_id: string | null;
        previous_quantity: number;
        new_quantity: number;
        delta: number;
        reason: string;
        note: string | null;
        adjusted_by: string | null;
        created_at: string;
      }>;
      admin_audit_log: Table<{
        id: string;
        actor_id: string | null;
        actor_email: string;
        actor_role: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        entity_label: string | null;
        before_value: Json | null;
        after_value: Json | null;
        reason: string | null;
        created_at: string;
      }>;
      notification_outbox: Table<{
        id: string;
        channel: string;
        template: string;
        recipient: string;
        payload: Json;
        status: NotificationStatus;
        attempts: number;
        last_error: string | null;
        created_at: string;
        sent_at: string | null;
      }>;
      contact_messages: Table<{
        id: string;
        name: string;
        email: string;
        phone: string | null;
        subject: string | null;
        message: string;
        status: MessageStatus;
        handled_by: string | null;
        handled_at: string | null;
        staff_note: string | null;
        created_at: string;
        updated_at: string;
      }>;
      newsletter_subscribers: Table<{
        id: string;
        email: string;
        is_active: boolean;
        unsubscribe_token: string;
        unsubscribed_at: string | null;
        source: string;
        created_at: string;
        updated_at: string;
      }>;
      bd_divisions: Table<{
        name: string;
        sort_order: number;
      }>;
      bd_districts: Table<{
        name: string;
        division_name: string;
        sort_order: number;
      }>;
      store_settings: Table<{
        key: string;
        value: Json;
        is_public: boolean;
        label: string | null;
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
          p_idempotency_key?: string | null;
          p_client_fingerprint?: string | null;
        };
        Returns: Json;
      };
      get_guest_order_tracking: {
        Args: { p_order_number: string; p_tracking_token: string };
        Returns: Json;
      };
      admin_transition_order: {
        Args: {
          p_order_id: string;
          p_status: OrderStatus;
          p_customer_note?: string | null;
          p_internal_note?: string | null;
          p_restock?: boolean | null;
        };
        Returns: Json;
      };
      admin_update_payment_status: {
        Args: {
          p_order_id: string;
          p_payment_status: PaymentStatus;
          p_note?: string | null;
        };
        Returns: Json;
      };
      admin_add_order_note: {
        Args: { p_order_id: string; p_note: string };
        Returns: Json;
      };
      admin_adjust_inventory: {
        Args: {
          p_variant_id: string;
          p_new_quantity: number;
          p_reason: InventoryAdjustmentReason;
          p_note?: string | null;
        };
        Returns: Json;
      };
      admin_moderate_review: {
        Args: { p_review_id: string; p_status: ReviewStatus; p_note?: string | null };
        Returns: Json;
      };
      admin_update_message_status: {
        Args: {
          p_message_id: string;
          p_status: MessageStatus;
          p_staff_note?: string | null;
        };
        Returns: Json;
      };
      admin_set_newsletter_active: {
        Args: { p_subscriber_id: string; p_active: boolean };
        Returns: Json;
      };
      admin_save_coupon: { Args: { p_payload: Json }; Returns: Json };
      admin_archive_coupon: {
        Args: { p_coupon_id: string; p_archived: boolean };
        Returns: Json;
      };
      admin_save_settings: { Args: { p_settings: Json }; Returns: Json };
      admin_dashboard_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      admin_analytics: { Args: { p_days?: number }; Returns: Json };
      admin_customer_summary: { Args: { p_profile_id: string }; Returns: Json };
      admin_set_customer_active: {
        Args: { p_profile_id: string; p_active: boolean; p_reason?: string | null };
        Returns: Json;
      };
      admin_mark_notification: {
        Args: { p_id: string; p_status: NotificationStatus; p_error?: string | null };
        Returns: Json;
      };
      validate_coupon: {
        Args: {
          p_code: string;
          p_subtotal: number;
          p_user_id?: string | null;
          p_phone?: string | null;
        };
        Returns: Json;
      };
      unsubscribe_newsletter_by_token: {
        Args: { p_token: string };
        Returns: boolean;
      };
      newsletter_unsubscribe_token: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      normalize_bd_phone: { Args: { p_phone: string }; Returns: string | null };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_full_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      has_permission: { Args: { p_permission: string }; Returns: boolean };
      my_permissions: { Args: Record<PropertyKey, never>; Returns: string[] };
      current_role_name: { Args: Record<PropertyKey, never>; Returns: string };
      ensure_my_profile: { Args: Record<PropertyKey, never>; Returns: Json };
      set_profile_role: {
        Args: { p_profile_id: string; p_role: UserRole };
        Returns: undefined;
      };
      submit_contact_message: {
        Args: {
          p_name: string;
          p_email: string;
          p_phone: string;
          p_message: string;
          p_subject?: string | null;
          p_client_fingerprint?: string | null;
        };
        Returns: string;
      };
      subscribe_newsletter: {
        Args: {
          p_email: string;
          p_language?: string;
          p_client_fingerprint?: string | null;
        };
        Returns: boolean;
      };
      resolve_shipping_location: {
        Args: { p_division: string; p_district: string };
        Returns: Json | null;
      };
      calculate_delivery_fee: {
        Args: { p_subtotal: number; p_division: string };
        Returns: number;
      };
      search_catalogue: { Args: { p_filters: Json }; Returns: Json };
      catalogue_facets: { Args: { p_filters: Json }; Returns: Json };
      collection_is_visible: { Args: { p_collection_id: string }; Returns: boolean };
      set_product_primary_image: { Args: { p_image_id: string }; Returns: Json };
      reorder_product_images: {
        Args: { p_product_id: string; p_image_ids: string[] };
        Returns: Json;
      };
      delete_product_image: { Args: { p_image_id: string }; Returns: Json };
      replace_cart_items: { Args: { p_items: Json }; Returns: Json };
      merge_cart_items: { Args: { p_items: Json }; Returns: Json };
      current_cart_state: { Args: Record<PropertyKey, never>; Returns: Json };
      consume_public_rate_limit: {
        Args: { p_bucket: string; p_identifier: string };
        Returns: boolean;
      };
      claim_order_notifications: {
        Args: { p_order_number: string; p_tracking_token: string };
        Returns: Json;
      };
      claim_order_notifications_admin: {
        Args: { p_order_id: string };
        Returns: Json;
      };
      confirm_notification_dispatch: {
        Args: {
          p_id: string;
          p_dispatch_token: string;
          p_ok: boolean;
          p_error?: string | null;
        };
        Returns: boolean;
      };
      store_notification_recipient: {
        Args: { p_id: string; p_dispatch_token: string };
        Returns: string | null;
      };
      requeue_notification: { Args: { p_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: UserRole;
      product_status: ProductStatus;
      order_status: OrderStatus;
      payment_status: PaymentStatus;
      payment_method: PaymentMethod;
      delivery_method: DeliveryMethod;
      review_status: ReviewStatus;
      message_status: MessageStatus;
      discount_type: DiscountType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
