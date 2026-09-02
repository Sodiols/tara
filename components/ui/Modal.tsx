"use client";

import { ReactNode, useRef } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useDialogBehaviour } from "@/hooks/useDialogBehaviour";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidthClass?: string;
}

export function Modal({ isOpen, onClose, title, children, maxWidthClass = "max-w-2xl" }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape, the focus trap, focus restoration and the scroll lock all live in
  // the shared hook now, so this dialog, the search overlay and the mobile
  // navigation drawer cannot drift apart on any of them.
  useDialogBehaviour({ isOpen, onClose, panelRef, initialFocusRef: closeButtonRef });

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-ink/40 animate-fadeIn" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative z-10 w-full ${maxWidthClass} max-h-[90vh] overflow-y-auto rounded-panel bg-white shadow-lg animate-slideUp`}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-serif text-xl text-ink">{title}</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-ink hover:text-wine transition-colors"
          >
            <X size={22} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
