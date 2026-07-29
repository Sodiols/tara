import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  text: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, heading, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20 px-4">
      <Icon size={40} strokeWidth={1.25} className="text-muted mb-5" aria-hidden="true" />
      <h2 className="font-serif text-2xl text-ink mb-2">{heading}</h2>
      <p className="text-muted text-sm mb-6 max-w-sm">{text}</p>
      {action}
    </div>
  );
}
