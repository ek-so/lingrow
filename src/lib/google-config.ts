const CLIENT_ID_KEY = "lingrow.googleClientId.v1"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function envClientId() {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ""
}

/** Client ID from env build, or a value saved in Profile. */
export function getGoogleClientId(): string {
  const fromEnv = envClientId()
  if (fromEnv) return fromEnv
  if (!canUseStorage()) return ""
  return localStorage.getItem(CLIENT_ID_KEY)?.trim() ?? ""
}

export function loadSavedGoogleClientId(): string {
  if (!canUseStorage()) return ""
  return localStorage.getItem(CLIENT_ID_KEY)?.trim() ?? ""
}

export function saveGoogleClientId(clientId: string) {
  if (!canUseStorage()) return
  const trimmed = clientId.trim()
  if (!trimmed) localStorage.removeItem(CLIENT_ID_KEY)
  else localStorage.setItem(CLIENT_ID_KEY, trimmed)
}

export function isGoogleConfigured() {
  return getGoogleClientId().length > 0
}

/** True when the build baked in a client ID (Profile field is read-only then). */
export function hasEnvGoogleClientId() {
  return envClientId().length > 0
}

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ")

export const LINGROW_SPREADSHEET_TITLE = "Lingrow Collections"
