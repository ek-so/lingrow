import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"

interface ConfirmSaveProgressSheetProps {
  open: boolean
  onYes: () => void
  onNo: () => void
  onCancel: () => void
}

export function ConfirmSaveProgressSheet({
  open,
  onYes,
  onNo,
  onCancel,
}: ConfirmSaveProgressSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return

    // Dismiss the soft keyboard so the curtain isn't hidden behind it.
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()

    const overlay = overlayRef.current
    const vv = window.visualViewport

    function syncViewport() {
      if (!overlay) return
      if (!vv) {
        overlay.style.top = "0px"
        overlay.style.left = "0px"
        overlay.style.width = "100%"
        overlay.style.height = "100%"
        return
      }
      overlay.style.top = `${vv.offsetTop}px`
      overlay.style.left = `${vv.offsetLeft}px`
      overlay.style.width = `${vv.width}px`
      overlay.style.height = `${vv.height}px`
    }

    syncViewport()
    vv?.addEventListener("resize", syncViewport)
    vv?.addEventListener("scroll", syncViewport)

    const focusTimer = window.setTimeout(() => {
      panelRef.current?.focus({ preventScroll: true })
    }, 0)

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      vv?.removeEventListener("resize", syncViewport)
      vv?.removeEventListener("scroll", syncViewport)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed z-[100] flex items-end justify-center overflow-hidden sm:items-center"
      style={{ top: 0, left: 0, width: "100%", height: "100%" }}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-progress-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl outline-none sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="save-progress-title" className="text-lg font-semibold tracking-tight">
          Do you want to save progress?
        </h2>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="lg" onClick={onNo}>
            No
          </Button>
          <Button type="button" size="lg" onClick={onYes}>
            Yes
          </Button>
        </div>
      </div>
    </div>
  )
}
