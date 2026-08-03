# Background pronunciation (screen lock)

## Why words stop when the phone locks

There are two different “speech” mechanisms in a web app:

| Mechanism | What it is | Survives screen lock? |
| --- | --- | --- |
| **Web Speech** (`speechSynthesis`) | Browser/OS voice engine driven by page JavaScript | **No** — Android (incl. Samsung) and iOS mute or stop it when the screen locks |
| **HTML `<audio>`** | A real media file (MP3/WAV) played as a media session | **Yes** — the OS treats it like music/podcast playback |

If auto-play falls back to `speechSynthesis`, you get exactly the broken lock-screen behavior: the session can still advance (timers), you may hear tiny gap “clicks”, but vocabulary audio is gone.

## Why `<audio>` TTS was failing (the real bug)

Lock-screen speech uses Google Translate’s public TTS MP3 URLs (same unofficial family as word suggestions). Those URLs return **HTTP 404** when the browser sends a `Referer` from `ek-so.github.io`.

A normal `<audio src="https://translate.googleapis.com/...">` request *does* send that Referer, so:

1. TTS MP3 fails to load  
2. The player falls back to `speechSynthesis` (works with the screen on)  
3. You lock the phone → Web Speech is muted → silence  

This is **not** a Samsung battery-settings issue. Battery “sleeping apps” can still kill background media later, but the primary failure was the Referer/404.

**Fix:** the app entry sets `<meta name="referrer" content="no-referrer">` so TTS media requests omit Referer and Google returns the MP3. Audio elements also set `referrerPolicy = "no-referrer"` when the browser supports it.

## What Play does now

1. **Preload** upcoming TTS clips when you tap Play  
2. **Play each word/translation as `<audio>`** (media session → can continue when locked)  
3. **Near-silent gap clips + Media Session** between cards  
4. **Fallback** — if TTS still fails while visible, use `speechSynthesis`; if already locked, advance after a short estimated gap  

Relevant code: `src/lib/speech-audio.ts`, `app.html`, `src/pages/Study.tsx`.

## Tips

- Start with **Play** (user gesture unlocks background audio)  
- Wait a moment for the first words to load before locking  
- Prefer Add to Home Screen when possible  
- Keep network available for TTS  

## Limits

- Unofficial Google TTS can change or block clients; clips are capped ~180 characters  
- Fully offline lock-screen speech needs pre-downloaded files or a native app  
- Screen Wake Lock only keeps the display on while unlocked  
