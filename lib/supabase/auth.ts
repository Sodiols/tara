import "server-only";

import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { isSupabaseConfigured } from "./env";

export function safeReturnPath(value: string | null | undefined) {
  if (!value) return "/account";
  const trimmed = value.trim();
  // Browsers parsing an http(s) URL treat a backslash the same as a forward
  // slash, so "/\evil.com" is protocol-relative in effect even though it
  // doesn't literally start with "//" — normalize before checking so that
  // bypass can't slip past a bare `startsWith("//")` guard.
  const normalized = trimmed.replace(/\\/g, "/");
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return "/account";
  }
  return trimmed;
}

export async function getUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function requireUser(returnTo = "/account") {
  const user = await getUser();
  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  }
  return user;
}

export async function requireStaff() {
  const user = await requireUser("/admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (data?.role !== "admin" && data?.role !== "staff") {
    notFound();
  }
  return { user, role: data.role };
}
