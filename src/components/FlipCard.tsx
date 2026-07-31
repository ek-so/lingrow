import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type CardSwipeDirection = "left" | "right"

interface FlipCardProps {
  front: ReactNode
  back: ReactNode
  flipped: boolean
  onFlip: (next: boolean) => void
  /**
   * rate — horizontal swipe rates the card (multi-word study)
   * flip — horizontal swipe also toggles sides (single-word study)
   * Tap always flips in both modes.
   */
  swipeMode?: "rate" | "flip"
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
}

/**
 * Flashcard: tap to flip. Swipe left/right rates (rate mode) or flips (flip mode).
 */
export function FlipCard({
  front,
  back,
  flipped,
  onFlip,
  swipeMode = "rate",
  onSwipeLeft,
  onSwipeRight,
  className,
}: FlipCardProps) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)
  const suppressClick = useRef(false)
  const [dragX, setDragX] = useState(0)
  const [exitX, setExitX] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    setDragX(0)
    setExitX(0)
    setExiting(false)
  }, [flipped])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (exiting) return
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

    if (Math.abs(dx) > 72) {
      suppressClick.current = true
      if (swipeMode === "rate") {
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

      onFlip(!flipped)
      setDragX(0)
      return
    }

    // Short movement: let the following click event flip once.
    setDragX(0)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    finishGesture(e.clientX)
  }

  function onPointerCancel() {
    dragging.current = false
    startX.current = null
    startY.current = null
    setDragX(0)
  }

  function onClick() {
    if (exiting) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onFlip(!flipped)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onFlip(!flipped)
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault()
      if (swipeMode === "rate") onSwipeLeft?.()
      else onFlip(!flipped)
    }
    if (e.key === "ArrowRight") {
      e.preventDefault()
      if (swipeMode === "rate") onSwipeRight?.()
      else onFlip(!flipped)
    }
  }

  const shift = exiting ? exitX : dragX
  const rot = Math.max(-14, Math.min(14, shift * 0.06))
  const knowHint = swipeMode === "rate" && dragX > 28
  const learnHint = swipeMode === "rate" && dragX < -28

  return (
    <div
      className={cn("relative w-full select-none [perspective:1200px]", className)}
      style={{ touchAction: "none" }}
    >
      {swipeMode === "rate" ? (
        <>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-6 left-2 flex items-center text-sm font-medium transition-opacity",
              learnHint ? "opacity-100 text-destructive" : "opacity-0",
            )}
          >
            Still learning
          </div>
          <div
            className={cn(
              "pointer-events-none absolute inset-y-6 right-2 flex items-center text-sm font-medium transition-opacity",
              knowHint ? "opacity-100 text-primary" : "opacity-0",
            )}
          >
            I know it
          </div>
        </>
      ) : null}

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
        className="relative h-80 w-full max-h-[min(20rem,46dvh)] cursor-pointer outline-none"
        style={{
          transform: `translateX(${shift}px) rotate(${rot}deg)`,
          transition: dragging.current ? "none" : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${flipped ? 180 : 0}deg)`,
            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-xl border bg-card px-6 py-5 text-center shadow-sm [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
              knowHint ? "border-primary" : learnHint ? "border-destructive" : "border-border",
            )}
          >
            {front}
          </div>
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-xl border bg-card px-6 py-5 text-center shadow-sm [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
              knowHint ? "border-primary" : learnHint ? "border-destructive" : "border-border",
            )}
            style={{ transform: "rotateY(180deg)" }}
          >
            {back}
          </div>
        </div>
      </div>
    </div>
  )
}
