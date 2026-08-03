/**
 * Study pronunciation player — lock-screen capable.
 *
 * Phones (Samsung/Android Chrome, iOS Safari) will keep an HTML <audio> media
 * session playing after the screen locks. They will NOT keep Web Speech
 * (`speechSynthesis`) audible — that API is tied to the page’s foreground JS
 * and gets muted/stopped on lock. Timers may still run, which is why a session
 * can advance silently while you only hear tiny keepalive/gap “clicks”.
 *
 * So auto-play prefers real TTS MP3s through <audio>, preloads upcoming clips,
 * and only falls back to speechSynthesis while the page is visible.
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
/** Wait this long for remote TTS <audio> to start before falling back. */
const AUDIO_START_MS = 2500
/** Hard cap so a stuck clip can never freeze auto-play. */
const ITEM_SAFETY_MS = 20000
/** How many upcoming TTS clips to warm in parallel. */
const PRELOAD_AHEAD = 8

/** Near-silent WAV so the OS keeps a media session across gaps. */
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

  // Tiny amplitude — enough that some OEMs don’t drop the track as “silent”.
  const amp = 8
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

/** Unofficial Google Translate TTS MP3 URL (same family as word suggestions). */
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
 * from a user gesture when possible (unlocks background audio).
 */
export class PronouncePlayer {
  private main = new Audio()
  private keepAlive = new Audio()
  private warmers = new Map<string, HTMLAudioElement>()
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
    // Best-effort: omit Referer on media fetches (Google TTS 404s with github.io Referer).
    this.main.setAttribute("referrerpolicy", "no-referrer")
    this.keepAlive.setAttribute("playsinline", "true")
    this.keepAlive.loop = true
    this.keepAlive.preload = "auto"
    this.keepAlive.volume = 0.01
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
    this.preloadAhead(0)
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
    this.clearWarmers()
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

  private clearWarmers() {
    for (const el of this.warmers.values()) {
      try {
        el.pause()
        el.removeAttribute("src")
        el.load()
      } catch {
        // ignore
      }
    }
    this.warmers.clear()
  }

  private pauseMain() {
    try {
      this.main.onended = null
      this.main.onerror = null
      this.main.onplaying = null
      this.main.onloadedmetadata = null
      this.main.ontimeupdate = null
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

  /** Warm upcoming TTS URLs so lock-screen playback isn’t waiting on the network. */
  private preloadAhead(fromIndex: number) {
    let warmed = 0
    const keep = new Set<string>()

    for (let i = fromIndex; i < this.queue.length && warmed < PRELOAD_AHEAD; i++) {
      const item = this.queue[i]
      if (!item || item.kind !== "tts") continue
      const url = ttsAudioUrl(item.text, item.lang)
      keep.add(url)
      if (!this.warmers.has(url)) {
        const el = new Audio()
        el.preload = "auto"
        el.setAttribute("playsinline", "true")
        el.setAttribute("referrerpolicy", "no-referrer")
        el.src = url
        try {
          el.load()
        } catch {
          // ignore
        }
        this.warmers.set(url, el)
      }
      warmed += 1
    }

    for (const [url, el] of this.warmers) {
      if (keep.has(url)) continue
      try {
        el.pause()
        el.removeAttribute("src")
        el.load()
      } catch {
        // ignore
      }
      this.warmers.delete(url)
    }
  }

  private playCurrent(gen: number) {
    if (this.gen !== gen || !this.active) return

    const item = this.queue[this.index]
    if (!item) {
      this.active = false
      this.clearWarmers()
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

    this.preloadAhead(this.index + 1)

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

  /** Gap: timer advances; near-silent audio keeps the media session continuous. */
  private playSilence(ms: number, gen: number, onDone: () => void) {
    this.clearItemTimer()
    this.pauseMain()

    try {
      this.main.volume = 0.01
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
   * Speak so the user always hears something on-screen, and prefer <audio> when
   * it actually starts (needed for lock-screen continuity).
   *
   * Important: do NOT commit to audio on `loadedmetadata` alone — some browsers
   * report a duration before playback is real; that left sessions silent.
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
    let source: "none" | "audio" | "synth" | "gap" = "none"

    const finish = () => {
      if (settled || this.gen !== gen) return
      settled = true
      this.clearItemTimer()
      this.main.onended = null
      this.main.onerror = null
      this.main.onplaying = null
      this.main.ontimeupdate = null
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
      onDone()
    }

    this.itemTimer = window.setTimeout(finish, ITEM_SAFETY_MS)

    const startSynth = () => {
      if (settled || this.gen !== gen || source === "audio" || source === "synth") return
      source = "synth"
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
        window.speechSynthesis.speak(utter)
      } catch {
        if (source === "synth") finish()
      }
    }

    const startGap = () => {
      if (settled || this.gen !== gen || source === "audio") return
      source = "gap"
      this.playSilence(estimateSpeechMs(text), gen, finish)
    }

    // On-screen: speak immediately via Web Speech so a flaky TTS URL can’t mute us.
    if (document.visibilityState === "visible") {
      startSynth()
    }

    const url = ttsAudioUrl(text, lang)
    // If audio never becomes real, keep synth (visible) or use a gap (locked).
    let audioTimer: number | null = window.setTimeout(() => {
      audioTimer = null
      if (source === "audio") return
      if (document.visibilityState === "visible") {
        // Synth should already be speaking (or have finished).
        return
      }
      startGap()
    }, AUDIO_START_MS)

    const commitAudio = () => {
      if (settled || this.gen !== gen) return false
      const dur = this.main.duration
      const t = this.main.currentTime
      // Require real playback progress — metadata alone is not enough.
      if (!Number.isFinite(dur) || dur < 0.08) return false
      if (!(t > 0.02 || this.main.paused === false)) return false
      if (audioTimer != null) {
        window.clearTimeout(audioTimer)
        audioTimer = null
      }
      source = "audio"
      this.main.volume = 1
      try {
        window.speechSynthesis.cancel()
      } catch {
        // ignore
      }
      return true
    }

    this.main.ontimeupdate = () => {
      if (source === "audio") return
      if (this.main.currentTime > 0.05) commitAudio()
    }
    this.main.onplaying = () => {
      // Wait for timeupdate to prove audio is moving; if duration is known and
      // playing, allow a short delayed commit for browsers that skip timeupdate.
      window.setTimeout(() => {
        if (settled || this.gen !== gen || source === "audio") return
        if (this.main.paused) return
        if (!commitAudio() && document.visibilityState !== "visible") {
          // Locked and audio isn’t real — advance via gap.
          if (audioTimer != null) {
            window.clearTimeout(audioTimer)
            audioTimer = null
          }
          startGap()
        }
      }, 120)
    }
    this.main.onended = () => {
      if (source === "audio") finish()
    }
    this.main.onerror = () => {
      if (audioTimer != null) {
        window.clearTimeout(audioTimer)
        audioTimer = null
      }
      if (source === "audio") {
        // Rare: died after commit — finish so the queue continues.
        finish()
        return
      }
      if (document.visibilityState !== "visible") startGap()
      // Visible: synth already running (or start it).
      else startSynth()
    }

    try {
      this.main.volume = 1
      this.main.src = url
      const playPromise = this.main.play()
      if (playPromise) {
        void playPromise.catch(() => {
          if (audioTimer != null) {
            window.clearTimeout(audioTimer)
            audioTimer = null
          }
          if (document.visibilityState !== "visible") startGap()
          else startSynth()
        })
      }
    } catch {
      if (audioTimer != null) {
        window.clearTimeout(audioTimer)
        audioTimer = null
      }
      if (document.visibilityState !== "visible") startGap()
      else startSynth()
    }
  }
}

let shared: PronouncePlayer | null = null

export function getPronouncePlayer(): PronouncePlayer {
  if (!shared) shared = new PronouncePlayer()
  return shared
}
