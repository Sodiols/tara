begin;

-- Token-gated order tracking. RLS remains enabled on the underlying tables;
-- this function returns one order snapshot only when both identifiers match.
create or replace function public.get_guest_order_tracking(
  p_order_number text,
  p_tracking_token text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orderNumber', o.order_number,
    'customerName', o.customer_name,
    'status', o.status,
    'createdAt', o.created_at,
    'deliveryMethod', o.delivery_method,
    'paymentMethod', o.payment_method,
    'paymentStatus', o.payment_status,
    'subtotal', o.subtotal,
    'discount', o.discount_amount,
    'deliveryFee', o.delivery_fee,
    'total', o.total,
    'currency', o.currency,
    'shippingAddress', o.shipping_address,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'productName', oi.product_name_en,
          'productCode', oi.product_code,
          'sku', oi.sku,
          'size', oi.size,
          'colour', oi.colour_en,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'lineTotal', oi.line_total,
          'imageUrl', oi.product_image_url
        ) order by oi.created_at, oi.id
      )
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'status', e.status,
          'noteEn', e.note_en,
          'createdAt', e.created_at
        ) order by e.created_at, e.id
      )
      from public.order_tracking_events e
      where e.order_id = o.id and e.is_customer_visible
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and o.tracking_token = trim(p_tracking_token)
    and length(trim(p_tracking_token)) >= 32;
$$;

revoke execute on function public.get_guest_order_tracking(text, text) from public;
grant execute on function public.get_guest_order_tracking(text, text) to anon, authenticated;

commit;
