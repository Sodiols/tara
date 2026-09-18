"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/store/toastStore";
import type { ActionResult } from "@/lib/supabase/actions/auth";
import { adminButtonClass, type AdminButtonVariant } from "./ui";
import { AdminConfirmDialog } from "./AdminConfirmDialog";

// Widened so any action can be passed here regardless of what it returns in
// `data` — these wrappers only ever read `ok`, `message` and `fieldErrors`.
type AnyActionResult = ActionResult<unknown>;
// The success branch only — onSuccess is never called for a failure, so the
// callback should not have to re-narrow the union to read `data`.
type SuccessResult = Extract<AnyActionResult, { ok: true }>;

/**
 * Whether the enclosing ActionForm is submitting.
 *
 * ActionForm submits through `onSubmit` rather than the `action` prop (see the
 * note on it), which `useFormStatus` cannot see — so the form says it is busy
 * through this instead, and SubmitButton listens to both.
 */
const FormPendingContext = createContext(false);

/**
 * Client wrappers around the admin server actions.
 *
 * Everything here exists to make three things impossible to forget:
 * a disabled control while a request is in flight, an explicit success or
 * failure message, and a confirmation step in front of anything destructive.
 */

type Variant = AdminButtonVariant;

/**
 * The default horizontal padding is part of `adminButtonClass`; a caller that
 * passes its own `px-*` gets that instead. `cn()` is a plain join rather than
 * tailwind-merge, so a caller's `px-0` would otherwise sit beside the base
 * `px-4` and lose — which is what once squeezed the icon-only buttons in the
 * image manager down to a two-pixel content box.
 */
const PADDING_UTILITY = /(?:^|\s)!?(?:p|px|py|ps|pe|pl|pr)-/;
const HEIGHT_UTILITY = /(?:^|\s)!?h-/;

function buttonClass(variant: Variant, className?: string) {
  const base = adminButtonClass(variant, "md");
  if (!className) return base;
  // Strip the defaults the caller is overriding, so the caller's value is the
  // only one on the element.
  let resolved = base;
  if (PADDING_UTILITY.test(className)) resolved = resolved.replace(/\bpx-4\b/, "");
  if (HEIGHT_UTILITY.test(className)) resolved = resolved.replace(/\bh-11\b/, "");
  return cn(resolved, className);
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
  disabled,
  formAction,
  name,
  value,
  confirm,
  confirmTitle,
  confirmLabel,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
  formAction?: string | ((formData: FormData) => void | Promise<void>);
  name?: string;
  value?: string;
  /** The consequence, in a sentence. Shown in a dialog before submitting. */
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
}) {
  const { pending: statusPending } = useFormStatus();
  const contextPending = useContext(FormPendingContext);
  const pending = statusPending || contextPending;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);
  const [asking, setAsking] = useState(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="submit"
        name={name}
        value={value}
        formAction={formAction}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={(event) => {
          if (!confirm || confirmedRef.current) {
            confirmedRef.current = false;
            return;
          }
          event.preventDefault();
          setAsking(true);
        }}
        className={buttonClass(variant, className)}
      >
        {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
      {asking && confirm && (
        <AdminConfirmDialog
          title={confirmTitle ?? "Are you sure?"}
          body={[confirm]}
          confirmLabel={confirmLabel ?? (typeof children === "string" ? children : "Confirm")}
          tone={variant === "danger" ? "danger" : "primary"}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            // Submits through the same button, so its name, value and
            // formAction are sent exactly as a plain click would send them.
            confirmedRef.current = true;
            buttonRef.current?.form?.requestSubmit(buttonRef.current);
          }}
        />
      )}
    </>
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
  id,
  successToast = true,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<AnyActionResult>;
  children: React.ReactNode;
  className?: string;
  id?: string;
  successToast?: boolean;
  resetOnSuccess?: boolean;
  onSuccess?: (result: SuccessResult) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const addToast = useToastStore((state) => state.addToast);
  const messageId = useId();

  const [state, dispatch, pending] = useActionState<AnyActionResult | null, FormData>(
    async (_previous, formData) => action(formData),
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (successToast && state.message) addToast(state.message, "success");
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    } else {
      addToast(state.message, "error");
      // Take the staff member to the first field the server refused, rather
      // than leaving them to match a list of field names to inputs.
      const first = Object.keys(state.fieldErrors ?? {})[0];
      const element = first ? formRef.current?.elements.namedItem(first) : null;
      if (element instanceof HTMLElement) {
        element.scrollIntoView({ block: "center" });
        element.focus({ preventScroll: true });
      }
    }
    // `state` is the only meaningful trigger; the callbacks are stable enough
    // that re-running on their identity would double-fire the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form
      ref={formRef}
      id={id}
      /*
       * Submitted through onSubmit, NOT the `action` prop. React 19 resets an
       * uncontrolled form after its action returns — including when what it
       * returned was "the SKU is taken" — so an action-prop form wiped
       * everything the staff member had typed on every validation error. Here
       * the fields keep their values until the save succeeds, and are reset
       * then only when the caller asks (`resetOnSuccess`).
       *
       * The submitter is passed to FormData so a button's own name and value
       * are still sent, exactly as a native submission would send them.
       */
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter ?? undefined);
        startTransition(() => dispatch(formData));
      }}
      aria-busy={pending}
      className={className}
      noValidate
    >
      <FormPendingContext.Provider value={pending}>{children}</FormPendingContext.Provider>
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
  confirmTitle,
  confirmLabel,
  confirmTone,
  disabled,
  title,
}: {
  action: () => Promise<AnyActionResult>;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  confirmTone?: "danger" | "primary";
  disabled?: boolean;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const run = () =>
    startTransition(async () => {
      const result = await action();
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
    });

  return (
    <>
      <button
        type="button"
        title={title}
        disabled={pending || disabled}
        aria-busy={pending}
        onClick={() => (confirm ? setAsking(true) : run())}
        className={buttonClass(variant, className)}
      >
        {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {children}
      </button>
      {asking && confirm && (
        <AdminConfirmDialog
          title={confirmTitle ?? "Are you sure?"}
          body={[confirm]}
          confirmLabel={confirmLabel ?? title ?? "Confirm"}
          tone={variant === "danger" || confirmTone === "danger" ? "danger" : "primary"}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            run();
          }}
        />
      )}
    </>
  );
}

/** Small inline variant for dense table rows. */
export function RowActionButton({
  action,
  children,
  confirm,
  confirmTitle,
  confirmLabel,
  tone = "default",
}: {
  action: () => Promise<AnyActionResult>;
  children: React.ReactNode;
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

  const run = () =>
    startTransition(async () => {
      const result = await action();
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
    });

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => (confirm ? setAsking(true) : run())}
        className={cn(
          // 36px tall: still a comfortable tap target inside a dense row.
          "inline-flex min-h-9 items-center font-sans text-xs font-semibold uppercase tracking-wide underline-offset-4 transition-colors hover:underline disabled:cursor-not-allowed disabled:text-muted",
          tone === "danger" ? "text-[#8C2F2F]" : "text-taraWine",
        )}
      >
        {pending ? "Working…" : children}
      </button>
      {asking && confirm && (
        <AdminConfirmDialog
          title={confirmTitle ?? "Are you sure?"}
          body={[confirm]}
          confirmLabel={confirmLabel ?? (typeof children === "string" ? children : "Confirm")}
          tone={tone === "danger" ? "danger" : "primary"}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            run();
          }}
        />
      )}
    </>
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
          <span className="block font-sans text-sm font-bold text-ink">{title}</span>
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
