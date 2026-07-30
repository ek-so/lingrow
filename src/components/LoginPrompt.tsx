import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { Cloud, HardDrive } from "lucide-react"

export function LoginPrompt() {
  const { showLoginPrompt, signIn, continueLocally, configured, error } = useAuth()

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
          Save collections to Google?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your Google account to keep your word lists in a spreadsheet in Drive.
          Otherwise, collections stay on this device only.
        </p>

        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex gap-2.5">
            <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Google account</span>
              <span className="block text-muted-foreground">
                Sync across devices via a Lingrow spreadsheet you own.
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

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {!configured ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Google sign-in needs a client ID configured for this deployment.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            disabled={!configured}
            onClick={() => {
              void signIn().catch(() => undefined)
            }}
          >
            Sign in with Google
          </Button>
          <Button type="button" variant="outline" onClick={continueLocally}>
            Continue locally
          </Button>
        </div>
      </div>
    </div>
  )
}
