/** Public OAuth Web client ID for Lingrow (safe to ship in the frontend). */
const BUILTIN_GOOGLE_CLIENT_ID =
  "843982348245-qq0fqarm7lv7bq1tf2471brc32fg211a.apps.googleusercontent.com"

/** Prefer build env override; fall back to the shipped Lingrow client. */
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
  BUILTIN_GOOGLE_CLIENT_ID

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
].join(" ")

export const LINGROW_SPREADSHEET_TITLE = "Lingrow Collections"

export function isGoogleConfigured() {
  return GOOGLE_CLIENT_ID.length > 0
}
