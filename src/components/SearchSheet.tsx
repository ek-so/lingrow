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
import type { Collection, Folder } from "@/types"
import { Folder as FolderIcon, Layers, Search, X } from "lucide-react"

interface SearchSheetProps {
  open: boolean
  collections: Collection[]
  folders: Folder[]
  onClose: () => void
}

type RecentDisplayItem = {
  recent: RecentItem
  folder?: Folder
  collection?: Collection
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

  useEffect(() => {
    if (!open) return
    setQuery("")
    setRecent(loadRecentItems())
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 30)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
      window.clearTimeout(focusTimer)
    }
  }, [open, onClose])

  const results = useMemo(
    () => searchLibrary(deferredQuery, collections, folders),
    [deferredQuery, collections, folders],
  )

  const trimmed = query.trim()
  const searching = trimmed.length > 0

  const recentItems = useMemo(() => {
    const items: RecentDisplayItem[] = []
    for (const item of recent) {
      if (item.kind === "folder") {
        const folder = folderById.get(item.id)
        if (!folder) continue
        items.push({ recent: item, folder })
      } else {
        const collection = collectionById.get(item.id)
        if (!collection) continue
        items.push({ recent: item, collection })
      }
    }
    return items
  }, [recent, folderById, collectionById])

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

  function onSelectRecent(item: RecentDisplayItem) {
    if (item.recent.kind === "folder" && item.folder) {
      go(`/folder/${item.folder.id}`)
      return
    }
    if (item.collection) {
      go(`/study/${item.collection.id}`)
    }
  }

  const folderResults = results.filter((r) => r.kind === "folder")
  const setResults = results.filter((r) => r.kind === "collection")
  const wordResults = results.filter((r) => r.kind === "word")

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-search-title"
        className="relative z-10 flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:h-[min(36rem,85dvh)] sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />

        <div className="flex items-center gap-2 border-b border-border px-4 pb-3 pt-3 sm:pt-4">
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
              className="h-11 w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {!searching ? (
            recentItems.length > 0 ? (
              <section>
                <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recently opened
                </p>
                <ul className="flex flex-col">
                  {recentItems.map((item) => {
                    const key = `${item.recent.kind}-${item.recent.id}`
                    if (item.recent.kind === "folder" && item.folder) {
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => onSelectRecent(item)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                          >
                            <FolderIcon className="h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">
                                {item.folder.name}
                              </span>
                              <span className="block text-xs text-muted-foreground">Folder</span>
                            </span>
                          </button>
                        </li>
                      )
                    }
                    if (!item.collection) return null
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          onClick={() => onSelectRecent(item)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                        >
                          <Layers className="h-4 w-4 shrink-0 text-primary" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {item.collection.name}
                            </span>
                            <span className="block text-xs text-muted-foreground">Set</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                Recently opened sets and folders will show up here.
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
