"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { subscribeNewsletterAction } from "@/lib/supabase/actions/public";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewsletterFormProps {
  variant?: "light" | "dark";
}

export function NewsletterForm({ variant = "light" }: NewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const isDark = variant === "dark";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setError("");
    setLoading(true);
    const result = await subscribeNewsletterAction({ email });
    setLoading(false);
    if (!result.ok) return setError(result.message);
    setSuccess(true);
    setEmail("");
  };

  return (
    <div className="max-w-xl mx-auto text-center">
      <h2
        className={cn(
          "font-serif font-normal text-2xl sm:text-3xl leading-[1.1] mb-2",
          isDark ? "text-taraIvory" : "text-ink"
        )}
      >
        {"Stay close to TARA"}
      </h2>
      <p className={cn("font-sans font-normal text-sm mb-6", isDark ? "text-taraIvory/75" : "text-muted")}>
        {"Be the first to discover new collections, offers, and styling inspiration."}
      </p>
      {success ? (
        <p className={cn("text-sm", isDark ? "text-taraRose" : "text-wine")} role="status">
          {"Thank you for subscribing to TARA."}
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col sm:flex-row gap-3 sm:gap-0">
          <label htmlFor="newsletter-email" className="sr-only">
            {"Enter your email address"}
          </label>
          <input
            id="newsletter-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={"Enter your email address"}
            aria-invalid={!!error}
            aria-describedby={error ? "newsletter-error" : undefined}
            className={cn(
              "flex-1 h-[52px] border px-4 text-sm focus:outline-none sm:border-r-0 transition-colors",
              isDark
                ? "border-taraIvory/30 bg-transparent text-taraIvory placeholder:text-taraIvory/50 focus:border-taraIvory"
                : "border-border bg-white text-ink focus:border-wine"
            )}
          />
          <Button
            type="submit"
            size="lg"
            loading={loading}
            className={cn("sm:px-8", isDark && "!bg-white !text-wine hover:!bg-taraBlack hover:!text-white")}
          >
            {"Subscribe"}
          </Button>
        </form>
      )}
      {error && (
        <p id="newsletter-error" className={cn("text-xs mt-2", isDark ? "text-taraRose" : "text-wine")}>
          {error}
        </p>
      )}
      <p className={cn("text-xs mt-4", isDark ? "text-taraIvory/60" : "text-muted")}>{"By subscribing you agree to our Privacy Policy."}</p>
    </div>
  );
}
