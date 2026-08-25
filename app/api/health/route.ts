import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public-client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logger } from "@/lib/logger";

/**
 * Liveness and readiness for uptime monitors and deployment checks.
 *
 * Deliberately says as little as possible. A health endpoint is unauthenticated
 * by definition, so it must not become a reconnaissance tool: no environment
 * values, no connection strings, no library versions, no SQL, and no stack
 * traces. The database probe reports "reachable" or "unreachable" and nothing
 * about why.
 *
 *   200  the application is running and the database answered
 *   503  the application is running but the database did not
 *
 * The 503 is meaningful: a load balancer should take this instance out of
 * rotation rather than keep sending shoppers to a checkout that cannot write.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATABASE_TIMEOUT_MS = 3000;

async function probeDatabase(): Promise<"ok" | "unreachable" | "not_configured"> {
  if (!isSupabaseConfigured()) return "not_configured";

  try {
    const supabase = createPublicClient();
    // The cheapest possible real query: one row of a tiny public reference
    // table that every anonymous visitor may read anyway.
    const probe = supabase.from("bd_divisions").select("name").limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), DATABASE_TIMEOUT_MS),
    );
    const { error } = await Promise.race([probe, timeout]);
    return error ? "unreachable" : "ok";
  } catch {
    return "unreachable";
  }
}

export async function GET() {
  const startedAt = Date.now();
  const database = await probeDatabase();
  const healthy = database === "ok";

  if (!healthy) {
    logger.warn("health.degraded", { database });
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database,
      uptimeCheckMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
