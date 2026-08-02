import type { CollectionFormValues } from "@/lib/collection-form"

const PREFIX = "lingrow.new-set.draft.v1"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function newSetDraftKey(folderId: string | null): string {
  return `${PREFIX}:${folderId ?? "root"}`
}

export function saveNewSetDraft(key: string, values: CollectionFormValues) {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(key, JSON.stringify(values))
  } catch {
    // Quota / private mode — ignore
  }
}

export function loadNewSetDraft(key: string): CollectionFormValues | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CollectionFormValues
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

export function clearNewSetDraft(key: string) {
  if (!canUseStorage()) return
  localStorage.removeItem(key)
}
