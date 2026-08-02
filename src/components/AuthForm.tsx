import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"
import { LogIn, UserPlus } from "lucide-react"

type AuthMode = "sign_in" | "sign_up"

interface AuthFormProps {
  /** Larger submit button for the first-visit sheet. */
  size?: "default" | "lg"
  /** Stack fields vertically (sheet) or allow a wider layout (profile). */
  layout?: "stack" | "profile"
}

const inputClassName =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"

export function AuthForm({ size = "default", layout = "stack" }: AuthFormProps) {
  const { signIn, signUp, signingIn, configured, confirmEmailSentTo, clearConfirmEmail } =
    useAuth()
  const [mode, setMode] = useState<AuthMode>("sign_in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)

  const idPrefix = layout === "profile" ? "profile" : "login-prompt"
  const isSignUp = mode === "sign_up"

  if (confirmEmailSentTo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{confirmEmailSentTo}</span>. Open it to
          activate your account, then sign in here.
        </p>
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={() => {
            clearConfirmEmail()
            setMode("sign_in")
            setPassword("")
            setConfirmPassword("")
            setLocalError(null)
          }}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        setLocalError(null)
        if (isSignUp && password !== confirmPassword) {
          setLocalError("Passwords do not match.")
          return
        }
        const action = isSignUp ? signUp : signIn
        void action(email, password).catch(() => undefined)
      }}
    >
      <div
        role="group"
        aria-label="Account mode"
        className="inline-flex w-full rounded-lg border border-border bg-secondary p-0.5"
      >
        <button
          type="button"
          aria-pressed={!isSignUp}
          onClick={() => {
            setMode("sign_in")
            setLocalError(null)
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            !isSignUp
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-pressed={isSignUp}
          onClick={() => {
            setMode("sign_up")
            setLocalError(null)
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            isSignUp
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Create account
        </button>
      </div>

      <label className="sr-only" htmlFor={`${idPrefix}-email`}>
        Email
      </label>
      <input
        id={`${idPrefix}-email`}
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClassName}
      />

      <label className="sr-only" htmlFor={`${idPrefix}-password`}>
        Password
      </label>
      <input
        id={`${idPrefix}-password`}
        type="password"
        autoComplete={isSignUp ? "new-password" : "current-password"}
        required
        minLength={6}
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClassName}
      />

      {isSignUp ? (
        <>
          <label className="sr-only" htmlFor={`${idPrefix}-confirm-password`}>
            Confirm password
          </label>
          <input
            id={`${idPrefix}-confirm-password`}
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClassName}
          />
        </>
      ) : null}

      {localError ? <p className="text-sm text-destructive">{localError}</p> : null}

      <Button type="submit" size={size} disabled={signingIn || !configured}>
        {isSignUp ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
        {signingIn
          ? isSignUp
            ? "Creating account…"
            : "Signing in…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </Button>
    </form>
  )
}
