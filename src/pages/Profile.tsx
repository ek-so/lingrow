import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { AuthForm } from "@/components/AuthForm"
import { useAuth } from "@/lib/auth-context"
import { useCollections } from "@/lib/collections-context"
import type { PronounceFirst } from "@/types"
import { ArrowLeft, Cloud, CloudOff, LoaderCircle, LogOut } from "lucide-react"

export default function Profile() {
  const {
    user,
    error,
    syncing,
    signOut,
    configured,
    confirmEmailSentTo,
  } = useAuth()
  const { settings, setPronounceFirst, syncStatus, syncError } = useCollections()

  function onPronounceChange(value: PronounceFirst) {
    setPronounceFirst(value)
  }

  const signedIn = Boolean(user)
  const busy = syncing || syncStatus === "syncing"
  const wordFirst = settings.pronounceFirst === "word"

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center px-5 py-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            My sets
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 pb-8 pt-[4.75rem]">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
          <p className="mt-1 text-muted-foreground">
            Account, cloud storage, and study settings for this user.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            {signedIn && user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    // Keep email as plain text (no mailto / data-detector link).
                    data-mailto="false"
                  >
                    {(user.email || user.name).replace("@", "\u200B@")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {busy ? (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Syncing…
                      </span>
                    ) : syncStatus === "error" ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <CloudOff className="h-3.5 w-3.5" />
                        Sync issue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Cloud className="h-3.5 w-3.5" />
                        Synced
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 text-destructive hover:bg-transparent hover:text-destructive"
                  onClick={() => {
                    void signOut()
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            ) : (
              <div>
                <p className="font-medium">
                  {confirmEmailSentTo ? "Confirm your email" : "Not signed in"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {confirmEmailSentTo ? (
                    <>Open the confirmation link, then sign in with your email and password.</>
                  ) : (
                    <>
                      Sign in or create an account with email and password so Lingrow can store your
                      collections in the cloud. Without sign-in, data stays in this browser only.
                    </>
                  )}
                </p>
              </div>
            )}

            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {syncError ? <p className="mt-3 text-sm text-destructive">{syncError}</p> : null}
            {!configured ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Set <code className="rounded bg-secondary px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code>{" "}
                and{" "}
                <code className="rounded bg-secondary px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>{" "}
                to enable email sign-in.
              </p>
            ) : null}

            {!signedIn ? (
              <div className="mt-4">
                <AuthForm layout="profile" />
              </div>
            ) : null}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Settings
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Study order</h3>
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

        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Legal
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            <a
              href={import.meta.env.BASE_URL}
              className="text-primary underline-offset-2 hover:underline"
            >
              Lingrow home
            </a>
            <span className="mx-2 text-border">·</span>
            <a
              href={`${import.meta.env.BASE_URL}privacy.html`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Privacy Policy
            </a>
            <span className="mx-2 text-border">·</span>
            <a
              href={`${import.meta.env.BASE_URL}terms.html`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Terms of Use
            </a>
          </p>
        </section>
      </div>
    </div>
  )
}
