import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export type CardSwipeDirection = "left" | "right"

interface FlipCardProps {
  front: ReactNode
  back: ReactNode
  flipped: boolean
  onFlip: (next: boolean) => void
  /** When true, horizontal swipe rates the card instead of flipping. */
  swipeToRate?: boolean
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
}

/**
 * Flashcard: tap to flip. Swipe left/right to rate (manual or auto play).
 */
export function FlipCard({
  front,
  back,
  flipped,
  onFlip,
  swipeToRate = false,
  onSwipeLeft,
  onSwipeRight,
  className,
}: FlipCardProps) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)
  const [dragX, setDragX] = useState(0)
  const [exitX, setExitX] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    setDragX(0)
    setExitX(0)
    setExiting(false)
  }, [flipped, front, back])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (exiting) return
    startX.current = e.clientX
    startY.current = e.clientY
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current == null || startY.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (Math.abs(dx) < Math.abs(dy) && Math.abs(dx) < 12) return
    if (swipeToRate) {
      setDragX(Math.max(-140, Math.min(140, dx)))
    }
  }

  function finishGesture(clientX: number) {
    if (!dragging.current || startX.current == null) return
    const dx = clientX - startX.current
    dragging.current = false
    startX.current = null
    startY.current = null

    if (swipeToRate && Math.abs(dx) > 72) {
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

    if (Math.abs(dx) < 12) {
      onFlip(!flipped)
    }

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

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onFlip(!flipped)
    }
    if (!swipeToRate) return
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
  const knowHint = swipeToRate && dragX > 28
  const learnHint = swipeToRate && dragX < -28

  return (
    <div
      className={cn("relative w-full select-none [perspective:1200px]", className)}
      style={{ touchAction: "pan-y" }}
    >
      {swipeToRate ? (
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
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="relative min-h-56 h-80 w-full cursor-grab active:cursor-grabbing outline-none"
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
              "absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-xl border bg-card px-6 py-5 text-center shadow-sm [backface-visibility:hidden]",
              knowHint ? "border-primary" : learnHint ? "border-destructive" : "border-border",
            )}
          >
            {front}
          </div>
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center overflow-y-auto rounded-xl border bg-card px-6 py-5 text-center shadow-sm [backface-visibility:hidden]",
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
