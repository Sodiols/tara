"use client";

import { saveSettingsAction } from "@/lib/supabase/actions/admin";
import { DIVISIONS } from "@/data/bangladesh-geography";
import { ActionForm, SubmitButton } from "./AdminForm";
import {
  Field,
  Panel,
  PanelHeader,
  adminInputClass,
  adminSelectClass,
  adminTextareaClass,
} from "./ui";

export interface StoreSettingsValues {
  store_name: string;
  support_phone: string;
  whatsapp_number: string;
  support_email: string;
  store_address: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  delivery_fee_inside_sylhet: number;
  delivery_fee_outside_sylhet: number;
  free_delivery_threshold: number;
  free_delivery_enabled: boolean;
  free_delivery_division: string;
  cod_enabled: boolean;
  maintenance_mode: boolean;
  order_notification_email: string;
}

/**
 * Store settings.
 *
 * Only keys that already exist in `store_settings` can be written — the
 * database rejects anything else — so this form cannot be used to smuggle an
 * arbitrary key into a table that anonymous visitors can read.
 *
 * Every field here has a real effect. Settings that had none —
 * `standard_delivery_fee` (superseded), `express_delivery_fee`,
 * `online_payment_enabled`, `low_stock_alert_enabled` and `currency` — were
 * removed from the database in migration 0010 rather than left as controls that
 * appear to do something and do not.
 */
export function StoreSettingsForm({ values }: { values: StoreSettingsValues }) {
  const checkboxClass = "h-4 w-4 accent-[#702D42]";

  return (
    <ActionForm action={saveSettingsAction} className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="Contact details"
          description="These appear in the footer, on the contact page and on printed invoices. Leave a field blank rather than filling it with a placeholder."
        />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field label="Store name" htmlFor="store_name" required>
            <input
              id="store_name"
              name="store_name"
              required
              maxLength={80}
              defaultValue={values.store_name}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Support phone"
            htmlFor="support_phone"
            hint="Bangladesh mobile, e.g. 01712345678."
          >
            <input
              id="support_phone"
              name="support_phone"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              defaultValue={values.support_phone}
              className={adminInputClass}
            />
          </Field>
          <Field label="WhatsApp number" htmlFor="whatsapp_number">
            <input
              id="whatsapp_number"
              name="whatsapp_number"
              inputMode="tel"
              placeholder="01XXXXXXXXX"
              defaultValue={values.whatsapp_number}
              className={adminInputClass}
            />
          </Field>
          <Field label="Support email" htmlFor="support_email">
            <input
              id="support_email"
              name="support_email"
              type="email"
              defaultValue={values.support_email}
              className={adminInputClass}
            />
          </Field>
          <Field label="Store address" htmlFor="store_address" className="sm:col-span-2">
            <textarea
              id="store_address"
              name="store_address"
              rows={2}
              maxLength={300}
              defaultValue={values.store_address}
              className={adminTextareaClass}
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Delivery and payment"
          description="These are the numbers the database charges at checkout. The announcement bar, the bag, the checkout summary and the invoice all display the same rule, so they cannot disagree with what a customer is billed."
        />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field
            label="Delivery inside the free-delivery division (৳)"
            htmlFor="delivery_fee_inside_sylhet"
            required
            hint="Charged on orders below the free-delivery threshold."
          >
            <input
              id="delivery_fee_inside_sylhet"
              name="delivery_fee_inside_sylhet"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={values.delivery_fee_inside_sylhet}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Delivery everywhere else (৳)"
            htmlFor="delivery_fee_outside_sylhet"
            required
            hint="Charged on every order outside that division, whatever the subtotal."
          >
            <input
              id="delivery_fee_outside_sylhet"
              name="delivery_fee_outside_sylhet"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={values.delivery_fee_outside_sylhet}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Free delivery from (৳)"
            htmlFor="free_delivery_threshold"
            required
            hint="Applies inside the eligible division only."
          >
            <input
              id="free_delivery_threshold"
              name="free_delivery_threshold"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={values.free_delivery_threshold}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Division eligible for free delivery"
            htmlFor="free_delivery_division"
            required
          >
            <select
              id="free_delivery_division"
              name="free_delivery_division"
              required
              defaultValue={values.free_delivery_division}
              className={adminSelectClass}
            >
              {DIVISIONS.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Internal order notification inbox"
            htmlFor="order_notification_email"
            className="sm:col-span-2"
            hint="Where the store's own copy of each new order is emailed. Private — never shown on the storefront. Leave blank to keep the record in Order events only."
          >
            <input
              id="order_notification_email"
              name="order_notification_email"
              type="email"
              defaultValue={values.order_notification_email}
              className={adminInputClass}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-5">
          <label className="flex items-start gap-3 font-sans text-sm text-ink">
            <input
              type="checkbox"
              name="free_delivery_enabled"
              defaultChecked={values.free_delivery_enabled}
              className={`${checkboxClass} mt-1`}
            />
            <span>
              Free delivery offer active
              <span className="mt-0.5 block text-xs text-muted">
                Turning this off charges the inside-division fee on every order,
                and removes the promise from the announcement bar.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 font-sans text-sm text-ink">
            <input
              type="checkbox"
              name="cod_enabled"
              defaultChecked={values.cod_enabled}
              className={`${checkboxClass} mt-1`}
            />
            <span>
              Cash on delivery available
              <span className="mt-0.5 block text-xs text-muted">
                Turning this off stops new COD orders immediately, at the database level.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 font-sans text-sm text-ink">
            <input
              type="checkbox"
              name="maintenance_mode"
              defaultChecked={values.maintenance_mode}
              className={`${checkboxClass} mt-1`}
            />
            <span>
              Maintenance mode
              <span className="mt-0.5 block text-xs text-muted">
                Closes the storefront to shoppers and shows a maintenance page.
                Sign-in, the auth callbacks and the whole admin panel stay
                reachable, so you cannot lock yourself out.
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Social links" description="Blank links are hidden from the footer." />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-3">
          <Field label="Facebook URL" htmlFor="facebook_url">
            <input
              id="facebook_url"
              name="facebook_url"
              type="url"
              placeholder="https://facebook.com/…"
              defaultValue={values.facebook_url}
              className={adminInputClass}
            />
          </Field>
          <Field label="Instagram URL" htmlFor="instagram_url">
            <input
              id="instagram_url"
              name="instagram_url"
              type="url"
              placeholder="https://instagram.com/…"
              defaultValue={values.instagram_url}
              className={adminInputClass}
            />
          </Field>
          <Field label="TikTok URL" htmlFor="tiktok_url">
            <input
              id="tiktok_url"
              name="tiktok_url"
              type="url"
              placeholder="https://tiktok.com/@…"
              defaultValue={values.tiktok_url}
              className={adminInputClass}
            />
          </Field>
        </div>
      </Panel>

      <div>
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}
