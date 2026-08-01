export type RecentKind = "collection" | "folder"

export interface RecentItem {
  kind: RecentKind
  id: string
  openedAt: string
}

const RECENT_KEY = "lingrow.recent.v1"
const MAX_RECENT = 16

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function parseRecent(raw: string | null): RecentItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item): RecentItem | null => {
        if (!item || typeof item !== "object") return null
        const row = item as Record<string, unknown>
        if (row.kind !== "collection" && row.kind !== "folder") return null
        if (typeof row.id !== "string" || !row.id) return null
        return {
          kind: row.kind,
          id: row.id,
          openedAt: typeof row.openedAt === "string" ? row.openedAt : new Date(0).toISOString(),
        }
      })
      .filter((item): item is RecentItem => item != null)
  } catch {
    return []
  }
}

export function loadRecentItems(): RecentItem[] {
  if (!canUseStorage()) return []
  return parseRecent(localStorage.getItem(RECENT_KEY))
}

export function saveRecentItems(items: RecentItem[]) {
  if (!canUseStorage()) return
  localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)))
}

/** Record that a set or folder was opened (most recent first). */
export function recordRecentOpen(kind: RecentKind, id: string): RecentItem[] {
  const next: RecentItem[] = [
    { kind, id, openedAt: new Date().toISOString() },
    ...loadRecentItems().filter((item) => !(item.kind === kind && item.id === id)),
  ].slice(0, MAX_RECENT)
  saveRecentItems(next)
  return next
}
