import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  Layers,
  LibrarySearchHeader,
  ResultGroup,
  ResultRow,
} from "@/components/library-sheet"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"
import type { Collection } from "@/types"

interface SelectCollectionToMergeSheetProps {
  open: boolean
  /** The collection being merged (excluded from selection). */
  sourceCollectionId: string
  collections: Collection[]
  onSelect: (collectionId: string) => void
  onCancel: () => void
}

export function SelectCollectionToMergeSheet({
  open,
  sourceCollectionId,
  collections,
  onSelect,
  onCancel,
}: SelectCollectionToMergeSheetProps) {
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

  const availableCollections = useMemo(() => {
    return collections
      .filter((c) => c.id !== sourceCollectionId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
      }))
  }, [collections, sourceCollectionId])

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  const filteredCollections = useMemo(() => {
    if (!normalizedQuery) return availableCollections
    return availableCollections.filter((c) => 
      c.name.toLowerCase().includes(normalizedQuery)
    )
  }, [availableCollections, normalizedQuery])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="merge-select-title"
      className="fixed inset-0 z-[100] flex flex-col bg-background"
    >
      <LibrarySearchHeader
        titleId="merge-select-title"
        title="Merge with"
        inputId={inputId}
        inputLabel="Select set to merge with"
        placeholder="Search sets…"
        query={query}
        onQueryChange={setQuery}
        onCancel={onCancel}
        inputRef={inputRef}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-2xl px-2 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {!searching ? (
            availableCollections.length > 0 ? (
              <ResultGroup title="Available sets">
                {availableCollections.map((c) => (
                  <ResultRow
                    key={c.id}
                    icon={<Layers className="h-4 w-4 shrink-0 text-primary" />}
                    title={c.name}
                    subtitle={c.description || "Set"}
                    onClick={() => onSelect(c.id)}
                  />
                ))}
              </ResultGroup>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No other sets to merge with.
              </p>
            )
          ) : filteredCollections.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No matches for "{trimmed}".
            </p>
          ) : (
            <ResultGroup title="Sets">
              {filteredCollections.map((c) => (
                <ResultRow
                  key={c.id}
                  icon={<Layers className="h-4 w-4 shrink-0 text-primary" />}
                  title={c.name}
                  subtitle={c.description || "Set"}
                  onClick={() => onSelect(c.id)}
                />
              ))}
            </ResultGroup>
          )}
        </div>
      </div>
    </div>
  )
}
