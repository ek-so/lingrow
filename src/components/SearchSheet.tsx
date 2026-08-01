import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import { searchLibrary, type LibrarySearchResult } from "@/lib/library-search"
import { loadRecentItems, type RecentItem } from "@/lib/recent"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Collection, Folder } from "@/types"
import { cn } from "@/lib/utils"
import { Folder as FolderIcon, Layers, Search, X } from "lucide-react"

interface SearchSheetProps {
  open: boolean
  collections: Collection[]
  folders: Folder[]
  onClose: () => void
}

type BrowseItem =
  | { kind: "folder"; id: string; name: string }
  | { kind: "collection"; id: string; name: string; description: string }

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
    const items: BrowseItem[] = []
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
    const folderItems: BrowseItem[] = [...folders]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({ kind: "folder" as const, id: folder.id, name: folder.name }))
    const setItems: BrowseItem[] = [...collections]
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

  function onSelectBrowse(item: BrowseItem) {
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
      <header className="shrink-0 border-b border-border/80">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <h2 id="library-search-title" className="sr-only">
            Search library
          </h2>
          <label htmlFor={inputId} className="sr-only">
            Search sets, folders, and words
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sets, folders, words…"
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
            aria-label="Close search"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

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

function BrowseRow({
  item,
  onSelect,
}: {
  item: BrowseItem
  onSelect: (item: BrowseItem) => void
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
