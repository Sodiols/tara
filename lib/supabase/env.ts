import { AUTH_REDIRECT_ORIGIN } from "@/lib/site-url";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
export const SUPABASE_CONFIGURATION_MESSAGE =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the development server.";

export const supabaseEnv = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  /**
   * The origin Supabase Auth sends people back to. It ends up inside the
   * confirmation and password-reset links Supabase emails, so a wrong value
   * does not fail loudly — it mails everyone a link to a machine that is not
   * the shop. Resolved in lib/site-url.ts, the same place canonical URLs, the
   * sitemap and robots.txt get theirs; this file used to hold its own copy of
   * the localhost guard while data/site.ts had none.
   */
  siteUrl: AUTH_REDIRECT_ORIGIN,
  googleAuthEnabled:
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true",
};

export function getSupabaseConfigurationError() {
  if (!supabaseUrl || !supabasePublishableKey) {
    return SUPABASE_CONFIGURATION_MESSAGE;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    return "NEXT_PUBLIC_SUPABASE_URL must be a valid Supabase Project URL.";
  }

  if (parsedUrl.protocol !== "https:") {
    return "NEXT_PUBLIC_SUPABASE_URL must begin with https://.";
  }
  if (
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash ||
    supabaseUrl.toLowerCase().includes("/rest/v1")
  ) {
    return "NEXT_PUBLIC_SUPABASE_URL must be the Project URL and must not contain /rest/v1 or another API path.";
  }

  return null;
}

export function isSupabaseConfigured() {
  return getSupabaseConfigurationError() === null;
}

export function requireSupabaseEnv() {
  const configurationError = getSupabaseConfigurationError();
  if (configurationError) throw new Error(configurationError);
  return supabaseEnv;
}
