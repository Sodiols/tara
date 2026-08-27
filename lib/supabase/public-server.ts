import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

/**
 * Cookie-free client for data that is intentionally public under RLS.
 *
 * Storefront catalogue and public settings reads are identical for every
 * visitor. Using the request-bound SSR client for them made Next.js carry the
 * cookie context into work that can be safely shared and cached. This client
 * has no persistence or token refresh and therefore always runs as `anon`.
 */
export function createPublicServerClient() {
  const config = requireSupabaseEnv();
  return createClient<Database>(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
