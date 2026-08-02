import { useEffect, useRef, useState } from "react"
import { ArrowUpDown, Check } from "lucide-react"
import {
  LIBRARY_SORT_OPTIONS,
  type LibrarySortMode,
} from "@/lib/library-sort"
import { cn } from "@/lib/utils"

interface SortMenuProps {
  value: LibrarySortMode
  onChange: (mode: LibrarySortMode) => void
  className?: string
}

export function SortMenu({ value, onChange, className }: SortMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const activeLabel =
    LIBRARY_SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Sort"

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={`Sort: ${activeLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ArrowUpDown className="h-4 w-4 shrink-0" />
        <span className="max-w-[9rem] truncate text-xs font-medium">{activeLabel}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-48 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {LIBRARY_SORT_OPTIONS.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary",
                  selected ? "text-foreground" : "text-foreground",
                )}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                </span>
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
