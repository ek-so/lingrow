import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/AppHeader"
import { FlipCard } from "@/components/FlipCard"
import { OverflowMenu } from "@/components/OverflowMenu"
import { MoveToFolderSheet } from "@/components/MoveToFolderSheet"
import { PAGE_CONTENT_TOP, PageTitle } from "@/components/PageTitle"
import { StudyStats, type StudyRating } from "@/components/StudyStats"
import { playClingSound } from "@/lib/cling"
import { cn } from "@/lib/utils"
import { downloadCollectionExcel } from "@/lib/export-collection"
import { folderTrailUp } from "@/lib/folders"
import { LANGS, langLabel, pairLabel } from "@/lib/languages"
import { loadQuietMode, saveQuietMode } from "@/lib/prefs"
import { recordRecentOpen } from "@/lib/recent"
import {
  clearStudyProgress,
  loadStudyProgress,
  saveStudyProgress,
} from "@/lib/study-progress"
import { useWakeLock } from "@/lib/use-wake-lock"
import {
  Download,
  FolderInput,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react"
import type { Collection, PronounceFirst, Word } from "@/types"

/** Small speak control that doesn’t flip the card. */
function CardSidePlay({ label, onPlay }: { label: string; onPlay: () => void }) {
  function stopCardGesture(e: MouseEvent | PointerEvent) {
    e.stopPropagation()
  }

  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      onPointerDown={stopCardGesture}
      onPointerUp={stopCardGesture}
      onPointerCancel={stopCardGesture}
      onClick={(e) => {
        stopCardGesture(e)
        e.preventDefault()
        onPlay()
      }}
    >
      <Play className="h-3.5 w-3.5 fill-current" />
    </button>
  )
}

type SpeakPhase = "first" | "second" | "pause"
type StudyView = "cards" | "stats"

/** Gap after saying one side before the other side of the same card. */
const BETWEEN_SIDES_MS = 850
/** Brief hold after the second side before the between-card pause. */
const AFTER_SECOND_SIDE_MS = 600
/** Gap between finishing a card and starting the next one. */
const BETWEEN_CARDS_MS = 900

export default function Study() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getCollection, getFolder, folders, settings, deleteCollection, moveCollection } =
    useCollections()
  const collection = id ? getCollection(id) : undefined
  const pronounceFirst: PronounceFirst = settings.pronounceFirst
  const parentFolder = collection?.folderId ? getFolder(collection.folderId) : undefined
  const backTo = parentFolder ? `/folder/${parentFolder.id}` : "/"
  const backLabel = parentFolder?.name ?? "My sets"
  const backTrail = folderTrailUp(folders, collection?.folderId ?? null)

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<SpeakPhase>("first")
  const [flipped, setFlipped] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [view, setView] = useState<StudyView>("cards")
  const [ratings, setRatings] = useState<Record<string, StudyRating>>({})
  const [quiet, setQuiet] = useState(() => loadQuietMode())
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const timeoutRef = useRef<number | null>(null)
  const clingPlayed = useRef(false)
  const speakGen = useRef(0)
  const quietRef = useRef(quiet)
  quietRef.current = quiet

  // Keep the screen on during play so speechSynthesis is not suspended by lock.
  useWakeLock(playing && view === "cards")

  function stopSpeech() {
    speakGen.current += 1
    window.speechSynthesis.cancel()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  function resetToFirstWord() {
    stopSpeech()
    setIndex(0)
    setPlaying(false)
    setPhase("first")
    setFlipped(false)
    setRatings({})
    if (id) clearStudyProgress(id)
  }

  function resetSession() {
    resetToFirstWord()
    setView("cards")
    clingPlayed.current = false
  }

  useEffect(() => {
    stopSpeech()
    setPlaying(false)
    setPhase("first")
    setFlipped(false)
    setView("cards")
    setRatings({})
    clingPlayed.current = false

    if (!id || !collection) {
      setIndex(0)
      return
    }
    const saved = loadStudyProgress(id)
    const max = Math.max(0, collection.words.length - 1)
    setIndex(saved ? Math.min(Math.max(0, saved.index), max) : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pronounceFirst])

  useEffect(() => {
    if (id && collection) {
      recordRecentOpen("collection", id)
    }
    // Record once per set id when the set exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!id || !collection || view !== "cards") return
    saveStudyProgress(id, index)
  }, [id, index, view, collection])

  useEffect(() => {
    function loadVoices() {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.cancel()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    setFlipped(phase === "second" || phase === "pause")
  }, [playing, phase])

  useEffect(() => {
    if (view !== "stats" || clingPlayed.current) return
    clingPlayed.current = true
    if (id) clearStudyProgress(id)
    if (!quietRef.current) playClingSound()
  }, [view, id])

  function speak(text: string, lang: string, onEnd?: () => void) {
    const gen = speakGen.current

    if (quietRef.current) {
      if (!onEnd) return
      const ms = Math.min(1100, Math.max(280, text.trim().split(/\s+/).length * 260))
      timeoutRef.current = window.setTimeout(() => {
        if (speakGen.current !== gen) return
        onEnd()
      }, ms)
      return
    }

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    const prefix = lang.toLowerCase().slice(0, 2)
    const voice =
      voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
      voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(prefix))
    if (voice) utter.voice = voice
    utter.rate = 0.95
    if (onEnd) {
      utter.onend = () => {
        if (speakGen.current !== gen) return
        onEnd()
      }
    }
    window.speechSynthesis.speak(utter)
  }

  function speakOnce(text: string, lang: string) {
    window.speechSynthesis.cancel()
    speak(text, lang)
  }

  /** Always audible — used for the per-side play buttons. */
  function speakAudio(text: string, lang: string) {
    speakGen.current += 1
    window.speechSynthesis.cancel()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    const prefix = lang.toLowerCase().slice(0, 2)
    const voice =
      voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
      voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(prefix))
    if (voice) utter.voice = voice
    utter.rate = 0.95
    window.speechSynthesis.speak(utter)
  }

  function speakVisibleSide(wordIndex: number, showBack: boolean) {
    if (!collection) return
    const word = collection.words[wordIndex]
    if (!word) return
    const sides = sidesForWord(collection, word)
    const side = showBack ? sides.second : sides.first
    speakOnce(side.text, side.lang)
  }

  function playCardSide(showBack: boolean) {
    if (!collection) return
    if (playing) {
      stopSpeech()
      setPlaying(false)
    }
    const word = collection.words[index]
    if (!word) return
    const sides = sidesForWord(collection, word)
    const side = showBack ? sides.second : sides.first
    speakAudio(side.text, side.lang)
  }

  function sidesForWord(collection: Collection, word: Word) {
    const examples = word.examples?.length ? word.examples : undefined
    const wordSide = {
      text: word.word,
      lang: LANGS[collection.wordLang].speech,
      hint: `${langLabel(collection.wordLang)} · Word`,
      examples,
    }
    const translationSide = {
      text: word.translation,
      lang: LANGS[collection.translationLang].speech,
      hint: `${langLabel(collection.translationLang)} · Translation`,
      examples: undefined as string[] | undefined,
    }

    if (pronounceFirst === "translation") {
      return {
        first: translationSide,
        second: wordSide,
        frontText: translationSide.text,
        backText: wordSide.text,
        frontHint: translationSide.hint,
        backHint: wordSide.hint,
        frontExamples: translationSide.examples,
        backExamples: wordSide.examples,
      }
    }
    return {
      first: wordSide,
      second: translationSide,
      frontText: wordSide.text,
      backText: translationSide.text,
      frontHint: wordSide.hint,
      backHint: translationSide.hint,
      frontExamples: wordSide.examples,
      backExamples: translationSide.examples,
    }
  }

  function finishAutoSession(words: Word[]) {
    setRatings((prev) => {
      const next = { ...prev }
      for (const w of words) {
        if (!next[w.id]) next[w.id] = "listened"
      }
      return next
    })
    setPlaying(false)
    setView("stats")
  }

  function rateAndAdvance(wordId: string, rating: StudyRating, total: number) {
    stopSpeech()
    setRatings((prev) => ({ ...prev, [wordId]: rating }))
    setFlipped(false)
    if (index >= total - 1) {
      setPlaying(false)
      setView("stats")
      return
    }
    setIndex((i) => i + 1)
    setPhase("first")
  }

  useEffect(() => {
    if (!playing || !collection || view !== "cards") return
    const word = collection.words[index]
    if (!word) return
    const sides = sidesForWord(collection, word)
    const gen = speakGen.current

    if (phase === "first") {
      window.speechSynthesis.cancel()
      speak(sides.first.text, sides.first.lang, () => {
        timeoutRef.current = window.setTimeout(() => {
          if (speakGen.current !== gen) return
          setPhase("second")
        }, BETWEEN_SIDES_MS)
      })
    } else if (phase === "second") {
      speak(sides.second.text, sides.second.lang, () => {
        timeoutRef.current = window.setTimeout(() => {
          if (speakGen.current !== gen) return
          setPhase("pause")
        }, AFTER_SECOND_SIDE_MS)
      })
    } else if (phase === "pause") {
      const totalWords = collection.words.length
      timeoutRef.current = window.setTimeout(() => {
        if (speakGen.current !== gen) return
        if (index < totalWords - 1) {
          setIndex((i) => i + 1)
          setPhase("first")
          setFlipped(false)
        } else {
          finishAutoSession(collection.words)
        }
      }, BETWEEN_CARDS_MS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, index, pronounceFirst, view, quiet])

  // Manual study: pronounce the front side once when landing on a card.
  useEffect(() => {
    if (playing || view !== "cards" || !collection) return
    if (flipped) return
    if (quiet) return
    speakVisibleSide(index, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, view, id, pronounceFirst, quiet])

  function handleFlip(next: boolean) {
    setFlipped(next)
    if (view !== "cards") return
    if (quiet) return
    // Always voice the side that becomes visible after a flip.
    speakVisibleSide(index, next)
  }

  function toggleQuiet() {
    const next = !quiet
    saveQuietMode(next)
    setQuiet(next)
    // Cancel any in-flight utterance; auto-play effect restarts via `quiet` dep.
    speakGen.current += 1
    window.speechSynthesis.cancel()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  if (!collection) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Collection not found.</p>
          <Link to="/" className="text-primary underline mt-2 inline-block">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  if (collection.words.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center px-5">
          <p className="text-muted-foreground">This list has no words yet.</p>
          <Link to="/" className="text-primary underline mt-2 inline-block">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  if (view === "stats") {
    const known = collection.words.filter((w) => ratings[w.id] === "known").length
    const learning = collection.words.filter((w) => ratings[w.id] === "learning").length
    const listened = collection.words.filter((w) => ratings[w.id] === "listened").length
    const skipped = collection.words.filter(
      (w) => ratings[w.id] === "skipped" || ratings[w.id] == null,
    ).length
    return (
      <StudyStats
        collectionName={collection.name}
        total={collection.words.length}
        known={known}
        learning={learning}
        listened={listened}
        skipped={skipped}
        onFinish={() => navigate(backTo)}
        onRestart={resetSession}
      />
    )
  }

  const word = collection.words[index]
  const sides = sidesForWord(collection, word)
  const progressPct = ((index + (playing && phase === "pause" ? 1 : 0)) / collection.words.length) * 100

  function togglePlay() {
    if (playing) {
      stopSpeech()
      setPlaying(false)
    } else {
      setPhase("first")
      setFlipped(false)
      setPlaying(true)
    }
  }

  function goTo(newIndex: number) {
    if (!collection) return
    stopSpeech()
    setPlaying(false)
    setIndex(Math.max(0, Math.min(collection.words.length - 1, newIndex)))
    setPhase("first")
    setFlipped(false)
  }

  function goNext() {
    if (!collection) return
    const current = collection.words[index]
    stopSpeech()
    setPlaying(false)
    setRatings((prev) => {
      const next = { ...prev }
      if (!next[current.id]) next[current.id] = "skipped"
      if (index >= collection.words.length - 1) {
        for (const w of collection.words) {
          if (!next[w.id]) next[w.id] = "skipped"
        }
      }
      return next
    })
    if (index >= collection.words.length - 1) {
      setView("stats")
      return
    }
    setIndex(index + 1)
    setPhase("first")
    setFlipped(false)
  }

  function onDelete() {
    if (!collection) return
    if (!window.confirm(`Delete “${collection.name}”? This can’t be undone.`)) return
    stopSpeech()
    clearStudyProgress(collection.id)
    deleteCollection(collection.id)
    navigate(backTo)
  }

  function onExport() {
    if (!collection) return
    void downloadCollectionExcel(collection)
  }

  return (
    <div className="h-dvh overflow-hidden bg-background">
      <AppHeader
        leading={{ kind: "back", label: backLabel, to: backTo, trail: backTrail }}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit set"
              onClick={() => {
                stopSpeech()
                navigate(`/edit/${collection.id}`)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <OverflowMenu
              label={`Actions for ${collection.name}`}
              items={[
                {
                  label: "Move to…",
                  icon: <FolderInput />,
                  onSelect: () => {
                    stopSpeech()
                    setPlaying(false)
                    setMoveOpen(true)
                  },
                },
                {
                  label: "Export",
                  icon: <Download />,
                  onSelect: onExport,
                },
                {
                  label: "Delete",
                  icon: <Trash2 />,
                  destructive: true,
                  onSelect: onDelete,
                },
              ]}
            />
          </>
        }
      />

      <div
        className={cn(
          "absolute inset-x-0 top-0 bottom-[4.75rem] flex flex-col overflow-hidden",
          PAGE_CONTENT_TOP,
        )}
      >
        <div className="mx-auto w-full max-w-2xl shrink-0 px-5">
          <PageTitle className="mb-3">{collection.name}</PageTitle>
          <Progress value={progressPct} className="mb-2" />
          <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>{pairLabel(collection.wordLang, collection.translationLang)}</span>
            <span>
              {index + 1} / {collection.words.length}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5">
          <div className="w-full max-w-2xl">
            <FlipCard
              key={word.id}
              flipped={flipped}
              onFlip={(next) => {
                if (playing) {
                  stopSpeech()
                  setPlaying(false)
                }
                handleFlip(next)
              }}
              onSwipeLeft={() => rateAndAdvance(word.id, "learning", collection.words.length)}
              onSwipeRight={() => rateAndAdvance(word.id, "known", collection.words.length)}
              corner={
                <div className="pointer-events-auto">
                  <CardSidePlay
                    label={`Play ${flipped ? sides.backText : sides.frontText}`}
                    onPlay={() => playCardSide(flipped)}
                  />
                </div>
              }
              front={
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{sides.frontHint}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{sides.frontText}</p>
                  {sides.frontExamples?.length ? (
                    <ul className="mt-4 w-full space-y-1.5 text-left text-sm leading-snug text-muted-foreground">
                      {sides.frontExamples.map((ex) => (
                        <li key={ex} className="border-l-2 border-border pl-2.5">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              }
              back={
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{sides.backHint}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{sides.backText}</p>
                  {sides.backExamples?.length ? (
                    <ul className="mt-4 w-full space-y-1.5 text-left text-sm leading-snug text-muted-foreground">
                      {sides.backExamples.map((ex) => (
                        <li key={ex} className="border-l-2 border-border pl-2.5">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              }
            />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {playing
                ? "Auto play — swipe to rate · Tap to flip"
                : "Tap to flip · Swipe right if you know it · Left if you don’t"}
            </p>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3">
          <Button
            variant={quiet ? "secondary" : "outline"}
            size="icon"
            aria-label={quiet ? "Sound on" : "Quiet mode"}
            aria-pressed={quiet}
            onClick={toggleQuiet}
          >
            {quiet ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="lg" onClick={togglePlay} className="w-28 sm:w-32">
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Play
              </>
            )}
          </Button>
          <Button variant="outline" size="icon" aria-label="Next" onClick={goNext}>
            <SkipForward className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Reset to first word"
            onClick={resetToFirstWord}
            disabled={index === 0 && !playing && !flipped}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <MoveToFolderSheet
        open={moveOpen}
        title={`Move “${collection.name}”`}
        folders={folders}
        currentFolderId={collection.folderId ?? null}
        onCancel={() => setMoveOpen(false)}
        onSelect={(folderId) => {
          moveCollection(collection.id, folderId)
          setMoveOpen(false)
        }}
      />
    </div>
  )
}
