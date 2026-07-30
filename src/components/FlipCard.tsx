import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface FlipCardProps {
  front: ReactNode
  back: ReactNode
  flipped: boolean
  onFlip: (next: boolean) => void
  className?: string
}

/**
 * Physical-feeling flashcard: tap or horizontal swipe to flip.
 */
export function FlipCard({ front, back, flipped, onFlip, className }: FlipCardProps) {
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const dragging = useRef(false)
  const [dragX, setDragX] = useState(0)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    setDragX(0)
  }, [flipped])

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (animating) return
    startX.current = e.clientX
    startY.current = e.clientY
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || startX.current == null || startY.current == null) return
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    if (Math.abs(dx) < Math.abs(dy)) return
    setDragX(Math.max(-90, Math.min(90, dx * 0.35)))
  }

  function finishGesture(clientX: number) {
    if (!dragging.current || startX.current == null) return
    const dx = clientX - startX.current
    dragging.current = false
    startX.current = null
    startY.current = null

    if (Math.abs(dx) > 56) {
      setAnimating(true)
      onFlip(!flipped)
      setDragX(0)
      window.setTimeout(() => setAnimating(false), 420)
      return
    }

    if (Math.abs(dx) < 10) {
      setAnimating(true)
      onFlip(!flipped)
      setDragX(0)
      window.setTimeout(() => setAnimating(false), 420)
      return
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
  }

  const tilt = flipped ? 180 : 0
  const liveTilt = tilt + dragX

  return (
    <div
      className={cn("relative w-full select-none [perspective:1200px]", className)}
      style={{ touchAction: "pan-y" }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={flipped ? "Show front of card" : "Show back of card"}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        className="relative h-56 w-full cursor-grab active:cursor-grabbing outline-none"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${liveTilt}deg)`,
          transition: dragging.current ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center shadow-sm [backface-visibility:hidden]">
          {front}
        </div>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center shadow-sm [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          {back}
        </div>
      </div>
    </div>
  )
}
