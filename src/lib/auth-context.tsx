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
import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES, isGoogleConfigured } from "@/lib/google-config"
import { fetchGoogleUserInfo, loadGoogleIdentityServices } from "@/lib/google-gis"
import {
  dismissLoginPrompt,
  loadAccessToken,
  loadAuthSession,
  loadLoginPromptState,
  saveAccessToken,
  saveAuthSession,
  type AuthSession,
} from "@/lib/prefs"

export type AuthStatus = "loading" | "signed_out" | "signed_in" | "error"

/** Refresh a bit before Google's expires_in so sync never hits a dead token first. */
const TOKEN_EXPIRY_SKEW_MS = 60_000
const DEFAULT_TOKEN_LIFETIME_SEC = 3600

interface AuthContextValue {
  status: AuthStatus
  user: AuthSession | null
  accessToken: string | null
  configured: boolean
  error: string | null
  syncing: boolean
  setSyncing: (value: boolean) => void
  spreadsheetUrl: string | null
  setSpreadsheetUrl: (url: string | null) => void
  showLoginPrompt: boolean
  signingIn: boolean
  signIn: () => Promise<void>
  signOut: () => void
  getAccessToken: (options?: { force?: boolean }) => Promise<string>
  dismissPrompt: () => void
  continueLocally: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

type TokenWaiter = {
  resolve: (token: string) => void
  reject: (err: Error) => void
}

function isTokenFresh(expiresAt: number, now = Date.now()) {
  return now < expiresAt - TOKEN_EXPIRY_SKEW_MS
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

  const tokenClientRef = useRef<GoogleTokenClient | null>(null)
  const tokenWaiters = useRef<TokenWaiter[]>([])
  const accessTokenRef = useRef<string | null>(null)
  const expiresAtRef = useRef(0)
  const refreshTimerRef = useRef<number | null>(null)
  const requestInFlightRef = useRef(false)
  const configured = isGoogleConfigured()

  accessTokenRef.current = accessToken

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }, [])

  const settleToken = useCallback((token: string | null, err?: Error) => {
    requestInFlightRef.current = false
    const waiters = tokenWaiters.current
    tokenWaiters.current = []
    if (token) waiters.forEach((w) => w.resolve(token))
    else waiters.forEach((w) => w.reject(err ?? new Error("Google sign-in was cancelled")))
  }, [])

  const applyToken = useCallback((token: string, expiresInSec: number) => {
    const lifetimeSec =
      Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : DEFAULT_TOKEN_LIFETIME_SEC
    const expiresAt = Date.now() + lifetimeSec * 1000
    expiresAtRef.current = expiresAt
    setAccessToken(token)
    accessTokenRef.current = token
    saveAccessToken({ token, expiresAt })
    return expiresAt
  }, [])

  const clearStoredToken = useCallback(() => {
    clearRefreshTimer()
    expiresAtRef.current = 0
    setAccessToken(null)
    accessTokenRef.current = null
    saveAccessToken(null)
  }, [clearRefreshTimer])

  const handleTokenResponse = useCallback(
    async (response: GoogleTokenResponse) => {
      setSigningIn(false)
      if (response.error) {
        const msg = response.error_description || response.error
        setError(msg)
        clearStoredToken()
        // Keep the cached profile so the UI stays signed in; sync will retry later.
        if (!loadAuthSession()) {
          setStatus("signed_out")
        }
        settleToken(null, new Error(msg))
        return
      }

      const token = response.access_token
      const expiresAt = applyToken(token, response.expires_in)
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

        clearRefreshTimer()
        const refreshIn = Math.max(5_000, expiresAt - Date.now() - TOKEN_EXPIRY_SKEW_MS)
        refreshTimerRef.current = window.setTimeout(() => {
          if (!tokenClientRef.current || requestInFlightRef.current) return
          requestInFlightRef.current = true
          tokenClientRef.current.requestAccessToken({ prompt: "" })
        }, refreshIn)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not finish Google sign-in"
        setError(msg)
        setStatus("error")
        settleToken(null, new Error(msg))
      }
    },
    [applyToken, clearRefreshTimer, clearStoredToken, settleToken]
  )

  const handleTokenResponseRef = useRef(handleTokenResponse)
  handleTokenResponseRef.current = handleTokenResponse

  const ensureTokenClient = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error("Google sign-in is not configured for this site yet.")
    }
    await loadGoogleIdentityServices()
    if (!window.google?.accounts?.oauth2) {
      throw new Error("Google Identity Services is unavailable")
    }
    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (response) => {
          void handleTokenResponseRef.current(response)
        },
        error_callback: (err) => {
          setSigningIn(false)
          const msg = err.message || err.type || "Google sign-in failed"
          setError(msg)
          // Do not wipe a valid cached session on a silent refresh failure.
          if (!loadAuthSession()) {
            setStatus("signed_out")
          }
          settleToken(null, new Error(msg))
        },
      })
    }
    return tokenClientRef.current
  }, [settleToken])

  useEffect(() => {
    let cancelled = false
    const prompt = loadLoginPromptState()
    const session = loadAuthSession()
    const storedToken = loadAccessToken()

    async function boot() {
      if (!configured) {
        if (!cancelled) {
          setStatus("signed_out")
          setShowLoginPrompt(!prompt.dismissed && !session)
        }
        return
      }

      try {
        await ensureTokenClient()
        if (cancelled) return

        if (session && storedToken && isTokenFresh(storedToken.expiresAt)) {
          setUser(session)
          expiresAtRef.current = storedToken.expiresAt
          setAccessToken(storedToken.token)
          accessTokenRef.current = storedToken.token
          setStatus("signed_in")
          setShowLoginPrompt(false)

          clearRefreshTimer()
          const refreshIn = Math.max(
            5_000,
            storedToken.expiresAt - Date.now() - TOKEN_EXPIRY_SKEW_MS
          )
          refreshTimerRef.current = window.setTimeout(() => {
            if (!tokenClientRef.current || requestInFlightRef.current) return
            requestInFlightRef.current = true
            tokenClientRef.current.requestAccessToken({ prompt: "" })
          }, refreshIn)
          return
        }

        if (session) {
          // Profile is still known; restore UI without a consent popup.
          setUser(session)
          setStatus("signed_in")
          setShowLoginPrompt(false)
          if (storedToken && !isTokenFresh(storedToken.expiresAt)) {
            saveAccessToken(null)
          }
          // Quiet background refresh — may no-op if Google blocks silent grant.
          if (!requestInFlightRef.current) {
            requestInFlightRef.current = true
            tokenClientRef.current?.requestAccessToken({ prompt: "" })
          }
          return
        }

        setStatus("signed_out")
        setShowLoginPrompt(!prompt.dismissed)
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
      clearRefreshTimer()
    }
  }, [configured, ensureTokenClient, clearRefreshTimer])

  const signIn = useCallback(async () => {
    setError(null)
    if (!configured) {
      setError("Google sign-in is not configured for this site yet.")
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
        requestInFlightRef.current = true
        // Opens Google’s account chooser / consent (normal platform flow).
        client.requestAccessToken({ prompt: "select_account" })
      })
    } catch (e) {
      setSigningIn(false)
      throw e
    }
  }, [configured, ensureTokenClient])

  const getAccessToken = useCallback(
    async (options?: { force?: boolean }) => {
      if (
        !options?.force &&
        accessTokenRef.current &&
        isTokenFresh(expiresAtRef.current)
      ) {
        return accessTokenRef.current
      }
      if (!configured) throw new Error("Google is not configured")
      if (options?.force) {
        clearStoredToken()
      }
      const client = await ensureTokenClient()
      return new Promise<string>((resolve, reject) => {
        tokenWaiters.current.push({ resolve, reject })
        if (!requestInFlightRef.current) {
          requestInFlightRef.current = true
          client.requestAccessToken({ prompt: "" })
        }
      })
    },
    [configured, ensureTokenClient, clearStoredToken]
  )

  const signOut = useCallback(() => {
    const token = accessTokenRef.current
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token, () => undefined)
    }
    clearStoredToken()
    setUser(null)
    saveAuthSession(null)
    setSpreadsheetUrl(null)
    setStatus("signed_out")
    setError(null)
  }, [clearStoredToken])

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
