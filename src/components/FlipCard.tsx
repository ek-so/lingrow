import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type CardSwipeDirection = "left" | "right"

interface FlipCardProps {
  front: ReactNode
  back: ReactNode
  flipped: boolean
  onFlip: (next: boolean) => void
  /** Horizontal swipe rates the card; tap flips. */
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  /** Overlay on the visible card face (e.g. a single play control). */
  corner?: ReactNode
  className?: string
}

/**
 * Flashcard: tap to flip (and parent should speak). Swipe left/right rates.
 */
export function FlipCard({
  front,
  back,
  flipped,
  onFlip,
  onSwipeLeft,
  onSwipeRight,
  corner,
  className,
}: FlipCardProps) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)
  const suppressClick = useRef(false)
  const flippedRef = useRef(flipped)
  const [dragX, setDragX] = useState(0)
  const [exitX, setExitX] = useState(0)
  const [exiting, setExiting] = useState(false)

  flippedRef.current = flipped

  useEffect(() => {
    setDragX(0)
    setExitX(0)
    setExiting(false)
  }, [flipped])

  function flip() {
    onFlip(!flippedRef.current)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (exiting) return
    if (e.pointerType === "mouse" && e.button !== 0) return
    startX.current = e.clientX
    startY.current = e.clientY
    dragging.current = true
    suppressClick.current = false
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current == null || startY.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 12) return
    setDragX(Math.max(-140, Math.min(140, dx)))
  }

  function finishGesture(clientX: number) {
    if (!dragging.current || startX.current == null) return
    const dx = clientX - startX.current
    dragging.current = false
    startX.current = null
    startY.current = null
    suppressClick.current = true

    if (Math.abs(dx) > 72) {
      const dir: CardSwipeDirection = dx < 0 ? "left" : "right"
      setExiting(true)
      setExitX(dir === "left" ? -420 : 420)
      window.setTimeout(() => {
        if (dir === "left") onSwipeLeft?.()
        else onSwipeRight?.()
        setDragX(0)
        setExitX(0)
        setExiting(false)
      }, 220)
      return
    }

    // Tap / short drag — flip (parent voices the new side).
    flip()
    setDragX(0)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    finishGesture(e.clientX)
  }

  function onLostPointerCapture(e: PointerEvent<HTMLDivElement>) {
    if (dragging.current) finishGesture(e.clientX)
  }

  function onPointerCancel() {
    dragging.current = false
    startX.current = null
    startY.current = null
    setDragX(0)
  }

  function onClick(e: MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) {
      suppressClick.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (exiting) return
    flip()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      flip()
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      onSwipeLeft?.()
    }
    if (e.key === "ArrowRight") {
      e.preventDefault()
      onSwipeRight?.()
    }
  }

  const shift = exiting ? exitX : dragX
  const rot = Math.max(-14, Math.min(14, shift * 0.06))
  // Hints sit on the opposite side of the swipe so they appear behind the card.
  const knowHint = shift > 28
  const learnHint = shift < -28

  return (
    <div
      className={cn("relative w-full select-none [perspective:1200px]", className)}
      style={{ touchAction: "none" }}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-6 left-2 z-0 flex items-center text-sm font-medium transition-opacity",
          knowHint ? "opacity-100 text-primary" : "opacity-0",
        )}
      >
        I know
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-y-6 right-2 z-0 flex items-center text-sm font-medium transition-opacity",
          learnHint ? "opacity-100 text-destructive" : "opacity-0",
        )}
      >
        I don’t know
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Show front of card" : "Show back of card"}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onLostPointerCapture}
        className="relative h-80 w-full max-h-[min(20rem,46dvh)] cursor-pointer outline-none"
        style={{
          transform: `translateX(${shift}px) rotate(${rot}deg)`,
          transition: dragging.current ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="relative h-full w-full [transform-style:preserve-3d]"
          style={{
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border bg-card px-6 py-5 text-center shadow-sm [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
              knowHint ? "border-primary" : learnHint ? "border-destructive" : "border-border",
            )}
          >
            {front}
          </div>
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-xl border bg-card px-6 py-5 text-center shadow-sm [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
              knowHint ? "border-primary" : learnHint ? "border-destructive" : "border-border",
            )}
            style={{ transform: "rotateY(180deg)" }}
          >
            {back}
          </div>
        </div>
        {corner ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10">{corner}</div>
        ) : null}
      </div>
    </div>
  )
}
