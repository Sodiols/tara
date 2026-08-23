"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toastStore";
import type { ActionResult } from "@/lib/supabase/actions/auth";

// Widened so any action can be passed here regardless of what it returns in
// `data` — these wrappers only ever read `ok`, `message` and `fieldErrors`.
type AnyActionResult = ActionResult<unknown>;
// The success branch only — onSuccess is never called for a failure, so the
// callback should not have to re-narrow the union to read `data`.
type SuccessResult = Extract<AnyActionResult, { ok: true }>;

/**
 * Client wrappers around the admin server actions.
 *
 * Everything here exists to make three things impossible to forget:
 * a disabled control while a request is in flight, an explicit success or
 * failure message, and a confirmation step in front of anything destructive.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-taraWine text-taraIvory border border-taraWine hover:bg-taraBlack hover:border-taraBlack",
  secondary:
    "bg-taraWhite text-ink border border-border hover:border-taraWine hover:text-taraWine",
  ghost: "bg-transparent text-muted border border-transparent hover:text-taraWine",
  danger:
    "bg-taraWhite text-[#8C2F2F] border border-[#8C2F2F]/40 hover:bg-[#8C2F2F] hover:text-taraWhite",
};

const baseButton =
  "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 font-sans text-[13px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted";

export function SubmitButton({
  children,
  variant = "primary",
  className,
  disabled,
  formAction,
  name,
  value,
  confirm,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  name?: string;
  value?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      formAction={formAction}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
      className={cn(baseButton, variants[variant], className)}
    >
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/**
 * A form bound to a server action, with the result surfaced as an inline
 * message and a toast. Field-level errors from Zod are rendered under the form
 * so a staff member can see exactly which input needs fixing.
 */
export function ActionForm({
  action,
  children,
  className,
  successToast = true,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<AnyActionResult>;
  children: React.ReactNode;
  className?: string;
  successToast?: boolean;
  resetOnSuccess?: boolean;
  onSuccess?: (result: SuccessResult) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const addToast = useToastStore((state) => state.addToast);
  const messageId = useId();

  const [state, formAction] = useActionState<AnyActionResult | null, FormData>(
    async (_previous, formData) => action(formData),
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (successToast && state.message) addToast(state.message, "success");
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    } else {
      addToast(state.message, "error");
    }
    // `state` is the only meaningful trigger; the callbacks are stable enough
    // that re-running on their identity would double-fire the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={formAction} className={className} noValidate>
      {children}
      {state && !state.ok && (
        <div
          id={messageId}
          role="alert"
          className="mt-4 rounded-control border border-[#8C2F2F]/25 bg-[#8C2F2F]/5 px-3 py-2 font-sans text-sm text-[#8C2F2F]"
        >
          <p>{state.message}</p>
          {fieldErrors && Object.keys(fieldErrors).length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs">
              {Object.entries(fieldErrors).map(([field, messages]) => (
                <li key={field}>
                  <span className="font-semibold">{field}:</span> {messages.join(" ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state?.ok && state.message && (
        <p
          role="status"
          className="mt-4 rounded-control border border-[#2F5D50]/25 bg-[#2F5D50]/5 px-3 py-2 font-sans text-sm text-[#2F5D50]"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

/**
 * A standalone button that calls a server action — used for row actions such
 * as "Approve" or "Archive" where a whole form would be noise.
 *
 * `confirm` is mandatory for anything irreversible; the caller passes the exact
 * sentence the staff member should read before committing.
 */
export function ActionButton({
  action,
  children,
  variant = "secondary",
  className,
  confirm,
  disabled,
  title,
}: {
  action: () => Promise<AnyActionResult>;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  confirm?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const addToast = useToastStore((state) => state.addToast);

  return (
    <button
      type="button"
      title={title}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const result = await action();
          addToast(result.message ?? "Done.", result.ok ? "success" : "error");
        });
      }}
      className={cn(baseButton, variants[variant], className)}
    >
      {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Small inline variant for dense table rows. */
export function RowActionButton({
  action,
  children,
  confirm,
  tone = "default",
}: {
  action: () => Promise<AnyActionResult>;
  children: React.ReactNode;
  confirm?: string;
  tone?: "default" | "danger";
}) {
  const [pending, startTransition] = useTransition();
  const addToast = useToastStore((state) => state.addToast);

  return (
    <button
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const result = await action();
          addToast(result.message ?? "Done.", result.ok ? "success" : "error");
        });
      }}
      className={cn(
        "font-sans text-xs font-semibold uppercase tracking-wide underline-offset-4 transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted",
        tone === "danger" ? "text-[#8C2F2F]" : "text-taraWine",
      )}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/**
 * Collapsible section used by the long product form, so a staff member is not
 * confronted with forty inputs at once.
 */
export function Disclosure({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="rounded-panel border border-border bg-taraWhite">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block font-sans text-sm font-semibold uppercase tracking-wider text-ink">
            {title}
          </span>
          {description && (
            <span className="mt-1 block font-sans text-xs text-muted">{description}</span>
          )}
        </span>
        <span aria-hidden="true" className="font-sans text-lg leading-none text-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div id={panelId} className="border-t border-border px-5 py-5">
          {children}
        </div>
      )}
    </div>
  );
}
