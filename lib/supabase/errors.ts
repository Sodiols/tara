import "server-only";

/**
 * Recognising the one database failure that is a deployment problem, not a bug.
 *
 * PostgREST answers a call to a function that does not exist with `PGRST202`.
 * In this project that means exactly one thing: a migration has not been
 * applied. The generic handling — log the error, return an empty result —
 * is correct, but on its own it produces a silently empty storefront and a log
 * line that says "search_catalogue failed" without saying why or what to do.
 *
 * This turns that into a sentence naming the migration to run.
 */

/** Which migration introduced each function, for the message below. */
const FUNCTION_MIGRATIONS: Record<string, string> = {
  search_catalogue: "0009_catalogue_geography_and_delivery.sql",
  catalogue_facets: "0009_catalogue_geography_and_delivery.sql",
  collection_is_visible: "0009_catalogue_geography_and_delivery.sql",
  resolve_shipping_location: "0009_catalogue_geography_and_delivery.sql",
  calculate_delivery_fee: "0009_catalogue_geography_and_delivery.sql",
  set_product_primary_image: "0010_security_operations_and_email.sql",
  reorder_product_images: "0010_security_operations_and_email.sql",
  delete_product_image: "0010_security_operations_and_email.sql",
  replace_cart_items: "0010_security_operations_and_email.sql",
  merge_cart_items: "0010_security_operations_and_email.sql",
  consume_public_rate_limit: "0010_security_operations_and_email.sql",
  unsubscribe_newsletter_by_token: "0010_security_operations_and_email.sql",
  claim_order_notifications: "0010_security_operations_and_email.sql",
  claim_order_notifications_admin: "0010_security_operations_and_email.sql",
  confirm_notification_dispatch: "0010_security_operations_and_email.sql",
  store_notification_recipient: "0010_security_operations_and_email.sql",
};

interface DatabaseErrorShape {
  code?: unknown;
  message?: unknown;
}

/**
 * True when the function exists but the caller has no EXECUTE grant.
 *
 * Postgres reports this as `42501 permission denied for function <name>` --
 * which reads almost identically to the application's own
 * `permission_denied` from require_permission(), but means something
 * completely different. The first is a deployment fault: the grant is missing.
 * The second is working as designed: the staff member's role does not include
 * the permission.
 *
 * Telling them apart matters because the fixes are opposite. One is "run
 * migration 0012"; the other is "ask an administrator for the permission".
 */
export function isMissingExecuteGrant(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as DatabaseErrorShape;
  return (
    code === "42501" ||
    (typeof message === "string" && /permission denied for function/i.test(message))
  );
}

/** True when the failure is "this function does not exist in the database". */
export function isMissingDatabaseFunction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as DatabaseErrorShape;
  return (
    code === "PGRST202" ||
    (typeof message === "string" && message.includes("Could not find the function"))
  );
}

/**
 * An actionable sentence for a missing function, or null if that is not what
 * went wrong.
 *
 * Server-side only — this names internal migration files and must never be
 * shown to a customer. Customers get the ordinary "something went wrong"
 * message; this is for whoever is reading the logs.
 */
export function describeMissingMigration(
  error: unknown,
  functionName: string,
): string | null {
  if (isMissingExecuteGrant(error)) {
    return (
      `public.${functionName}() exists but is not executable by this role, so ` +
      `the request was refused before the function ran. This is a missing GRANT, ` +
      `not a role problem. It happens when 0000_baseline_schema.sql is re-run ` +
      `after a later migration: its blanket REVOKE strips every grant the later ` +
      `migrations issued. Apply supabase/migrations/0012_repair_function_grants.sql ` +
      `to restore them. See docs/DATABASE.md.`
    );
  }

  if (!isMissingDatabaseFunction(error)) return null;

  const migration = FUNCTION_MIGRATIONS[functionName];
  return (
    `public.${functionName}() does not exist in this database, so this request ` +
    `returned nothing. ` +
    (migration
      ? `Apply supabase/migrations/${migration} — run \`supabase db push\`, or paste the file into the Supabase SQL Editor. `
      : "Apply the pending migrations in supabase/migrations. ") +
    `See docs/DATABASE.md.`
  );
}
