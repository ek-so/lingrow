/** Local per-set study cursor (word index) — not synced to the cloud. */

const PROGRESS_KEY = "lingrow.studyProgress.v1"

export interface StudyProgress {
  index: number
  updatedAt: string
}

type ProgressMap = Record<string, StudyProgress>

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function loadAll(): ProgressMap {
  if (!canUseStorage()) return {}
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return {}
    const out: ProgressMap = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!id || !value || typeof value !== "object") continue
      const row = value as Record<string, unknown>
      const index = typeof row.index === "number" && Number.isFinite(row.index) ? Math.max(0, Math.floor(row.index)) : 0
      out[id] = {
        index,
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
      }
    }
    return out
  } catch {
    return {}
  }
}

function saveAll(map: ProgressMap) {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map))
  } catch {
    // Quota / private mode — ignore
  }
}

export function loadStudyProgress(collectionId: string): StudyProgress | null {
  return loadAll()[collectionId] ?? null
}

/** Full progress map (used for “recently exercised” sorting). */
export function loadStudyProgressMap(): ProgressMap {
  return loadAll()
}

export function saveStudyProgress(collectionId: string, index: number) {
  if (!collectionId) return
  const map = loadAll()
  map[collectionId] = {
    index: Math.max(0, Math.floor(index)),
    updatedAt: new Date().toISOString(),
  }
  saveAll(map)
}

export function clearStudyProgress(collectionId: string) {
  if (!collectionId) return
  const map = loadAll()
  if (!(collectionId in map)) return
  delete map[collectionId]
  saveAll(map)
}

/** Short relative label for when a set was last practiced. */
export function formatLastRepetition(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ""
  const diff = Math.max(0, nowMs - t)
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
