import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FlipCard } from "@/components/FlipCard"
import { OverflowMenu } from "@/components/OverflowMenu"
import { StudyStats, type StudyRating } from "@/components/StudyStats"
import { playClingSound } from "@/lib/cling"
import { LANGS, langLabel, pairLabel } from "@/lib/languages"
import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react"
import type { Collection, PronounceFirst, Word } from "@/types"

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
  const { getCollection, settings, deleteCollection } = useCollections()
  const collection = id ? getCollection(id) : undefined
  const pronounceFirst: PronounceFirst = settings.pronounceFirst

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<SpeakPhase>("first")
  const [flipped, setFlipped] = useState(false)
  const [view, setView] = useState<StudyView>("cards")
  const [ratings, setRatings] = useState<Record<string, StudyRating>>({})
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const timeoutRef = useRef<number | null>(null)
  const clingPlayed = useRef(false)
  const speakGen = useRef(0)

  function resetSession() {
    stopSpeech()
    setIndex(0)
    setPlaying(false)
    setPhase("first")
    setFlipped(false)
    setView("cards")
    setRatings({})
    clingPlayed.current = false
  }

  useEffect(() => {
    resetSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pronounceFirst])

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
    playClingSound()
  }, [view])

  function speak(text: string, lang: string, onEnd?: () => void) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    const prefix = lang.toLowerCase().slice(0, 2)
    const voice =
      voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
      voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(prefix))
    if (voice) utter.voice = voice
    utter.rate = 0.95
    if (onEnd) {
      const gen = speakGen.current
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

  function speakVisibleSide(wordIndex: number, showBack: boolean) {
    if (!collection) return
    const word = collection.words[wordIndex]
    if (!word) return
    const sides = sidesForWord(collection, word)
    const side = showBack ? sides.second : sides.first
    speakOnce(side.text, side.lang)
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
  }, [playing, phase, index, pronounceFirst, view])

  // Manual study: pronounce the front side once when landing on a card.
  useEffect(() => {
    if (playing || view !== "cards" || !collection) return
    if (flipped) return
    speakVisibleSide(index, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, playing, view, id, pronounceFirst])

  function stopSpeech() {
    speakGen.current += 1
    window.speechSynthesis.cancel()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

  function handleFlip(next: boolean) {
    setFlipped(next)
    if (playing || view !== "cards") return
    speakVisibleSide(index, next)
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
        onFinish={() => navigate("/")}
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
    deleteCollection(collection.id)
    navigate("/")
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl w-full items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            My sets
          </Link>
          <OverflowMenu
            label={`Actions for ${collection.name}`}
            items={[
              {
                label: "Edit",
                onSelect: () => {
                  stopSpeech()
                  navigate(`/edit/${collection.id}`)
                },
              },
              {
                label: "Delete",
                destructive: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </header>

      <div className="mx-auto max-w-2xl w-full px-5 pt-[4.75rem] pb-28 flex flex-col flex-1">
        <Progress value={progressPct} className="mb-2" />
        <div className="mb-8 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>{pairLabel(collection.wordLang, collection.translationLang)}</span>
          <span>
            {index + 1} / {collection.words.length}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <FlipCard
            key={word.id}
            flipped={flipped}
            onFlip={handleFlip}
            swipeToRate
            onSwipeLeft={() => rateAndAdvance(word.id, "learning", collection.words.length)}
            onSwipeRight={() => rateAndAdvance(word.id, "known", collection.words.length)}
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
          <p className="text-xs text-muted-foreground">
            {playing
              ? "Auto play — swipe to rate · Tap to flip"
              : "Tap to flip & hear the other side · Swipe right if you know it · Left if still learning"}
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            variant="outline"
            size="icon"
            aria-label={collection.words.length === 1 ? "Show other side" : "Previous"}
            onClick={() => {
              if (collection.words.length === 1) {
                handleFlip(!flipped)
                return
              }
              goTo(index - 1)
            }}
            disabled={collection.words.length > 1 && index === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="lg" onClick={togglePlay} className="w-32">
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
          <Button
            variant="outline"
            size="icon"
            aria-label={collection.words.length === 1 ? "Show other side" : "Next"}
            onClick={() => {
              if (collection.words.length === 1) {
                handleFlip(!flipped)
                return
              }
              goNext()
            }}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
