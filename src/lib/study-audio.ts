import type { StudyAudioManifest, StudySegment } from "@/types/audio"

declare global {
  interface Navigator {
    audioSession?: {
      type: string
    }
  }
}

/** Tell iOS this is media playback so audio can continue with the screen off. */
export function enablePlaybackAudioSession() {
  try {
    if (navigator.audioSession) {
      navigator.audioSession.type = "playback"
    }
  } catch {
    // Older browsers — ignore.
  }
}

export function audioUrl(relativePath: string): string {
  const base = import.meta.env.BASE_URL || "/"
  const normalized = relativePath.replace(/^\//, "")
  return `${base}${normalized}`
}

export async function loadStudyManifest(collectionId: string): Promise<StudyAudioManifest> {
  const res = await fetch(audioUrl(`audio/${collectionId}/manifest.json`))
  if (!res.ok) {
    throw new Error(`Missing study audio for ${collectionId}`)
  }
  return (await res.json()) as StudyAudioManifest
}

export function segmentAtTime(segments: StudySegment[], time: number): StudySegment | null {
  if (segments.length === 0) return null
  for (const segment of segments) {
    if (time >= segment.start && time < segment.end) return segment
  }
  // During tiny timing gaps / end, snap to the nearest prior segment.
  for (let i = segments.length - 1; i >= 0; i--) {
    if (time >= segments[i].start) return segments[i]
  }
  return segments[0]
}

export function startOfWord(segments: StudySegment[], wordIndex: number): number {
  const hit = segments.find((s) => s.wordIndex === wordIndex && s.phase === "de")
  return hit?.start ?? 0
}

export function setupMediaSession(handlers: {
  title: string
  artist?: string
  onPlay: () => void
  onPause: () => void
  onPrevious: () => void
  onNext: () => void
}) {
  if (!("mediaSession" in navigator)) return () => {}

  navigator.mediaSession.metadata = new MediaMetadata({
    title: handlers.title,
    artist: handlers.artist ?? "Lingrow",
    album: "Study session",
  })

  const bind = (action: MediaSessionAction, fn: () => void) => {
    try {
      navigator.mediaSession.setActionHandler(action, fn)
    } catch {
      // Unsupported action on this platform.
    }
  }

  bind("play", handlers.onPlay)
  bind("pause", handlers.onPause)
  bind("previoustrack", handlers.onPrevious)
  bind("nexttrack", handlers.onNext)

  return () => {
    for (const action of ["play", "pause", "previoustrack", "nexttrack"] as MediaSessionAction[]) {
      try {
        navigator.mediaSession.setActionHandler(action, null)
      } catch {
        // ignore
      }
    }
  }
}
