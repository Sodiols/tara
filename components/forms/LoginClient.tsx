"use client";

import { FormEvent, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  googleLoginAction,
  loginAction,
  registerAction,
} from "@/lib/supabase/actions/auth";
import { Button } from "@/components/ui/Button";

type AuthMode = "login" | "register";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px]">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.62Z" />
      <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
    </svg>
  );
}

/**
 * The Google button.
 *
 * Split out so it can read `useFormStatus`, which only reports the state of the
 * form it is rendered inside. Without this the button gave no feedback at all
 * between the click and the redirect to Google — a second or more on a slow
 * connection, during which the obvious thing to do is click it again. Each
 * extra click started another OAuth handshake.
 *
 * `disabled` is also driven by the email form's pending state, so the two
 * cannot be submitted at once.
 */
function GoogleSubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      fullWidth
      loading={pending}
      disabled={disabled}
      className="normal-case tracking-normal"
    >
      <span className="flex items-center justify-center gap-3">
        {!pending && <GoogleIcon />}
        {pending ? "Redirecting to Google…" : "Continue with Google"}
      </span>
    </Button>
  );
}

function AuthInput({
  label,
  icon,
  error,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: React.ReactNode;
  error?: string;
  /** Shown before submit, so a rule does not have to be discovered by failing. */
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <span className="relative mt-2 block">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">
          {icon}
        </span>
        <input
          {...props}
          aria-invalid={Boolean(error)}
          className="h-[52px] w-full rounded-control border border-border bg-white pl-11 pr-4 outline-none transition-colors focus:border-wine"
        />
      </span>
      {hint && !error && (
        <span className="mt-1.5 block text-xs font-normal text-muted">{hint}</span>
      )}
      {/* role="alert" so the failure is announced when it appears, not only
          when the field is focused again. */}
      {error && (
        <span role="alert" className="mt-1.5 block text-xs font-normal text-wine">
          {error}
        </span>
      )}
    </label>
  );
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "not-configured": "Supabase has not been configured yet.",
  "recovery-expired": "This recovery link is invalid or expired.",
  "missing-callback-code": "That sign-in link is incomplete. Please start again.",
  "invalid-callback": "That sign-in link is invalid or has already been used.",
  oauth: "Google sign-in is unavailable right now. Please sign in with your email and password, or try again shortly.",
  default: "The sign-in link is invalid or expired.",
};

export function LoginClient({
  returnTo = "/account",
  errorCode,
  initialMode = "login",
  passwordUpdated = false,
}: {
  returnTo?: string;
  errorCode?: string;
  initialMode?: AuthMode;
  passwordUpdated?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Every code the auth callback and googleLoginAction can redirect back with.
  // "oauth" used to fall through to "the sign-in link is invalid or expired",
  // which is actively misleading: the usual cause is that the Google provider
  // has not been enabled in the Supabase dashboard, and there is no link.
  const [error, setError] = useState(AUTH_ERROR_MESSAGES[errorCode ?? ""] ?? (errorCode ? AUTH_ERROR_MESSAGES.default : ""));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState("");
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const googleEnabled =
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setFieldErrors({});
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.history.replaceState(
      null,
      "",
      nextMode === "register"
        ? `/login?mode=register${returnTo !== "/account" ? `&returnTo=${encodeURIComponent(returnTo)}` : ""}`
        : `/login${returnTo !== "/account" ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
    );
  }

  function submitLogin(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    startTransition(async () => {
      const result = await loginAction({ email, password, returnTo });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        return setError(result.message);
      }
      router.replace(returnTo);
      router.refresh();
    });
  }

  function submitRegistration(event: FormEvent) {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    startTransition(async () => {
      const result = await registerAction({
        ...registerForm,
      });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        return setError(result.message);
      }
      if (result.message === "Account created successfully") {
        router.replace("/account");
        router.refresh();
      } else {
        setSuccess(result.message ?? "Check your email and confirm your address before signing in.");
      }
    });
  }

  return (
    <section
      className="bg-[#f8f6f2] lg:min-h-[calc(100vh-7rem)]"
      aria-labelledby="auth-heading"
    >
      <div className="mx-auto grid w-full max-w-[1536px] lg:min-h-[calc(100vh-7rem)] lg:grid-cols-[44%_56%]">
        <div className="relative hidden min-h-[720px] overflow-hidden lg:block">
          <Image
            src="/images/account/tara-account-login.png"
            alt="A woman wearing an embroidered TARA three-piece outfit"
            fill
            priority
            sizes="44vw"
            className="object-cover object-[48%_58%]"
          />
        </div>

        <div
          className={`flex justify-center px-5 py-10 sm:px-8 sm:py-14 lg:px-12 ${
            mode === "register" ? "items-start" : "items-center"
          }`}
        >
          <div className="w-full max-w-[610px] rounded-[3px] border border-[#ded8d0] bg-white px-6 py-8 sm:px-11 sm:py-10">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-wine">
              {"Your TARA account"}
            </p>
            <h1
              id="auth-heading"
              className="font-serif text-[2.35rem] leading-none text-ink sm:text-[3.1rem]"
            >
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mb-7 mt-3 text-sm text-muted">
              {mode === "login" ? "Sign in to continue your TARA experience." : "Join TARA for faster checkout, order tracking, and saved favourites."}
            </p>

            {passwordUpdated && mode === "login" && (
              <p className="mb-5 rounded-control border border-border bg-beige/35 px-4 py-3 text-sm text-ink">
                {"Your password has been updated."}
              </p>
            )}

            {success ? (
              <div className="rounded-control border border-border bg-beige/35 px-5 py-6 text-center">
                <h2 className="font-serif text-2xl text-ink">{"Check your email"}</h2>
                <p className="mt-3 text-sm leading-6 text-muted">{success}</p>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="mt-5 text-sm font-medium text-wine hover:underline"
                >
                  {"Back to login"}
                </button>
              </div>
            ) : mode === "login" ? (
              <form onSubmit={submitLogin} className="space-y-5">
                <AuthInput
                  label={"Email Address"}
                  icon={<Mail size={17} />}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  error={fieldErrors.email?.length ? "Enter a valid email address." : undefined}
                  required
                />
                <label className="block text-sm font-medium text-ink">
                  {"Password"}
                  <span className="relative mt-2 block">
                    <LockKeyhole size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-[52px] w-full rounded-control border border-border pl-11 pr-12 outline-none transition-colors focus:border-wine"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-muted hover:text-wine"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-sm text-wine hover:underline">
                    {"Forgot Password?"}
                  </Link>
                </div>
                {error && <p role="alert" className="text-sm text-wine">{error}</p>}
                <Button type="submit" fullWidth size="lg" loading={pending} className="normal-case tracking-normal">
                  {"Sign In"}
                </Button>
              </form>
            ) : (
              <form onSubmit={submitRegistration} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthInput
                    label={"Full Name"}
                    icon={<UserRound size={17} />}
                    autoComplete="name"
                    value={registerForm.fullName}
                    onChange={(event) => setRegisterForm({ ...registerForm, fullName: event.target.value })}
                    error={fieldErrors.fullName?.length ? "Enter your full name." : undefined}
                    required
                  />
                  <AuthInput
                    label={"Phone Number"}
                    icon={<Phone size={17} />}
                    type="tel"
                    autoComplete="tel"
                    value={registerForm.phone}
                    onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
                    error={fieldErrors.phone?.length ? "Enter a valid Bangladesh mobile number." : undefined}
                    required
                  />
                </div>
                <AuthInput
                  label={"Email Address"}
                  icon={<Mail size={17} />}
                  type="email"
                  autoComplete="email"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })}
                  error={fieldErrors.email?.length ? "Enter a valid email address." : undefined}
                  required
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <AuthInput
                    label={"Password"}
                    icon={<LockKeyhole size={17} />}
                    type="password"
                    autoComplete="new-password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
                    hint="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
                    error={fieldErrors.password?.length ? "Use at least 8 characters with uppercase, lowercase, and a number." : undefined}
                    required
                  />
                  <AuthInput
                    label={"Confirm Password"}
                    icon={<LockKeyhole size={17} />}
                    type="password"
                    autoComplete="new-password"
                    value={registerForm.confirmPassword}
                    onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
                    error={fieldErrors.confirmPassword?.length ? "The passwords do not match." : undefined}
                    required
                  />
                </div>
                {error && <p role="alert" className="text-sm text-wine">{error}</p>}
                <Button type="submit" fullWidth size="lg" loading={pending} className="normal-case tracking-normal">
                  {"Create Account"}
                </Button>
              </form>
            )}

            {!success && (
              <>
                {/*
                  Directly under the submit button, above the link that swaps
                  between signing in and registering.

                  It used to sit below that link, which put "Don't have an
                  account? Create Account" between the two ways of doing the
                  same thing. Google is an alternative to the form immediately
                  above it, not an afterthought below the footer — and on a
                  phone the old order pushed it under the fold on the register
                  view, where the form is taller.

                  One block serves both modes deliberately. Signing in with
                  Google and signing up with Google are the same handshake:
                  Supabase creates the account on first use, so there is no
                  second button to write and no second flow to keep in step.
                */}
                {googleEnabled && (
                  <>
                    <p className="my-5 text-center text-xs text-muted">{"or"}</p>
                    <form action={() => googleLoginAction(returnTo)}>
                      <GoogleSubmitButton disabled={pending} />
                    </form>
                  </>
                )}

                <p className="mt-5 text-center text-sm text-muted">
                  {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
                  <button
                    type="button"
                    onClick={() => switchMode(mode === "login" ? "register" : "login")}
                    className="font-medium text-wine hover:underline"
                  >
                    {mode === "login" ? "Create Account" : "Sign In"}
                  </button>
                </p>
              </>
            )}

            <div className="mt-5 flex justify-center gap-2 text-xs leading-5 text-muted">
              <ShieldCheck size={18} className="text-wine" />
              <p>{"Your information is protected by secure account access."}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
