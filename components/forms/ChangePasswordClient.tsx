"use client";

import { FormEvent, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { changePasswordAction } from "@/lib/supabase/actions/auth";
import { useLanguage } from "@/lib/i18n";
import { useToastStore } from "@/store/toastStore";
import { Container } from "@/components/layout/Container";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ChangePasswordClient() {
  const { t } = useLanguage();
  const { addToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setFieldErrors({});
    startTransition(async () => {
      const result = await changePasswordAction({ currentPassword, password, confirmPassword });
      if (!result.ok) {
        setFormError(t(result.message));
        if (result.fieldErrors) {
          const next: Record<string, string> = {};
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) next[key] = messages[0];
          }
          setFieldErrors(next);
        }
        return;
      }
      addToast(t(result.message ?? "auth.passwordUpdated"));
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("account.heading"), href: "/account" }, { label: t("account.security") }]} />
      <h1 className="mb-2 mt-3 font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">{t("account.security")}</h1>
      <p className="mb-8 max-w-lg font-sans text-sm text-muted">{t("account.changePasswordText")}</p>

      <form onSubmit={submit} className="flex max-w-md flex-col gap-5">
        <Input
          label={t("auth.currentPassword")}
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          error={fieldErrors.currentPassword}
          required
        />
        <Input
          label={t("auth.newPassword")}
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          required
        />
        <Input
          label={t("auth.confirmPassword")}
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={fieldErrors.confirmPassword}
          required
        />
        <button
          type="button"
          onClick={() => setShowPasswords((v) => !v)}
          className="flex items-center gap-1.5 self-start font-sans text-xs text-muted hover:text-ink"
        >
          {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
          {showPasswords ? t("auth.hidePassword") : t("auth.showPassword")}
        </button>
        {formError && (
          <p role="alert" className="font-sans text-sm text-wine">
            {formError}
          </p>
        )}
        <Button type="submit" loading={pending} className="self-start">
          {t("auth.updatePassword")}
        </Button>
      </form>
    </Container>
  );
}
