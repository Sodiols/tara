import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

/**
 * A session-free Supabase client for genuinely public, cacheable reads.
 *
 * The normal server client reads cookies to attach the caller's session, which
 * opts the whole route out of static rendering. The sitemap has no caller — it
 * is the same document for every visitor — so binding it to a session both
 * broke incremental regeneration and risked caching one person's view.
 *
 * This client authenticates as `anon` and stores nothing, so row level security
 * shows it exactly what an anonymous visitor may see: active products, active
 * categories and active collections. That is precisely the set a sitemap should
 * contain, which makes the restriction a feature rather than a workaround.
 *
 * Do not use this for anything user-specific — it has no identity, so every
 * "own row" policy will correctly return nothing.
 */
export function createPublicClient() {
  const config = requireSupabaseEnv();

  return createSupabaseClient<Database>(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
