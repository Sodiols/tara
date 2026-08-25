import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Connection helpers for the database integration suite.
 *
 * These tests talk to a REAL Supabase project and write real rows. They are
 * deliberately not part of `npm test`: they need an environment, and a test
 * that silently passes because it had nothing to connect to is worse than no
 * test at all. Run them with `npm run test:integration` against a dedicated
 * testing project — never against production.
 *
 * Required:
 *   TEST_SUPABASE_URL
 *   TEST_SUPABASE_PUBLISHABLE_KEY
 *
 * Optional, and needed for the role-based row level security tests:
 *   TEST_CUSTOMER_EMAIL / TEST_CUSTOMER_PASSWORD
 *   TEST_CUSTOMER_B_EMAIL / TEST_CUSTOMER_B_PASSWORD   (a second, unrelated customer)
 *   TEST_SUPPORT_EMAIL / TEST_SUPPORT_PASSWORD         (role = support)
 *   TEST_FULFILMENT_EMAIL / TEST_FULFILMENT_PASSWORD   (role = fulfilment)
 *   TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD             (role = admin)
 *
 * No service-role key is used anywhere, here or in the application. Every
 * assertion below is made through the same anon key and the same row level
 * security a browser is subject to, which is the only way to prove the policies
 * actually hold.
 *
 * See docs/TESTING.md for how to provision the accounts.
 */

const url = process.env.TEST_SUPABASE_URL?.trim() ?? "";
const key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const hasDatabase = Boolean(url && key);

export const SKIP_REASON =
  "Set TEST_SUPABASE_URL and TEST_SUPABASE_PUBLISHABLE_KEY to run the database integration tests. See docs/TESTING.md.";

export function anonClient(): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export interface Credentials {
  email: string;
  password: string;
}

export function credentials(prefix: string): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`]?.trim();
  return email && password ? { email, password } : null;
}

/** A client authenticated as one of the configured test accounts. */
export async function signedInClient(prefix: string): Promise<SupabaseClient | null> {
  const account = credentials(prefix);
  if (!account) return null;

  const client = anonClient();
  const { error } = await client.auth.signInWithPassword(account);
  if (error) {
    throw new Error(
      `Could not sign in as ${prefix}: ${error.message}. Check the account exists and is confirmed.`,
    );
  }
  return client;
}

/** A phone number in a reserved range, unique per run. */
export function testPhone(): string {
  return `019${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
}
