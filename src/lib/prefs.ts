import {
  DEFAULT_LIBRARY_SORT,
  isLibrarySortMode,
  type LibrarySortMode,
} from "@/lib/library-sort"

const QUIET_MODE_KEY = "lingrow.quietMode.v1"
const LIBRARY_SORT_KEY = "lingrow.librarySort.v1"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
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
    return isLibrarySortMode(raw) ? raw : DEFAULT_LIBRARY_SORT
  } catch {
    return DEFAULT_LIBRARY_SORT
  }
}

export function saveLibrarySortMode(mode: LibrarySortMode) {
  if (!canUseStorage()) return
  localStorage.setItem(LIBRARY_SORT_KEY, mode)
}
