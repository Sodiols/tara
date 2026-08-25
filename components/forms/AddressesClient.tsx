"use client";

import { FormEvent, useState, useTransition } from "react";
import type { Database } from "@/types/database";
import { deleteAddressAction, saveAddressAction } from "@/lib/supabase/actions/profile";
import { useToastStore } from "@/store/toastStore";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  DIVISIONS,
  districtsForDivision,
  resolveLocation,
} from "@/data/bangladesh-geography";

type Address = Database["public"]["Tables"]["addresses"]["Row"];

/**
 * The saved address book.
 *
 * Division and district are dropdowns over the real Bangladesh geography, and
 * the district list is derived from the chosen division — so a pair like
 * "Sylhet / Dhaka" cannot be built here at all. The database re-checks it on
 * insert anyway (migration 0009), which is what catches a stale form.
 *
 * Upazila and area are gone. Checkout stopped collecting them, so asking for
 * them here was two required fields the order never used, and the old list of
 * upazilas was wrong besides.
 */
const DEFAULT_DIVISION = DIVISIONS[DIVISIONS.length - 1]; // Sylhet, the home division

const blank = {
  recipientName: "",
  phone: "",
  division: DEFAULT_DIVISION as string,
  district: districtsForDivision(DEFAULT_DIVISION)[0] ?? "",
  postalCode: "",
  fullAddress: "",
  deliveryNote: "",
  isDefault: false,
};

export function AddressesClient({ addresses }: { addresses: Address[] }) {
  const { addToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!resolveLocation(form.division, form.district)) {
      setError("Choose a division and a district that belong together.");
      return;
    }
    setError("");
    startTransition(async () => {
      const result = await saveAddressAction({ ...form, id: editingId });
      addToast(result.ok ? result.message ?? "Address saved" : result.message);
      if (result.ok) {
        setForm(blank);
        setEditingId(undefined);
      } else {
        setError(result.message);
      }
    });
  }

  function edit(address: Address) {
    // An address saved before the geography was corrected may name a place that
    // is not a district. It opens on something valid rather than pre-filling a
    // value the form cannot offer.
    const location = resolveLocation(address.division, address.district);
    setEditingId(address.id);
    setError("");
    setForm({
      recipientName: address.recipient_name,
      phone: address.phone,
      division: location?.division ?? DEFAULT_DIVISION,
      district:
        location?.district ?? districtsForDivision(DEFAULT_DIVISION)[0] ?? "",
      postalCode: address.postal_code ?? "",
      fullAddress: address.full_address,
      deliveryNote: address.delivery_note ?? "",
      isDefault: address.is_default,
    });
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-4">
        {addresses.map((address) => (
          <article key={address.id} className="rounded-panel border border-border p-5">
            <div className="flex justify-between gap-4">
              <h2 className="font-medium text-ink">{address.recipient_name}</h2>
              {address.is_default && <span className="text-xs text-wine">{"Default"}</span>}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {[address.full_address, address.district, address.division]
                .map((part) => part?.trim())
                .filter(Boolean)
                .join(", ")}
              <br />
              {address.phone}
            </p>
            <div className="mt-4 flex gap-4 text-sm">
              <button type="button" onClick={() => edit(address)} className="text-wine hover:underline">
                {"Edit"}
              </button>
              <button
                type="button"
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
        {addresses.length === 0 && (
          <p className="text-sm text-muted">{"You have not saved an address yet."}</p>
        )}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl text-ink">
          {editingId ? "Edit address" : "Add address"}
        </h2>
        <Input
          label={"Full Name"}
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          required
        />
        <Input
          label={"Phone Number"}
          placeholder="01XXXXXXXXX"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          required
        />
        <Select
          label={"Division"}
          value={form.division}
          onChange={(e) =>
            setForm({
              ...form,
              division: e.target.value,
              // A district belongs to exactly one division, so the district has
              // to follow the division rather than being left behind.
              district: districtsForDivision(e.target.value)[0] ?? "",
            })
          }
        >
          {DIVISIONS.map((division) => (
            <option key={division} value={division}>
              {division}
            </option>
          ))}
        </Select>
        <Select
          label={"District"}
          value={form.district}
          onChange={(e) => setForm({ ...form, district: e.target.value })}
        >
          {districtsForDivision(form.division).map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </Select>
        <Input
          label={"Full Address"}
          hint="House and road, plus any landmark that helps the courier find you."
          value={form.fullAddress}
          onChange={(e) => setForm({ ...form, fullAddress: e.target.value })}
          required
        />
        <Input
          label={"Postal code (optional)"}
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
        />
        <Input
          label={"Delivery note (optional)"}
          value={form.deliveryNote}
          onChange={(e) => setForm({ ...form, deliveryNote: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            className="accent-wine"
          />
          {"Use as default address"}
        </label>
        {error && (
          <p role="alert" className="text-sm text-wine">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={pending} className="self-start">
            {"Save"}
          </Button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(undefined);
                setForm(blank);
                setError("");
              }}
              className="text-sm text-muted underline-offset-4 hover:text-wine hover:underline"
            >
              {"Cancel"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
