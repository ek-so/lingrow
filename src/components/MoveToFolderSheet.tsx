import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  FolderIcon,
  LibrarySearchHeader,
  ResultGroup,
  ResultRow,
} from "@/components/library-sheet"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Folder } from "@/types"
import { Home } from "lucide-react"

type Destination =
  | { id: null; name: "My sets" }
  | { id: string; name: string }

interface MoveToFolderSheetProps {
  open: boolean
  title: string
  folders: Folder[]
  /** Currently selected folder id, or null for My sets (root). */
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

  const destinations = useMemo(() => {
    const items: Destination[] = []
    // Root is only offered when the item isn’t already there.
    if (currentFolderId != null) {
      items.push({ id: null, name: "My sets" })
    }
    const folderItems = [...folders]
      .filter((folder) => {
        if (folder.id === currentFolderId) return false
        if (disabledFolderIds?.has(folder.id)) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ id: folder.id, name: folder.name }))
    items.push(...folderItems)
    return items
  }, [folders, currentFolderId, disabledFolderIds])

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!normalizedQuery) return destinations
    return destinations.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
  }, [destinations, normalizedQuery])

  if (!open) return null

  function renderRow(item: Destination) {
    if (item.id == null) {
      return (
        <ResultRow
          key="root"
          icon={<Home className="h-4 w-4 shrink-0 text-primary" />}
          title={item.name}
          subtitle="Library root"
          onClick={() => onSelect(null)}
        />
      )
    }
    return (
      <ResultRow
        key={item.id}
        icon={<FolderIcon className="h-4 w-4 shrink-0 text-primary" />}
        title={item.name}
        subtitle="Folder"
        onClick={() => onSelect(item.id)}
      />
    )
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-folder-title"
      className="fixed inset-0 z-[100] flex flex-col bg-background"
    >
      <LibrarySearchHeader
        titleId="move-folder-title"
        title={title}
        inputId={inputId}
        inputLabel="Choose a destination folder"
        placeholder="Move to folder…"
        query={query}
        onQueryChange={setQuery}
        onCancel={onCancel}
        inputRef={inputRef}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-2 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {!searching ? (
            destinations.length > 0 ? (
              <ResultGroup title="Destination folders">
                {destinations.map(renderRow)}
              </ResultGroup>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No other folders to move into. Create one from the + menu.
              </p>
            )
          ) : filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{trimmed}”.
            </p>
          ) : (
            <ResultGroup title="Folders">{filtered.map(renderRow)}</ResultGroup>
          )}
        </div>
      </div>
    </div>
  )
}
