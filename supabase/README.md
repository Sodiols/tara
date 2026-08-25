# supabase/

| Path | What it is |
| --- | --- |
| `migrations/` | The database, in order. `0000_baseline_schema.sql` is the production baseline; everything after it evolves that baseline. Applying them all to an empty Postgres reproduces production exactly. |
| `seed/development_seed.sql` | Fourteen invented products with stock photography and made-up reviews. **Development only.** No migration references it, and it is deliberately not named `seed.sql` so `supabase db reset` will not run it. |

Full documentation lives in [`../docs/DATABASE.md`](../docs/DATABASE.md):
what each migration does, the rules the database enforces, the permission
matrix, how to verify row level security, and how to add a migration.

```bash
supabase db push          # apply everything not yet applied
supabase migration list   # local vs remote
```
