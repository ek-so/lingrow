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

1. **TTS clips as audio** — Word/translation text is turned into MP3 URLs via
   Google Translate’s public TTS endpoint (`translate.google.com/translate_tts`,
   `client=tw-ob`), the same unofficial Google family used for word suggestions.
2. **Queued playback** — Play builds a full remaining-session queue of speech
   clips plus near-silent gap WAVs (so the session never looks “finished” to iOS).
3. **Media Session** — Lock-screen play/pause/next/previous controls are wired
   through `navigator.mediaSession`.
4. **User gesture** — Starting Play calls `audio.play()` in the tap stack so iOS
   unlocks background audio.
5. **Fallback** — If a TTS URL fails (network/block), we fall back to
   `speechSynthesis` while foregrounded; that path will still stop when locked.

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
