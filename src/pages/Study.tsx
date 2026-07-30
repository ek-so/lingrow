import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { collections } from "@/data/collections"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Loader2, Pause, Play, SkipBack, SkipForward } from "lucide-react"
import type { StudyAudioManifest, StudyPhase } from "@/types/audio"
import {
  audioUrl,
  enablePlaybackAudioSession,
  loadStudyManifest,
  segmentAtTime,
  setupMediaSession,
  startOfWord,
} from "@/lib/study-audio"

export default function Study() {
  const { id } = useParams()
  const collection = collections.find((c) => c.id === id)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const indexRef = useRef(0)
  const manifestRef = useRef<StudyAudioManifest | null>(null)

  const [manifest, setManifest] = useState<StudyAudioManifest | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<StudyPhase>("de")
  const [progressPct, setProgressPct] = useState(0)

  useEffect(() => {
    if (!collection) return
    let cancelled = false

    setReady(false)
    setLoadError(null)
    setManifest(null)
    manifestRef.current = null
    setPlaying(false)
    setIndex(0)
    indexRef.current = 0
    setPhase("de")
    setProgressPct(0)

    loadStudyManifest(collection.id)
      .then((m) => {
        if (cancelled) return
        setManifest(m)
        manifestRef.current = m
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : "Failed to load study audio")
      })

    return () => {
      cancelled = true
    }
  }, [collection])

  useEffect(() => {
    if (!manifest || !collection) return

    const audio = new Audio(audioUrl(manifest.audio))
    audio.preload = "auto"
    audioRef.current = audio

    const seekToWord = (wordIndex: number) => {
      const m = manifestRef.current
      if (!m) return
      const clamped = Math.max(0, Math.min(collection.words.length - 1, wordIndex))
      audio.currentTime = startOfWord(m.segments, clamped)
      indexRef.current = clamped
      setIndex(clamped)
      setPhase("de")
      updateNowPlaying(clamped)
    }

    const updateNowPlaying = (wordIndex: number) => {
      if (!("mediaSession" in navigator)) return
      const word = collection.words[wordIndex]
      if (!word) return
      navigator.mediaSession.metadata = new MediaMetadata({
        title: word.de,
        artist: word.en,
        album: collection.name,
      })
    }

    const onLoaded = () => setReady(true)
    const onPlay = () => {
      setPlaying(true)
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing"
    }
    const onPause = () => {
      setPlaying(false)
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"
    }
    const onEnded = () => {
      setPlaying(false)
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused"
      const last = collection.words.length - 1
      indexRef.current = last
      setIndex(last)
      setPhase("pause")
      setProgressPct(100)
    }
    const onTimeUpdate = () => {
      const m = manifestRef.current
      if (!m) return
      const t = audio.currentTime
      const segment = segmentAtTime(m.segments, t)
      if (segment) {
        if (segment.wordIndex !== indexRef.current) {
          indexRef.current = segment.wordIndex
          updateNowPlaying(segment.wordIndex)
        }
        setIndex(segment.wordIndex)
        setPhase(segment.phase)
      }
      setProgressPct(m.duration > 0 ? Math.min(100, (t / m.duration) * 100) : 0)
    }

    audio.addEventListener("loadeddata", onLoaded)
    audio.addEventListener("canplaythrough", onLoaded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("timeupdate", onTimeUpdate)

    const teardownMedia = setupMediaSession({
      title: collection.name,
      onPlay: () => {
        enablePlaybackAudioSession()
        void audio.play()
      },
      onPause: () => audio.pause(),
      onPrevious: () => seekToWord(indexRef.current - 1),
      onNext: () => seekToWord(indexRef.current + 1),
    })
    updateNowPlaying(0)

    ;(audio as HTMLAudioElement & { __seekToWord?: (i: number) => void }).__seekToWord = seekToWord

    return () => {
      teardownMedia()
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      audioRef.current = null
      audio.removeEventListener("loadeddata", onLoaded)
      audio.removeEventListener("canplaythrough", onLoaded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("timeupdate", onTimeUpdate)
    }
  }, [manifest, collection])

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

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    enablePlaybackAudioSession()
    try {
      await audio.play()
    } catch (err) {
      console.error(err)
      setLoadError("Could not start audio playback. Tap Play again.")
    }
  }

  function goTo(newIndex: number) {
    const audio = audioRef.current as
      | (HTMLAudioElement & { __seekToWord?: (i: number) => void })
      | null
    if (!audio?.__seekToWord) return
    audio.__seekToWord(newIndex)
    if (playing) {
      enablePlaybackAudioSession()
      void audio.play()
    }
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
              {loadError ? (
                <p className="text-destructive text-sm">{loadError}</p>
              ) : !ready ? (
                <div className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing audio…
                </div>
              ) : (
                <>
                  <p className="text-3xl font-semibold tracking-tight">{word.de}</p>
                  <p
                    className={`mt-4 text-xl text-muted-foreground transition-opacity duration-300 ${
                      phase === "de" ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    {word.en}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
          <Button variant="outline" size="icon" onClick={() => goTo(index - 1)} disabled={!ready || index === 0}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="lg" onClick={() => void togglePlay()} className="w-32" disabled={!ready}>
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
            disabled={!ready || index === collection.words.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Plays a continuous audio track — works with the iPhone screen off. Use Control Center / lock screen
          controls to pause or skip.
        </p>
      </div>
    </div>
  )
}
