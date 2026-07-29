import { getSupabaseConfigurationError } from "@/lib/supabase/env";

export function SupabaseConfigurationNotice() {
  if (process.env.NODE_ENV !== "development") return null;
  const message = getSupabaseConfigurationError();
  if (!message) return null;

  return (
    <div
      role="alert"
      className="border-b border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-900"
    >
      {message}
    </div>
  );
}
