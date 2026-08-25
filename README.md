# TARA

The storefront and back office for TARA — women's clothing and accessories,
Sylhet, Bangladesh. Next.js 16 (App Router) on Supabase, cash on delivery,
English only.

```
npm ci
cp .env.local.example .env.local     # then fill in the two Supabase values
npm run dev
```

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Getting a database from zero to working, and creating the first administrator |
| [docs/DATABASE.md](docs/DATABASE.md) | Migration history, what each one does, and how to apply them |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Going to production, and the checks to run before and after |
| [docs/TESTING.md](docs/TESTING.md) | The four test suites and what each one needs |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | The rules the code follows and why |
| [.env.local.example](.env.local.example) | Every environment variable, marked required or optional |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, strict, no emit |
| `npm run lint` | ESLint |
| `npm test` | Unit tests — no database, no network |
| `npm run test:integration` | Database tests against a testing Supabase project |
| `npm run test:e2e` | Browser tests (Playwright) |
| `npm run verify` | typecheck → lint → test → build |

`npm test` and `npm run verify` need nothing but the repository. The integration
and browser suites need an environment and skip with a stated reason without
one — see [docs/TESTING.md](docs/TESTING.md).

## What the stack is

- **Next.js 16**, App Router, React Server Components by default
- **Supabase** — Postgres, Auth, Storage. Accessed with the publishable (anon)
  key only; the service-role key is not used anywhere in this repository
- **Tailwind CSS**
- **Zod** for input validation on both sides of every boundary
- **Zustand** for the guest cart and wishlist, persisted to localStorage

## The rules this codebase holds to

These are not aspirations; they are enforced, and there are tests for most of
them. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains each in full.

- **Money is never taken from the browser.** `place_order()` re-reads every
  price, recomputes the delivery charge from store settings, re-validates the
  coupon, locks each variant row and deducts stock — in one transaction. The
  totals a customer saw are never sent.
- **Stock never moves silently.** A trigger blocks any direct
  `update product_variants set stock_quantity = …`. Every movement goes through
  `place_order()` or `admin_adjust_inventory()` and writes an audit row.
- **The database is the authority on permissions.** Every sensitive mutation is
  a SECURITY DEFINER function that checks a permission. The UI hides controls
  the user could not use; it does not decide anything.
- **Filtering happens before pagination.** `search_catalogue()` applies every
  filter, including variant-level ones, inside the query — so a shopper
  filtering on XL sees the XL products in the catalogue, not the XL products
  that happened to be in the first page.
- **One source of truth per fact.** Shipping geography, the delivery rule,
  store contact details and filter URL encoding each exist in exactly one
  place, shared by browser and server.
- **Cash on delivery, enforced in SQL.** No payment gateway is integrated and
  no badge claims otherwise.

## Layout

```
app/            routes — storefront, account, admin, API handlers
components/     UI. Server components by default; "use client" where needed
lib/            business logic, Supabase access, validation, logging
  supabase/     clients, auth, queries (read) and actions (write)
data/           static reference data (geography, navigation, site identity)
supabase/
  migrations/   the database, in order. 0000 is the baseline schema
  seed/         development-only demonstration catalogue
tests/          unit tests, and the database integration suite
e2e/            Playwright browser tests
docs/           the documents listed above
```

## The `public/` folder

`public/` holds the real TARA logos and photography and is not reproduced in
code review packages because of its size. Asset paths in the source
(`/logo/logo-black.png` and similar) are correct — do not replace them with
placeholders.
