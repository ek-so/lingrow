import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  getGoogleClientId,
  GOOGLE_SCOPES,
  hasEnvGoogleClientId,
  isGoogleConfigured,
  loadSavedGoogleClientId,
  saveGoogleClientId,
} from "@/lib/google-config"
import { fetchGoogleUserInfo, loadGoogleIdentityServices } from "@/lib/google-gis"
import {
  dismissLoginPrompt,
  loadAuthSession,
  loadLoginPromptState,
  saveAuthSession,
  type AuthSession,
} from "@/lib/prefs"

export type AuthStatus = "loading" | "signed_out" | "signed_in" | "error"

interface AuthContextValue {
  status: AuthStatus
  user: AuthSession | null
  accessToken: string | null
  configured: boolean
  clientIdLockedByEnv: boolean
  clientId: string
  setClientId: (clientId: string) => void
  error: string | null
  syncing: boolean
  setSyncing: (value: boolean) => void
  spreadsheetUrl: string | null
  setSpreadsheetUrl: (url: string | null) => void
  showLoginPrompt: boolean
  signingIn: boolean
  signIn: () => Promise<void>
  signOut: () => void
  getAccessToken: () => Promise<string>
  dismissPrompt: () => void
  continueLocally: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type TokenWaiter = {
  resolve: (token: string) => void
  reject: (err: Error) => void
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [user, setUser] = useState<AuthSession | null>(() => loadAuthSession())
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(null)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [clientId, setClientIdState] = useState(() => getGoogleClientId())
  const configured = clientId.length > 0
  const clientIdLockedByEnv = hasEnvGoogleClientId()

  const tokenClientRef = useRef<GoogleTokenClient | null>(null)
  const tokenClientIdRef = useRef<string>("")
  const tokenWaiters = useRef<TokenWaiter[]>([])
  const accessTokenRef = useRef<string | null>(null)

  accessTokenRef.current = accessToken

  const settleToken = useCallback((token: string | null, err?: Error) => {
    const waiters = tokenWaiters.current
    tokenWaiters.current = []
    if (token) waiters.forEach((w) => w.resolve(token))
    else waiters.forEach((w) => w.reject(err ?? new Error("Google sign-in was cancelled")))
  }, [])

  const handleTokenResponse = useCallback(
    async (response: GoogleTokenResponse) => {
      setSigningIn(false)
      if (response.error) {
        const msg = response.error_description || response.error
        setError(msg)
        setAccessToken(null)
        setStatus("signed_out")
        settleToken(null, new Error(msg))
        return
      }

      const token = response.access_token
      setAccessToken(token)
      try {
        const info = await fetchGoogleUserInfo(token)
        const session: AuthSession = {
          id: info.sub,
          email: info.email,
          name: info.name,
          picture: info.picture,
        }
        setUser(session)
        saveAuthSession(session)
        setError(null)
        setStatus("signed_in")
        setShowLoginPrompt(false)
        dismissLoginPrompt()
        settleToken(token)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not finish Google sign-in"
        setError(msg)
        setStatus("error")
        settleToken(null, new Error(msg))
      }
    },
    [settleToken]
  )

  const handleTokenResponseRef = useRef(handleTokenResponse)
  handleTokenResponseRef.current = handleTokenResponse

  const ensureTokenClient = useCallback(async () => {
    const id = getGoogleClientId()
    if (!id) {
      throw new Error("Add your Google OAuth client ID in Profile first.")
    }
    await loadGoogleIdentityServices()
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google Identity Services is unavailable")
    }
    if (!tokenClientRef.current || tokenClientIdRef.current !== id) {
      tokenClientIdRef.current = id
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          void handleTokenResponseRef.current(response)
        },
        error_callback: (err) => {
          setSigningIn(false)
          const msg = err.message || err.type || "Google sign-in failed"
          setError(msg)
          setStatus("signed_out")
          settleToken(null, new Error(msg))
        },
      })
    }
    return tokenClientRef.current
  }, [settleToken])

  const setClientId = useCallback((next: string) => {
    if (hasEnvGoogleClientId()) return
    saveGoogleClientId(next)
    const resolved = getGoogleClientId()
    setClientIdState(resolved)
    tokenClientRef.current = null
    tokenClientIdRef.current = ""
    setError(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    const prompt = loadLoginPromptState()
    const session = loadAuthSession()

    async function boot() {
      // Keep Profile-saved id in sync if env is empty.
      if (!hasEnvGoogleClientId()) {
        const saved = loadSavedGoogleClientId()
        if (saved && saved !== clientId) setClientIdState(saved)
      }

      if (!isGoogleConfigured()) {
        if (!cancelled) {
          setStatus("signed_out")
          setShowLoginPrompt(!prompt.dismissed && !session)
        }
        return
      }

      try {
        await ensureTokenClient()
        if (cancelled) return

        if (session) {
          setUser(session)
          setStatus("loading")
          tokenClientRef.current?.requestAccessToken({ prompt: "" })
          window.setTimeout(() => {
            if (cancelled) return
            if (!accessTokenRef.current) {
              setStatus("signed_out")
              setShowLoginPrompt(false)
            }
          }, 3000)
        } else {
          setStatus("signed_out")
          setShowLoginPrompt(!prompt.dismissed)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Google auth failed to load")
          setStatus("error")
          setShowLoginPrompt(!prompt.dismissed)
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
    // Re-boot when client id becomes available.
  }, [clientId, ensureTokenClient])

  const signIn = useCallback(async () => {
    setError(null)
    if (!getGoogleClientId()) {
      setError("Add your Google OAuth client ID in Profile, then try again.")
      throw new Error("Google is not configured")
    }
    setSigningIn(true)
    try {
      const client = await ensureTokenClient()
      await new Promise<void>((resolve, reject) => {
        tokenWaiters.current.push({
          resolve: () => resolve(),
          reject,
        })
        client.requestAccessToken({ prompt: "consent" })
      })
    } catch (e) {
      setSigningIn(false)
      throw e
    }
  }, [ensureTokenClient])

  const getAccessToken = useCallback(async () => {
    if (accessTokenRef.current) return accessTokenRef.current
    if (!getGoogleClientId()) throw new Error("Google is not configured")
    const client = await ensureTokenClient()
    return new Promise<string>((resolve, reject) => {
      tokenWaiters.current.push({ resolve, reject })
      client.requestAccessToken({ prompt: "" })
    })
  }, [ensureTokenClient])

  const signOut = useCallback(() => {
    const token = accessTokenRef.current
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => undefined)
    }
    setAccessToken(null)
    setUser(null)
    saveAuthSession(null)
    setSpreadsheetUrl(null)
    setStatus("signed_out")
    setError(null)
  }, [])

  const dismissPrompt = useCallback(() => {
    dismissLoginPrompt()
    setShowLoginPrompt(false)
  }, [])

  const continueLocally = useCallback(() => {
    dismissLoginPrompt()
    setShowLoginPrompt(false)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      configured,
      clientIdLockedByEnv,
      clientId,
      setClientId,
      error,
      syncing,
      setSyncing,
      spreadsheetUrl,
      setSpreadsheetUrl,
      showLoginPrompt,
      signingIn,
      signIn,
      signOut,
      getAccessToken,
      dismissPrompt,
      continueLocally,
    }),
    [
      status,
      user,
      accessToken,
      configured,
      clientIdLockedByEnv,
      clientId,
      setClientId,
      error,
      syncing,
      spreadsheetUrl,
      showLoginPrompt,
      signingIn,
      signIn,
      signOut,
      getAccessToken,
      dismissPrompt,
      continueLocally,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
