import { getSupabase, isSupabaseConfigured } from "@/lib/supabase"

/** True when the landing URL is a password-recovery callback. */
let pendingPasswordRecovery = false

function paramsFromLocation(): Record<string, string> {
  const result: Record<string, string> = {}
  const url = new URL(window.location.href)

  if (url.hash && url.hash[0] === "#") {
    try {
      new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
        result[key] = value
      })
    } catch {
      // Hash is a route path, not auth params.
    }
  }

  url.searchParams.forEach((value, key) => {
    result[key] = value
  })

  return result
}

function isAuthFragment(hash: string): boolean {
  if (!hash || hash === "#" || hash.startsWith("#/")) return false
  try {
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
    return (
      params.has("access_token") ||
      params.has("refresh_token") ||
      params.has("error") ||
      params.has("error_code") ||
      params.has("error_description") ||
      params.get("type") === "recovery" ||
      params.get("type") === "signup" ||
      params.get("type") === "magiclink" ||
      params.get("type") === "email"
    )
  } catch {
    return false
  }
}

/** Strip auth query/hash tokens so HashRouter sees a real app route. */
export function cleanAuthCallbackUrl() {
  const url = new URL(window.location.href)
  const authQueryKeys = [
    "code",
    "token_hash",
    "type",
    "error",
    "error_code",
    "error_description",
  ]
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
 * Recovery/magic-link callbacks put tokens in the hash; HashRouter would
 * otherwise treat that as an unknown route and show a 404.
 */
export async function bootstrapAuthFromUrl() {
  if (typeof window === "undefined") return

  const params = paramsFromLocation()
  pendingPasswordRecovery = params.type === "recovery"

  if (isSupabaseConfigured()) {
    try {
      // Initializes the client and consumes ?code= / hash tokens when present.
      await getSupabase().auth.getSession()
    } catch {
      // Config/network issues are surfaced later in AuthProvider.
    }
  }

  cleanAuthCallbackUrl()
}

export function isPendingPasswordRecovery() {
  return pendingPasswordRecovery
}

export function clearPendingPasswordRecovery() {
  pendingPasswordRecovery = false
}
