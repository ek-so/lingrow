import type { Collection, Folder } from "@/types"
import { descendantFolderIds } from "@/lib/folders"
import type { StudyProgress } from "@/lib/study-progress"

export type LibrarySortMode = "name" | "added" | "edited" | "practiced"

export const LIBRARY_SORT_OPTIONS: { value: LibrarySortMode; label: string }[] = [
  { value: "name", label: "Alphabetical" },
  { value: "added", label: "Recently added" },
  { value: "edited", label: "Recently edited" },
  { value: "practiced", label: "Recently exercised" },
]

export const DEFAULT_LIBRARY_SORT: LibrarySortMode = "name"

const EPOCH_MS = 0

function timeMs(iso: string | undefined): number {
  if (!iso) return EPOCH_MS
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : EPOCH_MS
}

function compareName(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" })
}

/** Sort folders for display. */
export function sortFolders(
  folders: Folder[],
  mode: LibrarySortMode,
  ctx: {
    collections: Collection[]
    allFolders: Folder[]
    progressByCollectionId: Record<string, StudyProgress>
  },
): Folder[] {
  if (folders.length <= 1) return folders

  const practicedAt = new Map<string, number>()
  if (mode === "practiced") {
    for (const folder of folders) {
      const tree = descendantFolderIds(ctx.allFolders, folder.id)
      tree.add(folder.id)
      let max = EPOCH_MS
      for (const collection of ctx.collections) {
        const folderId = collection.folderId ?? null
        if (!folderId || !tree.has(folderId)) continue
        const ms = timeMs(ctx.progressByCollectionId[collection.id]?.updatedAt)
        if (ms > max) max = ms
      }
      practicedAt.set(folder.id, max)
    }
  }

  const sorted = [...folders]
  sorted.sort((a, b) => {
    switch (mode) {
      case "name":
        return compareName(a.name, b.name)
      case "added":
        return timeMs(b.createdAt) - timeMs(a.createdAt) || compareName(a.name, b.name)
      case "edited":
        return timeMs(b.updatedAt) - timeMs(a.updatedAt) || compareName(a.name, b.name)
      case "practiced":
        return (practicedAt.get(b.id) ?? 0) - (practicedAt.get(a.id) ?? 0) || compareName(a.name, b.name)
      default:
        return 0
    }
  })
  return sorted
}

/** Sort sets for display. */
export function sortCollections(
  collections: Collection[],
  mode: LibrarySortMode,
  progressByCollectionId: Record<string, StudyProgress>,
): Collection[] {
  if (collections.length <= 1) return collections

  const sorted = [...collections]
  sorted.sort((a, b) => {
    switch (mode) {
      case "name":
        return compareName(a.name, b.name)
      case "added":
        return timeMs(b.createdAt) - timeMs(a.createdAt) || compareName(a.name, b.name)
      case "edited":
        return timeMs(b.updatedAt) - timeMs(a.updatedAt) || compareName(a.name, b.name)
      case "practiced":
        return (
          timeMs(progressByCollectionId[b.id]?.updatedAt) -
            timeMs(progressByCollectionId[a.id]?.updatedAt) || compareName(a.name, b.name)
        )
      default:
        return 0
    }
  })
  return sorted
}

export function isLibrarySortMode(value: unknown): value is LibrarySortMode {
  return value === "name" || value === "added" || value === "edited" || value === "practiced"
}
