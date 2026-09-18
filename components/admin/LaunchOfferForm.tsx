"use client";

import { useMemo, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import {
  saveLaunchOfferAction,
  setLaunchOfferProductsAction,
} from "@/lib/supabase/actions/launch-offer";
import { isoToStoreLocal } from "@/lib/format";
import { offerBadge, offerSentence, type LaunchOffer } from "@/lib/launch-offer";
import type { LaunchOfferAdminData } from "@/lib/supabase/queries/launch-offer";
import { ActionButton, ActionForm, SubmitButton } from "./AdminForm";
import {
  AdminStickyActions,
  Badge,
  Field,
  Panel,
  PanelHeader,
  adminInputClass,
  adminSelectClass,
  adminTextareaClass,
} from "./ui";

/**
 * The launch offer, in one screen.
 *
 * TWO FORMS, NOT ONE. The offer itself is an ordinary form post; which products
 * take part is a list that can be a hundred rows long, and posting it as
 * hidden inputs would make every save rewrite the offer as well. They are
 * saved separately and can be worked on in either order.
 *
 * NOTHING HERE IS ON BY DEFAULT. The offer ships disabled with no dates and no
 * discount, and stays that way until somebody fills this in and ticks the box.
 * The preview at the top shows exactly the words a customer will read — there
 * is no second place where the wording is decided.
 */
export function LaunchOfferForm({ data }: { data: LaunchOfferAdminData }) {
  const { offer, products, participating } = data;

  const [offerType, setOfferType] = useState(offer.offer_type);
  const [appliesTo, setAppliesTo] = useState(offer.applies_to);
  const [title, setTitle] = useState(offer.title);
  const [discountValue, setDiscountValue] = useState(
    offer.discount_value === null ? "" : String(offer.discount_value),
  );
  const [minimum, setMinimum] = useState(String(offer.minimum_order_amount ?? 0));
  const [gift, setGift] = useState(offer.gift_description);

  const needsPercentage = offerType === "percentage" || offerType === "first_order";
  const needsAmount = offerType === "fixed_amount";
  const needsGift = offerType === "gift";

  /** The customer's view of what is configured, updated as it is typed. */
  const preview = useMemo<LaunchOffer>(
    () => ({
      title,
      description: offer.description,
      offerType,
      appliesTo,
      discountValue: discountValue === "" ? null : Number(discountValue),
      minimumOrderAmount: Number(minimum) || 0,
      giftDescription: gift,
      startsAt: offer.starts_at,
      endsAt: offer.ends_at,
      productIds: [],
      heroSlugs: [],
    }),
    [title, offer.description, offerType, appliesTo, discountValue, minimum, gift, offer.starts_at, offer.ends_at],
  );

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="What customers will see"
          description="Generated from the settings below — this is the wording, not a mock-up of it."
        />
        <div className="flex flex-col gap-2 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={offer.is_enabled ? "success" : "neutral"}>
              {offer.is_enabled ? "Switched on" : "Switched off"}
            </Badge>
            <Badge tone="info">{offerBadge(preview)}</Badge>
            {appliesTo === "site_wide" ? (
              <Badge tone="neutral">Whole shop</Badge>
            ) : (
              <Badge tone="neutral">Selected products</Badge>
            )}
          </div>
          <p className="font-sans text-lg font-semibold text-ink">{title || "No title yet"}</p>
          <p className="font-sans text-sm text-muted">{offerSentence(preview)}</p>
          {!offer.is_enabled && (
            <p className="font-sans text-xs text-muted">
              Nothing is shown on the storefront and no discount is applied at checkout while the
              offer is switched off.
            </p>
          )}
        </div>
      </Panel>

      <ActionForm action={saveLaunchOfferAction} className="flex flex-col gap-5">
        <Panel>
          <PanelHeader title="The offer" />
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2">
            <Field
              label="Title"
              htmlFor="title"
              className="sm:col-span-2"
              hint="Shown on the homepage, the product page and the bag."
            >
              <input
                id="title"
                name="title"
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="TARA Launch Week"
                className={adminInputClass}
              />
            </Field>

            <Field
              label="Short description"
              htmlFor="description"
              className="sm:col-span-2"
              hint="One sentence. Leave blank to show only the benefit."
            >
              <textarea
                id="description"
                name="description"
                rows={2}
                maxLength={400}
                defaultValue={offer.description}
                className={adminTextareaClass}
              />
            </Field>

            <Field label="Offer type" htmlFor="offerType" required>
              <select
                id="offerType"
                name="offerType"
                value={offerType}
                onChange={(event) =>
                  setOfferType(event.target.value as typeof offerType)
                }
                className={adminSelectClass}
              >
                <option value="free_delivery">Free delivery</option>
                <option value="percentage">Percentage discount</option>
                <option value="fixed_amount">Fixed amount off</option>
                <option value="first_order">First order discount</option>
                <option value="gift">Gift with purchase</option>
              </select>
            </Field>

            <Field label="Applies to" htmlFor="appliesTo" required>
              <select
                id="appliesTo"
                name="appliesTo"
                value={appliesTo}
                onChange={(event) => setAppliesTo(event.target.value as typeof appliesTo)}
                className={adminSelectClass}
              >
                <option value="selected_products">Selected products only</option>
                <option value="site_wide">The whole shop</option>
              </select>
            </Field>

            {(needsPercentage || needsAmount) && (
              <Field
                label={needsPercentage ? "Discount (%)" : "Discount (৳)"}
                htmlFor="discountValue"
                required
                hint={
                  needsPercentage
                    ? "Between 1 and 90."
                    : "Taken off the goods, never off the delivery charge."
                }
              >
                <input
                  id="discountValue"
                  name="discountValue"
                  type="number"
                  min={1}
                  max={needsPercentage ? 90 : undefined}
                  step="0.01"
                  inputMode="decimal"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  className={adminInputClass}
                />
              </Field>
            )}

            {needsGift && (
              <Field
                label="What the gift is"
                htmlFor="giftDescription"
                required
                className="sm:col-span-2"
              >
                <input
                  id="giftDescription"
                  name="giftDescription"
                  maxLength={200}
                  value={gift}
                  onChange={(event) => setGift(event.target.value)}
                  placeholder="A TARA scrunchie with every order"
                  className={adminInputClass}
                />
              </Field>
            )}

            <Field
              label="Minimum order (৳)"
              htmlFor="minimumOrderAmount"
              hint="Leave at 0 for no minimum."
            >
              <input
                id="minimumOrderAmount"
                name="minimumOrderAmount"
                type="number"
                min={0}
                step="1"
                inputMode="decimal"
                value={minimum}
                onChange={(event) => setMinimum(event.target.value)}
                className={adminInputClass}
              />
            </Field>

            <div className="hidden sm:block" aria-hidden="true" />

            <Field label="Starts" htmlFor="startsAt" hint="Store time. Blank means immediately.">
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={isoToStoreLocal(offer.starts_at)}
                className={adminInputClass}
              />
            </Field>
            <Field label="Ends" htmlFor="endsAt" hint="Blank means it runs until switched off.">
              <input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={isoToStoreLocal(offer.ends_at)}
                className={adminInputClass}
              />
            </Field>

            <label className="flex items-center gap-2 font-sans text-sm text-ink sm:col-span-2">
              <input
                type="checkbox"
                name="isEnabled"
                defaultChecked={offer.is_enabled}
                className="h-4 w-4 accent-[#702D42]"
              />
              Switch the offer on
            </label>
          </div>
        </Panel>

        <AdminStickyActions status="The campaign products below are saved separately, with their own button.">
          <SubmitButton>Save offer</SubmitButton>
        </AdminStickyActions>
      </ActionForm>

      <CampaignProducts products={products} participating={participating} />
    </div>
  );
}

/**
 * Which products are in the campaign, and which three it is built around.
 *
 * A hero product is automatically part of the campaign — ticking the star ticks
 * the box, because a hero that was not in its own campaign would be shown on
 * the homepage under an offer it does not get.
 */
function CampaignProducts({
  products,
  participating,
}: {
  products: LaunchOfferAdminData["products"];
  participating: LaunchOfferAdminData["participating"];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(participating.map((row) => row.product_id)),
  );
  const [heroes, setHeroes] = useState<Set<string>>(
    () => new Set(participating.filter((row) => row.is_hero).map((row) => row.product_id)),
  );
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(
      (product) =>
        product.name_en.toLowerCase().includes(term) ||
        product.product_code.toLowerCase().includes(term),
    );
  }, [products, search]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        setHeroes((currentHeroes) => {
          const nextHeroes = new Set(currentHeroes);
          nextHeroes.delete(id);
          return nextHeroes;
        });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleHero = (id: string) => {
    setHeroes((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        setSelected((currentSelected) => new Set(currentSelected).add(id));
      }
      return next;
    });
  };

  return (
    <Panel>
      <PanelHeader
        title="Campaign products"
        description="Which products take part, and the few the campaign is built around."
        actions={
          <span className="font-sans text-xs text-muted">
            {selected.size} in campaign · {heroes.size} hero
          </span>
        }
      />
      <div className="flex flex-col gap-4 px-5 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or product code"
            aria-label="Search products"
            className={`${adminInputClass} max-w-sm`}
          />
          <ActionButton
            action={async () => setLaunchOfferProductsAction([...selected], [...heroes])}
          >
            Save campaign products
          </ActionButton>
        </div>

        {products.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            There are no active products yet. Publish a product first, then build the campaign
            around it.
          </p>
        ) : (
          <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1">
            {visible.map((product) => {
              const inCampaign = selected.has(product.id);
              const isHero = heroes.has(product.id);
              return (
                <li
                  key={product.id}
                  className="flex flex-wrap items-center gap-3 rounded-control border border-border px-3 py-2"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-3 font-sans text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={inCampaign}
                      onChange={() => toggle(product.id)}
                      className="h-4 w-4 shrink-0 accent-[#702D42]"
                    />
                    <span className="min-w-0 truncate">{product.name_en}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {product.product_code}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => toggleHero(product.id)}
                    aria-pressed={isHero}
                    title={isHero ? "Remove from hero products" : "Make a hero product"}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-control border px-3 font-sans text-xs font-semibold uppercase tracking-wide transition-colors ${
                      isHero
                        ? "border-taraWine bg-taraWine text-taraIvory"
                        : "border-border bg-taraWhite text-muted hover:border-taraWine hover:text-taraWine"
                    }`}
                  >
                    {isHero ? <Star size={14} fill="currentColor" /> : <Sparkles size={14} />}
                    Hero
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li className="px-1 py-2 font-sans text-sm text-muted">
                No product matches that search.
              </li>
            )}
          </ul>
        )}
      </div>
    </Panel>
  );
}
