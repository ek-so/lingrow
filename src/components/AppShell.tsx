import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppShellProps {
  header?: ReactNode
  children: ReactNode
  /** Optional bottom chrome (player bar, save bar). Stays pinned; not scrolled. */
  footer?: ReactNode
  /**
   * When true (default), the main column scrolls under the header.
   * When false, the main column is clipped — use for the study player.
   */
  scroll?: boolean
  className?: string
  mainClassName?: string
}

/**
 * Viewport-locked page frame so document scroll can’t drag the header
 * or bottom bars, and can’t reveal empty space below fixed chrome.
 */
export function AppShell({
  header,
  children,
  footer,
  scroll = true,
  className,
  mainClassName,
}: AppShellProps) {
  return (
    <div
      className={cn(
        "flex h-dvh max-h-dvh flex-col overflow-hidden bg-background",
        className,
      )}
    >
      {header ? <div className="shrink-0">{header}</div> : null}
      <main
        className={cn(
          "min-h-0 flex-1",
          scroll ? "overflow-y-auto overscroll-y-contain" : "overflow-hidden",
          mainClassName,
        )}
      >
        {children}
      </main>
      {footer ? <div className="shrink-0">{footer}</div> : null}
    </div>
  )
}
