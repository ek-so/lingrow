/**
 * Background-capable pronunciation via HTMLAudioElement.
 *
 * iOS Safari suspends speechSynthesis when the screen locks; a real <audio>
 * media session is allowed to keep playing. We fetch short TTS clips (Google
 * Translate’s public TTS endpoint — same unofficial family as word suggestions)
 * and chain them with near-silent gap clips so the session never “ends”.
 */

export type SpeechPlayItem =
  | {
      kind: "tts"
      text: string
      lang: string
      onStart?: () => void
    }
  | {
      kind: "silence"
      ms: number
      /** Approximate spoken length when quiet-mode substitutes for TTS. */
      text?: string
      onStart?: () => void
    }

const SILENCE_CACHE = new Map<number, string>()

/** Near-silent WAV so iOS treats gaps as active media (true digital silence can be dropped). */
export function nearSilentWavDataUri(durationMs: number): string {
  const ms = Math.max(50, Math.round(durationMs))
  const cached = SILENCE_CACHE.get(ms)
  if (cached) return cached

  const sampleRate = 22050
  const numSamples = Math.max(1, Math.floor((sampleRate * ms) / 1000))
  const dataSize = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeAscii(view, 0, "RIFF")
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(view, 8, "WAVE")
  writeAscii(view, 12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, "data")
  view.setUint32(40, dataSize, true)

  // Very quiet low tone — audible only as “presence” to the audio session.
  const amp = 40 // of 32767
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const sample = Math.sin(2 * Math.PI * 180 * t) * amp
    view.setInt16(44 + i * 2, sample, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const uri = `data:audio/wav;base64,${btoa(binary)}`
  SILENCE_CACHE.set(ms, uri)
  return uri
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
}

/** Quiet-mode stand-in duration for a phrase. */
export function estimateSpeechMs(text: string): number {
  return Math.min(1100, Math.max(280, text.trim().split(/\s+/).filter(Boolean).length * 260))
}

/** Unofficial Google Translate TTS MP3 URL (works as <audio src>, not always via fetch/CORS). */
export function ttsAudioUrl(text: string, lang: string): string {
  const tl = (lang.split("-")[0] || "en").toLowerCase()
  const q = text.trim().slice(0, 180)
  const params = new URLSearchParams({
    ie: "UTF-8",
    client: "tw-ob",
    q,
    tl,
  })
  return `https://translate.google.com/translate_tts?${params.toString()}`
}

export type MediaSessionHandlers = {
  onPlay?: () => void
  onPause?: () => void
  onNext?: () => void
  onPrevious?: () => void
}

/**
 * Single-player audio queue for study pronunciation.
 * Call {@link PronouncePlayer.startQueue} or {@link PronouncePlayer.speakOne}
 * from a user gesture so iOS unlocks background audio.
 */
export class PronouncePlayer {
  private main = new Audio()
  private preloadEl = new Audio()
  private keepAlive = new Audio()
  private queue: SpeechPlayItem[] = []
  private index = 0
  private gen = 0
  private active = false
  private sessionMeta: { title: string; album?: string } = { title: "Lingrow" }
  private mediaHandlers: MediaSessionHandlers = {}
  private onQueueEnd: (() => void) | null = null

  constructor() {
    this.main.preload = "auto"
    this.preloadEl.preload = "auto"
    this.main.setAttribute("playsinline", "true")
    this.preloadEl.setAttribute("playsinline", "true")
    this.keepAlive.setAttribute("playsinline", "true")
    this.keepAlive.loop = true
    this.keepAlive.preload = "auto"
    this.keepAlive.volume = 0.02
    this.keepAlive.src = nearSilentWavDataUri(2000)

    this.main.addEventListener("ended", () => this.advance())
    this.main.addEventListener("error", () => this.onMainError())
  }

  setMediaSessionHandlers(handlers: MediaSessionHandlers) {
    this.mediaHandlers = handlers
    this.bindMediaSession()
  }

  setSessionMeta(meta: { title: string; album?: string }) {
    this.sessionMeta = meta
    this.updateMediaMetadata(meta.title)
  }

  /** Begin (or replace) a queued session. Must run in a user-gesture stack when possible. */
  startQueue(items: SpeechPlayItem[], onQueueEnd?: () => void): void {
    this.gen += 1
    this.queue = items
    this.index = 0
    this.active = true
    this.onQueueEnd = onQueueEnd ?? null
    void this.ensureKeepAlive()
    this.bindMediaSession()
    void this.playCurrent()
  }

  /** One-off pronunciation (manual flip / side button). Stops any queue. */
  speakOne(text: string, lang: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    this.gen += 1
    this.queue = []
    this.index = 0
    this.active = true
    void this.ensureKeepAlive()
    this.bindMediaSession()
    this.updateMediaMetadata(trimmed)
    this.playSrc(ttsAudioUrl(trimmed, lang), () => {
      this.active = false
      this.stopKeepAlive()
    })
  }

  stop(): void {
    this.gen += 1
    this.queue = []
    this.index = 0
    this.active = false
    this.onQueueEnd = null
    this.main.pause()
    this.main.removeAttribute("src")
    this.main.load()
    this.preloadEl.pause()
    this.stopKeepAlive()
    window.speechSynthesis?.cancel()
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "paused"
      } catch {
        // ignore
      }
    }
  }

  get isActive() {
    return this.active
  }

  private async ensureKeepAlive() {
    try {
      if (this.keepAlive.paused) {
        await this.keepAlive.play()
      }
    } catch {
      // Autoplay restrictions — main clip play() from the gesture usually still works.
    }
  }

  private stopKeepAlive() {
    this.keepAlive.pause()
    try {
      this.keepAlive.currentTime = 0
    } catch {
      // ignore
    }
  }

  private bindMediaSession() {
    if (!("mediaSession" in navigator)) return
    try {
      navigator.mediaSession.setActionHandler("play", () => {
        this.mediaHandlers.onPlay?.()
      })
      navigator.mediaSession.setActionHandler("pause", () => {
        this.mediaHandlers.onPause?.()
      })
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        this.mediaHandlers.onNext?.()
      })
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        this.mediaHandlers.onPrevious?.()
      })
    } catch {
      // Some handlers unsupported.
    }
  }

  private updateMediaMetadata(title: string) {
    if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: "Lingrow",
        album: this.sessionMeta.album ?? "Study",
      })
      navigator.mediaSession.playbackState = "playing"
    } catch {
      // ignore
    }
  }

  private advance() {
    if (!this.active) return
    this.index += 1
    void this.playCurrent()
  }

  private async playCurrent() {
    const gen = this.gen
    const item = this.queue[this.index]
    if (!item) {
      this.active = false
      this.stopKeepAlive()
      const ended = this.onQueueEnd
      this.onQueueEnd = null
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.playbackState = "none"
        } catch {
          // ignore
        }
      }
      ended?.()
      return
    }

    item.onStart?.()
    if (gen !== this.gen) return

    if (item.kind === "silence") {
      const ms = item.text ? estimateSpeechMs(item.text) : item.ms
      this.updateMediaMetadata(this.sessionMeta.title)
      this.playSrc(nearSilentWavDataUri(ms))
      this.preloadNext(this.index + 1)
      return
    }

    this.updateMediaMetadata(item.text)
    this.playSrc(ttsAudioUrl(item.text, item.lang), () => {
      // TTS failed — fall back to speechSynthesis while foregrounded.
      if (gen !== this.gen) return
      this.speakSynthesisFallback(item.text, item.lang, () => {
        if (gen !== this.gen) return
        this.advance()
      })
    })
    this.preloadNext(this.index + 1)
  }

  private preloadNext(at: number) {
    const item = this.queue[at]
    if (!item) return
    try {
      if (item.kind === "tts") {
        this.preloadEl.src = ttsAudioUrl(item.text, item.lang)
      } else {
        const ms = item.text ? estimateSpeechMs(item.text) : item.ms
        this.preloadEl.src = nearSilentWavDataUri(ms)
      }
      this.preloadEl.load()
    } catch {
      // ignore preload failures
    }
  }

  private playSrc(src: string, onError?: () => void) {
    const gen = this.gen
    this.main.onerror = () => {
      if (gen !== this.gen) return
      if (onError) onError()
      else this.advance()
    }
    this.main.src = src
    const playPromise = this.main.play()
    if (playPromise) {
      void playPromise.catch(() => {
        if (gen !== this.gen) return
        if (onError) onError()
        else this.advance()
      })
    }
  }

  private onMainError() {
    // Handled via playSrc onerror; keep as safety net.
  }

  private speakSynthesisFallback(text: string, lang: string, onEnd: () => void) {
    try {
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      utter.rate = 0.95
      const voices = window.speechSynthesis.getVoices()
      const prefix = lang.toLowerCase().slice(0, 2)
      const voice =
        voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
        voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
      if (voice) utter.voice = voice
      utter.onend = onEnd
      utter.onerror = onEnd
      window.speechSynthesis.speak(utter)
    } catch {
      onEnd()
    }
  }
}

let shared: PronouncePlayer | null = null

export function getPronouncePlayer(): PronouncePlayer {
  if (!shared) shared = new PronouncePlayer()
  return shared
}
