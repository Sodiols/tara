"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  applyProductImageOrderAction,
  createProductAction,
  createProductColoursAction,
  createProductVariantsAction,
  saveProductAction,
  setProductStatusAction,
} from "@/lib/supabase/actions/admin";
import { adminProductSchema, productFormValues } from "@/lib/validation";
import {
  orderedImageIds,
  outstandingUploads,
  primaryImageId,
} from "@/lib/product-image-workflow";
import { describeColourNameProblems } from "@/lib/product-colour-images";
import { MAX_IMAGES_PER_PRODUCT } from "@/lib/product-images";
import {
  SAVE_STAGE_LABELS,
  blockingItems,
  buildVariantRows,
  builderReadiness,
  includedVariants,
  outstandingVariants,
  validateVariantRows,
  type BuilderSection,
  type SaveStage,
  type VariantRow,
} from "@/lib/product-builder";
import { useToastStore } from "@/store/toastStore";
import { usePendingImages } from "../ProductImageManager";
import { useColourDrafts } from "../ProductColourImages";
import { uploadPendingImages } from "../upload-pending-images";
import {
  BasicInfoFields,
  MerchandisingFields,
  ProductDetailFields,
  SeoFields,
} from "../ProductFieldSections";
import { AdminSectionNav, type SectionNavItem } from "../AdminSectionNav";
import { AdminConfirmDialog } from "../AdminConfirmDialog";
import { AdminFormSection, AdminStickyActions, adminButtonClass } from "../ui";
import { ColoursAndMedia } from "./ColoursAndMedia";
import { VariantBuilder } from "./VariantBuilder";
import { ReadinessChecklist } from "./ReadinessChecklist";
import { BuilderSuccess } from "./BuilderSuccess";

type Option = { id: string; name_en: string };

/**
 * Admin → Products → Add product, from start to finish, on one screen.
 *
 * The administrator never has to create the product and then go looking for
 * where to finish it. Six numbered sections — basics, colours and photographs,
 * sizes and stock, details, merchandising, review — all live in one form with
 * one action bar that is always on screen: Cancel, Save as draft, Publish.
 *
 * UNDERNEATH, IT IS STILL A SEQUENCE. The database needs a product id before a
 * colour, a photograph or a variant can point at one, and twelve large images
 * cannot go through one request. So a save runs these stages, and the action
 * bar names each one as it runs:
 *
 *   product    the row — created ONCE and then only ever updated, always as a
 *              draft, so nothing half-built can reach the storefront
 *   colours    created, or renamed in place on a retry (never duplicated)
 *   images     one request per file; anything already stored is skipped
 *   order      the arranged order and the cover photograph
 *   variants   the grid rows that do not exist yet, each with its opening stock
 *   publish    only if Publish was pressed, and only once all of the above is in
 *
 * EVERY STAGE IS RESUMABLE. The product id, the colour ids, each photograph's
 * id and each variant's id are held here as they come back. Pressing the
 * button again after a failure skips everything that already succeeded — no
 * second product, no second Black, no second copy of image four, no second
 * variant — and nothing the administrator typed or picked is ever cleared by a
 * failure. The failure names the stage, so the message is something a person
 * can act on.
 */
export function ProductBuilder({
  categories,
  collections,
}: {
  categories: Option[];
  collections: Option[];
}) {
  // "Add another product" remounts the builder rather than trying to reset
  // forty pieces of state by hand and forgetting one.
  const [instance, setInstance] = useState(0);
  return (
    <ProductBuilderForm
      key={instance}
      categories={categories}
      collections={collections}
      onAddAnother={() => {
        setInstance((value) => value + 1);
        window.scrollTo({ top: 0 });
      }}
    />
  );
}

interface CreatedProduct {
  id: string;
  slug: string;
}

interface Failure {
  stage: SaveStage | "validation";
  message: string;
}

interface Result {
  productId: string;
  slug: string;
  name: string;
  published: boolean;
  variantCount: number;
  imageCount: number;
  notes: string[];
}

type Intent = "draft" | "publish";

const EMPTY_VALUES = productFormValues(new FormData());

const SECTIONS: { id: BuilderSection; label: string; title: string; description: string }[] = [
  {
    id: "basics",
    label: "Basics",
    title: "Basic information",
    description: "What the product is called, where it lives and what it costs.",
  },
  {
    id: "media",
    label: "Colours & photos",
    title: "Colours and photographs",
    description: "Name every colour it comes in, then add the photographs.",
  },
  {
    id: "variants",
    label: "Sizes & stock",
    title: "Sizes, variants and opening stock",
    description: "Every size in every colour, each with its own SKU and starting stock.",
  },
  {
    id: "details",
    label: "Details",
    title: "Product details",
    description: "Fabric, care and fit — shown in the product page accordion.",
  },
  {
    id: "merchandising",
    label: "Merchandising",
    title: "Merchandising and search",
    description: "Where it is promoted, and how it appears in search engines.",
  },
  {
    id: "review",
    label: "Review",
    title: "Review and publish",
    description: "Everything the product still needs before customers can buy it.",
  },
];

function sectionId(section: BuilderSection) {
  return `builder-${section}`;
}

function ProductBuilderForm({
  categories,
  collections,
  onAddAnother,
}: {
  categories: Option[];
  collections: Option[];
  onAddAnother: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const addToast = useToastStore((state) => state.addToast);

  const pending = usePendingImages();
  // One colour to start with, ready to be named: every product has at least
  // one, and an empty list is a question the administrator should not have to
  // work out the answer to.
  const drafts = useColourDrafts(MAX_IMAGES_PER_PRODUCT, 1);
  const [photographsPerColour, setPhotographsPerColour] = useState(false);

  const [sizes, setSizes] = useState<string[]>([]);
  const [rowState, setRowState] = useState<VariantRow[]>([]);

  // A snapshot of the form's own fields, taken on every input. The readiness
  // checklist and the SKU suggestions read it. The fields themselves stay
  // uncontrolled — FormData is still what gets submitted — so the snapshot is
  // a read-only view and can never disagree with what is sent.
  const [values, setValues] = useState(EMPTY_VALUES);
  const [touched, setTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<SaveStage | null>(null);
  const [progress, setProgress] = useState("");
  const [failure, setFailure] = useState<Failure | null>(null);
  const [lastIntent, setLastIntent] = useState<Intent>("publish");
  const [attemptedPublish, setAttemptedPublish] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // What already exists in the database. Held for the life of the screen:
  // this is what makes a retry resume instead of starting again.
  const [created, setCreated] = useState<CreatedProduct | null>(null);
  const [colourIds, setColourIds] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);

  // A double click has to be refused in the same tick; state is a render away.
  const busyRef = useRef(false);
  // The stage in progress, readable from the catch block — the `stage` state
  // captured by this closure would still hold the value from when it started.
  const stageRef = useRef<SaveStage | null>(null);
  const enter = (next: SaveStage) => {
    stageRef.current = next;
    setStage(next);
  };

  // --- Derived ----------------------------------------------------------------

  const namedColours = useMemo(
    () =>
      drafts.colours
        .filter((colour) => colour.name.trim())
        .map((colour) => ({ key: colour.key, name: colour.name, hex: colour.hex })),
    [drafts.colours],
  );

  const rows = useMemo(
    () =>
      buildVariantRows({
        colours: namedColours,
        sizes,
        previous: rowState,
        productCode: values.productCode,
      }),
    [namedColours, sizes, rowState, values.productCode],
  );

  const imageCount = photographsPerColour ? drafts.totalImages : pending.items.length;
  const included = includedVariants(rows);

  const readiness = builderReadiness({
    name: values.nameEn,
    productCode: values.productCode,
    categoryId: values.categoryId,
    basePrice: values.basePrice,
    description: values.descriptionEn,
    fabric: values.fabricEn,
    careInstructions: values.careInstructionsEn,
    seoTitle: values.seoTitle,
    seoDescription: values.seoDescription,
    colourNames: drafts.colours.map((colour) => colour.name),
    imageCount,
    coloursWithoutImages: photographsPerColour
      ? drafts.colours
          .filter((colour) => colour.images.length === 0 && colour.name.trim())
          .map((colour) => colour.name.trim())
      : [],
    photographsPerColour,
    variantCount: included.length,
    totalOpeningStock: included.reduce(
      (total, row) => total + (Number(row.openingStock) || 0),
      0,
    ),
  });
  const blocking = blockingItems(readiness);
  const createdColourKeys = useMemo(() => new Set(Object.keys(colourIds)), [colourIds]);

  const navItems: SectionNavItem[] = SECTIONS.map((section, index) => {
    const required = readiness.filter((item) => item.section === section.id && item.required);
    const missing = required.some((item) => !item.ok);
    const state: SectionNavItem["state"] =
      section.id === "review"
        ? blocking.length === 0
          ? "done"
          : attemptedPublish
            ? "error"
            : undefined
        : required.length === 0
          ? undefined
          : missing
            ? attemptedPublish
              ? "error"
              : undefined
            : "done";
    return { id: sectionId(section.id), label: section.label, number: String(index + 1), state };
  });

  // --- Leaving -------------------------------------------------------------

  const dirty = touched || imageCount > 0 || rows.length > 0;

  useEffect(() => {
    if (!dirty || result) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, result]);

  // --- Helpers -------------------------------------------------------------

  const snapshot = () => {
    const form = formRef.current;
    if (!form) return;
    setValues(productFormValues(new FormData(form)));
    setTouched(true);
  };

  /** Scrolls to a section — or straight to a field in it — and focuses it. */
  const jump = (section: BuilderSection, fieldId?: string) => {
    const field = fieldId ? document.getElementById(fieldId) : null;
    // A field inside a closed <details> has to be revealed before it can be
    // focused.
    const details = field?.closest("details");
    if (details && !details.open) details.open = true;
    const target = field ?? document.getElementById(sectionId(section));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    (target as HTMLElement | null)?.focus?.({ preventScroll: true });
  };

  const focusFirstError = (fieldErrors: Record<string, string[] | undefined>) => {
    const first = Object.keys(fieldErrors)[0];
    if (!first) return;
    const section = ["fabricEn", "videoUrl"].includes(first)
      ? "details"
      : ["seoTitle", "seoDescription"].includes(first)
        ? "merchandising"
        : "basics";
    jump(section, first);
  };

  const updateRow = (key: string, change: Partial<VariantRow>) =>
    setRowState(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));

  const setAllOpeningStock = (stock: string) =>
    setRowState(
      rows.map((row) => (row.variantId || row.excluded ? row : { ...row, openingStock: stock })),
    );

  const fail = (next: Failure) => {
    setFailure(next);
    setRunning(false);
    stageRef.current = null;
    setStage(null);
    setProgress("");
  };

  // --- The save --------------------------------------------------------------

  const run = async (intent: Intent, options: { skipFailedImages?: boolean } = {}) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLastIntent(intent);
    setFailure(null);

    try {
      const form = formRef.current;
      if (!form) return;
      const formData = new FormData(form);

      // Validated against the status the administrator is aiming for, so
      // Publish surfaces the two rules the server enforces on a live product
      // (a description and a fabric) before anything is written.
      formData.set("status", intent === "publish" ? "active" : "draft");
      const parsed = adminProductSchema.safeParse(productFormValues(formData));
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
        setErrors(fieldErrors);
        fail({
          stage: "validation",
          message: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
        });
        focusFirstError(fieldErrors);
        return;
      }
      setErrors({});

      if (intent === "publish") {
        setAttemptedPublish(true);
        if (blocking.length > 0) {
          fail({
            stage: "validation",
            message: `Not ready to publish yet: ${blocking.map((item) => item.label.toLowerCase()).join(", ")}.`,
          });
          jump("review");
          return;
        }
      }

      // Colours are needed as soon as anything depends on them. A draft with
      // one blank colour and nothing else simply skips the stage.
      const coloursNeeded =
        drafts.colours.some((colour) => colour.name.trim()) ||
        (photographsPerColour && drafts.totalImages > 0);
      if (coloursNeeded) {
        const problem = describeColourNameProblems(drafts.colours);
        if (problem) {
          fail({ stage: "validation", message: problem });
          jump("media");
          return;
        }
      }

      const rowProblems = validateVariantRows(rows);
      if (rowProblems.size > 0) {
        setRowState(
          rows.map((row) =>
            rowProblems.has(row.key) ? { ...row, error: rowProblems.get(row.key) ?? null } : row,
          ),
        );
        fail({
          stage: "validation",
          message: `${rowProblems.size} variant${rowProblems.size === 1 ? " needs" : "s need"} attention.`,
        });
        jump("variants");
        return;
      }

      setRunning(true);

      // Stage 1 — the product, always as a draft until the very end.
      enter("product");
      formData.set("status", "draft");
      let product = created;
      if (!product) {
        formData.set("pendingImageCount", "0");
        const result = await createProductAction(formData);
        if (!result.ok || !result.data) {
          const fieldErrors = result.ok ? {} : (result.fieldErrors ?? {});
          setErrors(fieldErrors);
          fail({ stage: "product", message: result.message ?? "Could not create this product." });
          focusFirstError(fieldErrors);
          return;
        }
        product = { id: result.data.id, slug: result.data.slug };
        setCreated(product);
      } else {
        formData.set("id", product.id);
        const saved = await saveProductAction(formData);
        if (!saved.ok) {
          setErrors(saved.fieldErrors ?? {});
          fail({ stage: "product", message: saved.message });
          focusFirstError(saved.fieldErrors ?? {});
          return;
        }
      }

      // Stage 2 — colours, renamed in place if they already exist.
      let ids = colourIds;
      if (coloursNeeded) {
        enter("colours");
        const result = await createProductColoursAction(
          product.id,
          drafts.definitions().map((colour) => ({ ...colour, id: colourIds[colour.key] })),
        );
        if (!result.ok) {
          fail({ stage: "colours", message: result.message });
          jump("media");
          return;
        }
        ids = { ...colourIds, ...(result.data?.ids ?? {}) };
        setColourIds(ids);
      }

      // Stage 3 — photographs, one request each, skipping what is stored.
      let storedIds: string[];
      let coverId: string | null;
      let skippedImages = 0;
      if (photographsPerColour) {
        let groups = drafts.colours;
        const queued = drafts.allImages();
        if (outstandingUploads(queued).length > 0 && !options.skipFailedImages) {
          enter("images");
          const outcome = await uploadPendingImages({
            productId: product.id,
            items: queued,
            colourIdFor: (item) => ids[item.colourKey] ?? null,
            onProgress: setProgress,
          });
          groups = drafts.applyResults(outcome.results);
          if (outcome.failed > 0) {
            fail({
              stage: "images",
              message: `${outcome.failed} photograph${outcome.failed === 1 ? "" : "s"} could not be uploaded. Everything else is saved.`,
            });
            jump("media");
            return;
          }
        }
        const all = groups.flatMap((colour) => colour.images);
        storedIds = orderedImageIds(all);
        skippedImages = all.length - storedIds.length;
        // The first photograph of the first colour is the product's cover.
        coverId = storedIds[0] ?? null;
      } else {
        let images = pending.items;
        if (outstandingUploads(images).length > 0 && !options.skipFailedImages) {
          enter("images");
          const outcome = await uploadPendingImages({
            productId: product.id,
            items: images,
            onProgress: setProgress,
          });
          images = pending.applyResults(outcome.results);
          if (outcome.failed > 0) {
            fail({
              stage: "images",
              message: `${outcome.failed} photograph${outcome.failed === 1 ? "" : "s"} could not be uploaded. Everything else is saved.`,
            });
            jump("media");
            return;
          }
        }
        storedIds = orderedImageIds(images);
        skippedImages = images.length - storedIds.length;
        coverId = primaryImageId(images, pending.mainKey);
      }

      // Stage 4 — the arranged order, and the cover.
      if (storedIds.length > 0) {
        enter("order");
        setProgress("");
        const ordered = await applyProductImageOrderAction(product.id, storedIds, coverId);
        if (!ordered.ok) {
          fail({ stage: "order", message: ordered.message });
          return;
        }
      }

      // Stage 5 — variants that do not exist yet.
      let finalRows = rows;
      const toCreate = outstandingVariants(rows);
      if (toCreate.length > 0) {
        enter("variants");
        const result = await createProductVariantsAction(
          product.id,
          toCreate.map((row) => ({
            key: row.key,
            colourId: ids[row.colourKey] ?? "",
            size: row.size,
            sku: row.sku.trim().toUpperCase(),
            openingStock: Number(row.openingStock || "0"),
            priceOverride: row.priceOverride.trim() ? Number(row.priceOverride) : null,
            lowStockThreshold: Number(row.lowStockThreshold || "3"),
            isActive: row.isActive,
          })),
        );
        if (!result.ok || !result.data) {
          fail({ stage: "variants", message: result.message ?? "Could not create the variants." });
          jump("variants");
          return;
        }
        const { ids: variantIds, errors: variantErrors } = result.data;
        finalRows = rows.map((row) =>
          variantIds[row.key]
            ? { ...row, variantId: variantIds[row.key], error: null }
            : variantErrors[row.key]
              ? { ...row, error: variantErrors[row.key] }
              : row,
        );
        setRowState(finalRows);
        const failedRows = Object.keys(variantErrors).length;
        if (failedRows > 0) {
          fail({
            stage: "variants",
            message: `${failedRows} variant${failedRows === 1 ? "" : "s"} could not be created — see the rows marked in step 3. The rest are saved.`,
          });
          jump("variants");
          return;
        }
      }

      // Stage 6 — go live, if that is what was asked for. Not with no
      // photograph at all: "continue without them" can leave a product whose
      // every upload failed, and that is a draft, not a storefront page.
      if (intent === "publish" && storedIds.length === 0) {
        fail({
          stage: "publish",
          message: "No photograph uploaded, so it was saved as a draft. Add a photograph and publish again.",
        });
        jump("media");
        return;
      }
      if (intent === "publish") {
        enter("publish");
        const published = await setProductStatusAction(product.id, "active");
        if (!published.ok) {
          fail({ stage: "publish", message: published.message });
          return;
        }
      }

      const notes: string[] = [];
      if (skippedImages > 0) {
        notes.push(
          `${skippedImages} photograph${skippedImages === 1 ? " was" : "s were"} left out after failing to upload. Add ${skippedImages === 1 ? "it" : "them"} from the editor.`,
        );
      }
      const createdVariants = finalRows.filter((row) => row.variantId).length;
      if (intent === "publish" && createdVariants > 0 && finalRows.every((row) => !row.variantId || Number(row.openingStock) === 0)) {
        notes.push("Every variant has zero stock, so it shows as out of stock. Add stock from Inventory.");
      }

      setRunning(false);
      setStage(null);
      setProgress("");
      setResult({
        productId: product.id,
        slug: product.slug,
        name: values.nameEn.trim() || "The product",
        published: intent === "publish",
        variantCount: createdVariants,
        imageCount: storedIds.length,
        notes,
      });
      addToast(intent === "publish" ? "Product published." : "Saved as a draft.", "success");
      router.refresh();
    } catch {
      // A dropped connection mid-stage. Everything that completed is held
      // above, so pressing the button again resumes from here.
      fail({
        stage: stageRef.current ?? "product",
        message: "The connection was interrupted. Nothing is lost — try again to continue.",
      });
    } finally {
      busyRef.current = false;
    }
  };

  // --- Render ----------------------------------------------------------------

  if (result) {
    return <BuilderSuccess {...result} onAddAnother={onAddAnother} />;
  }

  const statusLine = running ? (
    <span className="inline-flex items-center gap-2 text-ink">
      <Loader2 size={15} className="animate-spin text-taraWine" aria-hidden="true" />
      {stage === "images" && progress ? progress : stage ? SAVE_STAGE_LABELS[stage].running : "Working…"}
    </span>
  ) : failure ? (
    <span className="text-[#8C2F2F]">
      <strong className="font-semibold">
        {failure.stage === "validation" ? "Not saved." : SAVE_STAGE_LABELS[failure.stage].failed}
      </strong>{" "}
      {failure.message}
    </span>
  ) : created ? (
    <span>Saved as a draft so far — not visible to customers until you publish.</span>
  ) : blocking.length === 0 ? (
    <span className="text-[#2F5D50]">Ready to publish.</span>
  ) : (
    <span>
      {blocking.length} required item{blocking.length === 1 ? "" : "s"} left before publishing ·
      drafts can be saved any time
    </span>
  );

  return (
    <>
      <form
        ref={formRef}
        noValidate
        onInput={snapshot}
        onChange={snapshot}
        // Enter in a text field must not publish a product, so the form never
        // submits on its own; the buttons in the action bar are the only way.
        onSubmit={(event) => event.preventDefault()}
        className="lg:grid lg:grid-cols-[208px_minmax(0,1fr)] lg:gap-8"
      >
        <div className="sticky top-16 z-20 mb-5 lg:top-8 lg:mb-0 lg:self-start">
          <AdminSectionNav items={navItems} label="Product builder steps" />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {SECTIONS.map((section, index) => (
            <AdminFormSection
              key={section.id}
              id={sectionId(section.id)}
              step={`Step ${index + 1} of ${SECTIONS.length}`}
              title={section.title}
              description={section.description}
            >
              {section.id === "basics" && (
                <BasicInfoFields
                  categories={categories}
                  collections={collections}
                  errors={errors}
                  disabled={running}
                />
              )}
              {section.id === "media" && (
                <ColoursAndMedia
                  photographsPerColour={photographsPerColour}
                  onModeChange={(next) => {
                    setPhotographsPerColour(next);
                    setTouched(true);
                  }}
                  drafts={drafts}
                  pending={pending}
                  createdColourKeys={createdColourKeys}
                  disabled={running}
                />
              )}
              {section.id === "variants" && (
                <VariantBuilder
                  colours={namedColours}
                  sizes={sizes}
                  onSizesChange={(next) => {
                    setSizes(next);
                    setTouched(true);
                  }}
                  rows={rows}
                  onRowChange={updateRow}
                  onBulkStock={setAllOpeningStock}
                  disabled={running}
                />
              )}
              {section.id === "details" && <ProductDetailFields errors={errors} disabled={running} />}
              {section.id === "merchandising" && (
                <div className="flex flex-col gap-5">
                  <MerchandisingFields disabled={running} />
                  {/*
                    A native <details>, not the Disclosure component: its fields
                    stay in the document while it is closed, so they are still
                    submitted and the checklist can open it to focus one.
                  */}
                  <details className="group rounded-control border border-border">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 font-sans text-sm font-semibold text-ink">
                      Search engine listing
                      <span className="font-normal text-muted">Optional</span>
                    </summary>
                    <div className="border-t border-border px-4 py-4">
                      <SeoFields errors={errors} disabled={running} />
                    </div>
                  </details>
                </div>
              )}
              {section.id === "review" && (
                <ReadinessChecklist items={readiness} attempted={attemptedPublish} onJump={jump} />
              )}
            </AdminFormSection>
          ))}

          <AdminStickyActions
            status={statusLine}
            tone={failure ? "danger" : running ? "attention" : "neutral"}
          >
            <button
              type="button"
              disabled={running}
              onClick={() => (dirty ? setConfirmCancel(true) : router.push("/admin/products"))}
              className={adminButtonClass("ghost", "md")}
            >
              Cancel
            </button>
            {failure?.stage === "images" && (
              <button
                type="button"
                disabled={running}
                onClick={() => void run(lastIntent, { skipFailedImages: true })}
                className={adminButtonClass("secondary", "md")}
              >
                Continue without them
              </button>
            )}
            <button
              type="button"
              disabled={running}
              aria-busy={running && lastIntent === "draft"}
              onClick={() => void run("draft")}
              className={adminButtonClass("secondary", "md")}
            >
              {failure && lastIntent === "draft" && failure.stage !== "validation"
                ? "Retry draft"
                : "Save as draft"}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => void run("publish")}
              aria-busy={running && lastIntent === "publish"}
              className={adminButtonClass("primary", "md")}
            >
              {running && lastIntent === "publish" && (
                <Loader2 size={15} className="animate-spin" aria-hidden="true" />
              )}
              {failure && lastIntent === "publish" && failure.stage !== "validation"
                ? "Retry publish"
                : "Publish product"}
            </button>
          </AdminStickyActions>
        </div>
      </form>

      {confirmCancel && (
        <AdminConfirmDialog
          title="Leave without finishing?"
          body={
            created
              ? [
                  "What you have entered on this screen will be lost.",
                  "The part already saved stays in Products as a draft, hidden from customers.",
                ]
              : ["Nothing has been saved yet. What you have entered will be lost."]
          }
          confirmLabel="Leave"
          tone="danger"
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => {
            setConfirmCancel(false);
            // The unload prompt is for accidents; this was a decision.
            setTouched(false);
            router.push("/admin/products");
          }}
        />
      )}
    </>
  );
}
