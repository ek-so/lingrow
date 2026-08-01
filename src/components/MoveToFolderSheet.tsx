import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { flattenFolderTree } from "@/lib/folders"
import type { Folder } from "@/types"
import { Folder as FolderIcon, Home } from "lucide-react"
import { cn } from "@/lib/utils"

interface MoveToFolderSheetProps {
  open: boolean
  title: string
  folders: Folder[]
  /** Currently selected folder id, or null for Home. */
  currentFolderId: string | null
  /** Folder ids that cannot be chosen (e.g. self + descendants when moving a folder). */
  disabledFolderIds?: Set<string>
  onSelect: (folderId: string | null) => void
  onCancel: () => void
}

export function MoveToFolderSheet({
  open,
  title,
  folders,
  currentFolderId,
  disabledFolderIds,
  onSelect,
  onCancel,
}: MoveToFolderSheetProps) {
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

  if (!open) return null

  const tree = flattenFolderTree(folders)

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
        aria-labelledby="move-folder-title"
        className="relative z-10 flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        <h2 id="move-folder-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose a destination folder.</p>

        <div className="mt-4 min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          <button
            type="button"
            disabled={currentFolderId == null}
            onClick={() => onSelect(null)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-50",
              currentFolderId == null && "bg-accent text-accent-foreground",
            )}
          >
            <Home className="h-4 w-4 shrink-0" />
            <span className="font-medium">Home</span>
            {currentFolderId == null ? (
              <span className="ml-auto text-xs text-muted-foreground">Current</span>
            ) : null}
          </button>
          {tree.map(({ folder, depth }) => {
            const disabled = disabledFolderIds?.has(folder.id) ?? false
            const current = currentFolderId === folder.id
            return (
              <button
                key={folder.id}
                type="button"
                disabled={disabled || current}
                onClick={() => onSelect(folder.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 border-t border-border px-3 py-3 text-left text-sm transition-colors hover:bg-secondary disabled:opacity-40",
                  current && "bg-accent text-accent-foreground",
                )}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
              >
                <FolderIcon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 truncate font-medium">{folder.name}</span>
                {current ? (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">Current</span>
                ) : null}
              </button>
            )
          })}
          {folders.length === 0 ? (
            <p className="border-t border-border px-3 py-3 text-sm text-muted-foreground">
              No folders yet — create one from the + menu.
            </p>
          ) : null}
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
