import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ""
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ""

export function isSupabaseConfigured() {
  return url.length > 0 && anonKey.length > 0
}

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.")
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  }
  return client
}

/** Where email confirmation / auth redirects should land. */
export function authRedirectTo() {
  const base = import.meta.env.BASE_URL || "/"
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  // Include a HashRouter path so callbacks never leave an empty/invalid hash.
  return `${origin}${base.replace(/\/?$/, "/")}app.html#/`
}
