import { useEffect, useId, useMemo, useRef, useState } from "react"
import { flattenFolderTree, folderAncestors } from "@/lib/folders"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Collection, Folder } from "@/types"
import { cn } from "@/lib/utils"
import { Folder as FolderIcon, Layers, Search, X } from "lucide-react"

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
  const searchId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    setQuery("")
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onCancel])

  useEffect(() => {
    if (!open) return
    const focus = () => inputRef.current?.focus({ preventScroll: true })
    const raf = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(raf)
  }, [open])

  const blockedFolderIds = useMemo(() => {
    const ids = new Set<string>()
    if (destinationFolderId) ids.add(destinationFolderId)
    for (const ancestor of folderAncestors(folders, destinationFolderId)) {
      ids.add(ancestor.id)
    }
    return ids
  }, [folders, destinationFolderId])

  const movableFolders = useMemo(() => {
    return flattenFolderTree(folders).filter(({ folder }) => {
      if (blockedFolderIds.has(folder.id)) return false
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

  const normalizedQuery = query.trim().toLowerCase()

  const filteredFolders = useMemo(() => {
    if (!normalizedQuery) return movableFolders
    return movableFolders.filter(({ folder }) =>
      folder.name.toLowerCase().includes(normalizedQuery),
    )
  }, [movableFolders, normalizedQuery])

  const filteredSets = useMemo(() => {
    if (!normalizedQuery) return movableSets
    return movableSets.filter((c) => c.name.toLowerCase().includes(normalizedQuery))
  }, [movableSets, normalizedQuery])

  if (!open) return null

  const empty = filteredFolders.length === 0 && filteredSets.length === 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-here-title"
      className="fixed inset-0 z-[100] flex flex-col bg-background"
    >
      <header className="shrink-0 border-b border-border/80">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <h2 id="move-here-title" className="sr-only">
            Move here
          </h2>
          <label htmlFor={searchId} className="sr-only">
            Search
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sets and folders"
              autoComplete="off"
              className={cn(
                "h-11 w-full rounded-md border border-input bg-card py-2 pl-9 text-base outline-none focus:ring-2 focus:ring-ring",
                query ? "pr-10" : "pr-3",
              )}
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("")
                  inputRef.current?.focus({ preventScroll: true })
                }}
                className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-5 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {empty ? (
            <p className="px-1 py-6 text-sm text-muted-foreground">
              {normalizedQuery ? "No matches." : "Nothing else to move here."}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {filteredFolders.map(({ folder, depth }) => (
                <li key={`folder-${folder.id}`}>
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({ kind: "folder", id: folder.id, name: folder.name })
                    }
                    className="flex w-full items-center gap-2.5 px-3 py-3.5 text-left text-sm transition-colors hover:bg-secondary"
                    style={{
                      paddingLeft: normalizedQuery ? undefined : `${12 + depth * 16}px`,
                    }}
                  >
                    <FolderIcon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate font-medium">{folder.name}</span>
                  </button>
                </li>
              ))}
              {filteredSets.map((c) => (
                <li key={`set-${c.id}`}>
                  <button
                    type="button"
                    onClick={() =>
                      onSelect({ kind: "collection", id: c.id, name: c.name })
                    }
                    className="flex w-full items-center gap-2.5 px-3 py-3.5 text-left text-sm transition-colors hover:bg-secondary"
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate font-medium">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
