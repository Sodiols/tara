"use client";

import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

const iconMap = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function ToastNotification() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm"
    >
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className="flex items-start gap-3 bg-wine text-taraIvory px-4 py-3 shadow-lg animate-slideUp"
          >
            <Icon size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 text-taraIvory/70 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
