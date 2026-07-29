import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

export async function createClient() {
  const config = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch (error) {
            // Next.js intentionally rejects cookie writes while rendering a
            // Server Component. Server Actions and Route Handlers use this
            // same client and can write; the proxy refreshes render-time sessions.
            if (
              !(error instanceof Error) ||
              !error.message.toLowerCase().includes("cookie")
            ) {
              throw error;
            }
          }
        },
      },
    },
  );
}
