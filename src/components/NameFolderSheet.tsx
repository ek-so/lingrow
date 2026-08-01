import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"

interface NameFolderSheetProps {
  open: boolean
  title: string
  initialName?: string
  confirmLabel: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function NameFolderSheet({
  open,
  title,
  initialName = "",
  confirmLabel,
  onConfirm,
  onCancel,
}: NameFolderSheetProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)

  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    setName(initialName)
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, initialName, onCancel])

  useEffect(() => {
    if (!open) return
    const focus = () => inputRef.current?.focus({ preventScroll: true })
    const raf = requestAnimationFrame(focus)
    return () => cancelAnimationFrame(raf)
  }, [open])

  if (!open) return null

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-folder-title"
        className="relative z-10 w-full max-w-lg rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{ animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="name-folder-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <label htmlFor={inputId} className="mt-4 block text-sm font-medium">
          Name
        </label>
        <input
          ref={inputRef}
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
          placeholder="Folder name"
          className="mt-1.5 h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" size="lg" disabled={!name.trim()} onClick={submit}>
            {confirmLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
