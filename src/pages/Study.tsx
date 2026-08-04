import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { FlipCard } from "@/components/FlipCard"
import { MoveToFolderSheet } from "@/components/MoveToFolderSheet"
import { PageTitle } from "@/components/PageTitle"
import { TitleActions, titleAction } from "@/components/TitleActions"
import { StudyStats, type StudyRating } from "@/components/StudyStats"
import { playClingSound } from "@/lib/cling"
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
import {
  estimateSpeechMs,
  getPronouncePlayer,
  type SpeechPlayItem,
} from "@/lib/speech-audio"
import { useWakeLock } from "@/lib/use-wake-lock"
import {
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
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
  const clingPlayed = useRef(false)
  const quietRef = useRef(quiet)
  const playingRef = useRef(playing)
  const indexRef = useRef(index)
  const collectionRef = useRef(collection)
  quietRef.current = quiet
  playingRef.current = playing
  indexRef.current = index
  collectionRef.current = collection

  // Nice-to-have while unlocked; lock-screen audio uses <audio> media sessions.
  useWakeLock(playing && view === "cards")

  function stopSpeech() {
    getPronouncePlayer().stop()
  }

  function resetToFirstWord() {
    const keepPlaying = playing
    setIndex(0)
    setPhase("first")
    setFlipped(false)
    setRatings({})
    if (id) clearStudyProgress(id)
    // Keep autoplay running from the start; only Pause should stop it.
    // Don’t stop() first — cancel-then-speak in the same turn drops the first side.
    if (keepPlaying) startAutoplayQueue(0)
    else {
      stopSpeech()
      setPlaying(false)
    }
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
    if (!playing) return
    setFlipped(phase === "second" || phase === "pause")
  }, [playing, phase])

  useEffect(() => {
    if (view !== "stats" || clingPlayed.current) return
    clingPlayed.current = true
    // Keep a progress stamp so set lists can show “last repetition”, reset cursor to start.
    if (id) saveStudyProgress(id, 0)
    if (!quietRef.current) playClingSound()
  }, [view, id])

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

  function buildAutoplayQueue(col: Collection, fromIndex: number): SpeechPlayItem[] {
    const items: SpeechPlayItem[] = []
    const quietMode = quietRef.current

    for (let i = fromIndex; i < col.words.length; i++) {
      const word = col.words[i]
      if (!word) continue
      const sides = sidesForWord(col, word)

      if (quietMode) {
        items.push({
          kind: "silence",
          ms: estimateSpeechMs(sides.first.text),
          text: sides.first.text,
          onStart: () => {
            setIndex(i)
            setPhase("first")
            setFlipped(false)
          },
        })
      } else {
        items.push({
          kind: "tts",
          text: sides.first.text,
          lang: sides.first.lang,
          onStart: () => {
            setIndex(i)
            setPhase("first")
            setFlipped(false)
          },
        })
      }

      items.push({ kind: "silence", ms: BETWEEN_SIDES_MS })

      if (quietMode) {
        items.push({
          kind: "silence",
          ms: estimateSpeechMs(sides.second.text),
          text: sides.second.text,
          onStart: () => setPhase("second"),
        })
      } else {
        items.push({
          kind: "tts",
          text: sides.second.text,
          lang: sides.second.lang,
          onStart: () => setPhase("second"),
        })
      }

      items.push({
        kind: "silence",
        ms: AFTER_SECOND_SIDE_MS,
        onStart: () => setPhase("pause"),
      })
      items.push({ kind: "silence", ms: BETWEEN_CARDS_MS })
    }

    return items
  }

  /** Start/replace the audio queue. Prefer calling from a user gesture (Play tap). */
  function startAutoplayQueue(fromIndex: number) {
    const col = collectionRef.current
    if (!col) return
    const player = getPronouncePlayer()
    player.setSessionMeta({ title: col.name, album: col.name })
    player.startQueue(buildAutoplayQueue(col, fromIndex), () => {
      finishAutoSession(col.words)
    })
  }

  function speakVisibleSide(wordIndex: number, showBack: boolean) {
    if (!collection) return
    const word = collection.words[wordIndex]
    if (!word) return
    const sides = sidesForWord(collection, word)
    const side = showBack ? sides.second : sides.first
    getPronouncePlayer().speakOne(side.text, side.lang)
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
    getPronouncePlayer().speakOne(side.text, side.lang)
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
    // Jump speech to the next card; keep auto-play running unless the session ends.
    setRatings((prev) => ({ ...prev, [wordId]: rating }))
    setFlipped(false)
    if (index >= total - 1) {
      stopSpeech()
      setPlaying(false)
      setView("stats")
      return
    }
    const nextIndex = index + 1
    setIndex(nextIndex)
    setPhase("first")
    if (playing) startAutoplayQueue(nextIndex)
    else stopSpeech()
  }

  // Manual study: pronounce the front side once when landing on a card.
  useEffect(() => {
    if (playing || view !== "cards" || !collection) return
    if (flipped) return
    if (quiet) return
    speakVisibleSide(index, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, view, id, pronounceFirst, quiet])

  useEffect(() => {
    const player = getPronouncePlayer()
    player.setMediaSessionHandlers({
      onPlay: () => {
        if (playingRef.current) return
        if (!collectionRef.current) return
        setPhase("first")
        setFlipped(false)
        setPlaying(true)
        startAutoplayQueue(indexRef.current)
      },
      onPause: () => {
        stopSpeech()
        setPlaying(false)
      },
      onNext: () => {
        const col = collectionRef.current
        if (!col) return
        const i = indexRef.current
        const current = col.words[i]
        setRatings((prev) => {
          const next = { ...prev }
          if (current && !next[current.id]) next[current.id] = "skipped"
          if (i >= col.words.length - 1) {
            for (const w of col.words) {
              if (!next[w.id]) next[w.id] = "skipped"
            }
          }
          return next
        })
        if (i >= col.words.length - 1) {
          stopSpeech()
          setPlaying(false)
          setView("stats")
          return
        }
        const nextIndex = i + 1
        setIndex(nextIndex)
        setPhase("first")
        setFlipped(false)
        if (playingRef.current) startAutoplayQueue(nextIndex)
        else stopSpeech()
      },
      onPrevious: () => {
        const i = indexRef.current
        if (i <= 0) return
        setIndex(i - 1)
        setPhase("first")
        setFlipped(false)
        if (playingRef.current) startAutoplayQueue(i - 1)
        else stopSpeech()
      },
    })
    return () => {
      // Clear handlers only — avoid stop() here so React Strict Mode remount
      // does not cancel a pronunciation kicked off by the mount effect.
      player.setMediaSessionHandlers({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      getPronouncePlayer().stop()
    }
  }, [])

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
    quietRef.current = next
    stopSpeech()
    if (playingRef.current) startAutoplayQueue(indexRef.current)
  }

  if (!collection) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Collection not found.</p>
          <Link to="/" className="mt-2 inline-block text-primary underline">
            Back home
          </Link>
        </div>
      </div>
    )
  }

  if (collection.words.length === 0) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-5">
        <div className="text-center">
          <p className="text-muted-foreground">This list has no words yet.</p>
          <Link to="/" className="mt-2 inline-block text-primary underline">
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
      // Must start audio in this tap stack so iOS allows background playback.
      startAutoplayQueue(index)
    }
  }

  function goTo(newIndex: number) {
    if (!collection) return
    // Keep auto-play on; only Pause should stop it.
    const clamped = Math.max(0, Math.min(collection.words.length - 1, newIndex))
    setIndex(clamped)
    setPhase("first")
    setFlipped(false)
    if (playing) startAutoplayQueue(clamped)
    else stopSpeech()
  }

  function goNext() {
    if (!collection) return
    const current = collection.words[index]
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
      stopSpeech()
      setPlaying(false)
      setView("stats")
      return
    }
    const nextIndex = index + 1
    setIndex(nextIndex)
    setPhase("first")
    setFlipped(false)
    if (playing) startAutoplayQueue(nextIndex)
    else stopSpeech()
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
    <>
      <AppShell
        scroll={false}
        header={
          <AppHeader
            leading={{ kind: "back", label: backLabel, to: backTo, trail: backTrail }}
          />
        }
        footer={
          <div className="border-t border-border/80 bg-background/90 backdrop-blur-md">
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
        }
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="mx-auto w-full max-w-2xl shrink-0 px-5 pt-5">
            <PageTitle
              className="mb-3"
              actions={
                <TitleActions
                  menuLabel={`Actions for ${collection.name}`}
                  maxVisible={1}
                  actions={[
                    titleAction.edit(() => {
                      stopSpeech()
                      navigate(`/edit/${collection.id}`)
                    }),
                    titleAction.move(() => {
                      stopSpeech()
                      setPlaying(false)
                      setMoveOpen(true)
                    }),
                    titleAction.export(onExport),
                    titleAction.delete(onDelete),
                  ]}
                />
              }
            >
              {collection.name}
            </PageTitle>
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {sides.frontHint}
                    </p>
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
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {sides.backHint}
                    </p>
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
                {playing ? "Autoplay" : "Tap to flip · Swipe left or right to rate"}
              </p>
            </div>
          </div>
        </div>
      </AppShell>

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
    </>
  )
}
