"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction } from "@/lib/supabase/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const PASSWORD_HINT =
  "At least 8 characters, with an uppercase letter, a lowercase letter and a number.";

export function ResetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  // The action returns per-field errors and its message says "check the
  // highlighted information" — but nothing was highlighted, because these were
  // being thrown away. A weak password produced a dead end with no clue what
  // was wrong.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});

    // Checked here as well as on the server so the mismatch is caught without
    // a round trip.
    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "The passwords do not match." });
      return;
    }

    setLoading(true);
    const result = await resetPasswordAction({ password, confirmPassword });
    setLoading(false);
    if (!result.ok) {
      if (result.fieldErrors) {
        const next: Record<string, string> = {};
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) next[field] = messages[0];
        }
        setFieldErrors(next);
      }
      return setError(result.message);
    }
    router.replace("/login?passwordUpdated=true");
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <h1 className="mb-3 text-center font-serif text-3xl text-ink">{"Reset password"}</h1>
      <p className="mb-8 text-center text-sm text-muted">{"Choose a secure new password for your account."}</p>
      <form onSubmit={submit} noValidate className="space-y-5">
        <Input
          label={"New password"}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={PASSWORD_HINT}
          error={fieldErrors.password}
          required
        />
        <Input
          label={"Confirm Password"}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={fieldErrors.confirmPassword}
          required
        />
        {error && <p role="alert" className="text-sm text-wine">{error}</p>}
        <Button type="submit" fullWidth loading={loading}>{"Update password"}</Button>
      </form>
    </div>
  );
}
