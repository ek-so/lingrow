import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AuthForm } from "@/components/AuthForm"
import { useAuth } from "@/lib/auth-context"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import { Cloud, HardDrive } from "lucide-react"

export function LoginPrompt() {
  const {
    showLoginPrompt,
    continueLocally,
    error,
    configured,
    confirmEmailSentTo,
    passwordResetSentTo,
    passwordRecovery,
  } = useAuth()

  const open = showLoginPrompt || passwordRecovery
  useBodyScrollLock(open)

  useEffect(() => {
    if (!showLoginPrompt || passwordRecovery) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") continueLocally()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [showLoginPrompt, passwordRecovery, continueLocally])

  if (!open) return null

  const waitingForConfirm = Boolean(confirmEmailSentTo)
  const waitingForReset = Boolean(passwordResetSentTo)

  let title = "Sync collections to the cloud?"
  let body =
    "Create an account or sign in with email and password to keep your word lists in the cloud. Otherwise, collections stay on this device only."
  if (passwordRecovery) {
    title = "Set a new password"
    body = "You opened a password reset link. Choose a password to use with your email next time."
  } else if (waitingForReset) {
    title = "Check your email"
    body = "Open the reset link on this device, then choose a new password."
  } else if (waitingForConfirm) {
    title = "Confirm your email"
    body =
      "Check your inbox to finish creating your account, then sign in with your email and password."
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden sm:items-center">
      {!passwordRecovery ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="absolute inset-0 bg-black/40"
          onClick={continueLocally}
        />
      ) : (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="login-prompt-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>

        {!waitingForConfirm && !waitingForReset && !passwordRecovery ? (
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex gap-2.5">
              <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                <span className="font-medium text-foreground">Email &amp; password</span>
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
          <AuthForm size="lg" />
          {!passwordRecovery ? (
            <Button type="button" variant="outline" onClick={continueLocally}>
              Continue locally
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
