"use client";

import { FormEvent, useState, useTransition } from "react";
import type { Database } from "@/types/database";
import { deleteAddressAction, saveAddressAction } from "@/lib/supabase/actions/profile";
import { useToastStore } from "@/store/toastStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Address = Database["public"]["Tables"]["addresses"]["Row"];
const blank = { recipientName: "", phone: "", division: "", district: "", upazila: "", area: "", postalCode: "", fullAddress: "", deliveryNote: "", isDefault: false };

export function AddressesClient({ addresses }: { addresses: Address[] }) {
  const { addToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState(blank);

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveAddressAction({ ...form, id: editingId });
      addToast(result.ok ? result.message ?? "Address saved" : result.message);
      if (result.ok) { setForm(blank); setEditingId(undefined); }
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        {addresses.map((address) => (
          <article key={address.id} className="rounded-panel border border-border p-5">
            <div className="flex justify-between gap-4"><h2 className="font-medium text-ink">{address.recipient_name}</h2>{address.is_default && <span className="text-xs text-wine">{"Default"}</span>}</div>
            <p className="mt-2 text-sm leading-6 text-muted">{address.full_address}, {address.area}, {address.upazila}, {address.district}, {address.division}<br />{address.phone}</p>
            <div className="mt-4 flex gap-4 text-sm">
              <button onClick={() => { setEditingId(address.id); setForm({ recipientName: address.recipient_name, phone: address.phone, division: address.division, district: address.district, upazila: address.upazila, area: address.area, postalCode: address.postal_code ?? "", fullAddress: address.full_address, deliveryNote: address.delivery_note ?? "", isDefault: address.is_default }); }} className="text-wine hover:underline">{"Edit"}</button>
              <button
                onClick={() => {
                  if (!confirm("Delete this address? This can't be undone.")) return;
                  startTransition(async () => {
                    const result = await deleteAddressAction(address.id);
                    addToast(result.ok ? "Address deleted" : result.message);
                  });
                }}
                className="text-wine hover:underline"
              >
                {"Delete"}
              </button>
            </div>
          </article>
        ))}
        {addresses.length === 0 && <p className="text-sm text-muted">{"You have not saved an address yet."}</p>}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl text-ink">{editingId ? "Edit address" : "Add address"}</h2>
        <Input label={"Full Name"} value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} required />
        <Input label={"Phone Number"} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
        <Input label={"Division"} value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} required />
        <Input label={"District"} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required />
        <Input label={"Upazila"} value={form.upazila} onChange={(e) => setForm({ ...form, upazila: e.target.value })} required />
        <Input label={"Area or neighbourhood"} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} required />
        <Input label={"Full Address"} value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} required />
        <Input label={"Postal code (optional)"} value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
        <Input label={"Delivery note (optional)"} value={form.deliveryNote} onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })} />
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="accent-wine" />{"Use as default address"}</label>
        <Button type="submit" loading={pending} className="self-start">{"Save"}</Button>
      </form>
    </div>
  );
}
