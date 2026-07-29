"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/lib/supabase/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/lib/i18n";

export function ForgotPasswordClient() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const result = await forgotPasswordAction({ email });
    setLoading(false);
    if (result.ok) setMessage(t(result.message ?? "auth.resetEmailSent"));
    else setError(t(result.message));
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <h1 className="mb-3 text-center font-serif text-3xl text-ink">{t("auth.forgotPassword")}</h1>
      <p className="mb-8 text-center text-sm text-muted">{t("auth.forgotPasswordText")}</p>
      {message ? (
        <div className="border border-border bg-beige/40 p-5 text-sm text-ink">{message}</div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Input label={t("auth.email")} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {error && <p role="alert" className="text-sm text-wine">{error}</p>}
          <Button type="submit" fullWidth loading={loading}>{t("auth.sendResetLink")}</Button>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm text-wine hover:underline">{t("auth.backToLogin")}</Link>
    </div>
  );
}
