"use client";

import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import { Heart, KeyRound, LogOut, MapPin, Package, Truck, User } from "lucide-react";
import type { Database } from "@/types/database";
import { updateProfileAction } from "@/lib/supabase/actions/profile";
import { logoutAction } from "@/lib/supabase/actions/auth";
import { useLanguage } from "@/lib/i18n";
import { useToastStore } from "@/store/toastStore";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Container } from "@/components/layout/Container";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function AccountClient({ profile }: { profile: Profile }) {
  const { t } = useLanguage();
  const { addToast } = useToastStore();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone);
  const [preferredLanguage, setPreferredLanguage] = useState<"en" | "bn">(
    profile.preferred_language,
  );
  const clearBag = useCartStore((state) => state.clearBag);
  const clearWishlist = useWishlistStore((state) => state.replaceItems);

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateProfileAction({
        fullName: name,
        phone,
        preferredLanguage,
      });
      addToast(t(result.ok ? result.message ?? "account.profileSaved" : result.message));
    });
  }

  return (
    <Container className="py-8 sm:py-12 lg:py-14">
      <Breadcrumb items={[{ label: t("account.heading") }]} />
      <h1 className="mb-8 mt-3 font-serif text-3xl text-ink sm:text-4xl lg:text-[2.75rem]">{t("account.heading")}</h1>
      <div className="grid gap-10 lg:grid-cols-4">
        <aside>
          <nav className="flex flex-col divide-y divide-border overflow-hidden rounded-panel border border-border">
            <Link href="/account/profile" className="flex h-12 items-center gap-3 bg-beige px-4 text-sm text-ink"><User size={16} />{t("account.profile")}</Link>
            <Link href="/account/orders" className="flex h-12 items-center gap-3 px-4 text-sm text-muted hover:bg-beige/50 hover:text-ink"><Package size={16} />{t("account.orders")}</Link>
            <Link href="/track-order" className="flex h-12 items-center gap-3 px-4 text-sm text-muted hover:bg-beige/50 hover:text-ink"><Truck size={16} />{t("account.trackOrder")}</Link>
            <Link href="/account/wishlist" className="flex h-12 items-center gap-3 px-4 text-sm text-muted hover:bg-beige/50 hover:text-ink"><Heart size={16} />{t("account.wishlist")}</Link>
            <Link href="/account/addresses" className="flex h-12 items-center gap-3 px-4 text-sm text-muted hover:bg-beige/50 hover:text-ink"><MapPin size={16} />{t("account.addresses")}</Link>
            <Link href="/account/security" className="flex h-12 items-center gap-3 px-4 text-sm text-muted hover:bg-beige/50 hover:text-ink"><KeyRound size={16} />{t("account.security")}</Link>
            <form action={logoutAction} onSubmit={() => { clearBag(); clearWishlist([]); }}>
              <button className="flex h-12 w-full items-center gap-3 px-4 text-sm text-muted hover:bg-beige/50 hover:text-wine"><LogOut size={16} />{t("account.logout")}</button>
            </form>
          </nav>
        </aside>
        <form onSubmit={submit} className="flex max-w-lg flex-col gap-5 lg:col-span-3">
          <Input label={t("auth.fullName")} value={name} onChange={(event) => setName(event.target.value)} required />
          <Input label={t("auth.email")} type="email" value={profile.email} disabled />
          <Input label={t("auth.phone")} value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <label className="text-sm font-medium text-ink">
            {t("account.preferredLanguage")}
            <select
              value={preferredLanguage}
              onChange={(event) =>
                setPreferredLanguage(event.target.value as "en" | "bn")
              }
              className="mt-2 h-12 w-full rounded-control border border-border bg-white px-4 outline-none focus:border-wine"
            >
              <option value="en">{t("account.english")}</option>
              <option value="bn">{t("account.bangla")}</option>
            </select>
          </label>
          <Button type="submit" loading={pending} className="self-start">{t("common.save")}</Button>
        </form>
      </div>
    </Container>
  );
}
