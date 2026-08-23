"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/lib/supabase/actions/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ForgotPasswordClient() {
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
    if (result.ok) setMessage(result.message ?? "If an account exists, a password reset link has been sent.");
    else setError(result.message);
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16 sm:py-24">
      <h1 className="mb-3 text-center font-serif text-3xl text-ink">{"Forgot Password?"}</h1>
      <p className="mb-8 text-center text-sm text-muted">{"Enter your email and we will send a secure reset link."}</p>
      {message ? (
        <div className="border border-border bg-beige/40 p-5 text-sm text-ink">{message}</div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <Input label={"Email Address"} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          {error && <p role="alert" className="text-sm text-wine">{error}</p>}
          <Button type="submit" fullWidth loading={loading}>{"Send reset link"}</Button>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm text-wine hover:underline">{"Back to login"}</Link>
    </div>
  );
}
