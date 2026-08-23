"use client";

import { saveSettingsAction } from "@/lib/supabase/actions/admin";
import { ActionForm, SubmitButton } from "./AdminForm";
import { Field, Panel, PanelHeader, adminInputClass, adminTextareaClass } from "./ui";

export interface StoreSettingsValues {
  store_name: string;
  support_phone: string;
  whatsapp_number: string;
  support_email: string;
  store_address: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  free_delivery_threshold: number;
  standard_delivery_fee: number;
  cod_enabled: boolean;
  maintenance_mode: boolean;
}

/**
 * Store settings.
 *
 * Only keys that already exist in `store_settings` can be written — the
 * database rejects anything else — so this form cannot be used to smuggle an
 * arbitrary key into a table that anonymous visitors can read.
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
          description="The store runs one delivery option and takes cash on delivery only. These values are the ones the database charges at checkout — the storefront only displays them."
        />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
          <Field
            label="Delivery fee (৳)"
            htmlFor="standard_delivery_fee"
            required
            hint="Charged on every order below the free-delivery threshold."
          >
            <input
              id="standard_delivery_fee"
              name="standard_delivery_fee"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={values.standard_delivery_fee}
              className={adminInputClass}
            />
          </Field>
          <Field
            label="Free delivery from (৳)"
            htmlFor="free_delivery_threshold"
            required
            hint="Orders at or above this subtotal ship free."
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
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-5">
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
                Shows a maintenance notice on the storefront. The admin panel stays reachable.
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
