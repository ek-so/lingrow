import type { ReactNode, RefObject } from "react"
import { cn } from "@/lib/utils"
import { Folder as FolderIcon, Layers, Search, X } from "lucide-react"

export type LibrarySheetItem =
  | { kind: "folder"; id: string; name: string }
  | { kind: "collection"; id: string; name: string; description?: string }

interface LibrarySearchHeaderProps {
  titleId: string
  title: string
  inputId: string
  inputLabel: string
  placeholder: string
  query: string
  onQueryChange: (value: string) => void
  onCancel: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

/** Shared full-screen search chrome used by library search and move pickers. */
export function LibrarySearchHeader({
  titleId,
  title,
  inputId,
  inputLabel,
  placeholder,
  query,
  onQueryChange,
  onCancel,
  inputRef,
}: LibrarySearchHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border/80">
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <label htmlFor={inputId} className="sr-only">
          {inputLabel}
        </label>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            id={inputId}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
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
                onQueryChange("")
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
  )
}

export function ResultGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col">{children}</ul>
    </section>
  )
}

export function ResultRow({
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

export function BrowseRow({
  item,
  onSelect,
}: {
  item: LibrarySheetItem
  onSelect: (item: LibrarySheetItem) => void
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

export { FolderIcon, Layers, Search }
