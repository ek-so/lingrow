import type { Folder } from "@/types"

/** Descendants of `folderId` (not including itself). */
export function descendantFolderIds(folders: Folder[], folderId: string): Set<string> {
  const childrenByParent = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const list = childrenByParent.get(f.parentId) ?? []
    list.push(f)
    childrenByParent.set(f.parentId, list)
  }
  const out = new Set<string>()
  const stack = [...(childrenByParent.get(folderId) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    if (out.has(next.id)) continue
    out.add(next.id)
    const kids = childrenByParent.get(next.id)
    if (kids) stack.push(...kids)
  }
  return out
}

/** True if moving `folderId` into `targetParentId` would create a cycle. */
export function wouldCreateFolderCycle(
  folders: Folder[],
  folderId: string,
  targetParentId: string | null
): boolean {
  if (targetParentId == null) return false
  if (targetParentId === folderId) return true
  return descendantFolderIds(folders, folderId).has(targetParentId)
}

/** Breadcrumb from root to the given folder (inclusive). */
export function folderAncestors(folders: Folder[], folderId: string | null): Folder[] {
  if (!folderId) return []
  const byId = new Map(folders.map((f) => [f.id, f]))
  const chain: Folder[] = []
  let current: string | null = folderId
  const seen = new Set<string>()
  while (current) {
    if (seen.has(current)) break
    seen.add(current)
    const folder = byId.get(current)
    if (!folder) break
    chain.unshift(folder)
    current = folder.parentId
  }
  return chain
}

export type FolderTrailItem = {
  /** `null` for the library root (“My sets”). */
  id: string | null
  label: string
  to: string
}

/**
 * Jump targets from `fromFolderId` up through home: nearest parent first,
 * then each ancestor, ending with “My sets”.
 */
export function folderTrailUp(
  folders: Folder[],
  fromFolderId: string | null,
): FolderTrailItem[] {
  const chain = folderAncestors(folders, fromFolderId)
  const items: FolderTrailItem[] = [...chain]
    .reverse()
    .map((f) => ({
      id: f.id,
      label: f.name,
      to: `/folder/${f.id}`,
    }))
  items.push({ id: null, label: "My sets", to: "/" })
  return items
}

/** Flatten folders depth-first for pickers. */
export function flattenFolderTree(folders: Folder[]): { folder: Folder; depth: number }[] {
  const childrenByParent = new Map<string | null, Folder[]>()
  for (const f of folders) {
    const list = childrenByParent.get(f.parentId) ?? []
    list.push(f)
    childrenByParent.set(f.parentId, list)
  }
  // Preserve library array order (user-defined via drag-and-drop).

  const out: { folder: Folder; depth: number }[] = []
  function walk(parentId: string | null, depth: number) {
    for (const folder of childrenByParent.get(parentId) ?? []) {
      out.push({ folder, depth })
      walk(folder.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function countItemsInFolder(
  folders: Folder[],
  collectionFolderIds: (string | null | undefined)[],
  folderId: string
): { folders: number; sets: number } {
  const childFolders = folders.filter((f) => f.parentId === folderId).length
  const sets = collectionFolderIds.filter((id) => id === folderId).length
  return { folders: childFolders, sets }
}
