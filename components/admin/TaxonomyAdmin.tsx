"use client";

import { useState } from "react";
import Link from "next/link";
import {
  deleteCategoryAction,
  deleteCollectionAction,
  saveCategoryAction,
  saveCollectionAction,
} from "@/lib/supabase/actions/admin";
import { formatDate, isoToStoreLocal } from "@/lib/format";
import { slugify } from "@/lib/utils";
import type { Tables } from "@/types/database";
import { ActionForm, RowActionButton, SubmitButton } from "./AdminForm";
import {
  AdminEmptyState,
  Field,
  Panel,
  PanelHeader,
  TableWrap,
  Td,
  Th,
  adminInputClass,
  adminTextareaClass,
} from "./ui";
import { ActiveBadge, Badge } from "./status";

type Category = Tables<"categories">;
type Collection = Tables<"collections">;
type Row = Category | (Category & Partial<Collection>);

function isCollection(row: Row): row is Category & Collection {
  return "is_featured" in row;
}

/**
 * Shared editor for categories and collections. They differ only by the
 * scheduling and featured fields, so one component with a `kind` switch keeps
 * the two screens consistent instead of drifting apart.
 */
export function TaxonomyAdmin({
  kind,
  items,
  productCounts,
}: {
  kind: "categories" | "collections";
  items: Row[];
  productCounts: Record<string, number>;
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const isCollections = kind === "collections";
  const save = isCollections ? saveCollectionAction : saveCategoryAction;
  const remove = isCollections ? deleteCollectionAction : deleteCategoryAction;
  const singular = isCollections ? "collection" : "category";

  const openEditor = (row: Row | null) => {
    setEditing(row);
    setSlug(row?.slug ?? "");
    setSlugTouched(Boolean(row));
    setShowForm(true);
  };

  const closeEditor = () => {
    setShowForm(false);
    setEditing(null);
    setSlug("");
    setSlugTouched(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title={isCollections ? "Collections" : "Categories"}
          description={
            isCollections
              ? "Collections can be scheduled — a collection outside its date window is hidden from the storefront automatically."
              : "Every product belongs to exactly one category."
          }
          actions={
            <button
              type="button"
              onClick={() => openEditor(null)}
              className="inline-flex h-10 items-center rounded-control border border-taraWine bg-taraWine px-4 font-sans text-xs font-semibold uppercase tracking-wide text-taraIvory transition-colors hover:border-taraBlack hover:bg-taraBlack"
            >
              New {singular}
            </button>
          }
        />

        {items.length === 0 ? (
          <AdminEmptyState
            title={`No ${kind} yet`}
            description={`Create your first ${singular} to start organising the catalogue.`}
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Slug</Th>
                {isCollections && <Th>Schedule</Th>}
                <Th align="right">Products</Th>
                <Th align="right">Order</Th>
                <Th>State</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const count = productCounts[row.id] ?? 0;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-taraIvory/40">
                    <Td>
                      <span className="block font-medium">{row.name_en}</span>
                    </Td>
                    <Td className="font-mono text-xs">/{row.slug}</Td>
                    {isCollections && (
                      <Td className="text-xs text-muted">
                        {isCollection(row) && (row.starts_at || row.ends_at) ? (
                          <>
                            {row.starts_at ? formatDate(row.starts_at) : "Always"} →{" "}
                            {row.ends_at ? formatDate(row.ends_at) : "Ongoing"}
                          </>
                        ) : (
                          "Always visible"
                        )}
                      </Td>
                    )}
                    <Td align="right">
                      {count > 0 ? (
                        <Link
                          href={`/admin/products?${isCollections ? "" : `category=${row.id}`}`}
                          className="text-taraWine underline-offset-4 hover:underline"
                        >
                          {count}
                        </Link>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </Td>
                    <Td align="right" className="text-muted">
                      {row.sort_order}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        <ActiveBadge active={row.is_active} />
                        {isCollection(row) && row.is_featured && (
                          <Badge tone="info">Featured</Badge>
                        )}
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditor(row)}
                          className="font-sans text-xs font-semibold uppercase tracking-wide text-taraWine underline-offset-4 hover:underline"
                        >
                          Edit
                        </button>
                        <RowActionButton
                          tone="danger"
                          confirm={
                            count > 0
                              ? `"${row.name_en}" still has ${count} product${count === 1 ? "" : "s"}. Deleting will be refused — deactivate it instead?`
                              : `Delete "${row.name_en}"? This cannot be undone.`
                          }
                          action={async () => remove(row.id)}
                        >
                          Delete
                        </RowActionButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      {showForm && (
        <Panel>
          <PanelHeader title={editing ? `Edit ${editing.name_en}` : `New ${singular}`} />
          <div className="px-5 py-5">
            <ActionForm
              key={editing?.id ?? "new"}
              action={save}
              className="flex flex-col gap-5"
              onSuccess={closeEditor}
            >
              {editing && <input type="hidden" name="id" value={editing.id} />}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Name" htmlFor="tax-name-en" required>
                  <input
                    id="tax-name-en"
                    name="nameEn"
                    required
                    maxLength={120}
                    defaultValue={editing?.name_en ?? ""}
                    onChange={(event) => {
                      if (!slugTouched) setSlug(slugify(event.target.value));
                    }}
                    className={adminInputClass}
                  />
                </Field>
                <Field
                  label="Slug"
                  htmlFor="tax-slug"
                  required
                  hint={editing ? "Changing this breaks existing links." : undefined}
                >
                  <input
                    id="tax-slug"
                    name="slug"
                    required
                    maxLength={80}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(event.target.value);
                    }}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Sort order" htmlFor="tax-sort" hint="Lower numbers appear first.">
                  <input
                    id="tax-sort"
                    name="sortOrder"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={editing?.sort_order ?? 0}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="Description" htmlFor="tax-desc-en">
                  <textarea
                    id="tax-desc-en"
                    name="descriptionEn"
                    rows={3}
                    maxLength={1000}
                    defaultValue={editing?.description_en ?? ""}
                    className={adminTextareaClass}
                  />
                </Field>
                <Field label="Image URL" htmlFor="tax-image" className="sm:col-span-2">
                  <input
                    id="tax-image"
                    name="imageUrl"
                    type="url"
                    maxLength={500}
                    defaultValue={editing?.image_url ?? ""}
                    className={adminInputClass}
                  />
                </Field>

                {isCollections && (
                  <>
                    <Field
                      label="Starts at"
                      htmlFor="tax-starts"
                      hint="Bangladesh time. Leave blank for always."
                    >
                      <input
                        id="tax-starts"
                        name="startsAt"
                        type="datetime-local"
                        defaultValue={
                          editing && isCollection(editing)
                            ? isoToStoreLocal(editing.starts_at)
                            : ""
                        }
                        className={adminInputClass}
                      />
                    </Field>
                    <Field label="Ends at" htmlFor="tax-ends" hint="Bangladesh time.">
                      <input
                        id="tax-ends"
                        name="endsAt"
                        type="datetime-local"
                        defaultValue={
                          editing && isCollection(editing) ? isoToStoreLocal(editing.ends_at) : ""
                        }
                        className={adminInputClass}
                      />
                    </Field>
                  </>
                )}

                <Field label="SEO title" htmlFor="tax-seo-title">
                  <input
                    id="tax-seo-title"
                    name="seoTitle"
                    maxLength={70}
                    defaultValue={editing?.seo_title ?? ""}
                    className={adminInputClass}
                  />
                </Field>
                <Field label="SEO description" htmlFor="tax-seo-desc">
                  <input
                    id="tax-seo-desc"
                    name="seoDescription"
                    maxLength={180}
                    defaultValue={editing?.seo_description ?? ""}
                    className={adminInputClass}
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 font-sans text-sm text-ink">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={editing?.is_active ?? true}
                    className="h-4 w-4 accent-[#702D42]"
                  />
                  Visible on the storefront
                </label>
                {isCollections && (
                  <label className="flex items-center gap-2 font-sans text-sm text-ink">
                    <input
                      type="checkbox"
                      name="isFeatured"
                      defaultChecked={
                        editing && isCollection(editing) ? editing.is_featured : false
                      }
                      className="h-4 w-4 accent-[#702D42]"
                    />
                    Featured in navigation
                  </label>
                )}
              </div>

              <div className="flex gap-3">
                <SubmitButton>{editing ? "Save changes" : `Create ${singular}`}</SubmitButton>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="inline-flex h-11 items-center rounded-control border border-border bg-taraWhite px-4 font-sans text-[13px] font-semibold uppercase tracking-wide text-muted transition-colors hover:text-taraWine"
                >
                  Cancel
                </button>
              </div>
            </ActionForm>
          </div>
        </Panel>
      )}
    </div>
  );
}
