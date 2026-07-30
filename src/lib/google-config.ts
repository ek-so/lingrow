/** Google OAuth client ID from Vite env (set at build time). */
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ""

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
