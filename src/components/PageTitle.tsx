import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Top padding for content directly under AppHeader inside AppShell. */
const PAGE_CONTENT_TOP = "pt-5"

/**
 * Shared page heading with optional actions (create, overflow ⋯, edit, etc.).
 * Uses a fixed title-row height so the distance from the app header to the
 * title stays the same with or without right-side actions.
 */
export function PageTitle({
  children,
  actions,
  description,
  className,
}: {
  children: ReactNode
  actions?: ReactNode
  description?: ReactNode
  className?: string
}) {
  return (
    <header className={cn(className)}>
      <div className="flex h-10 items-center justify-between gap-3">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{children}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {description != null && description !== false ? (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      ) : null}
    </header>
  )
}

/**
 * Section heading under a page title — slightly smaller, optional action menu
 * on the right (same slot pattern as PageTitle).
 */
export function PageSubtitle({
  children,
  actions,
  className,
}: {
  children: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex h-9 items-center justify-between gap-3", className)}>
      <h2 className="truncate text-lg font-semibold tracking-tight">{children}</h2>
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  )
}

/** Standard content column under the app header. */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto max-w-2xl px-5 pb-6", PAGE_CONTENT_TOP, className)}>
      {children}
    </div>
  )
}
