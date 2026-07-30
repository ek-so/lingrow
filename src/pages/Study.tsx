import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { collections } from "@/data/collections"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react"

export default function Study() {
  const { id } = useParams()
  const collection = collections.find((c) => c.id === id)

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [phase, setPhase] = useState<"de" | "en" | "pause">("de")
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  const timeoutRef = useRef<number | null>(null)

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

  function speak(text: string, lang: string, onEnd: () => void) {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    const voice = voicesRef.current.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()))
    if (voice) utter.voice = voice
    utter.rate = 0.95
    utter.onend = onEnd
    window.speechSynthesis.speak(utter)
  }

  useEffect(() => {
    if (!playing || !collection) return
    const word = collection.words[index]
    if (!word) return

    if (phase === "de") {
      speak(word.de, "de-DE", () => {
        timeoutRef.current = window.setTimeout(() => setPhase("en"), 400)
      })
    } else if (phase === "en") {
      speak(word.en, "en-US", () => {
        timeoutRef.current = window.setTimeout(() => setPhase("pause"), 600)
      })
    } else if (phase === "pause") {
      const totalWords = collection.words.length
      timeoutRef.current = window.setTimeout(() => {
        if (index < totalWords - 1) {
          setIndex((i) => i + 1)
          setPhase("de")
        } else {
          setPlaying(false)
        }
      }, 900)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, phase, index])

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

  const word = collection.words[index]
  const progressPct = ((index + (phase === "pause" ? 1 : 0)) / collection.words.length) * 100

  function togglePlay() {
    if (playing) {
      window.speechSynthesis.cancel()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setPlaying(false)
    } else {
      setPlaying(true)
    }
  }

  function goTo(newIndex: number) {
    if (!collection) return
    window.speechSynthesis.cancel()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIndex(Math.max(0, Math.min(collection.words.length - 1, newIndex)))
    setPhase("de")
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

        <div className="flex-1 flex items-center justify-center">
          <Card className="w-full">
            <CardContent className="py-14 text-center">
              <p className="text-3xl font-semibold tracking-tight">{word.de}</p>
              <p
                className={`mt-4 text-xl text-muted-foreground transition-opacity duration-300 ${
                  phase === "de" ? "opacity-0" : "opacity-100"
                }`}
              >
                {word.en}
              </p>
            </CardContent>
          </Card>
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
          Uses your browser's built-in voice. Keep the screen on for now — lock-screen playback is next.
        </p>
      </div>
    </div>
  )
}
