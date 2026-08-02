/**
 * Pronunciation via real audio (Google Translate TTS → HTMLAudioElement),
 * with Web Speech API as a fallback.
 *
 * Same unofficial/keyless Google endpoint style as `suggest.ts`. Audio is played
 * by URL on `<audio>` (no CORS fetch needed). We only keep a small preload window
 * so large word lists do not download everything up front.
 */

const MAX_CHUNK_CHARS = 180
const PRELOAD_LIMIT = 24

let playGen = 0
let current: HTMLAudioElement | null = null

/** Preloaded clips keyed by `lang|text`. Bounded LRU via Map insertion order. */
const preloadCache = new Map<string, HTMLAudioElement>()

function cacheKey(text: string, lang: string) {
  return `${lang}|${text}`
}

/** BCP-47 (`de-DE`) or short (`de`) → Google `tl` code. */
export function ttsLang(lang: string): string {
  return lang.trim().toLowerCase().slice(0, 2)
}

export function ttsUrl(text: string, lang: string): string {
  const tl = ttsLang(lang)
  return (
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx` +
    `&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(tl)}`
  )
}

/** Split long phrases so each request stays under Google’s practical length cap. */
export function chunkTextForTts(text: string, max = MAX_CHUNK_CHARS): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= max) return [trimmed]

  const parts: string[] = []
  let rest = trimmed
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max)
    if (cut < Math.floor(max * 0.4)) cut = max
    const piece = rest.slice(0, cut).trim()
    if (piece) parts.push(piece)
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

function evictPreload() {
  while (preloadCache.size > PRELOAD_LIMIT) {
    const oldest = preloadCache.keys().next().value
    if (oldest === undefined) break
    const audio = preloadCache.get(oldest)
    preloadCache.delete(oldest)
    if (audio && audio !== current) {
      audio.removeAttribute("src")
      try {
        audio.load()
      } catch {
        // ignore
      }
    }
  }
}

function takeAudio(text: string, lang: string): HTMLAudioElement {
  const key = cacheKey(text, lang)
  const cached = preloadCache.get(key)
  if (cached) {
    preloadCache.delete(key)
    try {
      cached.currentTime = 0
    } catch {
      // ignore
    }
    return cached
  }
  const audio = new Audio()
  audio.preload = "auto"
  audio.src = ttsUrl(text, lang)
  return audio
}

function rememberAudio(text: string, lang: string, audio: HTMLAudioElement) {
  const key = cacheKey(text, lang)
  try {
    audio.currentTime = 0
  } catch {
    // ignore
  }
  if (preloadCache.has(key)) preloadCache.delete(key)
  preloadCache.set(key, audio)
  evictPreload()
}

function teardownCurrent(recycle?: { text: string; lang: string }) {
  if (!current) return
  const audio = current
  audio.onended = null
  audio.onerror = null
  audio.pause()
  try {
    audio.currentTime = 0
  } catch {
    // ignore
  }
  current = null
  if (recycle) rememberAudio(recycle.text, recycle.lang, audio)
}

function setMediaSession(title: string, playing: boolean) {
  if (!("mediaSession" in navigator)) return
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "Lingrow",
      album: "Study",
    })
    navigator.mediaSession.playbackState = playing ? "playing" : "none"
  } catch {
    // Media Session unsupported or restricted.
  }
}

function speakWithSynthesis(text: string, lang: string, gen: number, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) {
    onEnd?.()
    return
  }
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = lang
  utter.rate = 0.95
  const finish = () => {
    if (playGen !== gen) return
    setMediaSession(text, false)
    onEnd?.()
  }
  utter.onend = finish
  utter.onerror = finish
  window.speechSynthesis.cancel()
  setMediaSession(text, true)
  window.speechSynthesis.speak(utter)
}

function playChunk(
  text: string,
  lang: string,
  gen: number,
  onEnd?: () => void,
) {
  if (playGen !== gen) return

  const audio = takeAudio(text, lang)
  current = audio
  setMediaSession(text, true)

  const finishOk = () => {
    if (playGen !== gen) return
    teardownCurrent({ text, lang })
    setMediaSession(text, false)
    onEnd?.()
  }

  const finishErr = () => {
    if (playGen !== gen) return
    teardownCurrent()
    // Network / blocked TTS — fall back so study still voices the word.
    speakWithSynthesis(text, lang, gen, onEnd)
  }

  audio.onended = finishOk
  audio.onerror = finishErr

  const playPromise = audio.play()
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      finishErr()
    })
  }
}

function playChunks(
  chunks: string[],
  lang: string,
  index: number,
  gen: number,
  onEnd?: () => void,
) {
  if (playGen !== gen) return
  if (index >= chunks.length) {
    onEnd?.()
    return
  }
  const piece = chunks[index]!
  playChunk(piece, lang, gen, () => {
    playChunks(chunks, lang, index + 1, gen, onEnd)
  })
}

/** Stop current playback (audio + speechSynthesis) and invalidate pending callbacks. */
export function stopSpeaking() {
  playGen += 1
  teardownCurrent()
  setMediaSession("", false)
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Speak `text` in `lang` using streamed TTS audio when possible.
 * `onEnd` runs after the full phrase (all chunks) finishes, or after fallback TTS.
 */
export function speak(text: string, lang: string, onEnd?: () => void) {
  const trimmed = text.trim()
  // Replace any in-flight clip without invalidating this new utterance's generation.
  teardownCurrent()
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }

  if (!trimmed) {
    onEnd?.()
    return
  }

  const gen = playGen
  const chunks = chunkTextForTts(trimmed)
  playChunks(chunks, lang, 0, gen, onEnd)
}

/** Warm the next few clips (current/next sides). Safe to call often; bounded cache. */
export function prefetchSpeech(items: { text: string; lang: string }[]) {
  for (const item of items) {
    const trimmed = item.text.trim()
    if (!trimmed) continue
    for (const piece of chunkTextForTts(trimmed)) {
      const key = cacheKey(piece, item.lang)
      if (preloadCache.has(key)) {
        // Refresh LRU order.
        const existing = preloadCache.get(key)!
        preloadCache.delete(key)
        preloadCache.set(key, existing)
        continue
      }
      const audio = new Audio()
      audio.preload = "auto"
      audio.src = ttsUrl(piece, item.lang)
      preloadCache.set(key, audio)
      evictPreload()
    }
  }
}
