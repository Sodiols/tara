import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { PRODUCTION_ORIGIN, parseOrigin, resolveSiteOrigin } from "../lib/site-url";

/**
 * The site origin feeds canonical URLs, Open Graph, JSON-LD, robots.txt, the
 * sitemap and every Supabase auth email. These pin the one rule that matters:
 * a production build never publishes a local or malformed origin.
 *
 * The failure this guards was observed, not imagined — a `next build` with the
 * developer's `NEXT_PUBLIC_SITE_URL=http://localhost:3000` produced
 * `Host: http://localhost:3000` in robots.txt and a sitemap whose every <loc>
 * pointed at localhost, while auth links in the same build were correct.
 */

describe("a production build never publishes a local origin", () => {
  for (const configured of [
    "http://localhost:3000",
    "http://localhost",
    "https://localhost:8443",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://[::1]:3000",
    "http://tara.localhost:3000",
    "http://my-mac.local:3000",
  ]) {
    test(`${configured} falls back to the real domain`, () => {
      const { origin, problem } = resolveSiteOrigin({ configured, nodeEnv: "production" });
      assert.equal(origin, PRODUCTION_ORIGIN);
      assert.ok(problem?.includes("a local address"), "the fallback must be explained");
    });
  }

  test("an unset value falls back and says so", () => {
    for (const configured of [undefined, "", "   "]) {
      const { origin, problem } = resolveSiteOrigin({ configured, nodeEnv: "production" });
      assert.equal(origin, PRODUCTION_ORIGIN);
      assert.ok(problem?.includes("not set"));
    }
  });

  test("a value that is not an absolute URL is treated as absent, not concatenated", () => {
    // `tarabd.co` without a scheme would otherwise become "tarabd.co/two-piece"
    // as a canonical — a relative URL that resolves against whatever page it
    // is read from.
    for (const configured of ["tarabd.co", "www.tarabd.co", "not a url", "ftp://tarabd.co"]) {
      const { origin, problem } = resolveSiteOrigin({ configured, nodeEnv: "production" });
      assert.equal(origin, PRODUCTION_ORIGIN, configured);
      assert.ok(problem?.includes("not a valid absolute URL"), configured);
    }
  });
});

describe("a correctly configured origin is always used", () => {
  test("in production", () => {
    assert.deepEqual(
      resolveSiteOrigin({ configured: "https://www.tarabd.co", nodeEnv: "production" }),
      { origin: "https://www.tarabd.co", problem: null },
    );
  });

  test("a staging origin is respected rather than overridden", () => {
    // The fallback exists for mistakes. A deliberate non-production host — a
    // Vercel preview, a staging domain — must not be silently rewritten to the
    // live shop, or its canonical URLs would claim to be production.
    assert.equal(
      resolveSiteOrigin({ configured: "https://staging.tarabd.co", nodeEnv: "production" }).origin,
      "https://staging.tarabd.co",
    );
  });

  test("trailing slashes and paths are stripped to a bare origin", () => {
    assert.equal(parseOrigin("https://www.tarabd.co/"), "https://www.tarabd.co");
    assert.equal(parseOrigin("https://www.tarabd.co///"), "https://www.tarabd.co");
    assert.equal(parseOrigin("  https://www.tarabd.co/shop  "), "https://www.tarabd.co");
  });
});

describe("development keeps working locally", () => {
  test("a local origin is honoured outside production", () => {
    assert.deepEqual(
      resolveSiteOrigin({ configured: "http://localhost:3000", nodeEnv: "development" }),
      { origin: "http://localhost:3000", problem: null },
    );
  });

  test("unset outside production: auth returns to the dev server", () => {
    // A developer who has not set the variable is signing in on their own
    // machine and must be sent back to it.
    for (const nodeEnv of ["development", "test"]) {
      assert.equal(
        resolveSiteOrigin({ configured: undefined, nodeEnv, unsetOutsideProduction: "dev-server" })
          .origin,
        "http://localhost:3000",
      );
    }
  });

  test("unset outside production: public identity still names the real site", () => {
    // Canonicals, OG and JSON-LD have always defaulted to the real domain; a
    // preview whose canonical is www.tarabd.co harms nothing.
    assert.equal(
      resolveSiteOrigin({ configured: undefined, nodeEnv: "development" }).origin,
      PRODUCTION_ORIGIN,
    );
  });

  test("the two defaults never differ in a production build", () => {
    for (const configured of [undefined, "", "http://localhost:3000", "garbage", "https://www.tarabd.co"]) {
      const site = resolveSiteOrigin({ configured, nodeEnv: "production", unsetOutsideProduction: "production-origin" });
      const auth = resolveSiteOrigin({ configured, nodeEnv: "production", unsetOutsideProduction: "dev-server" });
      assert.equal(site.origin, auth.origin, String(configured));
    }
  });
});
