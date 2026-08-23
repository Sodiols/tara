import { getAdminSettings, getNotificationOutbox } from "@/lib/supabase/queries/admin";
import { describeNotification } from "@/lib/notifications";
import { formatDateTime } from "@/lib/format";
import { PageHeader, Panel, PanelHeader, TableWrap, Td, Th } from "@/components/admin/ui";
import { StoreSettingsForm } from "@/components/admin/StoreSettingsForm";

export default async function AdminSettingsPage() {
  const [{ value }, outbox] = await Promise.all([
    getAdminSettings(),
    getNotificationOutbox(15),
  ]);

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
          free_delivery_threshold: asNumber("free_delivery_threshold", 1500),
          standard_delivery_fee: asNumber("standard_delivery_fee", 100),
          cod_enabled: asBoolean("cod_enabled", true),
          maintenance_mode: asBoolean("maintenance_mode", false),
        }}
      />

      <Panel className="mt-5">
        <PanelHeader
          title="Order events"
          description="Every order placed and every status change is recorded here by the database as it happens. TARA sends no email — this log is the record, and it is the same one staff and the store owner work from."
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
                <Th>Customer</Th>
                <Th align="right">Recorded</Th>
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
                const customer =
                  asText("customer") ||
                  (entry.recipient === "store" ? "—" : entry.recipient) ||
                  "—";
                return (
                  <tr key={entry.id}>
                    <Td>{describeNotification(entry.template)}</Td>
                    <Td className="font-mono text-xs">{orderNumber || "—"}</Td>
                    <Td className="break-all">{customer}</Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-muted">
                      {formatDateTime(entry.created_at)}
                    </Td>
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
