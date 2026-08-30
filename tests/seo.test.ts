import test, { describe } from "node:test";
import assert from "node:assert/strict";

import {
  NOINDEX_FOLLOW,
  NOINDEX_NOFOLLOW,
  SCHEMA_IDS,
  absoluteUrl,
  breadcrumbSchema,
  buildMetadata,
  hasCatalogueParams,
  listingMetadata,
  metaDescription,
  postalAddress,
  websiteSchema,
} from "../lib/seo";
import { jsonLd } from "../lib/json-ld";
import { imageAlt, primaryImageAlt } from "../lib/product-media";
import { siteConfig } from "../data/site";

/**
 * SEO regressions.
 *
 * Every assertion here corresponds to something that was actually wrong in this
 * codebase, not to SEO theory. The canonical tests exist because the root
 * layout's canonical was being inherited by every page; the noindex tests
 * because filtered catalogue URLs were as indexable as the clean category page;
 * the alt-text and override tests because three database columns were editable
 * in the admin panel and had no effect on the live site.
 */

const canonicalOf = (metadata: ReturnType<typeof buildMetadata>) =>
  metadata.alternates?.canonical;

describe("canonical URLs", () => {
  test("every page canonical is absolute and on the production host", () => {
    for (const path of ["/", "/about", "/three-piece", "/product/silk-kameez"]) {
      const url = absoluteUrl(path);
      assert.ok(url.startsWith("https://"), `${path} must be https`);
      assert.ok(url.startsWith(siteConfig.url), `${path} must use the canonical host`);
      assert.ok(!url.includes("//", 8), `${path} must not contain a doubled slash`);
    }
  });

  test("the homepage canonical keeps its trailing slash and others do not", () => {
    assert.equal(absoluteUrl("/"), `${siteConfig.url}/`);
    assert.equal(absoluteUrl("/about"), `${siteConfig.url}/about`);
  });

  test("a page canonicalises to itself, never to the homepage", () => {
    // The bug this replaces: app/layout.tsx set alternates.canonical to the
    // site root, so /about, /size-guide and /privacy-policy all told Google
    // they were duplicates of the homepage.
    const about = buildMetadata({ title: "About Us", description: "d", path: "/about" });
    assert.equal(canonicalOf(about), `${siteConfig.url}/about`);
    assert.notEqual(canonicalOf(about), siteConfig.url);
  });

  test("an absolute URL passed in is left alone", () => {
    assert.equal(absoluteUrl("https://cdn.example.com/a.jpg"), "https://cdn.example.com/a.jpg");
  });
});

describe("Open Graph and Twitter", () => {
  test("og:url matches the page's own canonical", () => {
    // Pages defined no openGraph at all, so they inherited the root layout's —
    // and advertised the homepage URL and title when shared.
    const meta = buildMetadata({ title: "Hijab", description: "d", path: "/hijab" });
    assert.equal(meta.openGraph?.url, `${siteConfig.url}/hijab`);
    assert.equal(canonicalOf(meta), meta.openGraph?.url);
  });

  test("the social title carries the brand even when the tab title does not", () => {
    const meta = buildMetadata({ title: "Hijab", description: "d", path: "/hijab" });
    assert.equal(meta.openGraph?.title, "Hijab | TARA");
    assert.equal(meta.twitter?.title, "Hijab | TARA");
    // The document title stays unbranded: the root template appends "| TARA".
    assert.equal(meta.title, "Hijab");
  });

  test("an absolute title is not branded twice", () => {
    // A staff-written SEO title that already says TARA must not become
    // "TARA Silk Kameez | TARA".
    const meta = buildMetadata({
      title: "TARA Silk Kameez",
      description: "d",
      path: "/product/silk-kameez",
      absoluteTitle: true,
    });
    assert.deepEqual(meta.title, { absolute: "TARA Silk Kameez" });
    assert.equal(meta.openGraph?.title, "TARA Silk Kameez");
  });

  test("relative image paths become absolute, and Twitter takes the first", () => {
    const meta = buildMetadata({
      title: "T", description: "d", path: "/p",
      images: ["/images/a.jpg", "https://cdn.example.com/b.jpg"],
    });
    assert.deepEqual(meta.openGraph?.images, [
      `${siteConfig.url}/images/a.jpg`,
      "https://cdn.example.com/b.jpg",
    ]);
    assert.deepEqual(meta.twitter?.images, [`${siteConfig.url}/images/a.jpg`]);
  });

  test("no image keys are emitted when there is no image", () => {
    // An empty images array renders an empty og:image, which is worse than none.
    const meta = buildMetadata({ title: "T", description: "d", path: "/p" });
    assert.equal("images" in (meta.openGraph ?? {}), false);
    assert.equal("images" in (meta.twitter ?? {}), false);
  });
});

describe("faceted navigation is not indexable", () => {
  test("a clean category URL is indexable", () => {
    const meta = listingMetadata({
      title: "Hijab", description: "d", path: "/hijab", searchParams: {},
    });
    assert.equal(meta.robots, undefined, "the clean category page must stay indexable");
    assert.equal(canonicalOf(meta), `${siteConfig.url}/hijab`);
  });

  test("every filter, sort and page parameter triggers noindex", () => {
    for (const key of [
      "q", "price", "size", "colour", "fabric", "collection",
      "availability", "sale", "new", "sort", "page",
    ]) {
      assert.equal(hasCatalogueParams({ [key]: "x" }), true, `${key} should be a filter`);
      const meta = listingMetadata({
        title: "Hijab", description: "d", path: "/hijab", searchParams: { [key]: "x" },
      });
      assert.deepEqual(meta.robots, NOINDEX_FOLLOW, `${key} must be noindex`);
      // The canonical still points at the clean page, so its signals consolidate.
      assert.equal(canonicalOf(meta), `${siteConfig.url}/hijab`);
    }
  });

  test("noindex keeps follow, so product links are still discovered", () => {
    assert.equal(NOINDEX_FOLLOW.follow, true);
    assert.equal(NOINDEX_FOLLOW.index, false);
    assert.equal(NOINDEX_NOFOLLOW.follow, false);
  });

  test("tracking parameters do NOT make a page noindex", () => {
    // A customer arriving from an ad campaign must land on the same indexable
    // page as everyone else; the canonical is what prevents duplication.
    for (const key of ["utm_source", "utm_campaign", "fbclid", "gclid"]) {
      assert.equal(hasCatalogueParams({ [key]: "x" }), false, key);
    }
  });

  test("empty and whitespace parameter values are not filters", () => {
    assert.equal(hasCatalogueParams({ size: "" }), false);
    assert.equal(hasCatalogueParams({ size: "   " }), false);
    assert.equal(hasCatalogueParams({ size: [] }), false);
    assert.equal(hasCatalogueParams(undefined), false);
  });
});

describe("meta descriptions", () => {
  test("falls back when the primary value is blank", () => {
    assert.equal(metaDescription(null, "fallback"), "fallback");
    assert.equal(metaDescription("   ", "fallback"), "fallback");
    assert.equal(metaDescription("custom", "fallback"), "custom");
  });

  test("collapses the newlines a textarea produces", () => {
    // A meta description containing a line break is silently re-wrapped.
    assert.equal(metaDescription("one\n\ntwo   three", "f"), "one two three");
  });

  test("truncates on a word boundary and marks the cut", () => {
    const long = "word ".repeat(80).trim();
    const result = metaDescription(long, "f");
    assert.ok(result.length <= 156, `too long: ${result.length}`);
    assert.ok(result.endsWith("…"));
    assert.ok(!result.includes("wor…"), "must not cut mid-word");
  });

  test("a description already short enough is untouched", () => {
    assert.equal(metaDescription("Short and complete.", "f"), "Short and complete.");
  });
});

describe("structured data", () => {
  test("the WebSite entity names what people actually search for", () => {
    const schema = websiteSchema();
    assert.equal(schema["@type"], "WebSite");
    assert.equal(schema.name, "TARA");
    assert.ok(schema.alternateName.includes("TARA Bangladesh"));
    assert.equal(schema["@id"], SCHEMA_IDS.website);
    // Linked to the organisation rather than re-describing it.
    assert.equal(schema.publisher["@id"], SCHEMA_IDS.organization);
  });

  test("entity ids are stable and distinct", () => {
    const ids = Object.values(SCHEMA_IDS);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.ok(id.startsWith(siteConfig.url));
  });

  test("breadcrumbs are positioned from one and omit an item for the last crumb", () => {
    const schema = breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Hijab", path: "/hijab" },
      { name: "Silk Hijab" },
    ]);
    assert.equal(schema.itemListElement.length, 3);
    assert.equal(schema.itemListElement[0].position, 1);
    assert.equal(schema.itemListElement[1].item, `${siteConfig.url}/hijab`);
    assert.equal("item" in schema.itemListElement[2], false);
  });

  test("the postal address is split rather than dumped into streetAddress", () => {
    const address = postalAddress("Batortal Bazar, Zakiganj, Sylhet, Bangladesh");
    assert.equal(address?.streetAddress, "Batortal Bazar");
    assert.equal(address?.addressLocality, "Zakiganj");
    assert.equal(address?.addressRegion, "Sylhet");
    assert.equal(address?.addressCountry, "BD");
    // Never invented: there is no postcode or coordinate in the source data.
    assert.equal("postalCode" in address!, false);
  });

  test("a blank address yields no address block at all", () => {
    assert.equal(postalAddress(""), undefined);
    assert.equal(postalAddress(null), undefined);
  });

  test("JSON-LD cannot be broken out of with hostile text", () => {
    // A product name or review body is staff- and customer-supplied. One
    // containing </script> would otherwise close the block early.
    const payload = jsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    assert.ok(!payload.includes("</script>"), "must not contain a literal closing tag");
    assert.ok(!payload.includes("<"), "raw < must be escaped");
    // Still valid JSON that parses back to the original string.
    assert.equal(
      JSON.parse(payload).name,
      '</script><img src=x onerror=alert(1)>',
    );
  });
});

describe("image alt text reaches the storefront", () => {
  const media = (alt: string | null, isPrimary = false) => ({
    url: "https://example.com/a.jpg", alt, isPrimary, sortOrder: 0,
  });

  test("stored alt text wins over the product name", () => {
    // product_images.alt_en was editable and never read; every image fell back
    // to the product name.
    assert.equal(imageAlt(media("Wine kameez with gold embroidery"), "Silk Set", 0),
      "Wine kameez with gold embroidery");
  });

  test("the first image falls back to the product name, later ones to empty", () => {
    assert.equal(imageAlt(media(null), "Silk Set", 0), "Silk Set");
    // Repeating the product name on every thumbnail is noise for a screen reader.
    assert.equal(imageAlt(media(null), "Silk Set", 3), "");
    assert.equal(imageAlt(undefined, "Silk Set", 2), "");
  });

  test("whitespace-only stored alt is treated as absent", () => {
    assert.equal(imageAlt(media("   "), "Silk Set", 0), "Silk Set");
  });

  test("the representative image always has a non-empty alt", () => {
    // On a card the image IS the link, so it must carry a name.
    assert.equal(primaryImageAlt({ name: "Silk Set", media: [media(null, true)] }), "Silk Set");
    assert.equal(
      primaryImageAlt({ name: "Silk Set", media: [media("Detail of the cuff", true)] }),
      "Detail of the cuff",
    );
    assert.equal(primaryImageAlt({ name: "Silk Set", media: [] }), "Silk Set");
  });

  test("the primary image is preferred over the first in the array", () => {
    assert.equal(
      primaryImageAlt({
        name: "Silk Set",
        media: [media("second", false), media("the primary one", true)],
      }),
      "the primary one",
    );
  });
});

describe("pages that must never be indexed", () => {
  test("a missing product refuses indexing", () => {
    // notFound() renders HTML; without this it is an indexable empty page.
    assert.equal(NOINDEX_NOFOLLOW.index, false);
    assert.equal(NOINDEX_NOFOLLOW.googleBot.index, false);
  });

  test("robots directives cover googleBot explicitly", () => {
    // Google honours the googleBot block over the generic one when both exist,
    // so a mismatch between them is a silent indexing bug.
    assert.equal(NOINDEX_FOLLOW.index, NOINDEX_FOLLOW.googleBot.index);
    assert.equal(NOINDEX_FOLLOW.follow, NOINDEX_FOLLOW.googleBot.follow);
  });
});
