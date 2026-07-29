"use client";

import { FormEvent, useState, useTransition } from "react";
import type { Database } from "@/types/database";
import { deleteAddressAction, saveAddressAction } from "@/lib/supabase/actions/profile";
import { useLanguage } from "@/lib/i18n";
import { useToastStore } from "@/store/toastStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Address = Database["public"]["Tables"]["addresses"]["Row"];
const blank = { recipientName: "", phone: "", division: "", district: "", upazila: "", area: "", postalCode: "", fullAddress: "", deliveryNote: "", isDefault: false };

export function AddressesClient({ addresses }: { addresses: Address[] }) {
  const { t } = useLanguage();
  const { addToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState(blank);

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAddressAction({ ...form, id: editingId });
      addToast(t(result.ok ? result.message ?? "account.addressSaved" : result.message));
      if (result.ok) { setForm(blank); setEditingId(undefined); }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        {addresses.map((address) => (
          <article key={address.id} className="rounded-panel border border-border p-5">
            <div className="flex justify-between gap-4"><h2 className="font-medium text-ink">{address.recipient_name}</h2>{address.is_default && <span className="text-xs text-wine">{t("account.defaultAddress")}</span>}</div>
            <p className="mt-2 text-sm leading-6 text-muted">{address.full_address}, {address.area}, {address.upazila}, {address.district}, {address.division}<br />{address.phone}</p>
            <div className="mt-4 flex gap-4 text-sm">
              <button onClick={() => { setEditingId(address.id); setForm({ recipientName: address.recipient_name, phone: address.phone, division: address.division, district: address.district, upazila: address.upazila, area: address.area, postalCode: address.postal_code ?? "", fullAddress: address.full_address, deliveryNote: address.delivery_note ?? "", isDefault: address.is_default }); }} className="text-wine hover:underline">{t("common.edit")}</button>
              <button
                onClick={() => {
                  if (!confirm(t("account.confirmDeleteAddress"))) return;
                  startTransition(async () => {
                    const result = await deleteAddressAction(address.id);
                    addToast(t(result.ok ? "account.addressDeleted" : result.message));
                  });
                }}
                className="text-wine hover:underline"
              >
                {t("common.delete")}
              </button>
            </div>
          </article>
        ))}
        {addresses.length === 0 && <p className="text-sm text-muted">{t("account.noAddresses")}</p>}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl text-ink">{editingId ? t("account.editAddress") : t("account.addAddress")}</h2>
        <Input label={t("checkout.fullName")} value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
        <Input label={t("checkout.phone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        <Input label={t("checkout.division")} value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} required />
        <Input label={t("checkout.district")} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required />
        <Input label={t("checkout.upazila")} value={form.upazila} onChange={(e) => setForm({ ...form, upazila: e.target.value })} required />
        <Input label={t("account.area")} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required />
        <Input label={t("checkout.fullAddress")} value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} required />
        <Input label={t("account.postalCode")} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
        <Input label={t("account.deliveryNote")} value={form.deliveryNote} onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="accent-wine" />{t("account.makeDefault")}</label>
        <Button type="submit" loading={pending} className="self-start">{t("common.save")}</Button>
      </form>
    </div>
  );
}
