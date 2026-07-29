"use client";

import { useState, FormEvent } from "react";
import { Phone, Mail, MessageCircle, MapPin, Clock, Facebook, Instagram } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { siteConfig } from "@/data/site";
import { submitContactAction } from "@/lib/supabase/actions/public";

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export function ContactClient() {
  const { t } = useLanguage();
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
    if (!name.trim()) next.name = t("common.required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t("common.required");
    if (!message.trim()) next.message = t("common.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setSubmitError("");
    const result = await submitContactAction({ name, email, phone, message });
    setLoading(false);
    if (!result.ok) return setSubmitError(t(result.message));
    setSuccess(true);
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-8 lg:px-12 py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("contact.heading") }]} />
      <h1 className="font-serif text-3xl sm:text-4xl lg:text-[2.75rem] text-ink mt-3 mb-1">{t("contact.heading")}</h1>
      <p className="text-muted mb-10">{t("contact.subheading")}</p>

      <div className="grid lg:grid-cols-2 gap-12">
        <div>
          {success ? (
            <p className="text-sm text-wine rounded-panel border border-border p-6" role="status">
              {t("contact.success")}
            </p>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 max-w-md">
              <Input label={t("contact.name")} required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
              <Input
                label={t("contact.email")}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
              />
              <Input label={t("contact.phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Textarea
                label={t("contact.message")}
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                error={errors.message}
              />
              {submitError && <p role="alert" className="text-sm text-wine">{submitError}</p>}
              <Button type="submit" loading={loading} className="self-start">
                {t("contact.send")}
              </Button>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <Phone size={20} className="text-wine mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm text-ink font-medium">{t("contact.phoneLabel")}</h3>
              <p className="text-sm text-muted">{siteConfig.phone}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <MessageCircle size={20} className="text-wine mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm text-ink font-medium">{t("contact.whatsappLabel")}</h3>
              <p className="text-sm text-muted">{siteConfig.whatsapp}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Mail size={20} className="text-wine mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm text-ink font-medium">{t("contact.emailLabel")}</h3>
              <p className="text-sm text-muted">{siteConfig.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <MapPin size={20} className="text-wine mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm text-ink font-medium">{t("contact.addressLabel")}</h3>
              <p className="text-sm text-muted">{siteConfig.address}</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <Clock size={20} className="text-wine mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm text-ink font-medium">{t("contact.hoursLabel")}</h3>
              <p className="text-sm text-muted">{t("contact.hoursText")}</p>
            </div>
          </div>

          <div className="aspect-video rounded-panel bg-beige border border-border flex items-center justify-center text-muted text-sm">
            Google Maps
          </div>

          <div className="flex items-center gap-4">
            <a href={siteConfig.facebook} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-wine">
              <Facebook size={20} />
            </a>
            <a href={siteConfig.instagram} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-wine">
              <Instagram size={20} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
