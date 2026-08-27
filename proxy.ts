import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Route handlers perform their own authorization and return data rather
    // than executable HTML, so they do not need the nonce CSP or the storefront
    // maintenance/auth routing pass. Excluding them also lets their explicit
    // shared-cache headers work at the edge.
    "/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2)$).*)",
  ],
};
