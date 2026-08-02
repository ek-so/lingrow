import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, ChevronDown, Folder, Home, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FolderTrailItem } from "@/lib/folders"

type BrandLeading = { kind: "brand" }

type BackLeading = {
  kind: "back"
  label: string
  /** Prefer `to` for plain navigation; use `onBack` when leave must be confirmed. */
  to?: string
  onBack?: () => void
  /**
   * Ancestors from the next level up through home. Shown in a dropdown to the
   * right of the back control. Hidden when empty or a single root-only item.
   */
  trail?: FolderTrailItem[]
  /** When set (e.g. unsaved-leave guard), used instead of plain `Link` for trail items. */
  onTrailSelect?: (to: string) => void
}

export type AppHeaderLeading = BrandLeading | BackLeading

interface AppHeaderProps {
  leading: AppHeaderLeading
  actions?: ReactNode
  className?: string
}

function BreadcrumbTrailMenu({
  trail,
  onTrailSelect,
}: {
  trail: FolderTrailItem[]
  onTrailSelect?: (to: string) => void
}) {
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

  if (trail.length <= 1) return null

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Open folder path"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ChevronDown className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg"
        >
          {trail.map((item) => {
            const icon =
              item.id == null ? (
                <Home className="h-4 w-4" />
              ) : (
                <Folder className="h-4 w-4" />
              )
            const className =
              "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-secondary"

            if (onTrailSelect) {
              return (
                <button
                  key={item.to}
                  type="button"
                  role="menuitem"
                  className={className}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setOpen(false)
                    onTrailSelect(item.to)
                  }}
                >
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                    {icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              )
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                className={className}
                onClick={() => setOpen(false)}
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                  {icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Fixed top app bar — brand on the home root, back + label on inner pages,
 * optional actions on the right.
 */
export function AppHeader({ leading, actions, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-2xl items-center justify-between gap-3 px-5">
        <div className="min-w-0 flex-1">
          {leading.kind === "brand" ? (
            <a
              href={import.meta.env.BASE_URL}
              className="inline-flex items-center gap-2 text-primary"
            >
              <Layers className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium tracking-wide uppercase">Lingrow</span>
            </a>
          ) : (
            <div className="flex min-w-0 max-w-full items-center gap-0.5">
              {leading.onBack ? (
                <button
                  type="button"
                  onClick={leading.onBack}
                  className="inline-flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span className="truncate">{leading.label}</span>
                </button>
              ) : (
                <Link
                  to={leading.to ?? "/"}
                  className="inline-flex min-w-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span className="truncate">{leading.label}</span>
                </Link>
              )}
              {leading.trail ? (
                <BreadcrumbTrailMenu
                  trail={leading.trail}
                  onTrailSelect={leading.onTrailSelect}
                />
              ) : null}
            </div>
          )}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
