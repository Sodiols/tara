# Testing TARA

Four suites, with different costs and different requirements. The first runs
anywhere; the other three need something real to run against and **skip with a
stated reason** rather than passing vacuously when they do not have it.

| Suite | Command | Needs | Runs in CI |
| --- | --- | --- | --- |
| Unit | `npm test` | nothing | always |
| Type + lint + build | `npm run verify` | nothing | always |
| Database integration | `npm run test:integration` | a testing Supabase project | when configured |
| Browser (E2E) | `npm run test:e2e` | a running site + accounts | when configured |

---

## Unit tests

```bash
npm test
```

No database, no network, no browser. Node's own test runner over the pure
modules, with `tests/resolve-hooks.mjs` teaching it the two specifier styles the
bundler understands (`@/…` aliases and extensionless imports) and mapping
`server-only` to an empty module, as the server build does.

| File | Covers |
| --- | --- |
| `tests/geography.test.ts` | 8 divisions, 64 districts, no upazila masquerading as a district, and that a real district under the wrong division is refused |
| `tests/delivery.test.ts` | The delivery rule at every boundary: below, at and above the threshold, inside and outside the eligible division, invalid locations, and the offer switched off |
| `tests/catalogue.filters.test.ts` | URL round trip, disjoint price bands, bounds on every attacker-supplied value |
| `tests/commerce.test.ts` | Money arithmetic, phone normalisation, store time zone, and every input schema |
| `tests/security.test.ts` | Open-redirect protection, the role→permission table, and the order state machine |
| `tests/hardening.test.ts` | JSON-LD escaping and log redaction |
| `tests/catalogue.test.ts` | Category labelling, including the prototype-pollution case that once blanked the product grid |

---

## Database integration tests

```bash
npm run test:integration
```

These place real orders, deduct real stock and write real rows. **Point them at
a dedicated testing Supabase project. Never at production.**

Every assertion is made through the publishable (anon) key with a real session —
exactly what a browser has. No service-role key is used, because a test that
bypasses row level security cannot prove row level security works.

### Provisioning

1. Create a second Supabase project.
2. Apply every migration: `supabase db push`.
3. Seed a catalogue so there is something to buy:
   `psql "$URL" -f supabase/seed/development_seed.sql`
4. Register five accounts through `/register` on a build pointed at that
   project, then set their roles in the SQL Editor:

```sql
update public.profiles set role = 'support'    where email = 'support@test.local';
update public.profiles set role = 'fulfilment' where email = 'fulfilment@test.local';
update public.profiles set role = 'admin'      where email = 'admin@test.local';
-- the two customer accounts stay 'customer'
```

5. Put the credentials in `.env.local` (they are commented out in
   `.env.local.example`):

```
TEST_SUPABASE_URL=
TEST_SUPABASE_PUBLISHABLE_KEY=
TEST_CUSTOMER_EMAIL=          TEST_CUSTOMER_PASSWORD=
TEST_CUSTOMER_B_EMAIL=        TEST_CUSTOMER_B_PASSWORD=
TEST_SUPPORT_EMAIL=           TEST_SUPPORT_PASSWORD=
TEST_FULFILMENT_EMAIL=        TEST_FULFILMENT_PASSWORD=
TEST_ADMIN_EMAIL=             TEST_ADMIN_PASSWORD=
```

Without `TEST_SUPABASE_URL` the whole suite skips and says so. Without one of
the role accounts, only the tests that need it skip.

### What they prove

**`tests/integration/rls.test.ts`**

- anonymous: can read active products; cannot read orders, profiles, the
  subscriber list, contact messages or a private setting; cannot write a
  product; cannot move stock; cannot call `consume_rate_limit()` with a limit of
  its own choosing; cannot unsubscribe anyone by email address
- customer: sees only their own orders and addresses; cannot promote themselves
  to admin; cannot save an address for an impossible location; cannot read the
  audit log
- support: cannot edit the catalogue, cannot delete a product image, cannot
  upload into `product-images`
- fulfilment: cannot delete a product image, cannot change settings, cannot
  change a role

**`tests/integration/checkout.test.ts`**

- an invented division, a real district under the wrong division, and an upazila
  as a district are each refused before any stock is locked
- delivery is free inside the eligible division at the threshold, charged below
  it, and charged outside it however large the order
- an order for more than the stock on hand is refused
- **two simultaneous orders for the last item: exactly one succeeds**, and stock
  never goes negative
- replaying an idempotency key returns the original order and creates no second
  one
- a second order from the same phone within 90 seconds is refused

---

## Browser tests

```bash
npm run test:e2e:install     # once, downloads Chromium
npm run test:e2e
```

Playwright, on Desktop Chrome and a Pixel 7 — the storefront is mostly mobile
traffic, and the filter drawer, bag drawer and navigation are separate
components below the `lg` breakpoint.

Configuration:

```
E2E_BASE_URL=http://localhost:3000     # omit to have Playwright run `npm start`
E2E_ADMIN_EMAIL=      E2E_ADMIN_PASSWORD=
E2E_CUSTOMER_EMAIL=   E2E_CUSTOMER_PASSWORD=
```

These place real orders too. Same rule: staging only.

| Spec | Covers |
| --- | --- |
| `e2e/purchase.spec.ts` | The full guest purchase: product → variant → bag → checkout → division → district → COD order → order number → tracking. Plus: tracking needs the token as well as the number, the district list contains no upazilas, and a large order outside Sylhet is still charged for delivery |
| `e2e/catalogue.spec.ts` | Filters appear in the URL, survive a reload, undo with the back button; two price bands stay separate; Load More appends and the reload restores what was on screen; a missing collection is a 404; search results are `noindex` |
| `e2e/auth.spec.ts` | Registration, invalid sign-in, forgot password not enumerating accounts, protected routes redirecting with `returnTo`, open-redirect protection, sign-in/sign-out, and the address book offering only real districts |
| `e2e/admin.spec.ts` | A signed-in **customer** typing an admin URL is refused on every admin route; the dashboard shows real figures; orders are searched server-side; the settings form exposes both delivery charges and no dead fields |

Tests are run with one worker on purpose: checkout deducts stock and the COD
rate limits are keyed on the phone number, so two purchase tests at once would
fight over both.

---

## Continuous integration

```yaml
- run: npm ci
- run: npm run typecheck
- run: npm run lint
- run: npm test
- run: npm run build
- run: npm run test:integration    # with the TEST_* secrets
- run: npm run test:e2e:install
- run: npm run test:e2e            # with the E2E_* secrets
```

The first five need no secrets and should gate every pull request. The last two
need a staging environment; run them before a release at minimum.

---

## Writing a test here

- **Name the fault, not the function.** `"two simultaneous orders for the last
  item cannot both succeed"` says what breaks if it regresses.
- **Never let a missing prerequisite look like a pass.** Skip with a reason, or
  fail with one. `openFirstProduct()` in `e2e/fixtures.ts` fails rather than
  skipping when the catalogue is empty, because an empty catalogue would make
  every purchase test downstream report a false pass.
- **Test the boundary, not the middle.** Exactly at the free-delivery threshold
  is worth a test; ৳900 and ৳1,000 are the same test twice.
- **When a test fails after a deliberate change, check which one is wrong.**
  The checkout fixture in `tests/commerce.test.ts` used to say
  `district: "Zakiganj"`. It started failing because Zakiganj is an upazila —
  the test was right to fail, and the fixture was what needed correcting.
