/**
 * Study pronunciation player.
 *
 * Control plane (advances the session): speechSynthesis + timers — reliable while
 * the page is in the foreground.
 *
 * Media plane (helps iOS keep audio alive when locked): a near-silent keepalive
 * loop, Media Session metadata, and best-effort TTS MP3 playback via <audio>.
 * If a TTS URL hangs or fails, we never block the queue on it.
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
/** How long to wait for remote TTS audio before using speechSynthesis. */
const AUDIO_START_MS = 1500
/** Hard cap so a stuck utterance can never freeze auto-play. */
const ITEM_SAFETY_MS = 12000

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

/** Unofficial Google Translate TTS MP3 URL (best-effort; may be empty/blocked). */
export function ttsAudioUrl(text: string, lang: string): string {
  const tl = (lang.split("-")[0] || "en").toLowerCase()
  const q = text.trim().slice(0, 180)
  const params = new URLSearchParams({
    ie: "UTF-8",
    client: "gtx",
    q,
    tl,
    ttsspeed: "1",
  })
  return `https://translate.googleapis.com/translate_tts?${params.toString()}`
}

export type MediaSessionHandlers = {
  onPlay?: () => void
  onPause?: () => void
  onNext?: () => void
  onPrevious?: () => void
}

/**
 * Queued pronunciation for study auto-play and one-off side plays.
 * Call {@link PronouncePlayer.startQueue} / {@link PronouncePlayer.speakOne}
 * from a user gesture when possible (unlocks background audio on iOS).
 */
export class PronouncePlayer {
  private main = new Audio()
  private keepAlive = new Audio()
  private queue: SpeechPlayItem[] = []
  private index = 0
  private gen = 0
  private active = false
  private sessionMeta: { title: string; album?: string } = { title: "Lingrow" }
  private mediaHandlers: MediaSessionHandlers = {}
  private onQueueEnd: (() => void) | null = null
  private itemTimer: number | null = null
  private voices: SpeechSynthesisVoice[] = []

  constructor() {
    this.main.preload = "auto"
    this.main.setAttribute("playsinline", "true")
    this.keepAlive.setAttribute("playsinline", "true")
    this.keepAlive.loop = true
    this.keepAlive.preload = "auto"
    this.keepAlive.volume = 0.02
    this.keepAlive.src = nearSilentWavDataUri(2000)

    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices)
  }

  setMediaSessionHandlers(handlers: MediaSessionHandlers) {
    this.mediaHandlers = handlers
    this.bindMediaSession()
  }

  setSessionMeta(meta: { title: string; album?: string }) {
    this.sessionMeta = meta
    this.updateMediaMetadata(meta.title)
  }

  /** Begin (or replace) a queued session. Prefer calling from a user-gesture stack. */
  startQueue(items: SpeechPlayItem[], onQueueEnd?: () => void): void {
    this.clearItemTimer()
    this.gen += 1
    this.queue = items
    this.index = 0
    this.active = true
    this.onQueueEnd = onQueueEnd ?? null
    void this.ensureKeepAlive()
    this.bindMediaSession()
    this.playCurrent(this.gen)
  }

  /** One-off pronunciation (manual flip / side button). Stops any queue. */
  speakOne(text: string, lang: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    this.clearItemTimer()
    this.gen += 1
    const gen = this.gen
    this.queue = []
    this.index = 0
    this.active = true
    this.onQueueEnd = null
    void this.ensureKeepAlive()
    this.bindMediaSession()
    this.updateMediaMetadata(trimmed)
    this.speakText(trimmed, lang, gen, () => {
      if (this.gen !== gen) return
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
    this.clearItemTimer()
    this.pauseMain()
    this.stopKeepAlive()
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore
    }
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

  private clearItemTimer() {
    if (this.itemTimer != null) {
      window.clearTimeout(this.itemTimer)
      this.itemTimer = null
    }
  }

  private pauseMain() {
    try {
      this.main.onended = null
      this.main.onerror = null
      this.main.onplaying = null
      this.main.pause()
      this.main.removeAttribute("src")
      this.main.load()
    } catch {
      // ignore
    }
  }

  private async ensureKeepAlive() {
    try {
      if (this.keepAlive.paused) await this.keepAlive.play()
    } catch {
      // Autoplay restrictions — speechSynthesis still works in the foreground.
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
      navigator.mediaSession.setActionHandler("play", () => this.mediaHandlers.onPlay?.())
      navigator.mediaSession.setActionHandler("pause", () => this.mediaHandlers.onPause?.())
      navigator.mediaSession.setActionHandler("nexttrack", () => this.mediaHandlers.onNext?.())
      navigator.mediaSession.setActionHandler("previoustrack", () => this.mediaHandlers.onPrevious?.())
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

  private playCurrent(gen: number) {
    if (this.gen !== gen || !this.active) return

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
    if (this.gen !== gen) return

    const advance = () => {
      if (this.gen !== gen) return
      this.index += 1
      this.playCurrent(gen)
    }

    if (item.kind === "silence") {
      const ms = item.text ? estimateSpeechMs(item.text) : item.ms
      this.updateMediaMetadata(this.sessionMeta.title)
      this.playSilence(ms, gen, advance)
      return
    }

    this.updateMediaMetadata(item.text)
    this.speakText(item.text, item.lang, gen, advance)
  }

  /** Gap: timer is authoritative; near-silent audio keeps the media session warm. */
  private playSilence(ms: number, gen: number, onDone: () => void) {
    this.clearItemTimer()
    this.pauseMain()

    try {
      this.main.src = nearSilentWavDataUri(ms)
      void this.main.play().catch(() => undefined)
    } catch {
      // ignore
    }

    this.itemTimer = window.setTimeout(() => {
      this.itemTimer = null
      if (this.gen !== gen) return
      this.pauseMain()
      onDone()
    }, ms)
  }

  /**
   * Speak immediately via speechSynthesis (reliable on-screen).
   * Also try remote TTS <audio>; if it starts with a real duration while synth
   * is still warming up, switch to audio (better for lock-screen continuity).
   */
  private speakText(text: string, lang: string, gen: number, onDone: () => void) {
    this.clearItemTimer()
    this.pauseMain()
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore
    }

    let settled = false
    let source: "synth" | "audio" = "synth"
    let synthStartedAt = 0

    const finish = () => {
      if (settled || this.gen !== gen) return
      settled = true
      this.clearItemTimer()
      this.main.onended = null
      this.main.onerror = null
      this.main.onplaying = null
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
      onDone()
    }

    // Never hang the queue on a stuck network/voice.
    this.itemTimer = window.setTimeout(finish, ITEM_SAFETY_MS)

    // Defer speak() so cancel() can settle — same-turn speak is often dropped.
    window.setTimeout(() => {
      if (settled || this.gen !== gen) return

      try {
        const utter = new SpeechSynthesisUtterance(text)
        utter.lang = lang
        utter.rate = 0.95
        const prefix = lang.toLowerCase().slice(0, 2)
        const voice =
          this.voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase())) ??
          this.voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
          window.speechSynthesis.getVoices().find((v) =>
            v.lang.toLowerCase().startsWith(lang.toLowerCase()),
          )
        if (voice) utter.voice = voice
        utter.onend = () => {
          if (source === "synth") finish()
        }
        utter.onerror = () => {
          if (source === "synth") finish()
        }
        synthStartedAt = performance.now()
        window.speechSynthesis.speak(utter)
      } catch {
        finish()
        return
      }

      // Best-effort audio path — only steal the turn if it starts almost immediately.
      const url = ttsAudioUrl(text, lang)
      this.main.onplaying = () => {
        if (settled || this.gen !== gen) return
        const dur = this.main.duration
        if (!Number.isFinite(dur) || dur < 0.08) {
          this.main.pause()
          return
        }
        // If synth has already been audible for a bit, don't double-speak.
        if (performance.now() - synthStartedAt > AUDIO_START_MS) {
          this.main.pause()
          return
        }
        source = "audio"
        try {
          window.speechSynthesis.cancel()
        } catch {
          // ignore
        }
      }
      this.main.onended = () => {
        if (source === "audio") finish()
      }
      this.main.onerror = () => {
        // Synth remains in control.
      }

      try {
        this.main.src = url
        void this.main.play().catch(() => undefined)
      } catch {
        // ignore — synth already running
      }
    }, 40)
  }
}

let shared: PronouncePlayer | null = null

export function getPronouncePlayer(): PronouncePlayer {
  if (!shared) shared = new PronouncePlayer()
  return shared
}
