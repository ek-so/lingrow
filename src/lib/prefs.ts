const LOGIN_PROMPT_KEY = "lingrow.loginPrompt.v1"
const AUTH_SESSION_KEY = "lingrow.auth.v1"
const SPREADSHEET_KEY_PREFIX = "lingrow.spreadsheet.v1."

export interface LoginPromptState {
  /** User dismissed the first-visit login suggestion. */
  dismissed: boolean
  decidedAt?: string
}

export interface AuthSession {
  id: string
  email: string
  name: string
  picture?: string
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function loadLoginPromptState(): LoginPromptState {
  if (!canUseStorage()) return { dismissed: false }
  try {
    const raw = localStorage.getItem(LOGIN_PROMPT_KEY)
    if (!raw) return { dismissed: false }
    const parsed = JSON.parse(raw) as Partial<LoginPromptState>
    return { dismissed: Boolean(parsed.dismissed), decidedAt: parsed.decidedAt }
  } catch {
    return { dismissed: false }
  }
}

export function saveLoginPromptState(state: LoginPromptState) {
  if (!canUseStorage()) return
  localStorage.setItem(LOGIN_PROMPT_KEY, JSON.stringify(state))
}

export function dismissLoginPrompt() {
  saveLoginPromptState({ dismissed: true, decidedAt: new Date().toISOString() })
}

export function loadAuthSession(): AuthSession | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.name !== "string"
    ) {
      return null
    }
    return {
      id: parsed.id,
      email: parsed.email,
      name: parsed.name,
      picture: typeof parsed.picture === "string" ? parsed.picture : undefined,
    }
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession | null) {
  if (!canUseStorage()) return
  if (!session) {
    localStorage.removeItem(AUTH_SESSION_KEY)
    return
  }
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function loadSpreadsheetId(userId: string): string | null {
  if (!canUseStorage()) return null
  return localStorage.getItem(SPREADSHEET_KEY_PREFIX + userId)
}

export function saveSpreadsheetId(userId: string, spreadsheetId: string) {
  if (!canUseStorage()) return
  localStorage.setItem(SPREADSHEET_KEY_PREFIX + userId, spreadsheetId)
}

export function clearSpreadsheetId(userId: string) {
  if (!canUseStorage()) return
  localStorage.removeItem(SPREADSHEET_KEY_PREFIX + userId)
}
