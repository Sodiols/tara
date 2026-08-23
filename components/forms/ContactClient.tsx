"use client";

import { useState, FormEvent, useId } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { Phone, Mail, MessageCircle, MapPin, Clock, Facebook, Instagram } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { submitContactAction } from "@/lib/supabase/actions/public";
import { formatBdPhone, isValidBdPhone, toInternationalBdPhone, toWhatsAppNumber } from "@/lib/phone";

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export interface ContactDetails {
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  facebook: string;
  instagram: string;
}

/**
 * Underlined field.
 *
 * The rest of the site uses the boxed `Input` from components/ui, but this
 * panel reads as one continuous sheet of paper — a boxed control inside it
 * fights the card. The label sits above the rule and turns wine while the
 * field has focus, so the active row is obvious without adding a second border
 * colour.
 *
 * The accessibility wiring matches components/ui/Input exactly: the label is
 * bound by id, hint and error are both named by `aria-describedby`, and the
 * error is a live region so it is announced when it appears rather than only
 * when the field is re-entered.
 */
function FieldLine({
  label,
  error,
  hint,
  multiline,
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
} & InputHTMLAttributes<HTMLInputElement> &
  TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const reactId = useId();
  const fieldId = props.id ?? reactId;
  const describedBy =
    [hint ? `${fieldId}-hint` : null, error ? `${fieldId}-error` : null].filter(Boolean).join(" ") ||
    undefined;

  const shared =
    "mt-2 w-full border-0 border-b bg-transparent px-0 font-sans text-sm text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-wine " +
    (error ? "border-wine" : "border-border");

  // The muted colour lives on the wrapper and the label inherits it, rather
  // than the label carrying `text-muted` alongside a
  // `group-focus-within:text-wine` override. Those two are single-class
  // utilities of equal specificity, so which one won would come down to
  // Tailwind's emit order. On the wrapper, `focus-within:text-wine` is strictly
  // more specific than `text-muted`, so the active state always wins.
  return (
    <div className="group flex flex-col text-muted transition-colors focus-within:text-wine">
      <label
        htmlFor={fieldId}
        className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em]"
      >
        {label}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>

      {multiline ? (
        <textarea
          {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`${shared} min-h-[104px] resize-y py-2 leading-6`}
        />
      ) : (
        <input
          {...(props as InputHTMLAttributes<HTMLInputElement>)}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`${shared} h-11`}
        />
      )}

      {hint && !error && (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-xs text-wine">
          {error}
        </p>
      )}
    </div>
  );
}

/** One contact channel inside the wine panel. */
function Channel({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-taraIvory/15 text-taraIvory"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-taraIvory/70">
          {label}
        </p>
        <div className="mt-0.5 font-sans text-sm leading-6 text-taraIvory">{children}</div>
      </div>
    </li>
  );
}

const channelLinkClass =
  "underline-offset-4 transition-colors hover:text-taraRose hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-taraRose";

export function ContactClient({ contact }: { contact: ContactDetails }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FormErrors = {};
    if (!name.trim()) next.name = "This field is required";
    else if (name.trim().length < 2) next.name = "Please enter your full name.";
    if (!email.trim()) next.email = "This field is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (phone.trim() && !isValidBdPhone(phone))
      next.phone = "Enter a valid Bangladesh mobile number, or leave this blank.";
    if (!message.trim()) next.message = "This field is required";
    else if (message.trim().length < 10)
      next.message = "Please write at least 10 characters so we can help you properly.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setSubmitError("");
    const result = await submitContactAction({ name, email, phone, message });
    setLoading(false);
    if (!result.ok) {
      if (result.fieldErrors) {
        const serverErrors: FormErrors = {};
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          if (messages?.[0]) serverErrors[field as keyof FormErrors] = messages[0];
        }
        setErrors(serverErrors);
      }
      return setSubmitError(result.message);
    }
    setSuccess(true);
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
  };

  // Every channel below is rendered only when the shop has actually configured
  // it in /admin/settings. A blank field is better than an invented one — and
  // when none are set the panel says so plainly rather than showing an empty
  // column with nothing under the heading.
  const hasAnyChannel = Boolean(
    contact.phone || contact.whatsapp || contact.email || contact.address
  );

  return (
    <section className="relative">
      {/*
        Soft ivory wash behind the top of the section that fades into the page.
        It sits behind the card so the card reads as lifted off the surface,
        which is what gives the layout its depth.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[300px] bg-gradient-to-b from-cream to-white sm:h-[360px]"
      />

      <div className="relative mx-auto max-w-[1200px] px-5 py-8 md:px-8 lg:px-12 lg:py-14">
        <Breadcrumb items={[{ label: "Get in Touch" }]} />

        <header className="mx-auto mt-6 max-w-2xl text-center">
          <h1 className="font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">
            {"Get in Touch"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-6 text-muted sm:text-base sm:leading-7">
            {
              "Questions about a piece, your size, or an order already on its way — send us a message and our team will get back to you."
            }
          </p>
        </header>

        <div className="mt-10 overflow-hidden rounded-panel border border-border bg-white shadow-[0_18px_50px_-24px_rgb(23_23_23_/_0.28)] sm:mt-12">
          <div className="grid gap-0 p-3 sm:p-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:p-5">
            {/* ---------------- Contact information panel ---------------- */}
            <aside className="relative overflow-hidden rounded-panel bg-wine px-6 py-8 sm:px-8 sm:py-10">
              {/*
                Decorative only. Rose at low opacity rather than a lighter wine:
                it is the palette's accent, and it keeps the corner from reading
                as a printing flaw.
              */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -right-16 h-60 w-60 rounded-full bg-taraRose/20"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-28 right-20 h-44 w-44 rounded-full bg-taraIvory/[0.07]"
              />

              <div className="relative">
                <h2 className="font-serif text-2xl text-taraIvory sm:text-[1.75rem]">
                  {"Contact Information"}
                </h2>
                <p className="mt-3 max-w-xs font-sans text-sm leading-6 text-taraIvory/75">
                  {"Reach us directly, or use the form and we will reply as soon as we can."}
                </p>

                <ul className="mt-9 flex flex-col gap-6">
                  {contact.phone && (
                    <Channel icon={<Phone size={16} />} label="Phone">
                      <a
                        href={`tel:${toInternationalBdPhone(contact.phone) ?? contact.phone}`}
                        className={channelLinkClass}
                      >
                        {formatBdPhone(contact.phone)}
                      </a>
                    </Channel>
                  )}

                  {contact.whatsapp && (
                    <Channel icon={<MessageCircle size={16} />} label="WhatsApp">
                      <a
                        href={`https://wa.me/${toWhatsAppNumber(contact.whatsapp) ?? ""}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={channelLinkClass}
                      >
                        {formatBdPhone(contact.whatsapp)}
                      </a>
                    </Channel>
                  )}

                  {contact.email && (
                    <Channel icon={<Mail size={16} />} label="Email">
                      <a href={`mailto:${contact.email}`} className={`break-all ${channelLinkClass}`}>
                        {contact.email}
                      </a>
                    </Channel>
                  )}

                  {contact.address && (
                    <Channel icon={<MapPin size={16} />} label="Shop Address">
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={channelLinkClass}
                      >
                        {contact.address}
                      </a>
                    </Channel>
                  )}

                  <Channel icon={<Clock size={16} />} label="Business Hours">
                    {"Saturday – Thursday, 10:00 AM – 8:00 PM"}
                  </Channel>
                </ul>

                {!hasAnyChannel && (
                  <p className="mt-6 max-w-xs font-sans text-sm leading-6 text-taraIvory/75">
                    {"Our phone and email details are being updated. The form is the fastest way to reach us in the meantime."}
                  </p>
                )}

                {(contact.facebook || contact.instagram) && (
                  <div className="mt-10 flex items-center gap-3">
                    {contact.facebook && (
                      <a
                        href={contact.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="TARA on Facebook"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-taraIvory/15 text-taraIvory transition-colors hover:bg-taraIvory hover:text-wine"
                      >
                        <Facebook size={17} aria-hidden="true" />
                      </a>
                    )}
                    {contact.instagram && (
                      <a
                        href={contact.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="TARA on Instagram"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-taraIvory/15 text-taraIvory transition-colors hover:bg-taraIvory hover:text-wine"
                      >
                        <Instagram size={17} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </aside>

            {/* ---------------------- Enquiry form ---------------------- */}
            <div className="px-1 py-9 sm:px-6 lg:px-10 lg:py-10">
              {success ? (
                <div
                  role="status"
                  className="flex h-full flex-col items-start justify-center rounded-panel bg-cream px-6 py-10 sm:px-8"
                >
                  <h2 className="font-serif text-2xl text-ink">{"Message sent"}</h2>
                  <p className="mt-3 max-w-sm font-sans text-sm leading-6 text-muted">
                    {"Thank you for writing to TARA. We will get back to you as soon as we can."}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-7"
                    onClick={() => setSuccess(false)}
                    type="button"
                  >
                    {"Send another message"}
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7">
                  <div className="grid gap-7 sm:grid-cols-2">
                    <FieldLine
                      label="Your Name"
                      name="name"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      error={errors.name}
                    />
                    <FieldLine
                      label="Your Email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      error={errors.email}
                    />
                  </div>

                  <FieldLine
                    label="Phone Number"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    hint="Optional — helpful if you would rather we called you back."
                    error={errors.phone}
                  />

                  <FieldLine
                    label="Message"
                    name="message"
                    multiline
                    rows={4}
                    required
                    placeholder="Write your message here"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    error={errors.message}
                  />

                  {submitError && (
                    <p role="alert" className="font-sans text-sm text-wine">
                      {submitError}
                    </p>
                  )}

                  <Button type="submit" loading={loading} className="self-start">
                    {"Send Message"}
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
