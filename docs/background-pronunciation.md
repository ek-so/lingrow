# Background pronunciation (screen lock)

## Why words stop when the phone locks

There are two different “speech” mechanisms in a web app:

| Mechanism | What it is | Survives screen lock? |
| --- | --- | --- |
| **Web Speech** (`speechSynthesis`) | Browser/OS voice engine driven by page JavaScript | **No** — Android (incl. Samsung) and iOS mute or stop it when the screen locks or the tab backgrounds |
| **HTML `<audio>`** | A real media file (MP3/WAV) played as a media session | **Yes** — the OS treats it like music/podcast playback |

Earlier Lingrow used `speechSynthesis` as the main voice. On a locked Samsung phone that produced exactly what you heard:

1. **Words go silent** — `speechSynthesis` is no longer allowed to make sound.
2. **The session still advances** — gaps use timers (`setTimeout`), which often keep running while a tiny keepalive `<audio>` loop holds a media session.
3. **Occasional clicks** — that keepalive / between-card gap track is a near-silent tone, not the vocabulary audio.

So the queue was alive; only the *spoken* channel was the wrong kind of audio for lock-screen.

## What we do now

Auto-play **prefers real TTS MP3s through `<audio>`** (Google Translate’s public TTS endpoint, same unofficial family as word suggestions):

1. **Preload** upcoming clips when you tap Play (while still unlocked / online).
2. **Play each word/translation as `<audio>`** so Android/iOS can keep the media session after lock.
3. **Near-silent gap clips + Media Session** so the session doesn’t look “finished” between cards; lock-screen controls stay available.
4. **Fallback** — if a TTS URL fails *and* the page is still visible, use `speechSynthesis`. If the screen is already locked and TTS fails, advance after a short estimated gap (still no word audio for that item).

Relevant code: `src/lib/speech-audio.ts`, `src/pages/Study.tsx`.

## Tips

- Start with the **Play** button (user gesture unlocks background audio).
- Prefer **Add to Home Screen** / standalone when possible.
- Keep the network available so clips can preload before you lock.
- On Samsung, Chrome/Samsung Internet battery restrictions can still kill background media — if playback dies after a minute, check battery / “put apps to sleep” settings for the browser.

## Limits

- Unofficial Google TTS can throttle, change, or block clients; clips are capped ~180 characters.
- Fully offline lock-screen speech needs pre-downloaded files or a native app.
- Screen Wake Lock only keeps the display on while unlocked; it is not what enables locked playback.
