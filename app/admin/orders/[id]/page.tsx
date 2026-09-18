import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Printer, ReceiptText } from "lucide-react";
import { getAdminOrderDetail } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import { formatDateTime, formatTaka } from "@/lib/format";
import { formatBdPhone, toInternationalBdPhone } from "@/lib/phone";
import {
  CUSTOMER_STATUS_LABELS,
  FULFILMENT_PIPELINE,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/order-status";
import {
  AdminLinkButton,
  AdminStatusSummary,
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
import { OrderDeletePanel } from "@/components/admin/OrderDeletePanel";
import { getPublicStoreSettings } from "@/lib/supabase/queries/settings";
import { formatOrderAddress } from "@/lib/order-address";
import { deliveryZoneLabel } from "@/lib/delivery";
import { formatSizeLabel } from "@/lib/product-size";

/**
 * Both address shapes render here.
 *
 * `formatOrderAddress()` understands the legacy division/district snapshot and
 * the current address/city/zone one, so an order placed before the checkout
 * change still shows the address the courier was actually given. The three
 * admin screens used to each carry their own copy of this logic, which is how
 * the invoice and the packing slip came to format the same address two
 * different ways.
 */

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [staff, detail, settings] = await Promise.all([
    requireStaff(),
    getAdminOrderDetail(id),
    getPublicStoreSettings(),
  ]);
  if (!detail) notFound();

  const { order, items, events, notes, adjustments, audit, couponCode } = detail;
  const shipping = formatOrderAddress(order.shipping_address, {
    inside: deliveryZoneLabel("inside_sylhet", settings.delivery),
    outside: deliveryZoneLabel("outside_sylhet", settings.delivery),
  });
  const address = shipping.lines;
  const pipelineIndex = FULFILMENT_PIPELINE.indexOf(order.status);
  const archived = Boolean(order.archived_at);
  const canDelete = staff.permissions.includes("archive.manage");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={order.order_number}
        meta={
          <>
            {archived && <Badge tone="warning">Archived</Badge>}
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.payment_status} />
          </>
        }
        description={`Placed ${formatDateTime(order.created_at)} · ${order.customer_name}`}
        actions={
          <>
            <AdminLinkButton href={`/admin/orders/${order.id}/invoice`}>
              <ReceiptText size={15} aria-hidden="true" />
              Invoice
            </AdminLinkButton>
            <AdminLinkButton href={`/admin/orders/${order.id}/packing-slip`}>
              <Printer size={15} aria-hidden="true" />
              Packing slip
            </AdminLinkButton>
          </>
        }
      />

      {archived && (
        <div
          role="status"
          className="mb-5 rounded-panel border border-[#8A6A1F]/30 bg-[#8A6A1F]/10 px-4 py-3 font-sans text-sm text-[#6B521A]"
        >
          This order is archived{order.archived_at ? ` (${formatDateTime(order.archived_at)})` : ""}. It cannot move
          through fulfilment until an administrator restores it, and it still counts in revenue until it is
          permanently deleted.
        </div>
      )}

      {/* Order summary — the answer to "what is this order?" in one row. */}
      <div className="mb-5">
        <AdminStatusSummary
          items={[
            { label: "Status", value: ORDER_STATUS_LABELS[order.status] },
            {
              label: "Payment",
              value: PAYMENT_STATUS_LABELS[order.payment_status],
              hint: "Cash on delivery",
            },
            { label: "Total", value: formatTaka(order.total) },
            {
              label: "Items",
              value: items.reduce((sum, item) => sum + item.quantity, 0),
              hint: `${items.length} line${items.length === 1 ? "" : "s"}`,
            },
            { label: "Delivery", value: shipping.zoneLabel ?? "—", hint: formatTaka(order.delivery_fee) },
            {
              label: "Customer",
              value: order.user_id ? "Registered" : "Guest",
              hint: order.customer_name,
            },
          ]}
        />
      </div>

      {order.risk_flags.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Risk flags">
          <span className="font-sans text-xs font-semibold uppercase tracking-wide text-muted">
            Check before confirming:
          </span>
          {order.risk_flags.map((flag) => (
            <Badge key={flag} tone="warning">
              {flag.replace(/_/g, " ")}
            </Badge>
          ))}
        </div>
      )}

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
                        {formatSizeLabel(item.size)} · {item.colour_en}
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
                <strong className="font-sans text-lg font-bold">{formatTaka(order.total)}</strong>
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
          {/* Fulfilment and payment first: it is what this page is opened to do. */}
          {!archived && (
            <OrderActions
              orderId={order.id}
              status={order.status}
              paymentStatus={order.payment_status}
              permissions={staff.permissions}
            />
          )}

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
              {/*
                The zone the order was actually priced from. Worth showing
                explicitly: it is what the delivery fee was calculated against,
                so a query about the charge is answered here rather than by
                guessing from the city.
              */}
              {shipping.zoneLabel && (
                <Badge tone="neutral" className="mt-3">
                  {shipping.zoneLabel}
                </Badge>
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
        </div>
      </div>

      {/*
        Archive and permanent delete, kept apart from fulfilment. Administrators
        only; every action re-checks archive.manage on the server and permanent
        deletion requires the typed confirmation word.
      */}
      {canDelete && (
        <section aria-label="Danger zone" className="mt-8 border-t border-border pt-6">
          <OrderDeletePanel
            orderId={order.id}
            orderNumber={order.order_number}
            status={order.status}
            archived={archived}
          />
        </section>
      )}
    </>
  );
}
