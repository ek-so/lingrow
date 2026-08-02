import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/AppHeader"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { useAuth } from "@/lib/auth-context"
import { useCollections } from "@/lib/collections-context"
import type { PronounceFirst } from "@/types"
import {
  Cloud,
  CloudOff,
  LoaderCircle,
  LogIn,
  LogOut,
  RefreshCw,
  UserRound,
} from "lucide-react"

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function Profile() {
  const { user, error, syncing, signingIn, signIn, signOut, configured } = useAuth()
  const { settings, setPronounceFirst, syncStatus, syncError, refreshFromCloud } = useCollections()

  function onPronounceChange(value: PronounceFirst) {
    setPronounceFirst(value)
  }

  const signedIn = Boolean(user)
  const busy = syncing || syncStatus === "syncing"
  const wordFirst = settings.pronounceFirst === "word"

  return (
    <div className="min-h-screen bg-background">
      <AppHeader leading={{ kind: "back", label: "My sets", to: "/" }} />

      <PageBody className="pb-8">
        <PageTitle
          className="mb-8"
          description="Account, cloud storage, and study settings for this user."
        >
          Profile
        </PageTitle>

        <section className="mb-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Account
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            {signedIn && user ? (
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
                  {user.email ? (
                    <p
                      className="truncate text-sm text-muted-foreground"
                      data-mailto="false"
                    >
                      {user.email.replace("@", "\u200B@")}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
              </div>
            ) : (
              <div>
                <p className="font-medium">Not signed in</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in with GitHub so Lingrow can store your collections in the cloud. Without
                  sign-in, data stays in this browser only.
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
                to enable GitHub sign-in.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {signedIn ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void refreshFromCloud().catch(() => undefined)
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh from cloud
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:bg-transparent hover:text-destructive"
                    onClick={() => {
                      void signOut()
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={signingIn || !configured}
                  onClick={() => {
                    void signIn().catch(() => undefined)
                  }}
                >
                  {signingIn ? <LogIn className="h-4 w-4" /> : <GitHubMark className="h-4 w-4" />}
                  {signingIn ? "Connecting…" : "Sign in with GitHub"}
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
      </PageBody>
    </div>
  )
}
