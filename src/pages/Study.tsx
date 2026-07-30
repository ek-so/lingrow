import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FlipCard } from "@/components/FlipCard"
import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react"
import type { PronounceFirst } from "@/types"

type SpeakPhase = "first" | "second" | "pause"

export default function Study() {
  const { id } = useParams()
  const { getCollection, settings } = useCollections()
  const collection = id ? getCollection(id) : undefined
  const pronounceFirst: PronounceFirst = settings.pronounceFirst

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<SpeakPhase>("first")
  const [flipped, setFlipped] = useState(false)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    setIndex(0)
    setPlaying(false)
    setPhase("first")
    setFlipped(false)
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

  // Keep the visible face in sync with what’s being spoken during autoplay.
  useEffect(() => {
    if (!playing) return
    setFlipped(phase === "second" || phase === "pause")
  }, [playing, phase])

  function speak(text: string, lang: string, onEnd: () => void) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    const voice = voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()))
    if (voice) utter.voice = voice
    utter.rate = 0.95
    utter.onend = onEnd
    window.speechSynthesis.speak(utter)
  }

  function sidesForWord(word: { de: string; en: string }) {
    if (pronounceFirst === "translation") {
      return {
        first: { text: word.en, lang: "en-US", label: "English" },
        second: { text: word.de, lang: "de-DE", label: "German" },
        frontText: word.en,
        backText: word.de,
        frontHint: "Translation",
        backHint: "Word",
      }
    }
    return {
      first: { text: word.de, lang: "de-DE", label: "German" },
      second: { text: word.en, lang: "en-US", label: "English" },
      frontText: word.de,
      backText: word.en,
      frontHint: "Word",
      backHint: "Translation",
    }
  }

  useEffect(() => {
    if (!playing || !collection) return
    const word = collection.words[index]
    if (!word) return
    const sides = sidesForWord(word)

    if (phase === "first") {
      speak(sides.first.text, sides.first.lang, () => {
        timeoutRef.current = window.setTimeout(() => setPhase("second"), 400)
      })
    } else if (phase === "second") {
      speak(sides.second.text, sides.second.lang, () => {
        timeoutRef.current = window.setTimeout(() => setPhase("pause"), 600)
      })
    } else if (phase === "pause") {
      const totalWords = collection.words.length
      timeoutRef.current = window.setTimeout(() => {
        if (index < totalWords - 1) {
          setIndex((i) => i + 1)
          setPhase("first")
          setFlipped(false)
        } else {
          setPlaying(false)
        }
      }, 900)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, index, pronounceFirst])

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

  const word = collection.words[index]
  const sides = sidesForWord(word)
  const progressPct = ((index + (phase === "pause" ? 1 : 0)) / collection.words.length) * 100

  function stopSpeech() {
    window.speechSynthesis.cancel()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
  }

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="mx-auto max-w-2xl w-full px-5 py-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Collections
          </Link>
          <span className="text-sm text-muted-foreground">
            {index + 1} / {collection.words.length}
          </span>
        </div>

        <Progress value={progressPct} className="mb-8" />

        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <FlipCard
            flipped={flipped}
            onFlip={setFlipped}
            front={
              <>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{sides.frontHint}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{sides.frontText}</p>
              </>
            }
            back={
              <>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{sides.backHint}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{sides.backText}</p>
              </>
            }
          />
          <p className="text-xs text-muted-foreground">Swipe or tap the card to flip</p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => goTo(index - 1)} disabled={index === 0}>
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
            onClick={() => goTo(index + 1)}
            disabled={index === collection.words.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Pronouncing {pronounceFirst === "word" ? "word → translation" : "translation → word"}. Change this on the
          home screen. Keep the screen on while studying.
        </p>
      </div>
    </div>
  )
}
