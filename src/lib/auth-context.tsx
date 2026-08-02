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
import {
  dismissLoginPrompt,
  loadLoginPromptState,
  type AuthSession,
} from "@/lib/prefs"

export type AuthStatus = "loading" | "signed_out" | "signed_in" | "error"

const MIN_PASSWORD_LENGTH = 6

interface AuthContextValue {
  status: AuthStatus
  user: AuthSession | null
  configured: boolean
  error: string | null
  syncing: boolean
  setSyncing: (value: boolean) => void
  showLoginPrompt: boolean
  signingIn: boolean
  /** Set when sign-up needs the user to confirm their email before a session exists. */
  confirmEmailSentTo: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  dismissPrompt: () => void
  continueLocally: () => void
  clearConfirmEmail: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function sessionFromUser(user: User): AuthSession {
  const meta = user.user_metadata ?? {}
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    user.email ||
    "User"
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

function validateCredentials(email: string, password: string): string | null {
  if (!email.trim()) return "Enter your email address."
  if (!password) return "Enter your password."
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<AuthSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [confirmEmailSentTo, setConfirmEmailSentTo] = useState<string | null>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  useEffect(() => {
    const prompt = loadLoginPromptState()

    if (!configured) {
      setStatus("signed_out")
      setShowLoginPrompt(!prompt.dismissed)
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
          setShowLoginPrompt(false)
          dismissLoginPrompt()
        } else {
          setUser(null)
          setStatus("signed_out")
          setShowLoginPrompt(!prompt.dismissed)
        }
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Could not restore session")
        setStatus("error")
        setShowLoginPrompt(!prompt.dismissed)
      }
    }

    void boot()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session?.user) {
        setUser(sessionFromUser(session.user))
        setStatus("signed_in")
        setShowLoginPrompt(false)
        setSigningIn(false)
        setConfirmEmailSentTo(null)
        setError(null)
        dismissLoginPrompt()
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

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null)
      setConfirmEmailSentTo(null)
      const trimmed = email.trim()
      const validationError = validateCredentials(trimmed, password)
      if (validationError) {
        setError(validationError)
        throw new Error(validationError)
      }
      if (!configured) {
        setError("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.")
        throw new Error("Supabase is not configured")
      }
      setSigningIn(true)
      try {
        const supabase = getSupabase()
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        })
        if (signInError) throw signInError
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not sign in"
        setError(msg)
        throw e
      } finally {
        setSigningIn(false)
      }
    },
    [configured]
  )

  const signUp = useCallback(
    async (email: string, password: string) => {
      setError(null)
      setConfirmEmailSentTo(null)
      const trimmed = email.trim()
      const validationError = validateCredentials(trimmed, password)
      if (validationError) {
        setError(validationError)
        throw new Error(validationError)
      }
      if (!configured) {
        setError("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable sign-in.")
        throw new Error("Supabase is not configured")
      }
      setSigningIn(true)
      try {
        const supabase = getSupabase()
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: {
            emailRedirectTo: authRedirectTo(),
          },
        })
        if (signUpError) throw signUpError

        // Supabase may return a user with empty identities when the email is
        // already registered and confirmations are enabled (anti-enumeration).
        const identities = data.user?.identities
        if (data.user && Array.isArray(identities) && identities.length === 0) {
          const msg = "An account with this email already exists. Sign in instead."
          setError(msg)
          throw new Error(msg)
        }

        if (data.user && !data.session) {
          setConfirmEmailSentTo(trimmed)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create account"
        setError(msg)
        throw e
      } finally {
        setSigningIn(false)
      }
    },
    [configured]
  )

  const signOut = useCallback(async () => {
    setError(null)
    setConfirmEmailSentTo(null)
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

  const dismissPrompt = useCallback(() => {
    dismissLoginPrompt()
    setShowLoginPrompt(false)
  }, [])

  const continueLocally = useCallback(() => {
    dismissLoginPrompt()
    setShowLoginPrompt(false)
  }, [])

  const clearConfirmEmail = useCallback(() => {
    setConfirmEmailSentTo(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      configured,
      error,
      syncing,
      setSyncing,
      showLoginPrompt,
      signingIn,
      confirmEmailSentTo,
      signIn,
      signUp,
      signOut,
      dismissPrompt,
      continueLocally,
      clearConfirmEmail,
    }),
    [
      status,
      user,
      configured,
      error,
      syncing,
      showLoginPrompt,
      signingIn,
      confirmEmailSentTo,
      signIn,
      signUp,
      signOut,
      dismissPrompt,
      continueLocally,
      clearConfirmEmail,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
