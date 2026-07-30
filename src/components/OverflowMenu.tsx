import { useEffect, useRef, useState } from "react"
import { MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export interface OverflowMenuItem {
  label: string
  onSelect: () => void
  destructive?: boolean
}

interface OverflowMenuProps {
  label?: string
  items: OverflowMenuItem[]
  align?: "left" | "right"
  className?: string
}

export function OverflowMenu({
  label = "More actions",
  items,
  align = "right",
  className,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MoreVertical className="h-5 w-5" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-1 min-w-40 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={cn(
                "flex w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary",
                item.destructive ? "text-destructive" : "text-foreground",
              )}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
