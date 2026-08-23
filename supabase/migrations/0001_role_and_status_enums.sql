/*
TARA MIGRATION 0001 — Role and status enum extensions

Run this file FIRST, on its own, before 0002_production_hardening.sql.

PostgreSQL will not let a newly added enum value be *used* by other statements
inside the same transaction that added it, so the enum additions live in their
own migration. This file is additive only: no existing value is renamed or
removed, so every existing profile, order, and message row keeps its value.

Role model after this migration:
  customer    — shopper (default, unchanged)
  support     — Customer Support: customers, messages, order lookup, order notes
  fulfilment  — Fulfilment Staff: orders, packing, shipment, inventory
  manager     — Manager: catalogue, inventory, orders, coupons, reviews, customers
  staff       — LEGACY value, retained so existing rows stay valid. Treated as
                'manager' everywhere in the permission model.
  admin       — full access including staff, roles, settings, and audit log
*/

alter type public.user_role add value if not exists 'support';
alter type public.user_role add value if not exists 'fulfilment';
alter type public.user_role add value if not exists 'manager';

-- Contact messages gain an explicit "replied" state between read and resolved.
alter type public.message_status add value if not exists 'replied';

-- Payment lifecycle gains partial refunds so a COD order that is partly
-- returned can be recorded accurately instead of being forced to 'refunded'.
alter type public.payment_status add value if not exists 'partially_refunded';
