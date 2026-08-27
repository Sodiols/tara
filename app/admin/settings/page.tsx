import { getAdminSettings, getNotificationOutbox } from "@/lib/supabase/queries/admin";
import { describeNotification } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { Badge, PageHeader, Panel, PanelHeader, TableWrap, Td, Th, type BadgeTone } from "@/components/admin/ui";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";
import { ActionButton, RowActionButton } from "@/components/admin/AdminForm";
import { retryNotificationAction, sendTestEmailAction } from "@/lib/supabase/actions/admin";
import { getEmailConfiguration } from "@/lib/email/provider";

export default async function AdminSettingsPage() {
  const [{ value }, outbox] = await Promise.all([
    getAdminSettings(),
    getNotificationOutbox(15),
  ]);
  const emailConfiguration = getEmailConfiguration();

  const asString = (key: string) => {
    const raw = value(key);
    return typeof raw === "string" ? raw : "";
  };
  const asNumber = (key: string, fallback: number) => {
    const raw = value(key);
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const asBoolean = (key: string, fallback: boolean) => {
    const raw = value(key);
    return typeof raw === "boolean" ? raw : fallback;
  };
  const notificationInbox = asString("order_notification_email");

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Store settings"
        description="Business values you can change without a code deploy. API keys and other secrets live in environment variables, never here."
      />

      <StoreSettingsForm
        values={{
          store_name: asString("store_name") || "TARA",
          support_phone: asString("support_phone"),
          whatsapp_number: asString("whatsapp_number"),
          support_email: asString("support_email"),
          store_address: asString("store_address"),
          facebook_url: asString("facebook_url"),
          instagram_url: asString("instagram_url"),
          tiktok_url: asString("tiktok_url"),
          delivery_fee_inside_sylhet: asNumber("delivery_fee_inside_sylhet", 60),
          delivery_fee_outside_sylhet: asNumber("delivery_fee_outside_sylhet", 120),
          free_delivery_threshold: asNumber("free_delivery_threshold", 1500),
          free_delivery_enabled: asBoolean("free_delivery_enabled", true),
          free_delivery_division: asString("free_delivery_division") || "Sylhet",
          cod_enabled: asBoolean("cod_enabled", true),
          maintenance_mode: asBoolean("maintenance_mode", false),
          order_notification_email: notificationInbox,
        }}
      />

      <Panel className="mt-5">
        <PanelHeader
          title="Transactional email"
          description="Resend sends customer order updates, PDF receipts, staff order alerts, and website contact messages. Keys remain in server environment variables."
          actions={<ActionButton action={sendTestEmailAction} disabled={!emailConfiguration.configured}>Send test email</ActionButton>}
        />
        <dl className="grid gap-4 px-5 py-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs uppercase tracking-wide text-muted">Provider</dt><dd className="mt-1 font-medium text-ink">{emailConfiguration.provider}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted">From address</dt><dd className="mt-1 break-all font-medium text-ink">{emailConfiguration.fromAddress}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted">Status</dt><dd className="mt-1"><Badge tone={emailConfiguration.configured ? "success" : "warning"}>{emailConfiguration.configured ? "Ready" : "Setup required"}</Badge></dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-muted">Order notification inbox</dt><dd className="mt-1"><Badge tone={notificationInbox ? "success" : "warning"}>{notificationInbox ? "Configured" : "Missing"}</Badge></dd></div>
        </dl>
        {!emailConfiguration.configured && <p className="border-t border-border px-5 py-3 text-sm text-[#8A6A1F]">Email sending is not configured.</p>}
        {!notificationInbox && <p className="border-t border-border px-5 py-3 text-sm text-[#8A6A1F]">Add an order notification email to receive new order alerts.</p>}
      </Panel>

      <Panel className="mt-5">
        <PanelHeader
          title="Email delivery log"
          description="Every order and contact notification is recorded before delivery. Failed and skipped messages can be retried after their configuration problem is corrected."
        />
        {outbox.length === 0 ? (
          <p className="px-5 py-6 font-sans text-sm text-muted">
            Nothing yet. Placing an order, or moving one to its next status, adds an entry here
            automatically.
          </p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Order</Th>
                <Th>Recipient</Th>
                <Th>Status</Th>
                <Th align="right">Attempts</Th>
                <Th>Created / sent</Th>
                <Th>Last error</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((entry) => {
                const payload = (entry.payload ?? {}) as Record<string, unknown>;
                const asText = (key: string) =>
                  typeof payload[key] === "string" ? (payload[key] as string) : "";
                const orderNumber = asText("orderNumber");
                // `recipient` is the customer's email when they gave one, and
                // the literal "store" for the copy meant for staff.
                const recipient = entry.recipient === "store" ? "Store inbox" : entry.recipient || "—";
                const status = entry.status || "queued";
                const tone: BadgeTone = status === "sent" ? "success" : status === "failed" ? "danger" : status === "sending" ? "progress" : status === "skipped" ? "warning" : "neutral";
                return (
                  <tr key={entry.id}>
                    <Td>{describeNotification(entry.template)}</Td>
                    <Td className="font-mono text-xs">{orderNumber || "—"}</Td>
                    <Td className="break-all"><span className="block">{recipient}</span><span className="text-xs text-muted">{entry.recipient === "store" ? "Staff" : "Customer"}</span></Td>
                    <Td><Badge tone={tone}>{status}</Badge></Td>
                    <Td align="right">{entry.attempts}</Td>
                    <Td className="whitespace-nowrap text-xs text-muted"><span className="block">{formatDateTime(entry.created_at)}</span>{entry.sent_at && <span className="block text-[#2F5D50]">Sent {formatDateTime(entry.sent_at)}</span>}</Td>
                    <Td className="max-w-[220px] text-xs text-muted">{entry.last_error || "—"}</Td>
                    <Td>{["failed", "skipped"].includes(status) ? <RowActionButton action={retryNotificationAction.bind(null, entry.id)}>Retry Email</RowActionButton> : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </>
  );
}
