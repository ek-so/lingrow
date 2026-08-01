import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { flattenFolderTree, folderAncestors } from "@/lib/folders"
import type { Collection, Folder } from "@/types"
import { Folder as FolderIcon, Layers } from "lucide-react"

type MoveHereItem =
  | { kind: "folder"; id: string; name: string }
  | { kind: "collection"; id: string; name: string }

interface MoveHereSheetProps {
  open: boolean
  /** Destination folder; null means Home (root). */
  destinationFolderId: string | null
  folders: Folder[]
  collections: Collection[]
  onSelect: (item: MoveHereItem) => void
  onCancel: () => void
}

export function MoveHereSheet({
  open,
  destinationFolderId,
  folders,
  collections,
  onSelect,
  onCancel,
}: MoveHereSheetProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onCancel])

  const blockedFolderIds = useMemo(() => {
    const ids = new Set<string>()
    // Cannot move the destination folder into itself.
    if (destinationFolderId) ids.add(destinationFolderId)
    // Moving an ancestor into a descendant would create a cycle.
    for (const ancestor of folderAncestors(folders, destinationFolderId)) {
      ids.add(ancestor.id)
    }
    return ids
  }, [folders, destinationFolderId])

  const movableFolders = useMemo(() => {
    return flattenFolderTree(folders).filter(({ folder }) => {
      if (blockedFolderIds.has(folder.id)) return false
      // Already in this location.
      if (folder.parentId === destinationFolderId) return false
      return true
    })
  }, [folders, blockedFolderIds, destinationFolderId])

  const movableSets = useMemo(() => {
    return collections
      .filter((c) => (c.folderId ?? null) !== destinationFolderId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [collections, destinationFolderId])

  if (!open) return null

  const empty = movableFolders.length === 0 && movableSets.length === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-here-title"
        className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        <h2 id="move-here-title" className="text-lg font-semibold tracking-tight">
          Move here
        </h2>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          {empty ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Nothing else to move here.
            </p>
          ) : null}

          {movableFolders.map(({ folder, depth }) => (
            <button
              key={`folder-${folder.id}`}
              type="button"
              onClick={() => onSelect({ kind: "folder", id: folder.id, name: folder.name })}
              className="flex w-full items-center gap-2.5 border-b border-border px-3 py-3 text-left text-sm transition-colors hover:bg-secondary last:border-b-0"
              style={{ paddingLeft: `${12 + depth * 16}px` }}
            >
              <FolderIcon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate font-medium">{folder.name}</span>
            </button>
          ))}

          {movableSets.map((c) => (
            <button
              key={`set-${c.id}`}
              type="button"
              onClick={() => onSelect({ kind: "collection", id: c.id, name: c.name })}
              className="flex w-full items-center gap-2.5 border-b border-border px-3 py-3 text-left text-sm transition-colors hover:bg-secondary last:border-b-0"
            >
              <Layers className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate font-medium">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 shrink-0">
          <Button type="button" variant="ghost" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
