const LOGIN_PROMPT_KEY = "lingrow.loginPrompt.v1"

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
