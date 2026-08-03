import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MutableRefObject,
  type ReactNode,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LANG_CODES, LANGS, langLabel } from "@/lib/languages"
import {
  emptyDraftWord,
  hasEnteredProgress,
  isFormDirty,
  pairsFromDraft,
  type CollectionFormValues,
  type DraftWord,
} from "@/lib/collection-form"
import {
  applyImport,
  clearImportDraft,
  consumeImportResult,
  loadImportDraft,
  saveImportDraft,
  saveImportStaging,
} from "@/lib/import-bridge"
import { clearNewSetDraft, loadNewSetDraft, saveNewSetDraft } from "@/lib/new-set-draft"
import { examplesFromTextarea } from "@/lib/examples"
import { detectPairLanguages, isSpreadsheetFile, parseSpreadsheetFile } from "@/lib/parse-import"
import {
  appendCommaItem,
  applyGermanPlural,
  applyPrefix,
  commaListIncludes,
  hasGermanPlural,
  hasPrefix,
  type PrefixHint,
} from "@/lib/suggest-format"
import { useWordSuggest } from "@/lib/use-word-suggest"
import type { LangCode } from "@/types"
import { OverflowMenu } from "@/components/OverflowMenu"
import { SortableItem, SortableList } from "@/components/SortableList"
import { titleAction, toOverflowMenuItems } from "@/components/TitleActions"
import {
  ClipboardPaste,
  FileSpreadsheet,
  Info,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react"

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"
const inputClassName =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus:ring-2 focus:ring-ring"

function LangSelect({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: LangCode
  onChange: (code: LangCode) => void
}) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={id}>
      <span className="text-sm font-medium">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as LangCode)}
        className={selectClassName}
      >
        {LANG_CODES.map((code) => (
          <option key={code} value={code}>
            {LANGS[code].name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Chip({
  label,
  onClick,
  active,
  muted,
}: {
  label: string
  onClick: () => void
  active?: boolean
  /** Softer “ghost” style for articles / to. */
  muted?: boolean
}) {
  const base = muted
    ? "rounded-md border border-dashed px-2 py-0.5 text-left text-xs"
    : "rounded-md border px-2.5 py-1 text-left text-xs"
  const tone = active
    ? "border-transparent bg-accent font-medium text-accent-foreground"
    : muted
      ? "border-border/80 bg-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground"
      : "border-border bg-card text-foreground hover:bg-secondary"
  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`}>
      {label}
    </button>
  )
}

function PrefixHints({
  prefix,
  plural,
  value,
  onApplyPrefix,
  onApplyPlural,
}: {
  prefix?: PrefixHint
  plural?: string
  value: string
  onApplyPrefix: (prefix: PrefixHint) => void
  onApplyPlural: (plural: string) => void
}) {
  // Don't offer “to” / articles once they’re already on the field.
  const showPrefix = !!prefix && !hasPrefix(value, prefix)
  const showPlural = !!plural && !hasGermanPlural(value, plural)
  if (!showPrefix && !showPlural) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Add</span>
      {showPrefix && prefix ? (
        <Chip muted label={prefix} onClick={() => onApplyPrefix(prefix)} />
      ) : null}
      {showPlural && plural ? (
        <Chip muted label={`, ${plural}`} onClick={() => onApplyPlural(plural)} />
      ) : null}
    </div>
  )
}

function WordRow({
  draft,
  wordLang,
  translationLang,
  canRemove,
  onChange,
  onRemove,
  onStartReorder,
  dragHandle,
  mode = "edit",
}: {
  draft: DraftWord
  wordLang: LangCode
  translationLang: LangCode
  canRemove: boolean
  onChange: (field: "word" | "translation" | "examplesText", value: string) => void
  onRemove: () => void
  onStartReorder: () => void
  dragHandle?: ReactNode
  /** Full editor vs compact reorder row. */
  mode?: "edit" | "reorder"
}) {
  const { status, suggestion } = useWordSuggest(draft.word, wordLang, translationLang)
  const sameLanguage = wordLang === translationLang

  // Values we last auto-filled — kept so a new lookup can replace them without
  // overwriting anything the user typed by hand.
  const autoTranslation = useRef<string | null>(null)
  const autoExamples = useRef<string | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!suggestion) return
    const currentDraft = draftRef.current
    const change = onChangeRef.current

    if (!sameLanguage && suggestion.translation) {
      const current = currentDraft.translation.trim()
      const canFill = !current || current === autoTranslation.current
      if (canFill && current !== suggestion.translation) {
        autoTranslation.current = suggestion.translation
        change("translation", suggestion.translation)
      }
    }

    if (suggestion.examples.length > 0) {
      const current = currentDraft.examplesText
      const canFill = !current.trim() || current === autoExamples.current
      if (canFill) {
        const next = suggestion.examples.join("\n")
        if (next !== current) {
          autoExamples.current = next
          change("examplesText", next)
        }
      }
    }
  }, [suggestion, sameLanguage])

  function applyTranslation(value: string) {
    const next = appendCommaItem(draft.translation, value)
    autoTranslation.current = next
    onChange("translation", next)
  }

  function addExample(example: string) {
    const existing = examplesFromTextarea(draft.examplesText) ?? []
    if (existing.some((e) => e.toLowerCase() === example.toLowerCase())) return
    const next = [...existing, example].join("\n")
    autoExamples.current = null
    onChange("examplesText", next)
  }

  function applyAllExamples() {
    if (!suggestion?.examples.length) return
    autoExamples.current = suggestion.examples.join("\n")
    onChange("examplesText", autoExamples.current)
  }

  const unusedExamples =
    suggestion?.examples.filter((ex) => {
      const have = examplesFromTextarea(draft.examplesText) ?? []
      return !have.some((h) => h.toLowerCase() === ex.toLowerCase())
    }) ?? []

  const translationChips = suggestion
    ? [
        ...(suggestion.translation ? [suggestion.translation] : []),
        ...suggestion.alternatives,
      ]
    : []

  const showSuggestChrome =
    status === "loading" ||
    status === "error" ||
    !!(
      suggestion &&
      (translationChips.length > 0 ||
        suggestion.examples.length > 0 ||
        suggestion.wordPrefix ||
        suggestion.wordPlural ||
        suggestion.translationPrefix ||
        suggestion.translationPlural)
    )

  const label =
    draft.word.trim() || draft.translation.trim() || `Empty ${langLabel(wordLang)} row`

  const menuItems = [
    ...(mode === "edit" ? [titleAction.reorder(onStartReorder)] : []),
    ...(canRemove ? [titleAction.delete(onRemove)] : []),
  ]

  const overflow =
    menuItems.length > 0 ? (
      <OverflowMenu
        label={`Actions for ${label}`}
        items={toOverflowMenuItems(menuItems)}
      />
    ) : null

  if (mode === "reorder") {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-1.5">
        <div className="flex items-center gap-1">
          {dragHandle}
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{label}</p>
          {overflow}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-1">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <input
              value={draft.word}
              onChange={(e) => onChange("word", e.target.value)}
              placeholder={langLabel(wordLang)}
              aria-label={langLabel(wordLang)}
              className={inputClassName}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {suggestion ? (
              <PrefixHints
                prefix={suggestion.wordPrefix}
                plural={suggestion.wordPlural}
                value={draft.word}
                onApplyPrefix={(p) => onChange("word", applyPrefix(draft.word, p))}
                onApplyPlural={(pl) => onChange("word", applyGermanPlural(draft.word, pl))}
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <input
              value={draft.translation}
              onChange={(e) => {
                autoTranslation.current = null
                onChange("translation", e.target.value)
              }}
              placeholder={langLabel(translationLang)}
              aria-label={langLabel(translationLang)}
              className={inputClassName}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {suggestion && !sameLanguage ? (
              <PrefixHints
                prefix={suggestion.translationPrefix}
                plural={suggestion.translationPlural}
                value={draft.translation}
                onApplyPrefix={(p) => {
                  // Apply prefix to the first comma segment only.
                  const parts = draft.translation.split(/\s*,\s*/)
                  const head = parts[0] ?? ""
                  const rest = parts.slice(1)
                  const nextHead = applyPrefix(head || suggestion.translation || "", p)
                  const next = [nextHead, ...rest].filter(Boolean).join(", ")
                  autoTranslation.current = null
                  onChange("translation", next)
                }}
                onApplyPlural={(pl) => {
                  const base = draft.translation.trim() || suggestion.translation || ""
                  autoTranslation.current = null
                  onChange("translation", applyGermanPlural(base, pl))
                }}
              />
            ) : null}
          </div>
        </div>
        {overflow}
      </div>

      {showSuggestChrome ? (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-secondary/60 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {status === "loading" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Looking up translation…</span>
              </>
            ) : status === "error" ? (
              <span>Couldn’t fetch suggestions — type them in yourself.</span>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Suggestions</span>
              </>
            )}
          </div>

          {suggestion && !sameLanguage && translationChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {translationChips.map((alt) => (
                <Chip
                  key={alt}
                  label={alt}
                  active={commaListIncludes(draft.translation, alt)}
                  onClick={() => applyTranslation(alt)}
                />
              ))}
            </div>
          ) : null}

          {suggestion && unusedExamples.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Example sentences (from Google Translate)
                </span>
                <button
                  type="button"
                  onClick={applyAllExamples}
                  className="text-xs font-medium text-primary"
                >
                  Use all
                </button>
              </div>
              <ul className="flex flex-col gap-1">
                {unusedExamples.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      onClick={() => addExample(ex)}
                      className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left text-xs leading-snug text-foreground hover:bg-accent"
                    >
                      <span className="mt-0.5 text-muted-foreground" aria-hidden>
                        •
                      </span>
                      <span>{ex}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="mt-2 flex flex-col gap-1">
        <span className="sr-only">Examples for {draft.word || "word"}</span>
        <textarea
          value={draft.examplesText}
          onChange={(e) => {
            autoExamples.current = null
            onChange("examplesText", e.target.value)
          }}
          rows={4}
          placeholder="Example sentences (optional, one per line)"
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
    </div>
  )
}

interface CollectionFormProps {
  initial: CollectionFormValues
  submitLabel: string
  onSubmit: (values: {
    name: string
    description: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<{ word: string; translation: string; examples?: string[] }>
  }) => void
  /** Fires when typed content appears or clears (language-only changes ignored). */
  onDirtyChange?: (dirty: boolean) => void
  /** Parent can call this to run the same validation + submit as the Save button. */
  submitRef?: MutableRefObject<(() => boolean) | null>
  /** When set, typed progress is restored after reload and kept in localStorage. */
  persistDraftKey?: string
}

function resolveInitial(
  fallback: CollectionFormValues,
  pathname: string,
  search: string,
  persistDraftKey?: string,
): CollectionFormValues {
  const draft = loadImportDraft()
  const result = consumeImportResult()
  const here = `${pathname}${search}`

  if (draft && (draft.returnTo === here || draft.returnTo === pathname)) {
    const base = draft.values
    clearImportDraft()
    if (result) {
      return {
        ...base,
        wordLang: result.wordLang ?? base.wordLang,
        translationLang: result.translationLang ?? base.translationLang,
        words: applyImport(base.words, result.pairs, result.choice),
      }
    }
    return base
  }

  if (persistDraftKey) {
    const saved = loadNewSetDraft(persistDraftKey)
    if (saved) {
      return {
        name: saved.name ?? "",
        description: saved.description ?? "",
        wordLang: saved.wordLang ?? fallback.wordLang,
        translationLang: saved.translationLang ?? fallback.translationLang,
        words:
          Array.isArray(saved.words) && saved.words.length > 0
            ? saved.words.map((w) => ({
                key: w.key || emptyDraftWord().key,
                word: w.word ?? "",
                translation: w.translation ?? "",
                examplesText: w.examplesText ?? "",
              }))
            : fallback.words,
      }
    }
  }

  // Orphan result without matching draft — ignore
  return fallback
}

export function CollectionForm({
  initial,
  submitLabel,
  onSubmit,
  onDirtyChange,
  submitRef,
  persistDraftKey,
}: CollectionFormProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [boot] = useState(() =>
    resolveInitial(initial, location.pathname, location.search, persistDraftKey),
  )

  const [name, setName] = useState(boot.name)
  const [description, setDescription] = useState(boot.description)
  const [wordLang, setWordLang] = useState<LangCode>(boot.wordLang)
  const [translationLang, setTranslationLang] = useState<LangCode>(boot.translationLang)
  const [words, setWords] = useState<DraftWord[]>(() =>
    boot.words.map((w) => ({
      key: w.key || emptyDraftWord().key,
      word: w.word ?? "",
      translation: w.translation ?? "",
      examplesText: w.examplesText ?? "",
    })),
  )
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const sameLanguage = wordLang === translationLang

  const baselineRef = useRef(boot)

  useEffect(() => {
    onDirtyChange?.(
      isFormDirty(
        { name, description, wordLang, translationLang, words },
        baselineRef.current,
      ),
    )
  }, [name, description, wordLang, translationLang, words, onDirtyChange])

  useEffect(() => {
    if (!persistDraftKey) return
    const values: CollectionFormValues = {
      name,
      description,
      wordLang,
      translationLang,
      words,
    }
    if (hasEnteredProgress(values)) {
      saveNewSetDraft(persistDraftKey, values)
    } else {
      clearNewSetDraft(persistDraftKey)
    }
  }, [persistDraftKey, name, description, wordLang, translationLang, words])

  function updateWord(key: string, field: "word" | "translation" | "examplesText", value: string) {
    setWords((prev) => prev.map((w) => (w.key === key ? { ...w, [field]: value } : w)))
  }

  function removeWord(key: string) {
    setWords((prev) => (prev.length <= 1 ? prev : prev.filter((w) => w.key !== key)))
  }

  function reorderWords(orderedKeys: string[]) {
    setWords((prev) => {
      const byKey = new Map(prev.map((w) => [w.key, w]))
      if (
        orderedKeys.length !== prev.length ||
        orderedKeys.some((key) => !byKey.has(key))
      ) {
        return prev
      }
      return orderedKeys.map((key) => byKey.get(key)!)
    })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importPickError, setImportPickError] = useState<string | null>(null)

  function saveDraftForImport() {
    saveImportDraft({
      returnTo: location.pathname + location.search,
      values: { name, description, wordLang, translationLang, words },
    })
  }

  function openImportText() {
    setImportPickError(null)
    saveDraftForImport()
    navigate("/import/text")
  }

  function openImportFile() {
    setImportPickError(null)
    saveDraftForImport()
    fileInputRef.current?.click()
  }

  async function onImportFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (!isSpreadsheetFile(file)) {
      setImportPickError("Use an Excel (.xlsx / .xls) or CSV file.")
      return
    }
    setImportBusy(true)
    setImportPickError(null)
    try {
      const parsed = await parseSpreadsheetFile(file)
      const langs = detectPairLanguages(parsed)
      saveImportStaging({
        pairs: parsed,
        fileLabel: file.name,
        wordLang: langs.wordLang,
        translationLang: langs.translationLang,
        error:
          parsed.length === 0
            ? "No word pairs found. Expect columns: word, translation, optional examples."
            : null,
      })
      navigate("/import/file")
    } catch {
      setImportPickError("Could not read that file. Try exporting as .xlsx or .csv.")
    } finally {
      setImportBusy(false)
    }
  }

  function trySubmit(): boolean {
    const trimmedName = name.trim()
    const validWords = pairsFromDraft(words)
    if (!trimmedName) {
      setNameError(true)
      setError(null)
      requestAnimationFrame(() => {
        nameInputRef.current?.focus({ preventScroll: true })
        nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      })
      return false
    }
    setNameError(false)
    if (validWords.length === 0) {
      setError(
        sameLanguage
          ? `Add at least one pair with both sides filled in (${langLabel(wordLang)}).`
          : `Add at least one pair with both ${langLabel(wordLang)} and ${langLabel(translationLang)}.`,
      )
      return false
    }
    setError(null)
    if (persistDraftKey) clearNewSetDraft(persistDraftKey)
    onSubmit({
      name: trimmedName,
      description,
      wordLang,
      translationLang,
      words: validWords,
    })
    return true
  }

  useEffect(() => {
    if (!submitRef) return
    submitRef.current = trySubmit
    return () => {
      submitRef.current = null
    }
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    trySubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Name</span>
        <input
          ref={nameInputRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (nameError) setNameError(false)
          }}
          placeholder="e.g. Kitchen verbs"
          aria-invalid={nameError || undefined}
          aria-describedby={nameError ? "name-error" : undefined}
          className={
            nameError
              ? `${inputClassName} border-destructive focus:ring-destructive`
              : inputClassName
          }
        />
        {nameError ? (
          <span id="name-error" className="text-xs text-destructive">
            Enter a name to save
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Description (optional)</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short note for yourself"
          className={inputClassName}
        />
      </label>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <LangSelect id="from-lang" label="Translates from" value={wordLang} onChange={setWordLang} />
          <LangSelect id="into-lang" label="Into" value={translationLang} onChange={setTranslationLang} />
        </div>
        {sameLanguage ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Same language chosen — cards will still flip between the two sides.</span>
          </p>
        ) : null}
      </div>

      <div>
        <span className="text-sm font-medium">Words</span>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          onChange={(e) => void onImportFilePicked(e)}
        />

        {reorderMode ? null : (
          <>
            <div className="mt-3 flex h-12 w-full overflow-hidden rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground">
              <button
                type="button"
                disabled={importBusy}
                onClick={openImportFile}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground disabled:opacity-60"
              >
                <FileSpreadsheet className="h-4 w-4 shrink-0" />
                {importBusy ? "Reading…" : "Import file"}
              </button>
              <div className="w-px self-stretch bg-border" aria-hidden />
              <button
                type="button"
                onClick={openImportText}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
              >
                <ClipboardPaste className="h-4 w-4 shrink-0" />
                Paste text
              </button>
            </div>
            {importPickError ? (
              <p className="mt-2 text-xs text-destructive">{importPickError}</p>
            ) : null}
          </>
        )}

        {reorderMode ? (
          <SortableList
            ids={words.map((w) => w.key)}
            onReorder={reorderWords}
            className="mt-4 flex flex-col gap-2"
          >
            {words.map((w) => (
              <SortableItem
                key={w.key}
                id={w.key}
                handleLabel={`Reorder word ${w.word || "row"}`}
              >
                {(dragHandle) => (
                  <WordRow
                    draft={w}
                    wordLang={wordLang}
                    translationLang={translationLang}
                    canRemove={words.length > 1}
                    onChange={(field, value) => updateWord(w.key, field, value)}
                    onRemove={() => removeWord(w.key)}
                    onStartReorder={() => setReorderMode(true)}
                    dragHandle={dragHandle}
                    mode="reorder"
                  />
                )}
              </SortableItem>
            ))}
          </SortableList>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {words.map((w) => (
              <WordRow
                key={w.key}
                draft={w}
                wordLang={wordLang}
                translationLang={translationLang}
                canRemove={words.length > 1}
                onChange={(field, value) => updateWord(w.key, field, value)}
                onRemove={() => removeWord(w.key)}
                onStartReorder={() => setReorderMode(true)}
                mode="edit"
              />
            ))}
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {reorderMode ? (
        <div className="pb-24" aria-hidden />
      ) : (
        <div className="flex flex-col gap-3 pb-24">
          <Button type="button" variant="outline" onClick={() => setWords((w) => [...w, emptyDraftWord()])}>
            <Plus className="h-4 w-4" />
            Add row
          </Button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {reorderMode ? (
            <Button
              key="save-order"
              type="button"
              size="lg"
              className="w-full"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setReorderMode(false)
              }}
            >
              Save order
            </Button>
          ) : (
            <Button key="save-set" type="submit" size="lg" className="w-full">
              {submitLabel}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
