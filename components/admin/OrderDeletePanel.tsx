"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { orderDeletionWarning } from "@/lib/archive";
import {
  archiveOrdersAction,
  deleteOrdersAction,
  restoreArchivedItemsAction,
} from "@/lib/supabase/actions/archive";
import { useToastStore } from "@/store/toastStore";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types/database";
import { Panel, PanelHeader } from "./ui";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

const buttonBase =
  "inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 font-sans text-[13px] font-semibold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:border-border disabled:bg-taraIvory disabled:text-muted";

/**
 * Archive, restore and permanent delete for one order. Rendered only for
 * administrators by the order page; the actions check archive.manage again on
 * the server and in the database.
 */
export function OrderDeletePanel({
  orderId,
  orderNumber,
  status,
  archived,
}: {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  archived: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [restockShipped, setRestockShipped] = useState(false);
  const [pending, startTransition] = useTransition();
  const addToast = useToastStore((state) => state.addToast);
  const router = useRouter();
  const shipped = status === "shipped" || status === "delivered";
  const warning = orderDeletionWarning(1);

  const run = (task: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) => {
    startTransition(async () => {
      const result = await task();
      addToast(result.message ?? "Done.", result.ok ? "success" : "error");
      if (result.ok) after?.();
    });
  };

  return (
    <Panel>
      <PanelHeader
        title="Archive or delete"
        description={
          archived
            ? "This order is archived. It still counts in revenue until it is permanently deleted."
            : "Administrators only. Archive to move it out of the order list, or delete a test order permanently."
        }
      />
      <div className="flex flex-col gap-2 px-5 py-5">
        {archived ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => restoreArchivedItemsAction([{ type: "order", id: orderId }]), () => router.refresh())}
            className={cn(buttonBase, "border border-taraWine bg-taraWine text-taraIvory hover:border-taraBlack hover:bg-taraBlack")}
          >
            {pending && !confirming && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Restore order
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => archiveOrdersAction([orderId]), () => router.refresh())}
            className={cn(buttonBase, "border border-border bg-taraWhite text-ink hover:border-taraWine hover:text-taraWine")}
          >
            {pending && !confirming && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            Archive order
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(true)}
          className={cn(buttonBase, "border border-[#8C2F2F]/40 bg-taraWhite text-[#8C2F2F] hover:bg-[#8C2F2F] hover:text-taraWhite")}
        >
          Delete Order
        </button>
        {archived && (
          <Link
            href="/admin/archive?type=order"
            className="mt-1 text-center font-sans text-xs font-semibold uppercase tracking-wide text-muted underline-offset-4 hover:text-taraWine hover:underline"
          >
            Open Archive & Trash
          </Link>
        )}
      </div>

      {confirming && (
        <ConfirmDeleteDialog
          title={warning.title}
          body={[
            ...warning.body,
            `Order ${orderNumber}. ${shipped ? "It has shipped, so its stock is not returned unless you choose to." : "Stock it still holds is returned, and coupon usage is released."}`,
          ]}
          requireWord
          pending={pending}
          option={
            shipped
              ? {
                  label: "Also return this order's stock",
                  hint: "Only for a test order. Real shipped goods have already left the shop.",
                  checked: restockShipped,
                  onChange: setRestockShipped,
                }
              : undefined
          }
          onCancel={() => {
            setConfirming(false);
            setRestockShipped(false);
          }}
          onConfirm={(confirmation) =>
            run(
              () => deleteOrdersAction([orderId], confirmation, restockShipped),
              () => router.replace("/admin/orders"),
            )
          }
        />
      )}
    </Panel>
  );
}
