import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

import {
  IDENTIFIER_ALPHABET,
  ORDER_NUMBER_PATTERN,
  ORDER_NUMBER_RANDOM_LENGTH,
  REDACTED_TRACKING_PATH,
  TRACKING_TOKEN_PATTERN,
  TRACKING_TOKEN_RANDOM_LENGTH,
  isOrderNumber,
  isTrackingPagePath,
  isTrackingToken,
  normaliseOrderNumber,
  normaliseTrackingToken,
  redactTrackingPath,
  trackingPath,
  trackingUrl,
  type TrackingToken,
} from "../lib/order-identifiers";
import { parsePublicOrderTracking } from "../lib/order-tracking";
import { checkoutSchema } from "../lib/validation";
import { buildOrderNotificationEmail } from "../lib/email/templates";
import { generateOrderReceiptPdf } from "../lib/pdf/order-receipt";
import type { OrderReceiptSnapshot } from "../lib/order-receipt";

/**
 * Order numbers and tracking tokens (migration 0027).
 *
 * The identifiers are generated in PostgreSQL, so the properties that matter
 * most -- randomness source, uniqueness, collision retry, immutability, what
 * the public lookup returns -- live in SQL. Without a database, the unit suite
 * asserts them the way tests/analytics.test.ts and
 * tests/rate-limit-buckets.test.ts do: by reading the migration as text and
 * checking it says what it must. The same properties are exercised for real by
 * tests/integration/order-identifiers.test.ts and
 * supabase/tests/0027_order_identifiers.sql against a test database.
 */

const root = path.resolve(import.meta.dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const read = (...segments: string[]) => readFile(path.join(root, ...segments), "utf8");
const migration = read("supabase", "migrations", "0027_secure_order_identifiers.sql");

/** The body of `create or replace function public.<name>(` up to its closing `$$;`. */
function functionBody(sql: string, name: string): string | null {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, "i"));
  if (start === -1) return null;
  const open = sql.indexOf("$$", start);
  const close = sql.indexOf("$$;", open + 2);
  return sql.slice(start, close + 3);
}

/** SQL with its comments removed, so prose about a thing is not mistaken for the thing. */
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/** Which migration defines `name` last, and that definition. */
async function latestDefinition(name: string): Promise<{ file: string; body: string }> {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  let latest: { file: string; body: string } | null = null;
  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    // A file may redefine a function more than once; the last one wins.
    let offset = 0;
    for (;;) {
      const body = functionBody(sql.slice(offset), name);
      if (!body) break;
      latest = { file, body };
      offset += sql.slice(offset).indexOf(body) + body.length;
    }
  }
  assert.ok(latest, `no migration defines public.${name}`);
  return latest;
}

const NEW_NUMBER = "TARA-26-09-8F42K7M9Q2";
const LEGACY_NUMBER = "TARA-20260928-001042";
const NEW_TOKEN = "TRK-X7M9Q2LA84KP7N6R5BCD";
const LEGACY_TOKEN = "0123456789abcdef".repeat(3);

describe("the identifier alphabet", () => {
  test("is 32 unambiguous symbols: no 0, O, 1 or I", () => {
    assert.equal(IDENTIFIER_ALPHABET.length, 32);
    assert.equal(new Set(IDENTIFIER_ALPHABET).size, 32, "duplicate symbol");
    assert.match(IDENTIFIER_ALPHABET, /^[A-Z2-9]+$/, "uppercase letters and digits only");
    for (const confusable of ["0", "O", "1", "I"]) {
      assert.ok(!IDENTIFIER_ALPHABET.includes(confusable), `contains ${confusable}`);
    }
  });

  test("the SQL generator uses the same alphabet, lengths and prefixes", async () => {
    const sql = await migration;
    assert.match(sql, new RegExp(`alphabet constant text := '${IDENTIFIER_ALPHABET}'`));
    const orderNumber = functionBody(sql, "generate_order_number") ?? "";
    assert.match(orderNumber, new RegExp(`secure_random_code\\(${ORDER_NUMBER_RANDOM_LENGTH}\\)`));
    assert.match(orderNumber, /'TARA-'/);
    const token = functionBody(sql, "generate_tracking_token") ?? "";
    assert.match(token, new RegExp(`'TRK-' \\|\\| public\\.secure_random_code\\(${TRACKING_TOKEN_RANDOM_LENGTH}\\)`));
    assert.equal(ORDER_NUMBER_RANDOM_LENGTH, 10);
    assert.equal(TRACKING_TOKEN_RANDOM_LENGTH, 20);
  });

  test("the SQL recognisers accept exactly what the TypeScript ones accept", async () => {
    const sql = await migration;
    const sqlOrder = /p_value ~ '(\^TARA-\[0-9\]\{2\}-[^']+)'/.exec(functionBody(sql, "is_current_order_number") ?? "");
    const sqlToken = /p_value ~ '(\^TRK-[^']+)'/.exec(functionBody(sql, "is_current_tracking_token") ?? "");
    assert.ok(sqlOrder && sqlToken, "could not find the SQL patterns");
    // POSIX and JavaScript agree on these simple patterns; \d is spelled [0-9] in SQL.
    const asJs = (pattern: string) => new RegExp(pattern);
    for (const value of [NEW_NUMBER, LEGACY_NUMBER, "TARA-26-13-8F42K7M9Q2", "TARA-26-09-8F42K7M9QO", "tara-26-09-8f42k7m9q2"]) {
      assert.equal(asJs(sqlOrder[1]).test(value), ORDER_NUMBER_PATTERN.test(value), value);
    }
    for (const value of [NEW_TOKEN, LEGACY_TOKEN, "TRK-X7M9Q2LA84KP7N6R5BC", "TRK-X7M9Q2LA84KP7N6R5BC0", "trk-x7m9q2la84kp7n6r5bcd"]) {
      assert.equal(asJs(sqlToken[1]).test(value), TRACKING_TOKEN_PATTERN.test(value), value);
    }
  });
});

describe("order numbers", () => {
  test("new numbers are TARA-YY-MM-<10 symbols>", () => {
    assert.ok(isOrderNumber(NEW_NUMBER));
    assert.ok(ORDER_NUMBER_PATTERN.test(NEW_NUMBER));
    for (const bad of [
      "TARA-26-00-8F42K7M9Q2", // month 00
      "TARA-26-13-8F42K7M9Q2", // month 13
      "TARA-26-09-8F42K7M9Q", // 9 random symbols
      "TARA-26-09-8F42K7M9Q2A", // 11
      "TARA-26-09-8F42K7M9QO", // O is not in the alphabet
      "TARA-26-09-8F42K7M9Q1", // nor is 1
      "TARA-2026-09-8F42K7M9Q2",
      "TRK-26-09-8F42K7M9Q2",
      " TARA-26-09-8F42K7M9Q2",
    ]) {
      assert.equal(isOrderNumber(bad), false, bad);
    }
  });

  test("orders from before 0027 keep their numbers and are still recognised", () => {
    assert.ok(isOrderNumber(LEGACY_NUMBER));
    assert.equal(ORDER_NUMBER_PATTERN.test(LEGACY_NUMBER), false, "legacy is not the current shape");
  });

  test("a support search typed in lower case with spaces still finds the order", () => {
    assert.equal(normaliseOrderNumber("  tara-26-09-8f42k7m9q2 "), NEW_NUMBER);
    assert.equal(normaliseOrderNumber("8F42K"), null, "a fragment is not an exact order number");
    assert.equal(normaliseOrderNumber("18427"), null, "an internal id is not an order number");
    assert.equal(normaliseOrderNumber("x".repeat(500)), null);
  });
});

describe("tracking tokens", () => {
  test("new tokens are TRK-<20 symbols>; legacy tokens are 48 lowercase hex", () => {
    assert.ok(isTrackingToken(NEW_TOKEN));
    assert.ok(isTrackingToken(LEGACY_TOKEN));
    for (const bad of [
      "TRK-X7M9Q2LA84KP7N6R5BC", // 19
      "TRK-X7M9Q2LA84KP7N6R5BCDE", // 21
      "TRK-X7M9Q2LA84KP7N6R5BC0", // 0 is not in the alphabet
      "TRK-X7M9Q2LA84KP7N6R5BCI", // nor is I
      "0123456789abcdef".repeat(2), // 32 hex: the old length floor, not a real token
      LEGACY_TOKEN.toUpperCase(),
      "",
    ]) {
      assert.equal(isTrackingToken(bad), false, bad);
    }
  });

  test("the internal id, an order number or a sequential number is never a token", () => {
    for (const notAToken of [
      "16de7294-88bb-486e-95b5-fd8cbea83c0a",
      "16de729488bb486e95b5fd8cbea83c0a",
      "18427",
      NEW_NUMBER,
      LEGACY_NUMBER,
    ]) {
      assert.equal(isTrackingToken(notAToken), false, notAToken);
      assert.equal(normaliseTrackingToken(notAToken), null, notAToken);
    }
  });

  test("a pasted link, a lower-case token or stray whitespace normalise to the exact token", () => {
    assert.equal(normaliseTrackingToken(`  ${NEW_TOKEN.toLowerCase()} `), NEW_TOKEN);
    assert.equal(normaliseTrackingToken(`https://www.tarabd.co/track/${NEW_TOKEN}`), NEW_TOKEN);
    assert.equal(normaliseTrackingToken(`https://www.tarabd.co/track/${NEW_TOKEN}/?utm_source=email`), NEW_TOKEN);
    assert.equal(normaliseTrackingToken(`/track/${LEGACY_TOKEN.toUpperCase()}`), LEGACY_TOKEN);
  });

  test("malformed input is refused before any lookup", () => {
    for (const hostile of [
      null,
      undefined,
      42,
      "TRK-%",
      "TRK-%E0%A4%A",
      "TRK-X7M9Q2%", // no wildcard ever reaches SQL
      "TRK-X7M9Q2LA84KP7N6R5BCD' or '1'='1",
      `TRK-${"A".repeat(5000)}`,
      "/track/",
    ]) {
      assert.equal(normaliseTrackingToken(hostile), null, String(hostile).slice(0, 40));
    }
  });

  test("the public URL is /track/<token> and uses the configured origin", () => {
    const token = NEW_TOKEN as TrackingToken;
    assert.equal(trackingPath(token), `/track/${NEW_TOKEN}`);
    assert.equal(trackingUrl("https://www.tarabd.co/", token), `https://www.tarabd.co/track/${NEW_TOKEN}`);
  });
});

describe("the tracking URL never reaches analytics", () => {
  test("tracking paths are redacted; every other path is untouched", () => {
    assert.equal(redactTrackingPath(`/track/${NEW_TOKEN}`), REDACTED_TRACKING_PATH);
    assert.equal(redactTrackingPath(`/track/${LEGACY_TOKEN}`), REDACTED_TRACKING_PATH);
    assert.equal(redactTrackingPath("/track-order"), "/track-order");
    assert.equal(redactTrackingPath("/two-piece"), "/two-piece");
    assert.ok(isTrackingPagePath(`/track/${NEW_TOKEN}`));
    assert.equal(isTrackingPagePath("/track-order"), false);
  });

  test("first-party collection redacts on both sides, and third-party tags stay off the page", async () => {
    const [client, route, tags] = await Promise.all([
      read("lib", "analytics", "client.ts"),
      read("app", "api", "analytics", "collect", "route.ts"),
      read("components", "analytics", "MarketingTags.tsx"),
    ]);
    assert.match(client, /path: redactTrackingPath\(event\.path \?\? window\.location\.pathname\)/);
    assert.match(client, /landingPath: redactTrackingPath\(window\.location\.pathname\)/);
    assert.match(client, /!isTrackingPagePath\(path\)\) sendPageViewToPixels/);
    assert.match(route, /path: z\.string\(\)\.max\(300\)\.transform\(redactTrackingPath\)/);
    assert.match(route, /landingPath: z\.string\(\)\.max\(300\)\.transform\(redactTrackingPath\)/);
    assert.match(tags, /if \(isTrackingPagePath\(pathname \?\? ""\)\) return null;/);
  });

  test("the tracking page is not indexed and sends no referrer", async () => {
    const [page, robots] = await Promise.all([
      read("app", "track", "[token]", "page.tsx"),
      read("app", "robots.ts"),
    ]);
    assert.match(page, /robots: \{ index: false, follow: false/);
    assert.match(page, /referrer: "no-referrer"/);
    assert.match(robots, /"\/track\/"/);
  });
});

describe("the public tracking response", () => {
  const fromDatabase = {
    orderNumber: NEW_NUMBER,
    status: "shipped",
    placedAt: "2026-09-28T14:15:00Z",
    updatedAt: "2026-09-29T09:00:00Z",
    paymentMethod: "cash_on_delivery",
    deliveryZone: "inside_sylhet",
    total: "3810.00",
    currency: "BDT",
    items: [{ productName: "Kurta", size: "M", colour: "Wine", quantity: 2, imageUrl: "https://cdn.example.com/k.jpg" }],
    events: [
      { status: "pending", note: "Order placed", createdAt: "2026-09-28T14:15:00Z" },
      { status: "shipped", note: null, createdAt: "2026-09-29T09:00:00Z" },
    ],
  };

  test("parses the allowlisted snapshot", () => {
    const parsed = parsePublicOrderTracking(fromDatabase);
    assert.ok(parsed);
    assert.equal(parsed.orderNumber, NEW_NUMBER);
    assert.equal(parsed.status, "shipped");
    assert.equal(parsed.total, 3810);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.events.length, 2);
  });

  test("drops every field it was not told about, even if the database sends it", () => {
    const leaky = {
      ...fromDatabase,
      id: "16de7294-88bb-486e-95b5-fd8cbea83c0a",
      userId: "8c1c3f55-6f3b-4c43-9a51-0d7f27c8e0a1",
      customerName: "Ayesha Rahman",
      customerEmail: "ayesha@example.com",
      customerPhone: "01712345678",
      shippingAddress: { address: "House 12" },
      trackingToken: NEW_TOKEN,
      idempotencyKey: "k",
      clientFingerprint: "f",
      riskFlags: ["guest_checkout"],
      items: [{ ...fromDatabase.items[0], sku: "SECRET-SKU", unitPrice: 1 }],
      events: [{ ...fromDatabase.events[0], internalNote: "call back" }],
    };
    const serialised = JSON.stringify(parsePublicOrderTracking(leaky));
    for (const secret of [
      "16de7294", "8c1c3f55", "Ayesha", "ayesha@", "01712345678", "House 12",
      NEW_TOKEN, "idempotency", "fingerprint", "guest_checkout", "SECRET-SKU", "call back",
    ]) {
      assert.ok(!serialised.includes(secret), `leaked ${secret}`);
    }
  });

  test("rejects a snapshot without a recognisable order number or status", () => {
    assert.equal(parsePublicOrderTracking(null), null);
    assert.equal(parsePublicOrderTracking({ ...fromDatabase, orderNumber: "18427" }), null);
    assert.equal(parsePublicOrderTracking({ ...fromDatabase, status: "out_for_delivery" }), null);
    assert.equal(parsePublicOrderTracking({ ...fromDatabase, status: "constructor" }), null);
  });

  test("only https product images are kept", () => {
    const parsed = parsePublicOrderTracking({
      ...fromDatabase,
      items: [{ ...fromDatabase.items[0], imageUrl: "javascript:alert(1)" }],
    });
    assert.equal(parsed?.items[0].imageUrl, null);
  });
});

describe("the browser cannot choose an identifier", () => {
  test("order number and tracking token sent with a checkout are dropped by validation", () => {
    const parsed = checkoutSchema.safeParse({
      customerName: "Ayesha Rahman",
      customerEmail: "ayesha@example.com",
      customerPhone: "+880 1712 345678",
      shippingAddress: {
        address: "House 12, Road 3, Batortal Bazar",
        apartment: "",
        city: "Sylhet",
        postalCode: "3100",
        deliveryZone: "inside_sylhet",
      },
      items: [{ variantId: "3f1e9a6c-1d2b-4c3a-9e5f-6a7b8c9d0e1f", quantity: 2 }],
      orderNumber: "TARA-26-09-AAAAAAAAAA",
      order_number: "TARA-26-09-AAAAAAAAAA",
      trackingToken: "TRK-AAAAAAAAAAAAAAAAAAAA",
      tracking_token: "TRK-AAAAAAAAAAAAAAAAAAAA",
      id: "16de7294-88bb-486e-95b5-fd8cbea83c0a",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    for (const key of ["orderNumber", "order_number", "trackingToken", "tracking_token", "id"]) {
      assert.equal(key in parsed.data, false, `${key} survived validation`);
    }
  });

  test("the checkout action passes nothing identifier-shaped to place_order", async () => {
    const action = await read("lib", "supabase", "actions", "checkout.ts");
    const call = action.slice(action.indexOf('supabase.rpc("place_order"'), action.indexOf("if (error) {", action.indexOf('supabase.rpc("place_order"')));
    assert.ok(call.length > 0);
    assert.doesNotMatch(call, /order_?number|tracking_?token|p_order|p_tracking/i);
  });

  test("place_order has no parameter through which one could be supplied", async () => {
    const { body } = await latestDefinition("place_order");
    const signature = body.slice(0, body.indexOf(")"));
    assert.doesNotMatch(signature, /order_number|tracking|\bp_id\b|\bp_order_id\b/i);
  });

  test("no client role can write an order row", async () => {
    const sql = await migration;
    assert.match(sql, /revoke insert, update, delete on table public\.orders from anon, authenticated;/);
    // The baseline once granted UPDATE to authenticated; 0002 and 0012 revoked
    // it. What matters is the net effect in migration order: the last statement
    // to touch client write access on orders must be a REVOKE.
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    let last: { kind: "grant" | "revoke"; file: string; statement: string } | null = null;
    for (const file of files) {
      // Statement by statement, comments removed: prose must not match.
      const statements = stripComments(await readFile(path.join(migrationsDir, file), "utf8")).split(";");
      for (const statement of statements) {
        const kind = /^\s*(grant|revoke)\b/i.exec(statement)?.[1].toLowerCase() as "grant" | "revoke" | undefined;
        if (!kind) continue;
        const privileges = statement.slice(0, statement.search(/\bon\b/i));
        if (
          /\b(insert|update|delete|all)\b/i.test(privileges) &&
          /\bon\s+(table\s+)?[^;]*\bpublic\.orders\b/i.test(statement) &&
          /\b(to|from)\b[^;]*\b(anon|authenticated|public)\b/i.test(statement)
        ) {
          last = { kind, file, statement: statement.trim() };
        }
      }
    }
    assert.ok(last, "no statement governs client write access to orders");
    assert.equal(last.kind, "revoke", `${last.file} leaves client write access: ${last.statement}`);
  });
});

describe("migration 0027: generation", () => {
  test("randomness comes from gen_random_uuid(), never random() or Math.random()", async () => {
    const sql = stripComments(await migration);
    const generator = functionBody(sql, "secure_random_code") ?? "";
    assert.match(generator, /pg_catalog\.gen_random_uuid\(\)/);
    assert.match(generator, /continue when i = 6;/, "the UUID version byte must be skipped");
    assert.match(generator, /get_byte\(raw, i\) & 31/, "five bits per symbol: no modulo bias");
    assert.doesNotMatch(sql, /[^_]random\(\)/, "PostgreSQL random() is not cryptographically secure");
    assert.doesNotMatch(sql, /nextval\(/, "no sequence may feed an identifier");

    for (const file of [
      ["lib", "order-identifiers.ts"],
      ["lib", "order-tracking.ts"],
      ["lib", "supabase", "actions", "checkout.ts"],
      ["lib", "supabase", "queries", "tracking.ts"],
    ]) {
      assert.doesNotMatch(await read(...file), /Math\.random/, file.join("/"));
    }
  });

  test("the order number takes YY-MM from the store's time zone and nothing else about the order", async () => {
    const body = functionBody(await migration, "generate_order_number") ?? "";
    assert.match(body, /at time zone 'Asia\/Dhaka', 'YY-MM'/);
    assert.match(body, /\(p_created_at timestamptz default now\(\)\)/, "its only input is a timestamp");
  });

  test("the tracking token takes no input at all", async () => {
    const body = functionBody(await migration, "generate_tracking_token") ?? "";
    assert.match(body, /generate_tracking_token\(\)/);
  });

  test("the old sequential generator is removed, not left beside the new one", async () => {
    assert.match(await migration, /drop function if exists public\.generate_order_number\(\);/);
  });

  test("clients cannot call the generators", async () => {
    const sql = await migration;
    for (const signature of [
      "secure_random_code\\(integer\\)",
      "generate_order_number\\(timestamptz\\)",
      "generate_tracking_token\\(\\)",
      "is_order_identifier_constraint\\(text\\)",
      "orders_identifiers_guard\\(\\)",
    ]) {
      assert.match(sql, new RegExp(`revoke execute on function public\\.${signature} from public, anon, authenticated;`), signature);
    }
  });
});

describe("migration 0027: place_order()", () => {
  test("0027 holds the current definition of every function it changes", async () => {
    for (const name of [
      "place_order",
      "get_order_tracking",
      "get_guest_order_tracking",
      "claim_order_notifications",
      "get_customer_receipt",
      "generate_order_number",
    ]) {
      const { file } = await latestDefinition(name);
      assert.equal(file, "0027_secure_order_identifiers.sql", `${name} is redefined later in ${file}`);
    }
  });

  test("is 0026 exactly, apart from where the identifiers are drawn and the insert retried", async () => {
    const previous = functionBody(await read("supabase", "migrations", "0026_launch_offer_and_first_party_analytics.sql"), "place_order") ?? "";
    const current = (await latestDefinition("place_order")).body;
    const normalise = (text: string) => stripComments(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n");

    // Everything before the token declaration, and everything after the insert,
    // must be unchanged.
    const before = (text: string) => normalise(text.slice(0, text.indexOf("new_tracking_token text")));
    const after = (text: string) => normalise(text.slice(text.indexOf("if coupon_result is not null then", text.indexOf("insert into public.orders ("))));
    assert.equal(before(current), before(previous), "the start of place_order changed");
    assert.equal(after(current), after(previous), "the end of place_order changed");

    // And between them, only the identifier work changed: the pricing, stock and
    // offer logic in the middle is identical too.
    const middle = (text: string) =>
      normalise(text.slice(text.indexOf("current_user_id uuid := auth.uid();"), text.indexOf("insert into public.orders (")))
        .split("\n")
        .filter((line) => !/new_order_number := public\.generate_order_number/.test(line));
    const previousMiddle = middle(previous);
    const currentMiddle = middle(current);
    const added = currentMiddle.filter((line) => !previousMiddle.includes(line));
    for (const line of added) {
      assert.match(
        line,
        /^(\/\*|\*|loop$|begin$|identifier_attempt|new_order_number := public\.generate_order_number\(now\(\)\);|new_tracking_token := public\.generate_tracking_token\(\);)/,
        `unexpected new line in place_order: ${line}`,
      );
    }
    const removed = previousMiddle.filter((line) => !currentMiddle.includes(line));
    assert.deepEqual(removed, [], "place_order lost logic between the declarations and the insert");
  });

  test("the idempotent replay returns the stored identifiers before anything is generated", async () => {
    const { body } = await latestDefinition("place_order");
    const replay = body.indexOf("from public.orders where idempotency_key = p_idempotency_key");
    const generation = body.indexOf("public.generate_order_number(");
    assert.ok(replay > 0 && generation > replay);
    const replayBlock = body.slice(replay, body.indexOf("end if;", body.indexOf("end if;", replay) + 1));
    assert.match(replayBlock, /'orderNumber', existing_order\.order_number/);
    assert.match(replayBlock, /'trackingToken', existing_order\.tracking_token/);
    assert.match(replayBlock, /'replayed', true/);
  });

  test("identifiers are drawn after stock is locked and inside the same transaction as the insert", async () => {
    const { body } = await latestDefinition("place_order");
    const lock = body.indexOf("for update of v");
    const draw = body.indexOf("new_order_number := public.generate_order_number(now())");
    const insert = body.indexOf("insert into public.orders (");
    const items = body.indexOf("insert into public.order_items (");
    assert.ok(lock > 0 && lock < draw && draw < insert && insert < items);
    assert.doesNotMatch(body, /\bcommit\b/i, "place_order must not commit part-way");
    // No update of the identifiers after the insert: they are written once.
    assert.doesNotMatch(body, /update public\.orders\s+set\s+(order_number|tracking_token)/i);
  });

  test("only an identifier collision is retried, a bounded number of times", async () => {
    const { body } = await latestDefinition("place_order");
    const loop = body.slice(body.indexOf("  loop\n    identifier_attempt"), body.indexOf("end loop;", body.indexOf("identifier_attempt := identifier_attempt + 1")));
    assert.match(loop, /exception when unique_violation then/);
    assert.match(loop, /get stacked diagnostics violated_constraint = constraint_name;/);
    assert.match(loop, /if identifier_attempt >= 5\s+or not public\.is_order_identifier_constraint\(violated_constraint\) then\s+raise;/);
    assert.doesNotMatch(loop, /when others/, "unrelated errors must not be swallowed");
    assert.doesNotMatch(loop, /select[^;]*from public\.orders[^;]*where order_number =/i, "no check-then-insert");
  });

  test("the collision check matches the unique index on either column, whatever its name", async () => {
    const body = functionBody(await migration, "is_order_identifier_constraint") ?? "";
    assert.match(body, /i\.indisunique/);
    assert.match(body, /a\.attname in \('order_number', 'tracking_token'\)/);
  });
});

describe("migration 0027: constraints, immutability, existing orders", () => {
  test("both columns are NOT NULL and have a single-column unique index", async () => {
    const sql = await migration;
    assert.match(sql, /alter table public\.orders alter column order_number set not null;/);
    assert.match(sql, /alter table public\.orders alter column tracking_token set not null;/);
    assert.match(sql, /foreach target in array array\['order_number', 'tracking_token'\]/);
    assert.match(sql, /'alter table public\.orders add constraint %I unique \(%I\)'/);
  });

  test("missing values are back-filled before NOT NULL, from the order's own month and fresh randomness", async () => {
    const sql = await migration;
    const backfill = sql.indexOf("set order_number = public.generate_order_number(missing.created_at)");
    const tokenFill = sql.indexOf("set tracking_token = public.generate_tracking_token()");
    const notNull = sql.indexOf("alter column order_number set not null");
    assert.ok(backfill > 0 && tokenFill > 0 && backfill < notNull && tokenFill < notNull);
    // Only rows that have no value: existing numbers and tokens are never rewritten.
    assert.match(sql, /select id, created_at from public\.orders where order_number is null/);
    assert.match(sql, /select id from public\.orders where tracking_token is null/);
  });

  test("there is no CHECK constraint that legacy rows could fail on update", async () => {
    assert.doesNotMatch(await migration, /add constraint[^;]*check\s*\(/i);
  });

  test("a trigger makes both identifiers immutable and new rows use the new shapes", async () => {
    const sql = await migration;
    const guard = functionBody(sql, "orders_identifiers_guard") ?? "";
    assert.match(guard, /new\.order_number is distinct from old\.order_number/);
    assert.match(guard, /new\.tracking_token is distinct from old\.tracking_token/);
    assert.match(guard, /raise exception 'order_identifiers_immutable'/);
    assert.match(guard, /if not public\.is_current_order_number\(new\.order_number\) then/);
    assert.match(guard, /if not public\.is_current_tracking_token\(new\.tracking_token\) then/);
    assert.match(sql, /create trigger orders_identifiers_guard\s+before insert or update on public\.orders/);
    // Created after the back-fill, so filling a missing value is not an "update".
    assert.ok(sql.indexOf("create trigger orders_identifiers_guard") > sql.indexOf("alter column tracking_token set not null"));
  });
});

describe("migration 0027: lookups by token", () => {
  test("the public lookup validates the token and matches it exactly", async () => {
    const body = functionBody(await migration, "get_order_tracking") ?? "";
    assert.match(body, /security definer\s+set search_path = ''/);
    assert.match(body, /where public\.is_valid_tracking_token\(p_tracking_token\)\s+and o\.tracking_token = p_tracking_token;/);
    assert.doesNotMatch(body, /\blike\b|\bilike\b|~\*|similar to|lower\(|upper\(/i, "no fuzzy or partial matching");
  });

  test("the public lookup returns only allowlisted fields", async () => {
    const body = functionBody(await migration, "get_order_tracking") ?? "";
    const keys = [...body.matchAll(/'([a-zA-Z]+)',\s/g)].map((match) => match[1]);
    assert.deepEqual(
      [...new Set(keys)].sort(),
      ["colour", "createdAt", "currency", "deliveryZone", "events", "imageUrl", "items", "note", "orderNumber", "paymentMethod", "placedAt", "productName", "quantity", "size", "status", "total", "updatedAt"].sort(),
    );
    for (const column of [
      "user_id", "customer_name", "customer_email", "customer_phone", "normalized_phone",
      "o.shipping_address,", "idempotency_key", "client_fingerprint", "risk_flags", "o.tracking_token,",
      "order_internal_notes", "customer_note",
    ]) {
      assert.ok(!body.includes(column), `get_order_tracking reads ${column}`);
    }
    assert.match(body, /where e\.order_id = o\.id and e\.is_customer_visible/);
    // The id joins the tables; no output key ever names it.
    assert.doesNotMatch(body, /'id',|'orderId',|'userId',/);
  });

  test("the form lookup returns the same allowlist and no longer the name or address", async () => {
    const body = functionBody(await migration, "get_guest_order_tracking") ?? "";
    assert.match(body, /select public\.get_order_tracking\(o\.tracking_token\)/);
    assert.doesNotMatch(body, /customer_name|shipping_address/);
  });

  test("no token check still assumes a 32-character minimum", async () => {
    const sql = await migration;
    for (const name of ["claim_order_notifications", "get_customer_receipt", "get_guest_order_tracking", "get_order_tracking"]) {
      const body = functionBody(sql, name) ?? "";
      assert.doesNotMatch(body, /length\([^)]*tracking_token[^)]*\)\)?\s*(>=|<)\s*32/, name);
      assert.match(body, /is_valid_tracking_token/, name);
    }
    const action = await read("lib", "supabase", "actions", "analytics.ts");
    assert.doesNotMatch(action, /trackingToken: z\.string\(\)\.trim\(\)\.min\(32\)/);
  });

  test("a token in a URL no longer unlocks the full receipt after the first hour", async () => {
    const body = functionBody(await migration, "get_customer_receipt") ?? "";
    assert.match(body, /and o\.created_at > now\(\) - interval '1 hour'/);
    // The signed-in owner's path is unchanged.
    assert.match(body, /\(auth\.uid\(\) is not null and o\.user_id = auth\.uid\(\)\)/);
  });

  test("anonymous visitors can call the lookup and nothing else new", async () => {
    const sql = await migration;
    assert.match(sql, /grant execute on function public\.get_order_tracking\(text\) to anon, authenticated;/);
    assert.doesNotMatch(sql, /create policy[^;]*on public\.orders/i, "no new RLS policy on orders");
  });
});

describe("customer and staff surfaces use the order number", () => {
  const snapshot: OrderReceiptSnapshot = {
    order: {
      id: "16de7294-88bb-486e-95b5-fd8cbea83c0a",
      orderNumber: NEW_NUMBER,
      createdAt: "2026-09-28T14:15:00Z",
      customerName: "Ayesha Rahman",
      customerEmail: "ayesha@example.com",
      customerPhone: "01712345678",
      shippingAddress: { address: "House 12, Road 3", city: "Sylhet", deliveryZone: "inside_sylhet" },
      status: "shipped",
      paymentMethod: "cash_on_delivery",
      subtotal: "3850.00",
      deliveryFee: "60.00",
      discountAmount: "100.00",
      total: "3810.00",
      currency: "BDT",
      trackingToken: NEW_TOKEN,
    },
    items: [{
      id: "item-1", productId: "product-1", productName: "Kurta", productCode: "TARA-001",
      sku: "TARA-001-M-WINE", size: "M", colour: "Wine", unitPrice: "1925.00", quantity: 2, lineTotal: "3850.00",
    }],
  };
  const store = { storeName: "TARA", supportEmail: "support@tarabd.co", supportPhone: "01700000000" } as never;

  test("customer emails link to /track/<token> on the public origin and never print the token alone", () => {
    for (const template of ["order_placed", "order_confirmed", "order_shipped", "order_delivered", "order_cancelled"]) {
      const email = buildOrderNotificationEmail(template, "ayesha@example.com", snapshot, store);
      assert.ok(email, template);
      assert.match(email.subject, new RegExp(NEW_NUMBER), template);
      assert.match(email.text, new RegExp(`https://[^\\s]+/track/${NEW_TOKEN}`), template);
      assert.doesNotMatch(email.text, /localhost|Tracking token:/, template);
      assert.doesNotMatch(email.text, /16de7294-88bb/, `${template} shows the internal id`);
      assert.match(email.html ?? "", new RegExp(`href="https://[^"]+/track/${NEW_TOKEN}"`), template);
    }
  });

  test("the staff new-order email never carries the token", () => {
    const admin = buildOrderNotificationEmail("admin_new_order", "owner@example.com", snapshot, store);
    assert.ok(admin);
    assert.match(admin.subject, new RegExp(NEW_NUMBER));
    assert.doesNotMatch(`${admin.text}${admin.html}`, new RegExp(NEW_TOKEN));
    assert.doesNotMatch(`${admin.text}${admin.html}`, /\/track\//);
  });

  test("the PDF receipt is titled with the order number", async () => {
    const document = await PDFDocument.load(await generateOrderReceiptPdf(snapshot, store));
    assert.equal(document.getTitle(), `TARA Order ${NEW_NUMBER}`);
  });

  test("invoice, packing slip, account and admin pages show order_number, and printouts never load the token", async () => {
    const [invoice, slip, account, history, adminOrder, adminQueries] = await Promise.all([
      read("app", "admin", "orders", "[id]", "invoice", "page.tsx"),
      read("app", "admin", "orders", "[id]", "packing-slip", "page.tsx"),
      read("app", "account", "orders", "[orderNumber]", "page.tsx"),
      read("components", "forms", "OrderHistoryClient.tsx"),
      read("app", "admin", "orders", "[id]", "page.tsx"),
      read("lib", "supabase", "queries", "admin.ts"),
    ]);
    assert.match(invoice, /\{order\.order_number\}/);
    assert.match(slip, /\{order\.order_number\}/);
    assert.match(account, /\{result\.order\.order_number\}/);
    assert.match(history, /\{order\.order_number\}/);
    assert.match(adminOrder, /title=\{order\.order_number\}/);
    for (const page of [invoice, slip, account, history]) {
      assert.doesNotMatch(page, />\s*\{[a-z.]*order\.id\}\s*</, "an internal id is rendered as text");
    }
    const print = adminQueries.slice(adminQueries.indexOf("export async function getOrderForPrint"));
    assert.doesNotMatch(print.slice(0, print.indexOf(".eq(")), /tracking_token/);
  });

  test("admin search treats a complete order number as an exact match", async () => {
    const queries = await read("lib", "supabase", "queries", "admin.ts");
    assert.match(queries, /const exactOrderNumber = normaliseOrderNumber\(filters\.search\);/);
    assert.match(queries, /if \(exactOrderNumber\) query = query\.eq\("order_number", exactOrderNumber\);/);
  });
});
