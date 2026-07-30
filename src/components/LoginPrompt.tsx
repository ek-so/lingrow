import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { Cloud, HardDrive } from "lucide-react"

export function LoginPrompt() {
  const {
    showLoginPrompt,
    signIn,
    continueLocally,
    clientId,
    setClientId,
    clientIdLockedByEnv,
    error,
    signingIn,
  } = useAuth()
  const [draftId, setDraftId] = useState(clientId)

  useEffect(() => {
    setDraftId(clientId)
  }, [clientId])

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

  async function onSignIn() {
    if (!clientIdLockedByEnv) {
      const next = draftId.trim()
      if (next !== clientId) setClientId(next)
    }
    try {
      await signIn()
    } catch {
      // error surfaced via auth context
    }
  }

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

        {!clientIdLockedByEnv ? (
          <div className="mt-4">
            <label htmlFor="login-google-client-id" className="text-sm font-medium">
              Google OAuth client ID
            </label>
            <input
              id="login-google-client-id"
              type="text"
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              placeholder="123….apps.googleusercontent.com"
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Create a Web client ID in Google Cloud, enable Sheets + Drive APIs, and add this
              site’s origin. You can also set it later in{" "}
              <Link to="/profile" className="underline" onClick={continueLocally}>
                Profile
              </Link>
              .
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            disabled={signingIn}
            onClick={() => {
              void onSignIn()
            }}
          >
            {signingIn ? "Opening Google…" : "Sign in with Google"}
          </Button>
          <Button type="button" variant="outline" onClick={continueLocally}>
            Continue locally
          </Button>
        </div>
      </div>
    </div>
  )
}
