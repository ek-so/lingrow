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
  UserRound,
} from "lucide-react"

export default function Profile() {
  const {
    status,
    user,
    error,
    syncing,
    spreadsheetUrl,
    signingIn,
    signIn,
    signOut,
  } = useAuth()
  const { settings, setPronounceFirst, syncStatus, syncError } = useCollections()

  function onPronounceChange(value: PronounceFirst) {
    setPronounceFirst(value)
  }

  const signedIn = status === "signed_in" && user
  const busy = syncing || syncStatus === "syncing"
  const wordFirst = settings.pronounceFirst === "word"

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
                    {busy ? (
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

            <div className="mt-4 flex flex-wrap gap-2">
              {signedIn ? (
                <>
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
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">Study order</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {wordFirst ? "Word first" : "Translation first"}
                </p>
              </div>
              <div
                role="group"
                aria-label="Pronounce first"
                className="inline-flex shrink-0 rounded-lg border border-border bg-secondary p-0.5"
              >
                <button
                  type="button"
                  onClick={() => onPronounceChange("word")}
                  aria-pressed={wordFirst}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    wordFirst
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Word first
                </button>
                <button
                  type="button"
                  onClick={() => onPronounceChange("translation")}
                  aria-pressed={!wordFirst}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    !wordFirst
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Translation first
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
