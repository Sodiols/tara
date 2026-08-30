# supabase/

| Path | What it is |
| --- | --- |
| `migrations/` | The database, in order. `0000_baseline_schema.sql` is the production baseline; everything after it evolves that baseline. Applying them all to an empty Postgres reproduces production exactly. |
| `seed/development_seed.sql` | Fourteen invented products with stock photography and made-up reviews. **Development only.** No migration references it, and it is deliberately not named `seed.sql` so `supabase db reset` will not run it. |

Full documentation lives in [`../docs/DATABASE.md`](../docs/DATABASE.md):
what each migration does, the rules the database enforces, the permission
matrix, how to verify row level security, and how to add a migration.

---

## Which file do I run?

**None of them individually.** Run the series:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push          # applies everything not yet applied
supabase migration list   # local vs remote
```

`db push` is the only supported way to apply migrations to an environment that
already has some. It records what it applied, so running it again is a no-op.

| Situation | What to do |
| --- | --- |
| **Fresh Supabase project** | `supabase db push`. Applies `0000` → `0018` in order. |
| **Existing production database** | `supabase db push`. Applies only what is missing. |
| **No CLI available** | Run each file in the SQL Editor in filename order, whole file at a time. `0001` must run alone — Postgres will not *use* an enum value in the transaction that added it. |
| **Back office suddenly cannot save** | Re-run `0012_repair_function_grants.sql`. It is a repair tool and is safe at any time. |

`0000` is for a **fresh database only**. Replaying it over a migrated database
fails on purpose (`column "name_bn" does not exist`) and rolls back completely.
See [DATABASE.md → Replaying the baseline](../docs/DATABASE.md#replaying-the-baseline).

---

## Why there are nineteen files and not one

These are **versioned migrations that have already been applied to production**,
not setup scripts. Supabase records each filename in `supabase_migrations.schema_migrations`.
Merging them into one file would:

* make every applied filename unknown to the tracker, so the next `db push`
  would try to apply the merged file to a database that already has all of it;
* discard the repair history — `0007`, `0008`, `0012` exist because of specific
  production incidents, and `0011` is the only file that drops data, kept
  separate precisely so it can be reviewed or deferred on its own;
* not shorten anything. A concatenation of nineteen migrations is still
  nineteen migrations' worth of SQL, including the columns `0011` later drops
  and the four successive rewrites of `place_order()`.

Consolidating migration history and producing a schema snapshot are different
jobs. If you want a single file for spinning up new environments, generate a
**snapshot from the live database** rather than by concatenating history:

```bash
supabase db dump --linked -f supabase/schema-snapshot.sql          # structure
supabase db dump --linked --data-only -f supabase/data-snapshot.sql # settings/taxonomy
```

That output reflects the database as it actually is, which a hand-merged file
cannot promise. Keep `migrations/` regardless — it is what `db push` reads.

---

## Storage buckets

Created by the migrations with their policies; there is nothing to click.

| Bucket | Public | Limit | Who may write |
| --- | --- | --- | --- |
| `product-images` | yes | 5 MB · JPEG/PNG/WebP/AVIF | holders of `catalogue.manage` |
| `avatars` | yes | 2 MB · JPEG/PNG/WebP | the owning user, in their own folder |

---

## The first administrator

There is no self-promotion path in the application: `set_profile_role()`
requires an existing admin. Register through the site, then once, by hand:

```sql
update public.profiles set role = 'admin' where email = 'you@yourdomain.com';
```

Every later role change goes through `/admin/staff`, which writes an audit row.
A user who signs in with Google receives `role = 'customer'` from the column
default and cannot become staff any other way.
