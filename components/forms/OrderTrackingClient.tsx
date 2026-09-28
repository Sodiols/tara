"use client";

import { type FormEvent, useState } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { normaliseTrackingToken, trackingPath } from "@/lib/order-identifiers";

/**
 * The way in for a customer who has a tracking code but not the link.
 *
 * It does not look anything up. It recognises the code -- or the whole link,
 * pasted from the confirmation email -- and navigates to /track/<token>, the
 * one page that does. There is exactly one tracking lookup in the application.
 *
 * Codes from before migration 0027 (48 hexadecimal characters) are accepted
 * too, so tracking details already in customers' inboxes keep working. The
 * order number is not needed any more: the token alone identifies the order,
 * and the order number alone must never be enough.
 */
export function OrderTrackingClient() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const token = normaliseTrackingToken(value);
    if (!token) {
      setError("Enter the tracking code from your order confirmation. It starts with TRK-.");
      return;
    }
    setError("");
    setLoading(true);
    // A full document load rather than router.push, so no third-party tag
    // loaded on this page is carried into a page whose URL is a secret.
    window.location.assign(trackingPath(token));
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "Order Tracking" }]} />
      <h1 className="mt-3 mb-3 font-serif text-3xl text-ink sm:text-4xl">{"Order Tracking"}</h1>
      <p className="mb-8 text-sm text-muted">
        Your tracking link is in your order confirmation and email. You can also paste the link or the tracking code here.
      </p>
      <form onSubmit={handleSubmit} className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          label="Tracking code or link"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="TRK-XXXXXXXXXXXXXXXXXXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <Button type="submit" size="lg" loading={loading}>{"Track"}</Button>
        {error && <p role="alert" className="text-sm text-wine sm:col-span-2">{error}</p>}
      </form>
    </div>
  );
}
