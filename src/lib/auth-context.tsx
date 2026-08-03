import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { User } from "@supabase/supabase-js"
import { authRedirectTo, getSupabase, isSupabaseConfigured } from "@/lib/supabase"
import type { AuthSession } from "@/lib/prefs"

export type AuthStatus = "loading" | "signed_out" | "signed_in" | "error"

interface AuthContextValue {
  status: AuthStatus
  user: AuthSession | null
  configured: boolean
  error: string | null
  syncing: boolean
  setSyncing: (value: boolean) => void
  signingIn: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sessionFromUser(user: User): AuthSession {
  const meta = user.user_metadata ?? {}
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    user.email ||
    "GitHub user"
  const picture =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    undefined
  return {
    id: user.id,
    email: user.email ?? "",
    name,
    picture,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<AuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!configured) {
      setStatus("signed_out")
      return
    }

    const supabase = getSupabase()
    let cancelled = false

    async function boot() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession()
        if (cancelled) return
        if (sessionError) throw sessionError

        if (data.session?.user) {
          setUser(sessionFromUser(data.session.user))
          setStatus("signed_in")
        } else {
          setUser(null)
          setStatus("signed_out")
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not restore session")
        setStatus("error")
      }
    }

    void boot()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session?.user) {
        setUser(sessionFromUser(session.user))
        setStatus("signed_in")
        setSigningIn(false)
        setError(null)
      } else {
        setUser(null)
        setStatus("signed_out")
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [configured])

  const signIn = useCallback(async () => {
    setError(null)
    if (!configured) {
      setError("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.")
      throw new Error("Supabase is not configured")
    }
    setSigningIn(true)
    try {
      const supabase = getSupabase()
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: authRedirectTo(),
        },
      })
      if (oauthError) throw oauthError
      // Browser navigates to GitHub; keep signingIn true until redirect.
    } catch (e) {
      setSigningIn(false)
      const msg = e instanceof Error ? e.message : "GitHub sign-in failed"
      setError(msg)
      throw e
    }
  }, [configured])

  const signOut = useCallback(async () => {
    setError(null)
    if (configured) {
      try {
        await getSupabase().auth.signOut()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign out failed")
      }
    }
    setUser(null)
    setStatus("signed_out")
  }, [configured])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      configured,
      error,
      syncing,
      setSyncing,
      signingIn,
      signIn,
      signOut,
    }),
    [status, user, configured, error, syncing, signingIn, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
