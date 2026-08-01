import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { folderAncestors } from "@/lib/folders"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Collection, Folder } from "@/types"
import { cn } from "@/lib/utils"
import { Folder as FolderIcon, Layers, Search, X } from "lucide-react"

type MoveHereItem =
  | { kind: "folder"; id: string; name: string }
  | { kind: "collection"; id: string; name: string; description?: string }

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
    const folderItems: MoveHereItem[] = folders
      .filter((folder) => {
        if (blockedFolderIds.has(folder.id)) return false
        if (folder.parentId === destinationFolderId) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name }))

    const setItems: MoveHereItem[] = collections
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
      <header className="shrink-0 border-b border-border/80">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <h2 id="move-here-title" className="sr-only">
            Move here
          </h2>
          <label htmlFor={inputId} className="sr-only">
            Move here set or folder
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Move here set or folder…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                "h-11 w-full rounded-md border border-border bg-card py-2 pl-9 text-base outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring",
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
            onClick={onCancel}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </header>

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

function BrowseRow({
  item,
  onSelect,
}: {
  item: MoveHereItem
  onSelect: (item: MoveHereItem) => void
}) {
  if (item.kind === "folder") {
    return (
      <ResultRow
        icon={<FolderIcon className="h-4 w-4 shrink-0 text-primary" />}
        title={item.name}
        subtitle="Folder"
        onClick={() => onSelect(item)}
      />
    )
  }
  return (
    <ResultRow
      icon={<Layers className="h-4 w-4 shrink-0 text-primary" />}
      title={item.name}
      subtitle={item.description || "Set"}
      onClick={() => onSelect(item)}
    />
  )
}

function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col">{children}</ul>
    </section>
  )
}

function ResultRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
      >
        {icon}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
      </button>
    </li>
  )
}
