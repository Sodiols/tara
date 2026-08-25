import test, { describe } from "node:test";
import assert from "node:assert/strict";

import { jsonLd, jsonLdScriptProps } from "../lib/json-ld";
import { describeError, redact } from "../lib/logger";

/**
 * Two pieces of hardening whose failure modes are invisible in normal use:
 * structured data that can close its own script element, and logs that quietly
 * accumulate customer data.
 */

describe("JSON-LD serialisation", () => {
  test("a product name cannot close the script element", () => {
    // Product names, descriptions and category labels are staff-editable, so
    // this is reachable from /admin/products. JSON.stringify alone does not
    // escape `<`, and the HTML tokeniser ends a script at the first `</script`
    // regardless of the JSON around it.
    const payload = jsonLd({
      "@type": "Product",
      name: '</script><img src=x onerror="alert(1)">',
    });
    assert.equal(payload.includes("</script"), false);
    assert.equal(payload.includes("<"), false);
  });

  test("the escaped output still parses to the original value", () => {
    const original = {
      name: "Wine & Ivory <Lawn>",
      description: "Rated 5/5 by 40+ customers",
    };
    assert.deepEqual(JSON.parse(jsonLd(original)), original);
  });

  test("ampersands and closing angle brackets are escaped too", () => {
    const payload = jsonLd({ name: "A & B > C" });
    assert.equal(payload.includes("&"), false);
    assert.equal(payload.includes(">"), false);
    assert.equal(JSON.parse(payload).name, "A & B > C");
  });

  test("the line separators that break a JavaScript string are escaped", () => {
    const separators = `${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}`;
    const payload = jsonLd({ name: `a${separators}b` });
    assert.equal(payload.includes(String.fromCharCode(0x2028)), false);
    assert.equal(payload.includes(String.fromCharCode(0x2029)), false);
    assert.equal(JSON.parse(payload).name, `a${separators}b`);
  });

  test("undefined properties are omitted, not serialised as null", () => {
    // schema.org treats an absent property and a null one differently, and
    // `aggregateRating: null` makes a Product listing invalid in Search Console.
    const payload = jsonLd({ name: "Sari", aggregateRating: undefined });
    assert.equal(payload.includes("aggregateRating"), false);
  });

  test("the script props carry the escaped payload", () => {
    const props = jsonLdScriptProps({ name: "</script>" });
    assert.equal(props.type, "application/ld+json");
    assert.equal(props.dangerouslySetInnerHTML.__html.includes("</script"), false);
  });
});

describe("error serialisation", () => {
  test("a Supabase error is not flattened to [object Object]", () => {
    // This is what hid a real fault: Supabase and PostgREST report failures as
    // plain objects, not Errors, and `String({...})` is the literal text
    // "[object Object]". The log line recorded that something failed and
    // nothing about what — which is worse than no log, because it looks like
    // observability while hiding the one field that identifies the fault.
    const supabaseError = {
      code: "PGRST202",
      message: "Could not find the function public.search_catalogue(p_filters) in the schema cache",
      details: "Searched for the function public.search_catalogue with parameter p_filters",
      hint: null,
    };

    const described = describeError(supabaseError);
    assert.equal(described.code, "PGRST202");
    assert.match(String(described.message), /search_catalogue/);
    assert.match(String(described.details), /Searched for the function/);
    assert.equal(String(described.message).includes("[object Object]"), false);
  });

  test("a null hint is omitted rather than logged as the string null", () => {
    const described = describeError({ message: "boom", hint: null });
    assert.equal("hint" in described, false);
  });

  test("a real Error keeps its name and message", () => {
    const described = describeError(new TypeError("bad input"));
    assert.equal(described.name, "TypeError");
    assert.equal(described.message, "bad input");
  });

  test("an object with no message is still serialised, not discarded", () => {
    const described = describeError({ status: 500, body: "gateway" });
    assert.match(String(described.message), /gateway/);
  });

  test("a thrown string or number still produces a readable message", () => {
    assert.equal(describeError("out_of_stock").message, "out_of_stock");
    assert.equal(describeError(42).message, "42");
  });
});

describe("log redaction", () => {
  test("anything that looks like a credential is dropped", () => {
    const output = redact({
      password: "hunter2",
      accessToken: "eyJhbGciOi",
      supabaseKey: "sb-secret",
      authorization: "Bearer abc",
      cookie: "sb-auth=1",
      trackingToken: "a".repeat(48),
    });
    for (const value of Object.values(output)) {
      assert.equal(value, "[redacted]");
    }
  });

  test("customer contact details are masked, not removed", () => {
    // Enough to correlate two log lines about the same customer; not enough to
    // reconstitute a marketing list out of the log store.
    const output = redact({ email: "ayesha.rahman@example.com", phone: "01712345678" });
    assert.equal(output.email, "ay***@example.com");
    assert.equal(output.phone, "***5678");
  });

  test("an address is dropped entirely", () => {
    assert.equal(redact({ shippingAddress: "House 12, Road 3, Sylhet" }).shippingAddress, "[redacted]");
  });

  test("nested objects are redacted too", () => {
    const output = redact({ customer: { email: "a@b.com", name: "Ayesha" } }) as {
      customer: Record<string, unknown>;
    };
    assert.equal(output.customer.email, "a***@b.com");
    assert.equal(output.customer.name, "Ayesha");
  });

  test("operational fields are left readable", () => {
    const output = redact({ orderNumber: "TARA-1042", status: "shipped", lines: 3 });
    assert.equal(output.orderNumber, "TARA-1042");
    assert.equal(output.status, "shipped");
    assert.equal(output.lines, 3);
  });

  test("an Error becomes a plain object rather than an empty one", () => {
    // JSON.stringify(new Error("x")) is "{}", which is how a logged failure
    // ends up as a line with no message in it.
    const output = redact({ error: new Error("out_of_stock:TR-UN-101") }) as {
      error: { name: string; message: string };
    };
    assert.equal(output.error.name, "Error");
    assert.equal(output.error.message, "out_of_stock:TR-UN-101");
  });

  test("a deeply nested structure terminates rather than recursing forever", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    assert.doesNotThrow(() => redact(cyclic));
  });
});
