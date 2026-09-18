"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { saveProductAction } from "@/lib/supabase/actions/admin";
import type { ActionResult } from "@/lib/supabase/actions/auth";
import type { TrustReport } from "@/lib/product-trust";
import type { Tables } from "@/types/database";
import { useToastStore } from "@/store/toastStore";
import {
  BasicInfoFields,
  MerchandisingFields,
  ProductDetailFields,
  PublishingFields,
  SeoFields,
} from "./ProductFieldSections";
import { ProductColourLibrary } from "./ProductColourLibrary";
import { ProductImageLibrary } from "./ProductImageManager";
import { ProductVariants } from "./ProductVariants";
import { ProductTrustPanel } from "./ProductTrustPanel";
import { AdminSectionNav, type SectionNavItem } from "./AdminSectionNav";
import { AdminStickyActions, Panel, adminButtonClass } from "./ui";

type Option = { id: string; name_en: string };

const FORM_ID = "product-edit-form";

/**
 * The product editor, as one workspace.
 *
 * TWO KINDS OF CHANGE, ONE PLACE FOR EACH
 * ---------------------------------------
 * The product's own fields — name, price, description, fabric, merchandising,
 * SEO, status — are ONE form with ONE "Save changes" button, in the action bar
 * pinned to the bottom of the screen. They are spread down the page in the
 * order staff think in, with the photographs and the variants between them,
 * and every one of those inputs joins the same form through the `form`
 * attribute. However far down somebody scrolls, "where do I save?" has the
 * same answer, and the bar says "Unsaved changes" the moment there are any.
 *
 * Photographs, colours, variants and stock are individual operations — upload
 * this file, add this colour, adjust this variant — and each is saved by its
 * own button, always in the top-right of its own panel. They never touch the
 * general form, so saving one never saves (or discards) the other.
 *
 * Stock is read-only everywhere on this page except through "Adjust", which is
 * the audited inventory adjustment. Nothing here writes a quantity directly.
 */
export function ProductEditor({
  product,
  categories,
  collections,
  colours,
  images,
  variants,
  imageCounts,
  trust,
}: {
  product: Tables<"products">;
  categories: Option[];
  collections: Option[];
  colours: Tables<"product_colours">[];
  images: Tables<"product_images">[];
  variants: Tables<"product_variants">[];
  imageCounts: Record<string, number>;
  trust: TrustReport;
}) {
  const addToast = useToastStore((state) => state.addToast);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, dispatch, saving] = useActionState<
    ActionResult<string | undefined> | null,
    FormData
  >(async (_previous, formData) => saveProductAction(formData), null);
  const [, startTransition] = useTransition();
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  // Any input associated with the form — wherever it sits on the page —
  // marks the form as changed. `element.form` resolves the `form` attribute,
  // so the fields in the Details section count as much as the ones up top.
  useEffect(() => {
    const onEdit = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.form?.id === FORM_ID) setDirty(true);
    };
    document.addEventListener("input", onEdit);
    document.addEventListener("change", onEdit);
    return () => {
      document.removeEventListener("input", onEdit);
      document.removeEventListener("change", onEdit);
    };
  }, []);

  // The result of a save: toast it, clear the flag, or go to the first error.
  // Keyed on the result object, which is new for every submission.
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      // Setting state from a completed action is the point of this effect: the
      // form is clean because the server has just accepted it.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirty(false);
      addToast(state.message ?? "Product saved.", "success");
      return;
    }
    addToast(state.message, "error");
    const first = Object.keys(state.fieldErrors ?? {})[0];
    const field = first ? document.getElementById(first) : null;
    if (field) {
      field.scrollIntoView({ block: "center" });
      field.focus({ preventScroll: true });
    }
  }, [state, addToast]);

  // Leaving with unsaved general changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const hasFieldErrors = (fields: string[]) => fields.some((field) => errors[field]);
  const navItems: SectionNavItem[] = [
    {
      id: "overview",
      label: "Overview",
      state: hasFieldErrors(["nameEn", "productCode", "categoryId", "basePrice", "compareAtPrice", "descriptionEn"])
        ? "error"
        : undefined,
    },
    { id: "media", label: "Media & colours" },
    { id: "variants", label: "Variants & inventory" },
    {
      id: "details",
      label: "Product details",
      state: hasFieldErrors(["fabricEn", "videoUrl"]) ? "error" : undefined,
    },
    { id: "merchandising", label: "Merchandising" },
    { id: "seo", label: "SEO", state: hasFieldErrors(["seoTitle", "seoDescription"]) ? "error" : undefined },
    { id: "publishing", label: "Publishing", state: hasFieldErrors(["status"]) ? "error" : undefined },
  ];

  const fieldProps = { product, errors, formId: FORM_ID, disabled: saving };

  return (
    <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      <div className="sticky top-16 z-20 mb-5 lg:top-8 lg:mb-0 lg:self-start">
        <AdminSectionNav items={navItems} label="Product sections" />
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        <EditorSection
          id="overview"
          title="Overview"
          description="What the product is, what it costs, and how complete the listing is."
        >
          <ProductTrustPanel report={trust} />
          <Panel>
            <div className="px-5 py-5">
              <BasicInfoFields {...fieldProps} categories={categories} collections={collections} />
            </div>
          </Panel>
        </EditorSection>

        <EditorSection
          id="media"
          title="Media and colours"
          description="Colourways, and the photographs that belong to each. Each change here saves on its own."
        >
          <ProductColourLibrary productId={product.id} colours={colours} imageCounts={imageCounts} />
          <ProductImageLibrary productId={product.id} images={images} colours={colours} />
        </EditorSection>

        <EditorSection
          id="variants"
          title="Variants and inventory"
          description="Every size and colour customers can buy. Stock changes go through Adjust, which records a reason."
        >
          <ProductVariants
            productId={product.id}
            productCode={product.product_code}
            productName={product.name_en}
            variants={variants}
            colours={colours}
          />
        </EditorSection>

        <EditorSection
          id="details"
          title="Product details"
          description="Fabric, care and fit, shown in the product page accordion."
        >
          <Panel>
            <div className="px-5 py-5">
              <ProductDetailFields {...fieldProps} />
            </div>
          </Panel>
        </EditorSection>

        <EditorSection id="merchandising" title="Merchandising" description="Where the product is promoted.">
          <Panel>
            <div className="px-5 py-5">
              <MerchandisingFields {...fieldProps} />
            </div>
          </Panel>
        </EditorSection>

        <EditorSection
          id="seo"
          title="SEO"
          description="How the product appears in search results. Optional."
        >
          <Panel>
            <div className="px-5 py-5">
              <SeoFields {...fieldProps} />
            </div>
          </Panel>
        </EditorSection>

        <EditorSection
          id="publishing"
          title="Publishing"
          description="Whether customers can see and buy this product."
        >
          <Panel>
            <div className="flex flex-col gap-3 px-5 py-5 sm:max-w-md">
              <PublishingFields {...fieldProps} />
              {product.status !== "active" && trust.missingRequired > 0 && (
                <p className="text-xs leading-5 text-[#8A6A1F]">
                  {trust.missingRequired} important item{trust.missingRequired === 1 ? " is" : "s are"}{" "}
                  still missing — see Overview. A description and a fabric are required to go live.
                </p>
              )}
            </div>
          </Panel>
        </EditorSection>

        {/*
          The general form. Its fields live in the sections above and join it
          through `form={FORM_ID}`; the element itself holds only the id and the
          action bar, so the bar's submit button is inside the form it submits.
        */}
        <form
          ref={formRef}
          id={FORM_ID}
          noValidate
          // onSubmit rather than the action prop: React resets an action-prop
          // form after it returns, which would throw away every edit on a
          // failed save. See the same note on ActionForm.
          onSubmit={(event) => {
            event.preventDefault();
            if (saving) return;
            const formData = new FormData(event.currentTarget);
            startTransition(() => dispatch(formData));
          }}
        >
          <input type="hidden" name="id" value={product.id} />
          <AdminStickyActions
            tone={state && !state.ok ? "danger" : dirty ? "attention" : "neutral"}
            status={
              saving ? (
                <span className="inline-flex items-center gap-2 text-ink">
                  <Loader2 size={15} className="animate-spin text-taraWine" aria-hidden="true" />
                  Saving product details…
                </span>
              ) : state && !state.ok ? (
                <span className="text-[#8C2F2F]">{state.message}</span>
              ) : dirty ? (
                <span className="font-semibold text-taraWine">Unsaved changes</span>
              ) : (
                <span>Product details are saved. Photos, colours and variants save as you change them.</span>
              )
            }
          >
            {dirty && !saving && (
              <button
                type="button"
                onClick={() => {
                  // reset() reaches every associated field, including the ones
                  // joined by the `form` attribute elsewhere on the page.
                  formRef.current?.reset();
                  setDirty(false);
                }}
                className={adminButtonClass("ghost", "md")}
              >
                Discard
              </button>
            )}
            <button
              type="submit"
              disabled={saving || !dirty}
              aria-busy={saving}
              className={adminButtonClass("primary", "md")}
            >
              {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Save changes
            </button>
          </AdminStickyActions>
        </form>
      </div>
    </div>
  );
}

function EditorSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-28 flex-col gap-3">
      <div>
        <h2 id={`${id}-title`} className="font-sans text-base font-bold text-ink">
          {title}
        </h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}
