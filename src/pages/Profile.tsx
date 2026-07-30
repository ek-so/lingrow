import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { useCollections } from "@/lib/collections-context"
import type { PronounceFirst } from "@/types"
import {
  ArrowLeft,
  Cloud,
  CloudOff,
  ExternalLink,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  UserRound,
} from "lucide-react"

export default function Profile() {
  const {
    status,
    user,
    clientId,
    setClientId,
    clientIdLockedByEnv,
    error,
    syncing,
    spreadsheetUrl,
    signingIn,
    signIn,
    signOut,
  } = useAuth()
  const { settings, setPronounceFirst, syncStatus, syncError, refreshFromCloud } =
    useCollections()
  const [draftId, setDraftId] = useState(clientId)

  useEffect(() => {
    setDraftId(clientId)
  }, [clientId])

  function onPronounceChange(value: PronounceFirst) {
    setPronounceFirst(value)
  }

  function saveClientId() {
    setClientId(draftId)
  }

  const signedIn = status === "signed_in" && user

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <header className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Account, cloud storage, and study settings for this user.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            {signedIn ? (
              <div className="flex items-start gap-3">
                {user.picture ? (
                  <img
                    src={user.picture}
                    alt=""
                    className="h-12 w-12 rounded-full border border-border object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <UserRound className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {syncStatus === "syncing" || syncing ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Syncing spreadsheet…
                      </span>
                    ) : syncStatus === "error" ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <CloudOff className="h-3.5 w-3.5" />
                        Sync issue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Cloud className="h-3.5 w-3.5" />
                        Synced with Google Sheets
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <p className="font-medium">Not signed in</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in so Lingrow can store your collections as a spreadsheet in your Google
                  account. Without sign-in, data stays in this browser only.
                </p>
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {syncError ? <p className="mt-3 text-sm text-destructive">{syncError}</p> : null}

            {!clientIdLockedByEnv ? (
              <div className="mt-4">
                <label htmlFor="profile-google-client-id" className="text-sm font-medium">
                  Google OAuth client ID
                </label>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    id="profile-google-client-id"
                    type="text"
                    value={draftId}
                    onChange={(e) => setDraftId(e.target.value)}
                    placeholder="123….apps.googleusercontent.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={saveClientId}
                    disabled={draftId.trim() === clientId}
                  >
                    Save
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  In Google Cloud Console: create an OAuth <strong>Web</strong> client, enable
                  Sheets + Drive APIs, and add this site (and localhost) under Authorized JavaScript
                  origins.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {signedIn ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void refreshFromCloud()
                    }}
                    disabled={syncing || syncStatus === "syncing"}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh from Google
                  </Button>
                  {spreadsheetUrl ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        window.open(spreadsheetUrl, "_blank", "noopener,noreferrer")
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open spreadsheet
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" onClick={signOut}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={signingIn}
                  onClick={() => {
                    if (!clientIdLockedByEnv && draftId.trim() !== clientId) {
                      setClientId(draftId)
                    }
                    void signIn().catch(() => undefined)
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  {signingIn ? "Connecting…" : "Sign in with Google"}
                </Button>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Settings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {signedIn
              ? "Saved for your Google account and mirrored in the spreadsheet."
              : "Saved on this device until you sign in."}
          </p>
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-medium">Pronounce first</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Global study order. Each list still chooses its own language pair.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => onPronounceChange("word")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  settings.pronounceFirst === "word"
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <span className="font-medium">Word</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Word → translation
                </span>
              </button>
              <button
                type="button"
                onClick={() => onPronounceChange("translation")}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                  settings.pronounceFirst === "translation"
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border hover:bg-secondary"
                }`}
              >
                <span className="font-medium">Translation</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Translation → word
                </span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
