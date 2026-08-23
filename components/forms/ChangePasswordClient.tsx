"use client";

import { FormEvent, useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { changePasswordAction } from "@/lib/supabase/actions/auth";
import { useToastStore } from "@/store/toastStore";
import { Container } from "@/components/layout/Container";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ChangePasswordClient() {
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
        setFormError(result.message);
        if (result.fieldErrors) {
          const next: Record<string, string> = {};
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            if (messages?.[0]) next[key] = messages[0];
          }
          setFieldErrors(next);
        }
        return;
      }
      addToast(result.message ?? "Your password has been updated.");
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: "My Account", href: "/account" }, { label: "Change Password" }]} />
      <h1 className="mb-2 mt-3 font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">{"Change Password"}</h1>
      <p className="mb-8 max-w-lg font-sans text-sm text-muted">{"Update the password used to sign in to your TARA account."}</p>

      <form onSubmit={submit} className="flex max-w-md flex-col gap-5">
        <Input
          label={"Current password"}
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          error={fieldErrors.currentPassword}
          required
        />
        <Input
          label={"New password"}
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
          error={fieldErrors.password}
          required
        />
        <Input
          label={"Confirm Password"}
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
          {showPasswords ? "Hide password" : "Show password"}
        </button>
        {formError && (
          <p role="alert" className="font-sans text-sm text-wine">
            {formError}
          </p>
        )}
        <Button type="submit" loading={pending} className="self-start">
          {"Update password"}
        </Button>
      </form>
    </Container>
  );
}
