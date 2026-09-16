"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  applyProductImageOrderAction,
  createProductAction,
  createProductColoursAction,
  saveProductAction,
  setProductStatusAction,
} from "@/lib/supabase/actions/admin";
import { adminProductSchema, productFormValues } from "@/lib/validation";
import {
  describePartialUpload,
  orderedImageIds,
  outstandingUploads,
  primaryImageId,
} from "@/lib/product-image-workflow";
import { useToastStore } from "@/store/toastStore";
import { ProductFields } from "./ProductFields";
import {
  PendingImageGrid,
  usePendingImages,
  type PendingImage,
} from "./ProductImageManager";
import { uploadPendingImages } from "./upload-pending-images";
import {
  ColourImagesSection,
  describeColourProblems,
  useColourDrafts,
  type ColourDraft,
} from "./ProductColourImages";
import { Panel, PanelHeader } from "./ui";

type Option = { id: string; name_en: string };

type CreatedProduct = {
  id: string;
  slug: string;
  heldAsDraft: boolean;
  requestedStatus: "draft" | "active" | "archived";
};

type Phase = "idle" | "creating" | "uploading" | "finishing" | "done";

/**
 * Creating a product.
 *
 * From the administrator's side this is one screen and one button: fill the
 * form in, pick the images, press Create product, land on the editor with the
 * images already there and the variants section waiting.
 *
 * Underneath it is a sequence, because a storage path cannot be built before
 * the product has an id, and because twelve five-megabyte images cannot go
 * through one server action request without raising the body limit for the
 * whole application:
 *
 *   1. validate in the browser, so a missing category costs a render rather
 *      than a product row and six uploads;
 *   2. create the row — ONCE. The returned id is held for the rest of the
 *      operation, so nothing after this point can create a second product;
 *   3. create the colour rows, when the product is photographed per colourway.
 *      They are re-used rather than duplicated on a retry, so pressing the
 *      button twice cannot produce two Blacks;
 *   4. upload the files already in hand, one request at a time, in the order
 *      the administrator arranged them, each carrying the id of the colour it
 *      was grouped under;
 *   5. apply that order and the chosen main image;
 *   6. publish, if `active` was asked for and the images all arrived;
 *   7. go to the editor.
 *
 * Failures are survivable at every step. A server validation error keeps the
 * selected files. A failed upload keeps the product, keeps the images that did
 * upload, and keeps the failed file in memory so it can be retried without
 * being chosen again. Nothing here ever creates the product twice.
 */
export function ProductCreateForm({
  categories,
  collections,
}: {
  categories: Option[];
  collections: Option[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const addToast = useToastStore((state) => state.addToast);
  const pending = usePendingImages();
  // The two image workflows are mutually exclusive: a product either has one
  // gallery or one gallery per colour. Both controllers exist so switching the
  // toggle does not throw away files that were already picked.
  const [colourMode, setColourMode] = useState(false);
  const drafts = useColourDrafts();

  // Created colour ids, keyed by the draft key the browser generated. Held for
  // the whole operation for the same reason `created` is: a retry after a
  // failed upload must attach the files to the colours that already exist.
  const [colourIds, setColourIds] = useState<Record<string, string>>({});

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState("");
  const [dirty, setDirty] = useState(false);

  // The created product, kept for the whole operation. Its presence is the
  // guard against a second create: a retry that finds it set goes straight to
  // the uploads.
  const [created, setCreated] = useState<CreatedProduct | null>(null);
  const [failedCount, setFailedCount] = useState(0);

  // A ref as well as state, because a double click has to be refused in the
  // same tick — a state update is a render away and two clicks fit inside it.
  const busyRef = useRef(false);
  const leavingRef = useRef(false);

  const busy = phase !== "idle" && phase !== "done";
  const touched = dirty || pending.items.length > 0 || drafts.totalImages > 0;

  // An accidental back-navigation or tab close after twenty minutes of typing
  // is a bad afternoon. The prompt is only armed once something has actually
  // been entered, and is disarmed for the redirect we make ourselves.
  useEffect(() => {
    // Stays armed while the operation is running and while a failed image is
    // still retryable — leaving then is when work is actually lost. It is
    // disarmed once the redirect is under way.
    if (!touched || phase === "done") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leavingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [touched, phase]);

  const focusFirstError = (fieldErrors: Record<string, string[]>) => {
    const first = Object.keys(fieldErrors)[0];
    if (!first) return;
    const element = document.getElementById(first);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    (element as HTMLElement | null)?.focus?.();
  };

  /** Steps 5 to 7: order, main image, status, redirect. */
  const finish = useCallback(
    async (
      product: CreatedProduct,
      images: PendingImage[],
      colourGroups?: ColourDraft[],
    ) => {
      setPhase("finishing");
      setProgress("Finishing up…");

      /*
       * With colours, the stored order is colour by colour and, inside each
       * colour, that colour's own first image first — the order they were
       * uploaded in. The product's MAIN image (the one on cards, in search and
       * in social previews) is the first image of the first colour: a global
       * cover is a different concept from a colour's first photograph, and the
       * editor can point it anywhere afterwards without disturbing the groups.
       */
      const uploaded = colourGroups
        ? colourGroups.flatMap((colour) => colour.images)
        : images;
      const storedIds = orderedImageIds(uploaded);
      const mainId = colourGroups
        ? storedIds[0] ?? null
        : primaryImageId(images, pending.mainKey);

      if (storedIds.length > 0) {
        const ordered = await applyProductImageOrderAction(product.id, storedIds, mainId);
        if (!ordered.ok) addToast(ordered.message, "error");
      }

      // The row was inserted as a draft to keep a half-illustrated product off
      // the storefront while the files were in flight. It goes live now — but
      // only if it actually has an image, because publishing a product whose
      // every image failed is exactly what holding it back was for.
      if (product.heldAsDraft) {
        if (storedIds.length > 0) {
          const published = await setProductStatusAction(product.id, product.requestedStatus);
          if (!published.ok) {
            addToast(`${published.message} The product is saved as a draft.`, "error");
          }
        } else {
          addToast("Saved as a draft: an active product needs at least one image.", "info");
        }
      }

      setPhase("done");
      setProgress("Product created.");
      leavingRef.current = true;
      router.push(`/admin/products/${product.id}?created=1`);
    },
    [addToast, pending.mainKey, router],
  );

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setFormError("");

    try {
      const form = formRef.current;
      if (!form) return;
      const formData = new FormData(form);

      // Stage 0 — the same schema the server will run, so the common mistakes
      // never reach the network and never cost an upload.
      const parsed = adminProductSchema.safeParse(productFormValues(formData));
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
        setErrors(fieldErrors);
        setFormError(parsed.error.issues[0]?.message ?? "Check the highlighted fields.");
        focusFirstError(fieldErrors);
        return;
      }

      // Stage 0b — duplicate colour names and empty colour groups are caught
      // here, where the administrator can see both fields, rather than as a
      // unique-constraint error after the product row exists.
      if (colourMode) {
        const problem = describeColourProblems(drafts.colours);
        if (problem) {
          setFormError(problem);
          addToast(problem, "error");
          return;
        }
      }

      // Stage 1 — the product row, at most once for this screen.
      let product = created;
      if (!product) {
        setPhase("creating");
        setProgress("Creating product…");
        formData.set(
          "pendingImageCount",
          String(colourMode ? drafts.totalImages : pending.items.length),
        );

        const result = await createProductAction(formData);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.message);
          focusFirstError(result.fieldErrors ?? {});
          addToast(result.message, "error");
          setPhase("idle");
          setProgress("");
          return;
        }
        setErrors({});
        product = result.data as CreatedProduct;
        setCreated(product);
      } else {
        // The row already exists — this press is a retry. Any field edited
        // since is saved rather than silently discarded, and the status stays
        // held back if it was held back, because the images are still the thing
        // being waited on.
        setPhase("creating");
        setProgress("Saving product…");
        formData.set("id", product.id);
        if (product.heldAsDraft) formData.set("status", "draft");

        const saved = await saveProductAction(formData);
        if (!saved.ok) {
          setErrors(saved.fieldErrors ?? {});
          setFormError(saved.message);
          focusFirstError(saved.fieldErrors ?? {});
          addToast(saved.message, "error");
          setPhase("idle");
          setProgress("");
          return;
        }
        setErrors({});
      }

      if (colourMode) {
        // Stage 2 — the colour rows. Created before any file is sent, because
        // an upload carries the colour id and cannot be re-pointed afterwards
        // without a second write per image.
        setProgress("Saving colours…");
        const colourResult = await createProductColoursAction(
          product.id,
          drafts.definitions(),
        );
        if (!colourResult.ok) {
          setFormError(colourResult.message);
          addToast(colourResult.message, "error");
          setPhase("idle");
          setProgress("");
          return;
        }
        const ids = { ...colourIds, ...(colourResult.data?.ids ?? {}) };
        setColourIds(ids);

        // Stage 3 — the files, each tagged with the colour it was grouped
        // under. Anything already stored is skipped, so a retry uploads only
        // what failed and never attaches a second copy to the colour.
        const queued = drafts.allImages();
        let groups = drafts.colours;

        if (outstandingUploads(queued).length > 0) {
          setPhase("uploading");
          const outcome = await uploadPendingImages({
            productId: product.id,
            items: queued,
            colourIdFor: (item) => ids[item.colourKey] ?? null,
            onProgress: setProgress,
          });
          groups = drafts.applyResults(outcome.results);

          if (outcome.failed > 0) {
            const all = groups.flatMap((colour) => colour.images);
            const stored = all.filter((item) => item.imageId).length;
            setFailedCount(outcome.failed);
            setFormError(describePartialUpload(stored, all.length));
            addToast("Some images could not be uploaded.", "error");
            setPhase("idle");
            setProgress("");
            return;
          }
        }

        setFailedCount(0);
        await finish(product, [], groups);
        return;
      }

      // Stage 2 — the files already in hand. Anything that uploaded on an
      // earlier attempt is skipped inside uploadPendingImages().
      const outstanding = outstandingUploads(pending.items);
      let images = pending.items;

      if (outstanding.length > 0) {
        setPhase("uploading");
        const outcome = await uploadPendingImages({
          productId: product.id,
          items: pending.items,
          onProgress: setProgress,
        });
        images = pending.applyResults(outcome.results);

        if (outcome.failed > 0) {
          const stored = images.filter((item) => item.imageId).length;
          setFailedCount(outcome.failed);
          setFormError(describePartialUpload(stored, images.length));
          addToast("Some images could not be uploaded.", "error");
          setPhase("idle");
          setProgress("");
          return;
        }
      }

      setFailedCount(0);
      await finish(product, images);
    } finally {
      busyRef.current = false;
    }
  }, [addToast, colourIds, colourMode, created, drafts, finish, pending]);

  /** "Continue without this image" — the product and the images that did
   *  upload are already saved; this just stops trying. */
  const continueWithoutFailed = useCallback(async () => {
    if (busyRef.current || !created) return;
    busyRef.current = true;
    try {
      await finish(created, pending.items, colourMode ? drafts.colours : undefined);
    } finally {
      busyRef.current = false;
    }
  }, [colourMode, created, drafts.colours, finish, pending.items]);

  const storedCount = colourMode
    ? drafts.colours.flatMap((colour) => colour.images).filter((item) => item.imageId).length
    : pending.items.filter((item) => item.imageId).length;

  return (
    <form
      ref={formRef}
      noValidate
      onChange={() => setDirty(true)}
      onSubmit={(event) => {
        event.preventDefault();
        void run();
      }}
      className="flex flex-col gap-5"
    >
      <ProductFields
        categories={categories}
        collections={collections}
        errors={errors}
        imagesSlot={
          <ColourImagesSection
            enabled={colourMode}
            onEnabledChange={setColourMode}
            drafts={drafts}
            disabled={busy}
            flatImagesSlot={
              <Panel>
                <PanelHeader
                  title="Product images"
                  description="The first image is the main one until you choose another."
                />
                <div className="px-5 py-5">
                  <PendingImageGrid pending={pending} disabled={busy} />
                </div>
              </Panel>
            }
          />
        }
      />

      {formError && (
        <div
          role="alert"
          className="rounded-control border border-[#8C2F2F]/25 bg-[#8C2F2F]/5 px-4 py-3 font-sans text-sm text-[#8C2F2F]"
        >
          <p>{formError}</p>
          {failedCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="inline-flex h-10 items-center rounded-control border border-taraWine bg-taraWine px-4 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted"
              >
                Retry failed upload{failedCount === 1 ? "" : "s"}
              </button>
              <button
                type="button"
                onClick={() => void continueWithoutFailed()}
                disabled={busy}
                className="inline-flex h-10 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-taraWine hover:text-taraWine disabled:cursor-not-allowed disabled:text-muted"
              >
                Continue without {failedCount === 1 ? "this image" : "these images"}
              </button>
            </div>
          )}
          {created && (
            <p className="mt-2 text-xs">
              The product itself is saved
              {storedCount > 0
                ? ` with ${storedCount} image${storedCount === 1 ? "" : "s"}`
                : ""}
              . Nothing here will create it a second time.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-control border border-taraWine bg-taraWine px-5 font-sans text-[13px] font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted"
        >
          {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
          Create product
        </button>
        <Link
          href="/admin/products"
          className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted transition-colors hover:border-taraWine hover:text-taraWine"
        >
          Cancel
        </Link>
        <p role="status" aria-live="polite" className="font-sans text-sm text-muted">
          {busy ? progress : ""}
        </p>
      </div>
    </form>
  );
}
