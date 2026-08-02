import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MIN_PASSWORD_LENGTH, useAuth } from "@/lib/auth-context"
import { KeyRound, LogIn, Mail, UserPlus } from "lucide-react"

type AuthMode = "sign_in" | "sign_up" | "forgot_password"

interface AuthFormProps {
  /** Larger submit button for the first-visit sheet. */
  size?: "default" | "lg"
  /** Stack fields vertically (sheet) or allow a wider layout (profile). */
  layout?: "stack" | "profile"
}

const inputClassName =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"

export function AuthForm({ size = "default", layout = "stack" }: AuthFormProps) {
  const {
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signingIn,
    configured,
    confirmEmailSentTo,
    passwordResetSentTo,
    passwordRecovery,
    clearConfirmEmail,
    clearPasswordResetSent,
  } = useAuth()
  const [mode, setMode] = useState<AuthMode>("sign_in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [localError, setLocalError] = useState<string | null>(null)
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  const idPrefix = layout === "profile" ? "profile" : "login-prompt"
  const isSignUp = mode === "sign_up"
  const isForgot = mode === "forgot_password"

  if (passwordRecovery) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setLocalError(null)
          if (password !== confirmPassword) {
            setLocalError("Passwords do not match.")
            return
          }
          void updatePassword(password)
            .then(() => {
              setPassword("")
              setConfirmPassword("")
              setPasswordUpdated(true)
            })
            .catch(() => undefined)
        }}
      >
        <p className="text-sm text-muted-foreground">
          Choose a new password for your account. You will use this with your email next time you
          sign in.
        </p>
        <label className="sr-only" htmlFor={`${idPrefix}-new-password`}>
          New password
        </label>
        <input
          id={`${idPrefix}-new-password`}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClassName}
        />
        <label className="sr-only" htmlFor={`${idPrefix}-confirm-new-password`}>
          Confirm new password
        </label>
        <input
          id={`${idPrefix}-confirm-new-password`}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClassName}
        />
        {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        <Button type="submit" size={size} disabled={signingIn || !configured}>
          <KeyRound className="h-4 w-4" />
          {signingIn ? "Saving…" : "Save new password"}
        </Button>
      </form>
    )
  }

  if (passwordUpdated) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Your password was updated. You can keep using Lingrow, or sign out and sign back in with
          email and password.
        </p>
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={() => {
            setPasswordUpdated(false)
            setMode("sign_in")
          }}
        >
          Done
        </Button>
      </div>
    )
  }

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

  if (passwordResetSentTo) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          If an account exists for{" "}
          <span className="font-medium text-foreground">{passwordResetSentTo}</span>, we sent a
          link to set a new password. Open it on this device.
        </p>
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={() => {
            clearPasswordResetSent()
            setMode("sign_in")
            setPassword("")
            setLocalError(null)
          }}
        >
          Back to sign in
        </Button>
      </div>
    )
  }

  if (isForgot) {
    return (
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setLocalError(null)
          void requestPasswordReset(email).catch(() => undefined)
        }}
      >
        <p className="text-sm text-muted-foreground">
          Enter the email for your account. We will send a link so you can set a password (including
          for accounts that previously used a magic link).
        </p>
        <label className="sr-only" htmlFor={`${idPrefix}-reset-email`}>
          Email
        </label>
        <input
          id={`${idPrefix}-reset-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClassName}
        />
        {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
        <Button type="submit" size={size} disabled={signingIn || !configured}>
          <Mail className="h-4 w-4" />
          {signingIn ? "Sending…" : "Email reset link"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size={size}
          onClick={() => {
            setMode("sign_in")
            setLocalError(null)
          }}
        >
          Back to sign in
        </Button>
      </form>
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
        minLength={MIN_PASSWORD_LENGTH}
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
            minLength={MIN_PASSWORD_LENGTH}
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClassName}
          />
        </>
      ) : (
        <button
          type="button"
          className="self-start text-sm text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setMode("forgot_password")
            setLocalError(null)
            setPassword("")
          }}
        >
          Forgot password?
        </button>
      )}

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
