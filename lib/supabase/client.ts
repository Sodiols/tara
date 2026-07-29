"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "./env";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  const config = requireSupabaseEnv();
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      config.url,
      config.publishableKey,
    );
  }
  return browserClient;
}
