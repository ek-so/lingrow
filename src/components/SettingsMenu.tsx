import { useEffect, useRef, useState } from "react"
import { useCollections } from "@/lib/collections-context"
import { Settings } from "lucide-react"
import type { PronounceFirst } from "@/types"

export function SettingsMenu() {
  const { settings, setPronounceFirst } = useCollections()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  function onPronounceChange(value: PronounceFirst) {
    setPronounceFirst(value)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Settings className="h-5 w-5" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Settings"
          className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-lg"
        >
          <h2 className="text-sm font-medium">Pronounce first</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Global study order. Each list still chooses its own language pair.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => onPronounceChange("word")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                settings.pronounceFirst === "word"
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span className="font-medium">Word</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Word → translation</span>
            </button>
            <button
              type="button"
              onClick={() => onPronounceChange("translation")}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                settings.pronounceFirst === "translation"
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              <span className="font-medium">Translation</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Translation → word</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
