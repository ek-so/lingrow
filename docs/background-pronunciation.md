# Background pronunciation (screen lock)

Study auto-play uses an HTML `<audio>` queue rather than the Web Speech API
(`speechSynthesis`), so pronunciation can continue when the phone screen locks.

## Why

On iOS Safari, `speechSynthesis.speak()` is tied to page JavaScript execution.
When the screen locks or the tab is backgrounded, that JS is suspended and speech
stops. An `<audio>` element with a real audio source is a media session, which
iOS is willing to keep alive in the background (especially for a Home Screen /
standalone PWA).

## How Lingrow does it

1. **Control plane** — Auto-play speaks with `speechSynthesis` and advances with
   timers so a stuck network request can never freeze the session on-screen.
2. **Best-effort TTS audio** — In parallel, each phrase tries Google Translate’s
   public TTS MP3 (`translate.googleapis.com/translate_tts`, `client=gtx`). If
   that `<audio>` starts almost immediately with a real duration, we switch to
   it (better for lock-screen continuity); otherwise speechSynthesis keeps going.
3. **Keepalive + gaps** — A near-silent looping track and short gap clips keep a
   media session warm between phrases.
4. **Media Session** — Lock-screen play/pause/next/previous controls are wired
   through `navigator.mediaSession`.
5. **User gesture** — Starting Play kicks audio in the tap stack so iOS can
   unlock background playback.

Relevant code: `src/lib/speech-audio.ts`, `src/pages/Study.tsx`.

## Tips for reliable lock-screen play on iPhone

- Start with the **Play** button (don’t rely on automatic speech alone).
- Prefer **Add to Home Screen** (standalone). The app links a web manifest.
- Keep the network available so TTS clips can load (or preload while unlocked).
- Quiet mode still advances on near-silent audio timings (no spoken audio).

## Limits

- Unofficial Google TTS can throttle, change, or block clients; clips are capped
  around ~180 characters.
- True offline lock-screen speech would need pre-downloaded audio or a native app.
- Screen Wake Lock (when supported) still keeps the display on while unlocked; it
  is not what enables locked playback.
