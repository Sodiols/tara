const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "") ?? "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const configuredSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ?? "";

/**
 * The origin Supabase Auth sends people back to.
 *
 * This value ends up inside the confirmation and password-reset links that
 * Supabase emails to customers, so getting it wrong does not fail loudly — it
 * silently mails everyone a link to a machine that is not the shop.
 *
 * It used to fall back to http://localhost:3000 unconditionally. A production
 * build with NEXT_PUBLIC_SITE_URL missing (the variable is inlined at build
 * time, so forgetting it on the host is enough) would therefore have emailed
 * every new customer a localhost confirmation link, and every password reset
 * would have been unusable.
 *
 * localhost is now only ever used outside production. In production an absent
 * variable falls back to the real domain and logs loudly, so the store keeps
 * working while the misconfiguration is still obvious in the logs.
 */
const PRODUCTION_ORIGIN = "https://www.tarabd.co";

function resolveSiteUrl(): string {
  if (configuredSiteUrl && !/^https?:\/\/localhost(:\d+)?$/i.test(configuredSiteUrl)) {
    return configuredSiteUrl;
  }
  if (process.env.NODE_ENV === "production") {
    console.error(
      `[config] NEXT_PUBLIC_SITE_URL is ${
        configuredSiteUrl ? `"${configuredSiteUrl}"` : "not set"
      } in a production build. Auth confirmation and password-reset links must not point at localhost, so "${PRODUCTION_ORIGIN}" is being used instead. Set NEXT_PUBLIC_SITE_URL on the host and rebuild.`,
    );
    return PRODUCTION_ORIGIN;
  }
  return configuredSiteUrl || "http://localhost:3000";
}

export const SUPABASE_CONFIGURATION_MESSAGE =
  "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the development server.";

export const supabaseEnv = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  siteUrl: resolveSiteUrl(),
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
