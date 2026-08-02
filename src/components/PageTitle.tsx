import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Shared page heading. Uses a fixed title-row height so the distance from the
 * sticky header to the title stays the same with or without right-side actions.
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

/** Standard content column under the sticky app header. */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("mx-auto max-w-2xl px-5 pb-6 pt-[4.75rem]", className)}>{children}</div>
  )
}
