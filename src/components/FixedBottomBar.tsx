import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FixedBottomBarProps {
  children: ReactNode
  /** Lift above the soft keyboard (px). */
  bottomOffset?: number
  className?: string
}

/** Pinned footer chrome matching the collection form save bar. */
export function FixedBottomBar({ children, bottomOffset = 0, className }: FixedBottomBarProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/90 backdrop-blur-md",
        className,
      )}
      style={{ bottom: bottomOffset }}
    >
      <div className="mx-auto max-w-2xl px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}

export function addWordsToListLabel(count: number) {
  if (count === 0) return "Add to list"
  const noun = count === 1 ? "word" : "words"
  return `Add ${count} ${noun} to list`
}
