import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  BrowseRow,
  FolderIcon,
  Layers,
  LibrarySearchHeader,
  ResultGroup,
  ResultRow,
  type LibrarySheetItem,
} from "@/components/library-sheet"
import { folderAncestors } from "@/lib/folders"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Collection, Folder } from "@/types"

interface MoveHereSheetProps {
  open: boolean
  /** Destination folder; null means Home (root). */
  destinationFolderId: string | null
  folders: Folder[]
  collections: Collection[]
  onSelect: (item: LibrarySheetItem) => void
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
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)

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

  const movableItems = useMemo(() => {
    const folderItems: LibrarySheetItem[] = folders
      .filter((folder) => {
        if (blockedFolderIds.has(folder.id)) return false
        if (folder.parentId === destinationFolderId) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name }))

    const setItems: LibrarySheetItem[] = collections
      .filter((c) => (c.folderId ?? null) !== destinationFolderId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((collection) => ({
        kind: "collection" as const,
        id: collection.id,
        name: collection.name,
        description: collection.description,
      }))

    return [...folderItems, ...setItems]
  }, [folders, collections, blockedFolderIds, destinationFolderId])

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const filteredItems = useMemo(() => {
    if (!normalizedQuery) return movableItems
    return movableItems.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
  }, [movableItems, normalizedQuery])

  const folderResults = filteredItems.filter((item) => item.kind === "folder")
  const setResults = filteredItems.filter((item) => item.kind === "collection")

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-here-title"
      className="fixed inset-0 z-[100] flex flex-col bg-background"
    >
      <LibrarySearchHeader
        titleId="move-here-title"
        title="Move here"
        inputId={inputId}
        inputLabel="Move here set or folder"
        placeholder="Move here set or folder…"
        query={query}
        onQueryChange={setQuery}
        onCancel={onCancel}
        inputRef={inputRef}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-2 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {!searching ? (
            movableItems.length > 0 ? (
              <ResultGroup title="Available sets & folders">
                {movableItems.map((item) => (
                  <BrowseRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onSelect={onSelect}
                  />
                ))}
              </ResultGroup>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nothing else to move here.
              </p>
            )
          ) : filteredItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{trimmed}”.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {folderResults.length > 0 ? (
                <ResultGroup title="Folders">
                  {folderResults.map((item) => (
                    <ResultRow
                      key={`folder-${item.id}`}
                      icon={<FolderIcon className="h-4 w-4 shrink-0 text-primary" />}
                      title={item.name}
                      subtitle="Folder"
                      onClick={() => onSelect(item)}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {setResults.length > 0 ? (
                <ResultGroup title="Sets">
                  {setResults.map((item) => (
                    <ResultRow
                      key={`set-${item.id}`}
                      icon={<Layers className="h-4 w-4 shrink-0 text-primary" />}
                      title={item.name}
                      subtitle={
                        item.kind === "collection" ? item.description || "Set" : "Set"
                      }
                      onClick={() => onSelect(item)}
                    />
                  ))}
                </ResultGroup>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
