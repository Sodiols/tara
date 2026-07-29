"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/lib/supabase/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLanguage } from "@/lib/i18n";

export function ResetPasswordClient() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    const result = await resetPasswordAction({ password, confirmPassword });
    setLoading(false);
    if (!result.ok) return setError(t(result.message));
    router.replace("/login?passwordUpdated=true");
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <h1 className="mb-3 text-center font-serif text-3xl text-ink">{t("auth.resetPassword")}</h1>
      <p className="mb-8 text-center text-sm text-muted">{t("auth.resetPasswordText")}</p>
      <form onSubmit={submit} className="space-y-5">
        <Input label={t("auth.newPassword")} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <Input label={t("auth.confirmPassword")} type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        {error && <p role="alert" className="text-sm text-wine">{error}</p>}
        <Button type="submit" fullWidth loading={loading}>{t("auth.updatePassword")}</Button>
      </form>
    </div>
  );
}
