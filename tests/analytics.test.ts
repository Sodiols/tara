import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  buildTrackedUrl,
  creatorFrom,
  isDirect,
  referrerHost,
  resolveSource,
  utmFromSearch,
} from "../lib/analytics/attribution";
import { resolveRange, storeDateInput } from "../lib/analytics/range";
import { MAX_EVENTS_PER_BATCH, SESSION_IDLE_MS } from "../lib/analytics/events";

/**
 * First-party analytics.
 *
 * Two kinds of test here, and the second kind is the one that matters:
 *
 *   1. the ordinary behaviour of the pure functions — parsing a link, resolving
 *      a source, working out what "yesterday" means in Dhaka;
 *
 *   2. AGREEMENT WITH THE DATABASE. Several rules exist in both TypeScript and
 *      SQL: which events may be recorded, how a source is normalised, what a
 *      creator link looks like. The SQL is the authority in every case — it is
 *      the copy an attacker cannot skip — and these read the migration and
 *      assert the two say the same thing. Without them the pair drifts, and the
 *      symptom is a dashboard quietly under-reporting a channel.
 */

const migration = readFile(
  new URL("../supabase/migrations/0026_launch_offer_and_first_party_analytics.sql", import.meta.url),
  "utf8",
);

describe("reading a campaign out of a link", () => {
  test("the five parameters are read, trimmed and capped", () => {
    const utm = utmFromSearch(
      "?utm_source=Instagram&utm_medium=social&utm_campaign=launch_week&utm_content=reel_01&utm_term=%20silk%20",
    );
    assert.equal(utm.utmSource, "Instagram");
    assert.equal(utm.utmMedium, "social");
    assert.equal(utm.utmCampaign, "launch_week");
    assert.equal(utm.utmContent, "reel_01");
    assert.equal(utm.utmTerm, "silk");
  });

  test("a link with no parameters carries nothing", () => {
    assert.deepEqual(utmFromSearch(""), {
      utmSource: undefined,
      utmMedium: undefined,
      utmCampaign: undefined,
      utmContent: undefined,
      utmTerm: undefined,
    });
  });

  test("an absurdly long value is cut rather than stored", () => {
    const utm = utmFromSearch(`?utm_campaign=${"a".repeat(500)}`);
    assert.equal(utm.utmCampaign?.length, 120);
  });

  test("a leading question mark is optional", () => {
    assert.equal(utmFromSearch("utm_source=tiktok").utmSource, "tiktok");
  });
});

describe("the referrer", () => {
  test("only the host is kept — never the path or the query", () => {
    assert.equal(
      referrerHost("https://www.google.com/search?q=what+somebody+typed"),
      "google.com",
    );
  });

  test("a referrer from the shop itself is not a traffic source", () => {
    assert.equal(referrerHost("https://tarabd.co/bag", "tarabd.co"), undefined);
    assert.equal(referrerHost("https://www.tarabd.co/bag", "tarabd.co"), undefined);
  });

  test("junk does not throw", () => {
    assert.equal(referrerHost("not a url"), undefined);
    assert.equal(referrerHost(""), undefined);
  });
});

describe("normalising a source", () => {
  test("utm_source wins, lowercased", () => {
    assert.equal(resolveSource("Instagram", "facebook.com"), "instagram");
  });

  test("without one, the referring host decides", () => {
    assert.equal(resolveSource(undefined, "l.instagram.com"), "instagram");
    assert.equal(resolveSource(undefined, "m.facebook.com"), "facebook");
    assert.equal(resolveSource(undefined, "fb.me"), "facebook");
    assert.equal(resolveSource(undefined, "www.tiktok.com"), "tiktok");
    assert.equal(resolveSource(undefined, "google.com.bd"), "google");
    assert.equal(resolveSource(undefined, "duckduckgo.com"), "search");
  });

  test("an unexpected referrer is reported as itself, not as 'other'", () => {
    assert.equal(resolveSource(undefined, "prothomalo.com"), "prothomalo.com");
  });

  test("no campaign and no referrer is direct", () => {
    assert.equal(resolveSource(undefined, undefined), "direct");
    assert.equal(isDirect({}), true);
    assert.equal(isDirect({ utmSource: "instagram" }), false);
    assert.equal(isDirect({ referrerHost: "instagram.com" }), false);
  });

  test("the SQL resolves the same hosts", async () => {
    const sql = await migration;
    const start = sql.indexOf("function public.resolve_traffic_source");
    assert.ok(start > 0, "resolve_traffic_source is missing from the migration");
    const body = sql.slice(start, sql.indexOf("$$;", start));

    // Every host TARA's traffic actually comes from must be mapped on both
    // sides. A branch present in one and missing from the other is a channel
    // reported under two different names.
    for (const host of ["instagram", "facebook", "tiktok", "google", "youtube", "whatsapp"]) {
      assert.match(body, new RegExp(`'${host}'`), `SQL does not map ${host}`);
      assert.equal(
        resolveSource(undefined, `www.${host}.com`),
        host,
        `TypeScript does not map ${host}`,
      );
    }
    assert.match(body, /'direct'/);
  });
});

describe("creator attribution", () => {
  test("utm_source=creator names the creator in the campaign", () => {
    assert.equal(creatorFrom({ utmSource: "creator", utmCampaign: "nabila" }), "nabila");
  });

  test("a creator_ content tag names them too", () => {
    assert.equal(creatorFrom({ utmContent: "creator_nabila_tryon_01" }), "nabila");
  });

  test("ordinary content is not a creator", () => {
    assert.equal(creatorFrom({ utmContent: "instagram_tryon_reel_01" }), undefined);
    assert.equal(creatorFrom({ utmSource: "instagram", utmCampaign: "launch" }), undefined);
  });

  test("the SQL uses the same two conventions", async () => {
    const sql = await migration;
    assert.match(sql, /a\.source = 'creator'/);
    assert.match(sql, /a\.content ~ '\^creator\[_-\]'/);
  });
});

describe("building a tracked link", () => {
  test("values are normalised so two posts group together", () => {
    const link = buildTrackedUrl("https://tarabd.co/product/silk", {
      source: "Instagram",
      medium: "Social",
      campaign: "Launch Week",
      content: "Try On Reel 01",
    });
    assert.equal(
      link,
      "https://tarabd.co/product/silk?utm_source=instagram&utm_medium=social&utm_campaign=launch_week&utm_content=try_on_reel_01",
    );
  });

  test("empty parameters are left out rather than sent blank", () => {
    const link = buildTrackedUrl("https://tarabd.co/", { source: "tiktok" });
    assert.equal(link, "https://tarabd.co/?utm_source=tiktok");
  });

  test("a malformed base returns nothing rather than a broken link", () => {
    assert.equal(buildTrackedUrl("tarabd.co", { source: "tiktok" }), "");
  });
});

describe("the dashboard's date range", () => {
  // 03:00 in Dhaka on 12 March 2026 — which is still 11 March in UTC. A range
  // computed in UTC would show the owner the wrong day's takings.
  const earlyMorningDhaka = new Date("2026-03-11T21:00:00Z");

  test("today means today in Dhaka, not in UTC", () => {
    const range = resolveRange({ range: "today" }, earlyMorningDhaka);
    assert.equal(storeDateInput(range.from), "2026-03-12");
    assert.equal(range.from.toISOString(), "2026-03-11T18:00:00.000Z");
    assert.equal(range.to.toISOString(), "2026-03-12T18:00:00.000Z");
  });

  test("yesterday is the whole of the previous store day", () => {
    const range = resolveRange({ range: "yesterday" }, earlyMorningDhaka);
    assert.equal(range.from.toISOString(), "2026-03-10T18:00:00.000Z");
    assert.equal(range.to.toISOString(), "2026-03-11T18:00:00.000Z");
  });

  test("seven days includes today, so it is seven store days", () => {
    const range = resolveRange({ range: "7d" }, earlyMorningDhaka);
    const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
    assert.equal(days, 7);
  });

  test("thirty days is the default, and unknown values fall back to it", () => {
    for (const value of [undefined, "", "last-year", "'; drop table"]) {
      const range = resolveRange({ range: value });
      assert.equal(range.preset, "30d");
      const days = Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000);
      assert.equal(days, 30);
    }
  });

  test("a custom range covers both end days inclusively", () => {
    const range = resolveRange({ range: "custom", from: "2026-03-01", to: "2026-03-03" });
    assert.equal(range.preset, "custom");
    assert.equal(range.from.toISOString(), "2026-02-28T18:00:00.000Z");
    // Exclusive bound: midnight after the 3rd, so the 3rd is included.
    assert.equal(range.to.toISOString(), "2026-03-03T18:00:00.000Z");
    assert.equal(range.fromInput, "2026-03-01");
    assert.equal(range.toInput, "2026-03-03");
  });

  test("a half-filled or reversed custom range falls back rather than breaking", () => {
    assert.equal(resolveRange({ range: "custom", from: "2026-03-01" }).preset, "30d");
    assert.equal(
      resolveRange({ range: "custom", from: "2026-03-09", to: "2026-03-01" }).preset,
      "30d",
    );
    assert.equal(resolveRange({ range: "custom", from: "nonsense", to: "x" }).preset, "30d");
  });
});

describe("the application and the database agree about events", () => {
  test("every event the browser can send is one the check constraint allows", async () => {
    const sql = await migration;
    // [^)]+ already crosses newlines; the dotAll flag is not available at this
    // project's TypeScript target.
    const constraint =
      /constraint analytics_events_known_name check \(event_name in \(([^)]+)\)\)/.exec(sql);
    assert.ok(constraint, "the event-name constraint is missing");
    const allowed = new Set(
      [...constraint[1].matchAll(/'([a-z_]+)'/g)].map((match) => match[1]),
    );

    const route = await readFile(
      new URL("../app/api/analytics/collect/route.ts", import.meta.url),
      "utf8",
    );
    const enumBlock = /name: z\.enum\(\[([^\]]+)\]\)/.exec(route);
    assert.ok(enumBlock, "the route no longer declares an event-name enum");
    const sendable = [...enumBlock[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);

    assert.ok(sendable.length >= 13, "the sendable event list looks truncated");
    for (const name of sendable) {
      assert.ok(allowed.has(name), `the database would discard "${name}"`);
    }
  });

  test("a browser may never claim a purchase", async () => {
    const route = await readFile(
      new URL("../app/api/analytics/collect/route.ts", import.meta.url),
      "utf8",
    );
    const enumBlock = /name: z\.enum\(\[([^\]]+)\]\)/.exec(route);
    assert.ok(enumBlock);
    assert.doesNotMatch(enumBlock[1], /"purchase"/);

    // The ingest function drops it too, so the route is not the only guard.
    const sql = await migration;
    const ingest = sql.slice(sql.indexOf("function public.track_analytics_events"));
    const loopList = ingest.slice(ingest.indexOf("if v_name not in ("));
    assert.doesNotMatch(loopList.slice(0, 600), /'purchase'/);
  });

  test("one purchase per order is enforced by an index, not by the caller", async () => {
    const sql = await migration;
    assert.match(
      sql,
      /create unique index if not exists analytics_events_purchase_once_idx\s+on public\.analytics_events \(order_id\)\s+where event_name = 'purchase'/,
    );
  });

  test("a purchase is recorded only against a matching order number and token", async () => {
    const sql = await migration;
    const fn = sql.slice(sql.indexOf("function public.track_analytics_purchase"));
    assert.match(fn, /o\.order_number = btrim\(p_order_number\)/);
    assert.match(fn, /o\.tracking_token = btrim\(p_tracking_token\)/);
    // No money crosses the wire: the row carries the order id and nothing else.
    assert.match(fn, /visitor_id, session_id, event_name, order_id/);
  });

  test("revenue is read from the order, so a cancellation removes it", async () => {
    const sql = await migration;
    const fn = sql.slice(sql.indexOf("function public.admin_marketing_analytics"));
    assert.match(fn, /o\.status not in \('cancelled', 'returned'\)/);
    assert.match(fn, /o\.archived_at is null/);
    assert.match(fn, /then o\.total/);
  });
});

describe("the analytics tables are not readable by customers", () => {
  test("no grant reaches anon, and select needs analytics.view", async () => {
    const sql = await migration;
    for (const table of ["analytics_visitors", "analytics_sessions", "analytics_events"]) {
      assert.match(
        sql,
        new RegExp(`revoke all on table public\\.${table} from anon, authenticated`),
        `${table} keeps a grant it should not have`,
      );
      assert.match(
        sql,
        new RegExp(`grant select on table public\\.${table} to authenticated`),
        `${table} is not readable by staff at all`,
      );
      assert.doesNotMatch(
        sql,
        new RegExp(`grant (select|insert|update|delete)[^;]*on table public\\.${table} to anon`),
        `${table} is reachable by anon`,
      );
    }
    assert.match(sql, /using \(public\.has_permission\('analytics\.view'\)\)/);
  });

  test("the dashboard function requires the permission itself", async () => {
    const sql = await migration;
    const fn = sql.slice(sql.indexOf("function public.admin_marketing_analytics"));
    assert.match(fn, /perform public\.require_permission\('analytics\.view'\)/);
    assert.match(sql, /grant execute on function public\.admin_marketing_analytics\(jsonb\) to authenticated/);
    assert.match(sql, /revoke execute on function public\.admin_marketing_analytics\(jsonb\) from public/);
  });

  test("the ingest function is the only door for an anonymous visitor", async () => {
    const sql = await migration;
    assert.match(
      sql,
      /grant execute on function public\.track_analytics_events\(jsonb\) to anon, authenticated/,
    );
    assert.match(sql, /security definer/);
  });
});

describe("the tracker's limits", () => {
  test("a batch is bounded on both sides", async () => {
    assert.equal(MAX_EVENTS_PER_BATCH, 20);
    const sql = await migration;
    // The database caps it lower than nothing and independently of the client.
    assert.match(sql, /where idx <= 25/);
  });

  test("a session ends after thirty minutes of inactivity", () => {
    assert.equal(SESSION_IDLE_MS, 30 * 60 * 1000);
  });

  test("the rate limit the route asks for is the one the database enforces", async () => {
    const route = await readFile(
      new URL("../app/api/analytics/collect/route.ts", import.meta.url),
      "utf8",
    );
    const inProcess = /guardPublicAction\("analytics", (\d+), (\d+)\)/.exec(route);
    assert.ok(inProcess, "the route no longer guards itself");

    const sql = await migration;
    const arm = /when 'analytics'\s+then allowance := (\d+); window_seconds := (\d+);/.exec(sql);
    assert.ok(arm, "consume_public_rate_limit has no analytics arm");
    assert.equal(inProcess[1], arm[1]);
    assert.equal(inProcess[2], arm[2]);
  });
});
