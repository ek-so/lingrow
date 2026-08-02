import {
  DEFAULT_LIBRARY_SORT,
  isLibrarySortMode,
  type LibrarySortMode,
} from "@/lib/library-sort"

const LOGIN_PROMPT_KEY = "lingrow.loginPrompt.v1"
const QUIET_MODE_KEY = "lingrow.quietMode.v1"
const LIBRARY_SORT_KEY = "lingrow.librarySort.v1"

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

/** Global study mute — persists across sets. */
export function loadQuietMode(): boolean {
  if (!canUseStorage()) return false
  try {
    return localStorage.getItem(QUIET_MODE_KEY) === "1"
  } catch {
    return false
  }
}

export function saveQuietMode(quiet: boolean) {
  if (!canUseStorage()) return
  localStorage.setItem(QUIET_MODE_KEY, quiet ? "1" : "0")
}

export function loadLibrarySortMode(): LibrarySortMode {
  if (!canUseStorage()) return DEFAULT_LIBRARY_SORT
  try {
    const raw = localStorage.getItem(LIBRARY_SORT_KEY)
    // Migrate removed “manual” preference to alphabetical.
    if (raw === "manual") return DEFAULT_LIBRARY_SORT
    return isLibrarySortMode(raw) ? raw : DEFAULT_LIBRARY_SORT
  } catch {
    return DEFAULT_LIBRARY_SORT
  }
}

export function saveLibrarySortMode(mode: LibrarySortMode) {
  if (!canUseStorage()) return
  localStorage.setItem(LIBRARY_SORT_KEY, mode)
}
