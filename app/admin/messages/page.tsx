import { getAdminMessages, parsePage } from "@/lib/supabase/queries/admin";
import { updateMessageStatusAction } from "@/lib/supabase/actions/admin";
import { formatDateTime } from "@/lib/format";
import { formatBdPhone } from "@/lib/phone";
import { MESSAGE_STATUSES, MESSAGE_STATUS_LABELS } from "@/lib/order-status";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminQuickFilters,
  AdminSearchInput,
  Field,
  PageHeader,
  Pagination,
  Panel,
  adminInputClass,
} from "@/components/admin/ui";
import { MessageStatusBadge } from "@/components/admin/status";
import { ActionForm, SubmitButton } from "@/components/admin/AdminForm";
import type { MessageStatus } from "@/types/database";

type SearchParams = { page?: string; q?: string; status?: string };

const FILTERS = [
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "replied", label: "Replied" },
  { value: "resolved", label: "Resolved" },
  { value: "", label: "All" },
];

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const status = params.status ?? "new";

  const { rows, total, pageSize } = await getAdminMessages({
    page,
    search: params.q,
    status: status === "" ? "all" : (status as MessageStatus),
  });

  const buildHref = (nextPage: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(nextPage));
    return `/admin/messages?${query.toString()}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Customer care"
        title="Contact messages"
        description="Submitted through the storefront contact form. Never shown publicly."
      />

      <AdminQuickFilters
        label="Filter by status"
        items={FILTERS.map((option) => ({
          label: option.label,
          href: option.value ? `/admin/messages?status=${option.value}` : "/admin/messages?status=",
          active: status === option.value,
        }))}
      />

      <AdminFilterBar action="/admin/messages" submitLabel="Search">
        <input type="hidden" name="status" value={status} />
        <AdminSearchInput defaultValue={params.q ?? ""} placeholder="Name, email or text" label="Search messages" />
      </AdminFilterBar>

      <Panel>
        {rows.length === 0 ? (
          <AdminEmptyState
            title={status === "new" ? "No new messages" : "No messages here"}
            description={
              status === "new"
                ? "Everything from the contact page has been read. New enquiries arrive here."
                : "Try another status, or clear the search."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border/70">
              {rows.map((message) => (
                <li key={message.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-sans text-sm font-semibold text-ink">{message.name}</p>
                      <p className="font-sans text-xs text-muted">
                        <a
                          href={`mailto:${message.email}`}
                          className="break-all text-taraWine underline-offset-4 hover:underline"
                        >
                          {message.email}
                        </a>
                        {message.phone && ` · ${formatBdPhone(message.phone)}`}
                        {` · ${formatDateTime(message.created_at)}`}
                      </p>
                    </div>
                    <MessageStatusBadge status={message.status} />
                  </div>

                  {message.subject && (
                    <p className="mt-3 font-sans text-sm font-semibold text-ink">
                      {message.subject}
                    </p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6 text-muted">
                    {message.message}
                  </p>

                  {message.staff_note && (
                    <div className="mt-3 rounded-control border border-border bg-taraIvory/60 p-3">
                      <p className="font-sans text-[11px] font-bold uppercase tracking-wide text-muted">
                        Staff note
                      </p>
                      <p className="mt-1 whitespace-pre-wrap font-sans text-sm leading-6 text-ink">
                        {message.staff_note}
                      </p>
                    </div>
                  )}

                  <ActionForm
                    action={updateMessageStatusAction}
                    className="mt-4 flex flex-wrap items-end gap-3"
                    successToast
                  >
                    <input type="hidden" name="messageId" value={message.id} />
                    <Field
                      label="Status"
                      htmlFor={`status-${message.id}`}
                      className="min-w-[150px]"
                    >
                      <select
                        id={`status-${message.id}`}
                        name="status"
                        defaultValue={message.status}
                        className={adminInputClass}
                      >
                        {MESSAGE_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {MESSAGE_STATUS_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field
                      label="Staff note"
                      htmlFor={`note-${message.id}`}
                      className="min-w-[220px] flex-1"
                    >
                      <input
                        id={`note-${message.id}`}
                        name="staffNote"
                        maxLength={1000}
                        placeholder="Optional — what was done"
                        className={adminInputClass}
                      />
                    </Field>
                    <SubmitButton variant="secondary" className="mb-[1px]">
                      Update
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={pageSize} total={total} buildHref={buildHref} />
          </>
        )}
      </Panel>
    </>
  );
}
