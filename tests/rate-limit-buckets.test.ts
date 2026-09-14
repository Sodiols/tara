import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * The application and the database must agree on rate-limit bucket names.
 *
 * WHY THIS EXISTS
 * ---------------
 * `consumeDurableLimit(bucket, ...)` calls `consume_public_rate_limit()`, which
 * looks the allowance up from a fixed CASE list in SQL and raises on a name it
 * does not know. The TypeScript side catches that error and fails open — on
 * purpose, so a database blip cannot take the site down.
 *
 * The consequence is that a bucket name present in the app but missing from the
 * SQL is not an error anyone sees. The receipt endpoint shipped exactly like
 * that: `consumeDurableLimit("receipt", ...)` against a function with no
 * `receipt` arm, so its durable limit allowed everything and logged a warning
 * per request. Migration 0021 fixed it. This test is what stops the next one.
 *
 * It reads source rather than importing, because the question is about text in
 * two languages agreeing, and neither side can be exercised without a database.
 */

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

type Allowance = { allowance: number; window: number };

/** Parses every `when 'bucket' then allowance := N; window_seconds := M;` arm. */
function parseBuckets(sql: string): Map<string, Allowance> {
  const buckets = new Map<string, Allowance>();
  const arm =
    /when\s+'([a-z-]+)'\s+then\s+allowance\s*:=\s*(\d+)\s*;\s*window_seconds\s*:=\s*(\d+)\s*;/g;
  for (const match of sql.matchAll(arm)) {
    buckets.set(match[1], { allowance: Number(match[2]), window: Number(match[3]) });
  }
  return buckets;
}

/** The body of the LAST `create or replace function public.consume_public_rate_limit`. */
async function latestDefinition(): Promise<{ file: string; buckets: Map<string, Allowance> }> {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  let latest: { file: string; buckets: Map<string, Allowance> } | null = null;

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const start = sql.search(/create\s+or\s+replace\s+function\s+public\.consume_public_rate_limit\s*\(/i);
    if (start === -1) continue;
    // The body runs to the closing `$$;` of this function.
    const end = sql.indexOf("$$;", sql.indexOf("$$", start) + 2);
    latest = { file, buckets: parseBuckets(sql.slice(start, end)) };
  }

  assert.ok(latest, "no migration defines public.consume_public_rate_limit");
  return latest;
}

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    }),
  );
  return nested.flat();
}

/** Every bucket the application passes to consumeDurableLimit(). */
async function bucketsUsedByApplication(): Promise<Map<string, string[]>> {
  const used = new Map<string, string[]>();
  const files = (
    await Promise.all(["app", "lib", "components"].map((dir) => sourceFiles(path.join(root, dir))))
  ).flat();

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(/consumeDurableLimit\(\s*["']([a-z-]+)["']/g)) {
      const where = path.relative(root, file).split(path.sep).join("/");
      used.set(match[1], [...(used.get(match[1]) ?? []), where]);
    }
  }
  return used;
}

describe("durable rate-limit buckets", () => {
  test("every bucket the application consumes is handled by the database", async () => {
    const { file, buckets } = await latestDefinition();
    const used = await bucketsUsedByApplication();

    assert.ok(used.size > 0, "found no consumeDurableLimit() calls — the scan is broken");

    const missing = [...used.entries()].filter(([bucket]) => !buckets.has(bucket));
    assert.deepEqual(
      missing,
      [],
      `These buckets are consumed by the app but not handled by ${file}. ` +
        "consume_public_rate_limit() raises for them and consumeDurableLimit() fails " +
        "open, so they have no durable limit at all. Add them in a new migration.",
    );
  });

  test("the receipt bucket is 20 per 600 seconds, matching its in-process layer", async () => {
    const { buckets } = await latestDefinition();
    assert.deepEqual(buckets.get("receipt"), { allowance: 20, window: 600 });

    const route = await readFile(
      path.join(root, "app", "api", "orders", "[orderNumber]", "receipt", "route.ts"),
      "utf8",
    );
    const inProcess = /guardPublicAction\(\s*"receipt"\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(route);
    assert.ok(inProcess, "the receipt route no longer calls guardPublicAction(\"receipt\", …)");
    assert.deepEqual(
      { allowance: Number(inProcess[1]), window: Number(inProcess[2]) },
      buckets.get("receipt"),
      "the two layers disagree: one of them is not the limit anybody intended",
    );
  });

  test("no bucket defined before 0021 was loosened by a later migration", async () => {
    // The allowances as 0010 shipped them. A later redefinition may add buckets
    // or tighten one; it must never quietly raise an allowance or widen a window.
    const original = parseBuckets(
      await readFile(path.join(migrationsDir, "0010_security_operations_and_email.sql"), "utf8"),
    );
    const { buckets } = await latestDefinition();

    assert.ok(original.size >= 8, "could not read the 0010 bucket list");
    for (const [bucket, before] of original) {
      const after = buckets.get(bucket);
      assert.ok(after, `bucket "${bucket}" was removed`);
      assert.ok(after.allowance <= before.allowance, `bucket "${bucket}" allowance was raised`);
      assert.ok(after.window >= before.window, `bucket "${bucket}" window was shortened`);
    }
  });

  test("the public entry point keeps its security properties", async () => {
    const { file } = await latestDefinition();
    const sql = await readFile(path.join(migrationsDir, file), "utf8");

    assert.match(sql, /security\s+definer/i);
    assert.match(sql, /set\s+search_path\s*=\s*''/i);
    assert.match(sql, /raise\s+exception\s+'unknown_rate_limit_bucket'/i);
    assert.match(
      sql,
      /grant\s+execute\s+on\s+function\s+public\.consume_public_rate_limit\(text,\s*text\)\s+to\s+anon,\s*authenticated/i,
    );
    // The caller-chosen-allowance function must never be exposed alongside it.
    assert.doesNotMatch(sql, /grant\s+execute\s+on\s+function\s+public\.consume_rate_limit\s*\(/i);
  });
});
