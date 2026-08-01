import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import type { WordPair } from "@/lib/collection-form"
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock"

export type DuplicateImportChoice = "rewrite" | "skip"

interface DuplicateImportSheetProps {
  open: boolean
  duplicates: WordPair[]
  newCount: number
  choice: DuplicateImportChoice
  onChoiceChange: (choice: DuplicateImportChoice) => void
  onContinue: () => void
  onCancel: () => void
}

export function DuplicateImportSheet({
  open,
  duplicates,
  newCount,
  choice,
  onChoiceChange,
  onContinue,
  onCancel,
}: DuplicateImportSheetProps) {
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onCancel])

  if (!open) return null

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
        aria-labelledby="duplicate-import-title"
        className="relative z-10 w-full max-w-lg animate-in slide-in-from-bottom rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
        style={{
          animation: "lingrow-sheet-up 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <h2 id="duplicate-import-title" className="text-lg font-semibold tracking-tight">
          Matching words found
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {duplicates.length} imported{" "}
          {duplicates.length === 1 ? "word matches" : "words match"} ones already in this list
          {newCount > 0 ? ` · ${newCount} new will be added` : ""}.
        </p>

        <div className="mt-4 max-h-36 overflow-auto rounded-lg border border-border">
          <ul className="divide-y divide-border text-sm">
            {duplicates.slice(0, 12).map((d, i) => (
              <li key={`${d.word}-${i}`} className="flex gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{d.word}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.translation}</span>
              </li>
            ))}
          </ul>
          {duplicates.length > 12 ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              And {duplicates.length - 12} more…
            </p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoiceChange("rewrite")}
            className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
              choice === "rewrite"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            <span className="font-medium">Rewrite existing</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Update translations for matching words, then add the rest.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoiceChange("skip")}
            className={`rounded-lg border px-3 py-3 text-left text-sm transition-colors ${
              choice === "skip"
                ? "border-primary bg-accent text-accent-foreground"
                : "border-border hover:bg-secondary"
            }`}
          >
            <span className="font-medium">Skip matches</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Keep current rows; only add words that aren’t already in the list.
            </span>
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" size="lg" onClick={onContinue}>
            Continue import
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
