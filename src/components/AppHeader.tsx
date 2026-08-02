import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

type BrandLeading = { kind: "brand" }

type BackLeading = {
  kind: "back"
  label: string
  /** Prefer `to` for plain navigation; use `onBack` when leave must be confirmed. */
  to?: string
  onBack?: () => void
}

export type AppHeaderLeading = BrandLeading | BackLeading

interface AppHeaderProps {
  leading: AppHeaderLeading
  actions?: ReactNode
  className?: string
}

/**
 * Top app bar for AppShell — brand on the home root, back + label on inner
 * pages, optional actions on the right. Stays pinned via the shell layout
 * (not document `position: fixed`).
 */
export function AppHeader({ leading, actions, className }: AppHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-border/80 bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-5">
        <div className="min-w-0 flex-1">
          {leading.kind === "brand" ? (
            <a
              href={import.meta.env.BASE_URL}
              className="inline-flex items-center gap-2 text-primary"
            >
              <Layers className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium tracking-wide uppercase">Lingrow</span>
            </a>
          ) : leading.onBack ? (
            <button
              type="button"
              onClick={leading.onBack}
              className="inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{leading.label}</span>
            </button>
          ) : (
            <Link
              to={leading.to ?? "/"}
              className="inline-flex max-w-full items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">{leading.label}</span>
            </Link>
          )}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        ) : null}
      </div>
    </header>
  )
}
