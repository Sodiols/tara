import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/supabase/queries/admin";
import { requireStaff } from "@/lib/supabase/auth";
import { setCustomerActiveAction } from "@/lib/supabase/actions/admin";
import { formatDate, formatDateTime, formatTaka } from "@/lib/format";
import { formatBdPhone, toInternationalBdPhone } from "@/lib/phone";
import { roleLabel } from "@/lib/permissions";
import {
  AdminEmptyState,
  Badge,
  DetailRow,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import { ActiveBadge, OrderStatusBadge, PaymentStatusBadge } from "@/components/admin/status";
import { ActionButton } from "@/components/admin/AdminForm";

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [staff, detail] = await Promise.all([requireStaff(), getCustomerDetail(id)]);
  if (!detail) notFound();

  const { profile, orders, summary } = detail;
  const canManage = staff.permissions.includes("customers.manage");

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/customers" className="underline-offset-4 hover:underline">
            ← Customers
          </Link>
        }
        title={profile.full_name || "Unnamed customer"}
        description={`Joined ${formatDate(profile.created_at)}`}
        actions={
          canManage ? (
            <ActionButton
              variant={profile.is_active ? "danger" : "secondary"}
              confirm={
                profile.is_active
                  ? `Deactivate ${profile.email}? They will not be able to sign in. Their orders and history are kept.`
                  : `Reactivate ${profile.email}?`
              }
              action={async () => {
                "use server";
                return setCustomerActiveAction(profile.id, !profile.is_active);
              }}
            >
              {profile.is_active ? "Deactivate account" : "Reactivate account"}
            </ActionButton>
          ) : null
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={profile.role === "customer" ? "neutral" : "info"}>
          {roleLabel(profile.role)}
        </Badge>
        <ActiveBadge active={profile.is_active} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Orders" value={summary.totalOrders ?? 0} tone="info" />
        <StatTile
          label="Lifetime spend"
          value={formatTaka(summary.totalSpend ?? 0)}
          tone="success"
        />
        <StatTile
          label="Last order"
          value={summary.lastOrderAt ? formatDate(summary.lastOrderAt) : "Never"}
        />
        <StatTile
          label="Cancelled"
          value={summary.cancelledOrders ?? 0}
          tone={(summary.cancelledOrders ?? 0) > 2 ? "warning" : "neutral"}
          hint={(summary.cancelledOrders ?? 0) > 2 ? "Watch for COD abuse" : undefined}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel>
          <PanelHeader title="Order history" description="Most recent 50 orders." />
          {orders.length === 0 ? (
            <AdminEmptyState
              title="No orders yet"
              description="This customer has registered but has not ordered."
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Order</Th>
                  <Th>Status</Th>
                  <Th>Payment</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Placed</Th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-taraIvory/40">
                    <Td>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-semibold text-taraWine underline-offset-4 hover:underline"
                      >
                        {order.order_number}
                      </Link>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={order.status} />
                    </Td>
                    <Td>
                      <PaymentStatusBadge status={order.payment_status} />
                    </Td>
                    <Td align="right" className="font-semibold">
                      {formatTaka(order.total)}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(order.created_at)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Account" />
          <dl className="px-5 py-3">
            <DetailRow label="Email">
              {profile.email ? (
                <a
                  href={`mailto:${profile.email}`}
                  className="break-all text-taraWine underline-offset-4 hover:underline"
                >
                  {profile.email}
                </a>
              ) : (
                <span className="text-muted">Not set</span>
              )}
            </DetailRow>
            <DetailRow label="Phone">
              {profile.phone ? (
                <a
                  href={`tel:${toInternationalBdPhone(profile.phone) ?? profile.phone}`}
                  className="text-taraWine underline-offset-4 hover:underline"
                >
                  {formatBdPhone(profile.phone)}
                </a>
              ) : (
                <span className="text-muted">Not set</span>
              )}
            </DetailRow>
            <DetailRow label="Language">
              {profile.preferred_language === "bn" ? "Bangla" : "English"}
            </DetailRow>
            <DetailRow label="Registered">{formatDateTime(profile.created_at)}</DetailRow>
          </dl>
          {/*
            Saved addresses are deliberately not shown. Each order carries its
            own shipping snapshot, which is all the back office needs; the
            customer's full address book stays private to them.
          */}
          <p className="border-t border-border px-5 py-4 font-sans text-xs leading-5 text-muted">
            Delivery details for any specific order are on that order&apos;s page. A customer&apos;s
            saved address book is private to them and is not exposed here.
          </p>
        </Panel>
      </div>
    </>
  );
}
