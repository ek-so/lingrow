import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

function isAuthFragment(hash: string): boolean {
  if (!hash || hash === "#" || hash.startsWith("#/")) return false
  try {
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
    return (
      params.has("access_token") ||
      params.has("refresh_token") ||
      params.has("error") ||
      params.has("error_code") ||
      params.has("error_description")
    )
  } catch {
    return false
  }
}

/** Strip auth query/hash tokens so HashRouter sees a real app route. */
export function cleanAuthCallbackUrl() {
  const url = new URL(window.location.href)
  const authQueryKeys = ["code", "token_hash", "type", "error", "error_code", "error_description"]
  let changed = false

  for (const key of authQueryKeys) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key)
      changed = true
    }
  }

  if (isAuthFragment(url.hash)) {
    url.hash = "#/"
    changed = true
  }

  if (!changed) return

  const next = `${url.pathname}${url.search}${url.hash || "#/"}`
  window.history.replaceState(window.history.state, document.title, next)
}

/**
 * Process Supabase auth redirects before React Router mounts.
 * OAuth PKCE callbacks use ?code=; some flows put tokens in the hash.
 */
export async function bootstrapAuthFromUrl() {
  if (typeof window === "undefined") return

  if (isSupabaseConfigured()) {
    try {
      await getSupabase().auth.getSession()
    } catch {
      // Config/network issues are surfaced later in AuthProvider.
    }
  }

  cleanAuthCallbackUrl()
}
