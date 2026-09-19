"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  adjustInventoryAction,
  applyProductImageOrderAction,
  assignImageColourAction,
  deleteProductColourAction,
  deleteProductImageAction,
  saveProductAction,
  saveProductColourAction,
  saveVariantAction,
  setProductImageRoleAction,
  updateProductImageAltAction,
} from "@/lib/supabase/actions/admin";
import type { ActionResult } from "@/lib/supabase/actions/auth";
import {
  describePlan,
  draftFromRows,
  planChanges,
  planIsEmpty,
  validateDraft,
  type DraftProblems,
  type EditorDraft,
} from "@/lib/product-editor-draft";
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
import { ProductTrustPanel } from "./ProductTrustPanel";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { AdminSectionNav, type SectionNavItem } from "./AdminSectionNav";
import { AdminStickyActions, Panel, adminButtonClass } from "./ui";
import { uploadPendingImages } from "./upload-pending-images";
import { EditorColours } from "./product-editor/EditorColours";
import { EditorImages } from "./product-editor/EditorImages";
import { EditorVariants } from "./product-editor/EditorVariants";
import type { DraftUpdater } from "./product-editor/shared";

type Option = { id: string; name_en: string };

const FORM_ID = "product-edit-form";

const NO_PROBLEMS: DraftProblems = { colours: null, variants: new Map() };

/** A step of the save that failed, and where on the page to look. */
class SaveStepError extends Error {
  constructor(
    message: string,
    readonly section: string,
  ) {
    super(message);
  }
}

/**
 * The product editor: every change, one Save changes.
 *
 * NOTHING IS APPLIED UNTIL IT IS SAVED
 * ------------------------------------
 * Name, price and description; colours; photographs and their order; variants;
 * stock corrections — all of it is held on this screen, marked "Unsaved", and
 * written only when the administrator presses Save changes in the bar pinned to
 * the bottom. Discard puts every section back as it was. Leaving the page with
 * changes asks first.
 *
 * The product's own fields are one form, spread down the page and joined to it
 * by the `form` attribute. Everything else is a draft (lib/product-editor-draft)
 * compared against what the database holds.
 *
 * WHAT SAVE DOES, IN ORDER
 * ------------------------
 * Everything is checked first, so a bad SKU stops the save before anything is
 * written. Then: product details, colours, photographs (deleted, uploaded,
 * re-labelled, re-ordered), variants, stock, and deleted colours last. Each
 * write that succeeds is folded into the saved copy at once — so if a later
 * step fails, the bar says which, what was saved stays saved, and pressing
 * Save changes again sends only what is left. Nothing is created twice.
 *
 * Stock is never written directly. A new variant's opening stock goes in with
 * the row; a change to an existing one goes through the audited inventory
 * adjustment with its reason, exactly as the Inventory page does.
 */
export function ProductEditor({
  product,
  categories,
  collections,
  colours,
  images,
  variants,
  trust,
}: {
  product: Tables<"products">;
  categories: Option[];
  collections: Option[];
  colours: Tables<"product_colours">[];
  images: Tables<"product_images">[];
  variants: Tables<"product_variants">[];
  trust: TrustReport;
}) {
  const router = useRouter();
  const addToast = useToastStore((state) => state.addToast);
  const formRef = useRef<HTMLFormElement>(null);

  // --- The draft, and the saved copy it is compared against -----------------
  const [saved, setSavedState] = useState<EditorDraft>(() => draftFromRows({ colours, images, variants }));
  const [draft, setDraftState] = useState<EditorDraft>(saved);
  const savedRef = useRef(saved);
  const draftRef = useRef(draft);

  const setSaved = useCallback((change: (current: EditorDraft) => EditorDraft) => {
    savedRef.current = change(savedRef.current);
    setSavedState(savedRef.current);
  }, []);
  const update: DraftUpdater = useCallback((change) => {
    draftRef.current = change(draftRef.current);
    setDraftState(draftRef.current);
  }, []);
  /** Records one successful write in both copies. */
  const settle = useCallback(
    (change: (current: EditorDraft) => EditorDraft) => {
      setSaved(change);
      update(change);
    },
    [setSaved, update],
  );

  // Previews of files not uploaded yet. Released when they are no longer shown.
  const objectUrls = useRef(new Set<string>());
  const trackObjectUrl = useCallback((url: string, release = false) => {
    if (release) {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
    } else {
      objectUrls.current.add(url);
    }
  }, []);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const [detailsDirty, setDetailsDirty] = useState(false);
  const [detailsResult, setDetailsResult] = useState<ActionResult<string | undefined> | null>(null);
  const [problems, setProblems] = useState<DraftProblems>(NO_PROBLEMS);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [stage, setStage] = useState("");
  const [failure, setFailure] = useState<{ message: string; section: string } | null>(null);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const plan = useMemo(() => planChanges(saved, draft), [saved, draft]);
  const pending = describePlan(plan, detailsDirty);
  const dirty = detailsDirty || !planIsEmpty(plan);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const errors = detailsResult && !detailsResult.ok ? (detailsResult.fieldErrors ?? {}) : {};

  // Fresh rows from the server replace the draft only when there is nothing
  // unsaved to lose — after a save, never in the middle of one.
  useEffect(() => {
    if (savingRef.current) return;
    if (!planIsEmpty(planChanges(savedRef.current, draftRef.current))) return;
    const fresh = draftFromRows({ colours, images, variants });
    savedRef.current = fresh;
    draftRef.current = fresh;
    setSavedState(fresh);
    setDraftState(fresh);
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
  }, [colours, images, variants]);

  // Any input in the product form — wherever it sits on the page — marks the
  // details as changed. `element.form` resolves the `form` attribute.
  useEffect(() => {
    const onEdit = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (target?.form?.id === FORM_ID) setDetailsDirty(true);
    };
    document.addEventListener("input", onEdit);
    document.addEventListener("change", onEdit);
    return () => {
      document.removeEventListener("input", onEdit);
      document.removeEventListener("change", onEdit);
    };
  }, []);

  // Leaving with unsaved changes asks first: closing the tab, and following a
  // link inside the admin panel (the sidebar, the back link).
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTo(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const goTo = (section: string, fieldId?: string) => {
    const field = fieldId ? document.getElementById(fieldId) : null;
    const target = field ?? document.getElementById(section);
    target?.scrollIntoView({ block: field ? "center" : "start" });
    field?.focus({ preventScroll: true });
  };

  const discard = () => {
    formRef.current?.reset();
    setDetailsDirty(false);
    setDetailsResult(null);
    for (const url of objectUrls.current) URL.revokeObjectURL(url);
    objectUrls.current.clear();
    draftRef.current = savedRef.current;
    setDraftState(savedRef.current);
    setProblems(NO_PROBLEMS);
    setFailure(null);
  };

  // --- Save ----------------------------------------------------------------

  const colourIdFor = (key: string | null) =>
    key ? (draftRef.current.colours.find((colour) => colour.key === key)?.id ?? null) : null;

  const saveDetails = async () => {
    setStage("Saving product details…");
    const result = await saveProductAction(new FormData(formRef.current!));
    setDetailsResult(result);
    if (!result.ok) {
      const first = Object.keys(result.fieldErrors ?? {})[0];
      throw new SaveStepError(result.message, first ? `field:${first}` : "overview");
    }
    setDetailsDirty(false);
  };

  const saveColours = async () => {
    const live = draftRef.current.colours.filter((colour) => !colour.deleted);
    const writes = planChanges(savedRef.current, draftRef.current).colourWrites;
    for (const [index, colour] of writes.entries()) {
      setStage(`Saving colours (${index + 1} of ${writes.length})…`);
      const send = async (id: string | null, isActive: boolean) => {
        const formData = new FormData();
        formData.set("productId", product.id);
        if (id) formData.set("id", id);
        formData.set("nameEn", colour.name.trim());
        formData.set("colourHex", colour.hex.toUpperCase());
        formData.set("sortOrder", String(Math.max(0, live.findIndex((entry) => entry.key === colour.key))));
        if (isActive) formData.set("isActive", "on");
        return saveProductColourAction(formData);
      };
      const result = await send(colour.id, colour.isActive);
      if (!result.ok || !result.data) {
        throw new SaveStepError(result.message ?? "Could not save a colour.", "colours");
      }
      const id = result.data.id;
      // A new colour is always created offered; switching it off is a second write.
      if (!colour.id && !colour.isActive) {
        const off = await send(id, false);
        if (!off.ok) throw new SaveStepError(off.message, "colours");
      }
      settle((current) => ({
        ...current,
        colours: current.colours.map((entry) => (entry.key === colour.key ? { ...entry, id } : entry)),
      }));
      setSaved((current) => {
        const exists = current.colours.some((entry) => entry.key === colour.key);
        const stored = { ...colour, id };
        return {
          ...current,
          colours: exists
            ? current.colours.map((entry) => (entry.key === colour.key ? stored : entry))
            : [...current.colours, stored],
        };
      });
    }
  };

  const saveImages = async () => {
    const plan = () => planChanges(savedRef.current, draftRef.current);

    // Deleted first, which also frees room under the twelve-image limit.
    for (const image of plan().imageDeletes) {
      setStage("Deleting photographs…");
      const result = await deleteProductImageAction(image.id!, product.id);
      if (!result.ok) throw new SaveStepError(result.message, "images");
      settle((current) => ({ ...current, images: current.images.filter((entry) => entry.key !== image.key) }));
    }

    const uploads = plan().imageUploads;
    if (uploads.length > 0) {
      const outcome = await uploadPendingImages({
        productId: product.id,
        items: uploads.map((image) => ({ key: image.key, file: image.file!, imageId: null })),
        colourIdFor: (item) => colourIdFor(draftRef.current.images.find((image) => image.key === item.key)?.colourKey ?? null),
        onProgress: setStage,
      });
      for (const image of uploads) {
        const result = outcome.results.get(image.key);
        if (!result?.ok || !result.imageId) continue;
        const imageId = result.imageId;
        update((current) => ({
          ...current,
          images: current.images.map((entry) => (entry.key === image.key ? { ...entry, id: imageId } : entry)),
        }));
        // Stored as uploaded: in its colour, not yet labelled or described, at
        // the end. The steps below bring those in line with the draft.
        setSaved((current) => ({
          ...current,
          images: [...current.images, { ...image, id: imageId, role: "", alt: "" }],
        }));
      }
      if (outcome.failed > 0) {
        const reasons = [...outcome.results.values()].filter((result) => !result.ok).map((result) => result.error);
        throw new SaveStepError(
          `${outcome.failed} photograph${outcome.failed === 1 ? "" : "s"} could not be uploaded: ${reasons[0] ?? "upload failed"}.`,
          "images",
        );
      }
    }

    for (const change of plan().imageUpdates) {
      setStage("Saving photograph details…");
      const { image } = change;
      if (change.colour) {
        const result = await assignImageColourAction(image.id!, product.id, colourIdFor(image.colourKey));
        if (!result.ok) throw new SaveStepError(result.message, "images");
      }
      if (change.role) {
        const result = await setProductImageRoleAction(image.id!, product.id, image.role || null);
        if (!result.ok) throw new SaveStepError(result.message, "images");
      }
      if (change.alt) {
        const result = await updateProductImageAltAction(image.id!, product.id, image.alt);
        if (!result.ok) throw new SaveStepError(result.message, "images");
      }
      setSaved((current) => ({
        ...current,
        images: current.images.map((entry) =>
          entry.key === image.key ? { ...entry, colourKey: image.colourKey, role: image.role, alt: image.alt } : entry,
        ),
      }));
    }

    if (plan().reorder) {
      setStage("Saving photograph order…");
      const live = draftRef.current.images.filter((image) => !image.deleted && image.id);
      const primary =
        live.find((image) => image.key === draftRef.current.primaryKey) ?? live[0] ?? null;
      const result = await applyProductImageOrderAction(
        product.id,
        live.map((image) => image.id!),
        primary?.id ?? null,
      );
      if (!result.ok) throw new SaveStepError(result.message, "images");
      setSaved((current) => {
        const byKey = new Map(current.images.map((image) => [image.key, image]));
        return {
          ...current,
          images: live.map((image) => byKey.get(image.key) ?? image),
          primaryKey: primary?.key ?? null,
        };
      });
      update((current) => ({ ...current, primaryKey: primary?.key ?? null }));
    }
  };

  const saveVariants = async () => {
    const writes = planChanges(savedRef.current, draftRef.current).variantWrites;
    const rowErrors = new Map<string, string>();
    for (const [index, variant] of writes.entries()) {
      setStage(`Saving variants (${index + 1} of ${writes.length})…`);
      const colour = variant.colourKey
        ? draftRef.current.colours.find((entry) => entry.key === variant.colourKey)
        : null;
      const send = async (id: string | null, isActive: boolean) => {
        const formData = new FormData();
        formData.set("productId", product.id);
        if (id) formData.set("id", id);
        formData.set("size", variant.size.trim());
        formData.set("sku", variant.sku.trim().toUpperCase());
        if (colour?.id) {
          // The server reads the name and swatch from the colour row itself.
          formData.set("productColourId", colour.id);
          formData.set("colourEn", colour.name.trim());
          formData.set("colourHex", colour.hex);
        } else {
          formData.set("colourEn", variant.colourName.trim());
          formData.set("colourHex", variant.colourHex);
        }
        formData.set("priceOverride", variant.priceOverride.trim());
        formData.set("lowStockThreshold", variant.lowStockThreshold.trim() || "3");
        if (isActive) formData.set("isActive", "on");
        if (!id) formData.set("initialStock", variant.openingStock.trim() || "0");
        return saveVariantAction(formData);
      };

      const result = await send(variant.id, variant.isActive);
      if (!result.ok || !result.data) {
        rowErrors.set(variant.key, result.message ?? "Could not save this variant.");
        continue;
      }
      const id = result.data.id;
      const opening = variant.id ? variant.stock : Number(variant.openingStock.trim() || "0");
      // A new variant is always created available; hiding it is a second write.
      if (!variant.id && !variant.isActive) {
        const off = await send(id, false);
        if (!off.ok) rowErrors.set(variant.key, off.message);
      }
      settle((current) => ({
        ...current,
        variants: current.variants.map((entry) =>
          entry.key === variant.key ? { ...entry, id, stock: opening } : entry,
        ),
      }));
      setSaved((current) => {
        const stored = { ...variant, id, stock: opening, stockChange: null };
        const exists = current.variants.some((entry) => entry.key === variant.key);
        return {
          ...current,
          variants: exists
            ? current.variants.map((entry) => (entry.key === variant.key ? stored : entry))
            : [...current.variants, stored],
        };
      });
    }
    if (rowErrors.size > 0) {
      setProblems((current) => ({ ...current, variants: rowErrors }));
      const [first] = rowErrors.values();
      throw new SaveStepError(
        rowErrors.size === 1 ? first : `${rowErrors.size} variants could not be saved. ${first}`,
        "variants",
      );
    }
  };

  const saveStock = async () => {
    const changes = planChanges(savedRef.current, draftRef.current).stockChanges;
    for (const [index, variant] of changes.entries()) {
      setStage(`Recording stock changes (${index + 1} of ${changes.length})…`);
      const formData = new FormData();
      formData.set("variantId", variant.id!);
      formData.set("newQuantity", variant.stockChange!.newQuantity.trim());
      formData.set("reason", variant.stockChange!.reason);
      formData.set("note", variant.stockChange!.note.trim());
      const result = await adjustInventoryAction(formData);
      if (!result.ok) throw new SaveStepError(`${variant.sku}: ${result.message}`, "variants");
      const quantity = Number(variant.stockChange!.newQuantity);
      settle((current) => ({
        ...current,
        variants: current.variants.map((entry) =>
          entry.key === variant.key ? { ...entry, stock: quantity, stockChange: null } : entry,
        ),
      }));
    }
  };

  const deleteColours = async () => {
    for (const colour of planChanges(savedRef.current, draftRef.current).colourDeletes) {
      setStage("Deleting colours…");
      const result = await deleteProductColourAction(colour.id!, product.id);
      if (!result.ok) throw new SaveStepError(result.message, "colours");
      settle((current) => ({
        ...current,
        colours: current.colours.filter((entry) => entry.key !== colour.key),
        images: current.images.map((image) =>
          image.colourKey === colour.key ? { ...image, colourKey: null } : image,
        ),
      }));
    }
  };

  const save = async () => {
    if (savingRef.current || !dirtyRef.current) return;

    // Checked before anything is written, so a mistake stops the whole save.
    const found = validateDraft(draftRef.current);
    setProblems(found);
    if (found.colours || found.variants.size > 0) {
      const message = found.colours ?? [...found.variants.values()][0];
      setFailure({ message: `Nothing was saved. ${message}`, section: found.colours ? "colours" : "variants" });
      addToast("Nothing was saved yet — fix the highlighted problem first.", "error");
      goTo(found.colours ? "colours" : "variants");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFailure(null);
    try {
      if (detailsDirty) await saveDetails();
      await saveColours();
      await saveImages();
      await saveVariants();
      await saveStock();
      await deleteColours();
      setProblems(NO_PROBLEMS);
      addToast("All changes saved.", "success");
    } catch (error) {
      const step = error instanceof SaveStepError ? error : new SaveStepError("Something went wrong while saving.", "overview");
      const message = `${step.message} What is still marked Unsaved was not applied; press Save changes to try again.`;
      setFailure({ message, section: step.section });
      addToast(step.message, "error");
      if (step.section.startsWith("field:")) goTo("overview", step.section.slice(6));
      else goTo(step.section);
    } finally {
      savingRef.current = false;
      setSaving(false);
      setStage("");
      // Brings the summary, the completeness panel and the page header up to
      // date. The draft is only replaced when nothing unsaved is left.
      router.refresh();
    }
  };

  // --- Layout --------------------------------------------------------------

  const hasFieldErrors = (fields: string[]) => fields.some((field) => errors[field]);
  const navItems: SectionNavItem[] = [
    {
      id: "overview",
      label: "Overview",
      state: hasFieldErrors(["nameEn", "productCode", "categoryId", "basePrice", "compareAtPrice", "descriptionEn"])
        ? "error"
        : undefined,
    },
    { id: "media", label: "Media & colours", state: problems.colours ? "error" : undefined },
    { id: "variants", label: "Variants & inventory", state: problems.variants.size > 0 ? "error" : undefined },
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
          description="Colourways, and the photographs that belong to each."
        >
          <EditorColours
            draft={draft}
            saved={saved}
            update={update}
            problem={problems.colours}
            disabled={saving}
          />
          <EditorImages
            draft={draft}
            saved={saved}
            update={update}
            disabled={saving}
            onObjectUrl={trackObjectUrl}
          />
        </EditorSection>

        <EditorSection
          id="variants"
          title="Variants and inventory"
          description="Every size and colour customers can buy. Stock changes are recorded with a reason."
        >
          <EditorVariants
            draft={draft}
            saved={saved}
            update={update}
            problems={problems.variants}
            productCode={product.product_code}
            disabled={saving}
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
          The product form. Its fields live in the sections above and join it
          through `form={FORM_ID}`. It never submits on its own — Enter in a
          field and the Save changes button both run the one save below.
        */}
        <form
          ref={formRef}
          id={FORM_ID}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <input type="hidden" name="id" value={product.id} />
          <AdminStickyActions
            tone={failure ? "danger" : dirty ? "attention" : "neutral"}
            status={
              saving ? (
                <span className="inline-flex items-center gap-2 text-ink">
                  <Loader2 size={15} className="animate-spin text-taraWine" aria-hidden="true" />
                  {stage || "Saving…"}
                </span>
              ) : failure ? (
                <span className="text-[#8C2F2F]">{failure.message}</span>
              ) : dirty ? (
                <span className="text-taraWine">
                  <span className="font-semibold">Unsaved changes</span>
                  {pending.length > 0 && <span className="text-ink"> — {pending.join(", ")}</span>}
                </span>
              ) : (
                <span>All changes are saved.</span>
              )
            }
          >
            {dirty && !saving && (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
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

      {confirmDiscard && (
        <AdminConfirmDialog
          title="Discard your changes?"
          body={[
            `Everything you changed since the last save${pending.length ? ` (${pending.join(", ")})` : ""} goes back to how it was.`,
            "Nothing on the storefront changes.",
          ]}
          confirmLabel="Discard changes"
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            discard();
          }}
        />
      )}

      {leaveTo && (
        <AdminConfirmDialog
          title="Leave without saving?"
          body={[
            `You have unsaved changes${pending.length ? ` (${pending.join(", ")})` : ""}.`,
            "If you leave now they are not applied to the product.",
          ]}
          confirmLabel="Leave without saving"
          onCancel={() => setLeaveTo(null)}
          onConfirm={() => {
            const href = leaveTo;
            setLeaveTo(null);
            dirtyRef.current = false;
            discard();
            router.push(href);
          }}
        />
      )}
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
