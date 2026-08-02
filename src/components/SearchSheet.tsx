import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router-dom"
import {
  BrowseRow,
  FolderIcon,
  Layers,
  LibrarySearchHeader,
  ResultGroup,
  ResultRow,
  Search,
  type LibrarySheetItem,
} from "@/components/library-sheet"
import { searchLibrary, type LibrarySearchResult } from "@/lib/library-search"
import { loadRecentItems, type RecentItem } from "@/lib/recent"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Collection, Folder } from "@/types"

interface SearchSheetProps {
  open: boolean
  collections: Collection[]
  folders: Folder[]
  onClose: () => void
}

export function SearchSheet({ open, collections, folders, onClose }: SearchSheetProps) {
  const navigate = useNavigate()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [recent, setRecent] = useState<RecentItem[]>([])

  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])
  const collectionById = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  )

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    setQuery("")
    setRecent(loadRecentItems())
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const focus = () => inputRef.current?.focus({ preventScroll: true })
    const raf = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(raf)
  }, [open])

  const results = useMemo(
    () => searchLibrary(deferredQuery, collections, folders),
    [deferredQuery, collections, folders],
  )

  const trimmed = query.trim()
  const searching = trimmed.length > 0

  const recentBrowse = useMemo(() => {
    const items: LibrarySheetItem[] = []
    for (const item of recent) {
      if (item.kind === "folder") {
        const folder = folderById.get(item.id)
        if (!folder) continue
        items.push({ kind: "folder", id: folder.id, name: folder.name })
      } else {
        const collection = collectionById.get(item.id)
        if (!collection) continue
        items.push({
          kind: "collection",
          id: collection.id,
          name: collection.name,
          description: collection.description,
        })
      }
    }
    return items
  }, [recent, folderById, collectionById])

  const allBrowse = useMemo(() => {
    const folderItems: LibrarySheetItem[] = [...folders]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name }))
    const setItems: LibrarySheetItem[] = [...collections]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((collection) => ({
        kind: "collection" as const,
        id: collection.id,
        name: collection.name,
        description: collection.description,
      }))
    return [...folderItems, ...setItems]
  }, [folders, collections])

  const restBrowse = useMemo(() => {
    if (recentBrowse.length === 0) return allBrowse
    const seen = new Set(recentBrowse.map((item) => `${item.kind}:${item.id}`))
    return allBrowse.filter((item) => !seen.has(`${item.kind}:${item.id}`))
  }, [recentBrowse, allBrowse])

  const hasBrowseItems = recentBrowse.length > 0 || restBrowse.length > 0

  if (!open) return null

  function go(path: string) {
    onClose()
    navigate(path)
  }

  function onSelectResult(result: LibrarySearchResult) {
    if (result.kind === "folder") {
      go(`/folder/${result.id}`)
      return
    }
    go(`/study/${result.kind === "word" ? result.collectionId : result.id}`)
  }

  function onSelectBrowse(item: LibrarySheetItem) {
    if (item.kind === "folder") {
      go(`/folder/${item.id}`)
      return
    }
    go(`/study/${item.id}`)
  }

  const folderResults = results.filter((r) => r.kind === "folder")
  const setResults = results.filter((r) => r.kind === "collection")
  const wordResults = results.filter((r) => r.kind === "word")

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="library-search-title"
      className="fixed inset-0 z-[100] flex flex-col bg-background"
    >
      <LibrarySearchHeader
        titleId="library-search-title"
        title="Search library"
        inputId={inputId}
        inputLabel="Search sets, folders, and words"
        placeholder="Search sets, folders, words…"
        query={query}
        onQueryChange={setQuery}
        onCancel={onClose}
        inputRef={inputRef}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-2 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {!searching ? (
            hasBrowseItems ? (
              <div className="flex flex-col gap-4">
                {recentBrowse.length > 0 ? (
                  <ResultGroup title="Recently opened">
                    {recentBrowse.map((item) => (
                      <BrowseRow
                        key={`recent-${item.kind}-${item.id}`}
                        item={item}
                        onSelect={onSelectBrowse}
                      />
                    ))}
                  </ResultGroup>
                ) : null}

                {restBrowse.length > 0 ? (
                  <ResultGroup
                    title={recentBrowse.length > 0 ? "Everything else" : "All sets & folders"}
                  >
                    {restBrowse.map((item) => (
                      <BrowseRow
                        key={`all-${item.kind}-${item.id}`}
                        item={item}
                        onSelect={onSelectBrowse}
                      />
                    ))}
                  </ResultGroup>
                ) : null}
              </div>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No sets or folders yet.
              </p>
            )
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for “{trimmed}”.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {folderResults.length > 0 ? (
                <ResultGroup title="Folders">
                  {folderResults.map((result) => (
                    <ResultRow
                      key={`folder-${result.id}`}
                      icon={<FolderIcon className="h-4 w-4 shrink-0 text-primary" />}
                      title={result.name}
                      subtitle="Folder"
                      onClick={() => onSelectResult(result)}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {setResults.length > 0 ? (
                <ResultGroup title="Sets">
                  {setResults.map((result) => (
                    <ResultRow
                      key={`set-${result.id}`}
                      icon={<Layers className="h-4 w-4 shrink-0 text-primary" />}
                      title={result.name}
                      subtitle={result.description || "Set"}
                      onClick={() => onSelectResult(result)}
                    />
                  ))}
                </ResultGroup>
              ) : null}

              {wordResults.length > 0 ? (
                <ResultGroup title="Words">
                  {wordResults.map((result) => (
                    <ResultRow
                      key={`word-${result.collectionId}-${result.wordId}`}
                      icon={<Search className="h-4 w-4 shrink-0 text-primary" />}
                      title={`${result.word} · ${result.translation}`}
                      subtitle={`In ${result.collectionName}`}
                      onClick={() => onSelectResult(result)}
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
