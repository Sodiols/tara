import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Printer, ReceiptText } from "lucide-react";
import { getAdminOrderDetail } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import { formatDateTime, formatTaka } from "@/lib/format";
import { formatBdPhone, toInternationalBdPhone } from "@/lib/phone";
import { CUSTOMER_STATUS_LABELS, FULFILMENT_PIPELINE, ORDER_STATUS_LABELS } from "@/lib/order-status";
import {
  Badge,
  DetailRow,
  PageHeader,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status";
import { OrderActions } from "@/components/admin/OrderActions";
import type { Json } from "@/types/database";

function addressLines(raw: Json | null): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const address = raw as Record<string, unknown>;
  const pick = (key: string) => {
    const value = address[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return [
    pick("fullAddress"),
    [pick("area"), pick("upazila")].filter(Boolean).join(", ") || null,
    [pick("district"), pick("division")].filter(Boolean).join(", ") || null,
    pick("postalCode"),
  ].filter((line): line is string => Boolean(line));
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [staff, detail] = await Promise.all([requireStaff(), getAdminOrderDetail(id)]);
  if (!detail) notFound();

  const { order, items, events, notes, adjustments, audit, couponCode } = detail;
  const address = addressLines(order.shipping_address);
  const pipelineIndex = FULFILMENT_PIPELINE.indexOf(order.status);

  const printLinkClass =
    "inline-flex h-11 items-center gap-2 rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine";

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/orders" className="underline-offset-4 hover:underline">
            ← Orders
          </Link>
        }
        title={order.order_number}
        description={`Placed ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <Link href={`/admin/orders/${order.id}/invoice`} className={printLinkClass}>
              <ReceiptText size={15} aria-hidden="true" />
              Invoice
            </Link>
            <Link href={`/admin/orders/${order.id}/packing-slip`} className={printLinkClass}>
              <Printer size={15} aria-hidden="true" />
              Packing slip
            </Link>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.status} />
        <PaymentStatusBadge status={order.payment_status} />
        <Badge tone="neutral">Cash on delivery</Badge>
        {order.risk_flags.map((flag) => (
          <Badge key={flag} tone="warning">
            {flag.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>

      {/* Fulfilment rail */}
      {pipelineIndex >= 0 && (
        <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {FULFILMENT_PIPELINE.map((step, index) => (
            <li
              key={step}
              className={
                index <= pipelineIndex
                  ? "rounded-control border border-taraWine/35 bg-taraWine/8 px-3 py-2"
                  : "rounded-control border border-border bg-taraWhite px-3 py-2"
              }
            >
              <span
                className={
                  index <= pipelineIndex
                    ? "block font-sans text-[11px] font-bold uppercase tracking-wide text-taraWine"
                    : "block font-sans text-[11px] font-bold uppercase tracking-wide text-muted"
                }
              >
                {index + 1}. {ORDER_STATUS_LABELS[step]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* Items */}
          <Panel>
            <PanelHeader
              title="Items"
              description="Prices are the snapshot taken when the order was placed and never change afterwards."
            />
            <TableWrap>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>Variant</Th>
                  <Th align="right">Unit</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Line total</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {item.product_image_url ? (
                          <Image
                            src={item.product_image_url}
                            alt=""
                            width={44}
                            height={56}
                            className="h-14 w-11 shrink-0 rounded-sm object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-14 w-11 shrink-0 rounded-sm bg-taraIvory"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {item.product_name_en}
                          </span>
                          <span className="block font-sans text-xs text-muted">
                            {item.product_code}
                          </span>
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <span className="block">
                        {item.size} · {item.colour_en}
                      </span>
                      <span className="block font-sans text-xs text-muted">SKU {item.sku}</span>
                    </Td>
                    <Td align="right">{formatTaka(item.unit_price)}</Td>
                    <Td align="right">{item.quantity}</Td>
                    <Td align="right" className="font-semibold">
                      {formatTaka(item.line_total)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <dl className="px-5 py-4">
              <DetailRow label="Subtotal">{formatTaka(order.subtotal)}</DetailRow>
              <DetailRow label="Delivery">{formatTaka(order.delivery_fee)}</DetailRow>
              {Number(order.discount_amount) > 0 && (
                <DetailRow label={couponCode ? `Discount (${couponCode})` : "Discount"}>
                  −{formatTaka(order.discount_amount)}
                </DetailRow>
              )}
              <DetailRow label="Total">
                <strong className="font-serif text-lg">{formatTaka(order.total)}</strong>
              </DetailRow>
            </dl>
          </Panel>

          {/* Customer-visible timeline */}
          <Panel>
            <PanelHeader
              title="Customer tracking"
              description="Exactly what the customer sees on the public tracking page."
            />
            {events.length === 0 ? (
              <p className="px-5 py-6 font-sans text-sm text-muted">No tracking events yet.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {events.map((event) => (
                  <li key={event.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-medium text-ink">
                        {CUSTOMER_STATUS_LABELS[event.status]}
                      </p>
                      {event.note_en && (
                        <p className="mt-0.5 font-sans text-sm text-muted">{event.note_en}</p>
                      )}
                      {!event.is_customer_visible && (
                        <Badge tone="neutral" className="mt-1">
                          Hidden from customer
                        </Badge>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-sans text-xs text-muted">
                      {formatDateTime(event.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/*
            Status history.

            order_tracking_events above is what the customer sees, and it only
            records the status an order moved TO. This panel is the audit trail:
            the status it moved FROM, who moved it, when, and any internal
            reason they gave. Nothing overwrites it, so the full history of an
            order survives every later change.
          */}
          <Panel>
            <PanelHeader
              title="Status history"
              description="Every change to this order, with who made it. Staff-only and never overwritten."
            />
            {audit.length === 0 ? (
              <p className="px-5 py-6 font-sans text-sm text-muted">
                No changes have been made since this order was placed.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {audit.map((entry) => {
                  const before = (entry.before_value ?? {}) as Record<string, unknown>;
                  const after = (entry.after_value ?? {}) as Record<string, unknown>;
                  const asText = (value: unknown) =>
                    typeof value === "string" ? value : null;
                  const fromStatus = asText(before.status) ?? asText(before.paymentStatus);
                  const toStatus = asText(after.status) ?? asText(after.paymentStatus);

                  return (
                    <li key={entry.id} className="px-5 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-sans text-sm text-ink">
                          {fromStatus && toStatus ? (
                            <>
                              <span className="capitalize">{fromStatus}</span>
                              <span className="mx-1.5 text-muted">&rarr;</span>
                              <span className="font-medium capitalize">{toStatus}</span>
                            </>
                          ) : (
                            entry.action
                          )}
                        </p>
                        <span className="whitespace-nowrap font-sans text-xs text-muted">
                          {formatDateTime(entry.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 font-sans text-xs text-muted">
                        {entry.actor_email || "System"}
                        {entry.actor_role ? ` · ${entry.actor_role}` : ""}
                        {after.restocked === true ? " · stock restored" : ""}
                      </p>
                      {entry.reason && (
                        <p className="mt-1 font-sans text-sm text-muted">{entry.reason}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {/* Internal notes */}
          <Panel>
            <PanelHeader
              title="Internal notes"
              description="Private to staff. Stored in a separate table that customers have no access to."
            />
            {notes.length === 0 ? (
              <p className="px-5 py-6 font-sans text-sm text-muted">
                No internal notes on this order.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {notes.map((note) => (
                  <li key={note.id} className="px-5 py-3">
                    <p className="whitespace-pre-wrap font-sans text-sm leading-6 text-ink">
                      {note.note}
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted">
                      {note.author_name || "Staff"} · {formatDateTime(note.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {adjustments.length > 0 && (
            <Panel>
              <PanelHeader title="Inventory impact" />
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Reason</Th>
                    <Th align="right">Before</Th>
                    <Th align="right">Change</Th>
                    <Th align="right">After</Th>
                    <Th align="right">When</Th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((adjustment) => (
                    <tr key={adjustment.id}>
                      <Td className="capitalize">{adjustment.reason.replace(/_/g, " ")}</Td>
                      <Td align="right">{adjustment.previous_quantity}</Td>
                      <Td align="right" className="font-semibold">
                        {adjustment.delta > 0 ? `+${adjustment.delta}` : adjustment.delta}
                      </Td>
                      <Td align="right">{adjustment.new_quantity}</Td>
                      <Td align="right" className="whitespace-nowrap text-xs text-muted">
                        {formatDateTime(adjustment.created_at)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title="Customer" />
            <dl className="px-5 py-3">
              <DetailRow label="Name">{order.customer_name}</DetailRow>
              <DetailRow label="Phone">
                {toInternationalBdPhone(order.customer_phone) ? (
                  <a
                    href={`tel:${toInternationalBdPhone(order.customer_phone)}`}
                    className="text-taraWine underline-offset-4 hover:underline"
                  >
                    {formatBdPhone(order.customer_phone)}
                  </a>
                ) : (
                  order.customer_phone
                )}
              </DetailRow>
              <DetailRow label="Email">
                {order.customer_email ? (
                  <a
                    href={`mailto:${order.customer_email}`}
                    className="break-all text-taraWine underline-offset-4 hover:underline"
                  >
                    {order.customer_email}
                  </a>
                ) : (
                  <span className="text-muted">Not provided</span>
                )}
              </DetailRow>
              <DetailRow label="Account">
                {order.user_id ? (
                  <Link
                    href={`/admin/customers/${order.user_id}`}
                    className="text-taraWine underline-offset-4 hover:underline"
                  >
                    Registered customer
                  </Link>
                ) : (
                  <span className="text-muted">Guest checkout</span>
                )}
              </DetailRow>
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title="Delivery address" />
            <div className="px-5 py-4">
              {address.length > 0 ? (
                <address className="font-sans text-sm not-italic leading-6 text-ink">
                  {address.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : (
                <p className="font-sans text-sm text-muted">No address recorded.</p>
              )}
              {order.customer_note && (
                <div className="mt-4 rounded-control border border-border bg-taraIvory/60 p-3">
                  <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                    Customer note
                  </p>
                  <p className="mt-1 whitespace-pre-wrap font-sans text-sm leading-6 text-ink">
                    {order.customer_note}
                  </p>
                </div>
              )}
            </div>
          </Panel>

          <OrderActions
            orderId={order.id}
            status={order.status}
            paymentStatus={order.payment_status}
            permissions={staff.permissions}
          />
        </div>
      </div>
    </>
  );
}
