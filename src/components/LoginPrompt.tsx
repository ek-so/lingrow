import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { Cloud, HardDrive, Mail } from "lucide-react"

export function LoginPrompt() {
  const {
    showLoginPrompt,
    signIn,
    continueLocally,
    error,
    signingIn,
    configured,
    linkSentTo,
    clearLinkSent,
  } = useAuth()
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!showLoginPrompt) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") continueLocally()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [showLoginPrompt, continueLocally])

  if (!showLoginPrompt) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={continueLocally}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="login-prompt-title" className="text-lg font-semibold tracking-tight">
          {linkSentTo ? "Check your email" : "Sync collections to the cloud?"}
        </h2>
        {linkSentTo ? (
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a magic link to <span className="font-medium text-foreground">{linkSentTo}</span>.
            Open it on this device to finish signing in.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email for a magic link to keep your word lists in the cloud. Otherwise,
            collections stay on this device only.
          </p>
        )}

        {!linkSentTo ? (
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2.5">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">Email magic link</span>
                <span className="block text-muted-foreground">
                  Sync across devices via your Lingrow cloud profile.
                </span>
              </span>
            </li>
            <li className="flex gap-2.5">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium text-foreground">This device</span>
                <span className="block text-muted-foreground">
                  Stored in local browser storage. Cleared if you wipe site data.
                </span>
              </span>
            </li>
          </ul>
        ) : null}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {!configured ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Cloud sign-in needs Supabase configured for this deployment.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {linkSentTo ? (
            <>
              <Button
                type="button"
                size="lg"
                disabled={signingIn || !configured}
                onClick={() => {
                  void signIn(linkSentTo).catch(() => undefined)
                }}
              >
                <Mail className="h-4 w-4" />
                {signingIn ? "Sending…" : "Resend link"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearLinkSent()
                }}
              >
                Use a different email
              </Button>
            </>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void signIn(email).catch(() => undefined)
              }}
            >
              <label className="sr-only" htmlFor="login-prompt-email">
                Email
              </label>
              <input
                id="login-prompt-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button type="submit" size="lg" disabled={signingIn || !configured}>
                <Mail className="h-4 w-4" />
                {signingIn ? "Sending link…" : "Email me a magic link"}
              </Button>
            </form>
          )}
          <Button type="button" variant="outline" onClick={continueLocally}>
            Continue locally
          </Button>
        </div>
      </div>
    </div>
  )
}
