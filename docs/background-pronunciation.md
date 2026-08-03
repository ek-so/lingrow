# Study pronunciation & background audio

## Verdict

| Goal | Status on a plain web app |
| --- | --- |
| Hear words with screen **on** | Reliable via `speechSynthesis` |
| Keep **advancing** cards when locked | Often yes (timers + keepalive `<audio>`) |
| Keep **hearing words** when locked | Only if real TTS **MP3s** play through `<audio>` — not guaranteed on all phones |
| Offline lock-screen speech | Not supported without a backend or native app |

Mobile OSes (iOS Safari, Android Chrome / Samsung Internet) treat Web Speech and HTML media differently. `speechSynthesis` is not a media session; it is typically muted or stopped when the screen locks. HTML `<audio>` can continue as a media session (music/podcast style), subject to battery policies and network.

## Current architecture

Lingrow uses a **split control / media plane** on purpose:

1. **Control plane — `speechSynthesis` + timers**  
   Speaks immediately when visible so Play never depends on a network TTS URL. Gaps and safety timeouts always advance the queue.

2. **Media plane — Google TTS MP3 via `<audio>`**  
   In parallel, each phrase tries `translate.googleapis.com/translate_tts`. If that clip **actually progresses** within ~1.5s, we switch to it (better for lock-screen). Otherwise Web Speech keeps going.

3. **Keepalive + Media Session**  
   A near-silent loop and gap clips try to keep an OS media session alive; lock-screen play/pause/next/previous are wired when supported.

4. **User gesture**  
   Play must start from a tap so browsers unlock audio.

Relevant code: `src/lib/speech-audio.ts`, `src/pages/Study.tsx`, `app.html`.

## Critical footgun (fixed in app entry)

Google’s TTS endpoint returns **HTTP 404** when the request includes a `Referer` from `ek-so.github.io`. A normal `<audio src=…>` from the GitHub Pages app sends that Referer, so MP3s fail, the player stays on `speechSynthesis`, and lock-screen speech never works.

**Mitigation:** `<meta name="referrer" content="no-referrer">` in `app.html`, plus `referrerpolicy="no-referrer"` on audio elements.

## Platform notes

- **Desktop Chrome/Firefox/Safari** — Web Speech is fine; lock-screen less relevant.
- **iOS Safari / Home Screen PWA** — Web Speech stops when locked; `<audio>` MP3s can continue if loaded. Prefer Add to Home Screen. Start with Play.
- **Android Chrome / Samsung Internet** — Same split. OEMs may still kill background media (battery “sleeping apps”) even when TTS MP3s work. That is OS policy, not missing Settings copy in-app.
- **Quiet mode** — Advances on estimated timings with near-silent clips (no spoken audio).

## Recommendations (senior / product)

**Keep (short term)**  
- Split plane: Web Speech for foreground reliability.  
- Referer omission for Google TTS.  
- Safety timeouts so a hung URL cannot freeze Play.  
- Take over to `<audio>` only after `currentTime` progresses (not metadata alone).

**Do next for real cross-platform lock-screen speech**  
1. **Owned TTS backend** (e.g. Supabase Edge Function → Cloud TTS / Azure / similar) that returns MP3/OGG with CORS or same-origin URLs. Prefetch blobs on Play, play only `<audio>`. Drop unofficial Google TTS.  
2. **Single media pipeline** while auto-playing: no Web Speech during the locked session — only queued `<audio>` (A/B double-buffer so the session never gaps to “idle”).  
3. **Optional Capacitor/native shell** if you need guaranteed background audio and offline packs.

**Avoid**  
- Depending on unofficial Google TTS as a product guarantee.  
- Flipping “audio-first” vs “synth-first” without automated device tests.  
- Promising lock-screen speech on all Samsung builds without a backend media pipeline.

## Manual test checklist

1. Hard-refresh app → Play with screen on → every card speaks.  
2. Play → lock after 2–3 words → words continue **or** only clicks/gaps (document which).  
3. Airplane mode after preloading a few words → observe behavior.  
4. Quiet mode → session still advances silently.
