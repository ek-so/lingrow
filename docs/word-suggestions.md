# Word suggestions: data sources

When you type a word while creating or editing a list, Lingrow looks up a
translation, alternative senses, usage examples, and (for some languages)
enriched word forms. Everything is fetched **in the browser** — there is no
Lingrow backend for suggestions, and no API key is configured today.

Suggestions are helpers only. You can always edit or ignore them before saving.

## Sources

| What | Source | Notes |
| --- | --- | --- |
| Translation + alternatives | [Google Translate](https://translate.google.com/) public `gtx` endpoint (`translate.googleapis.com`) | Unofficial client endpoint (`client=gtx`). No API key. Used for the primary translation, dictionary-style alternatives, and part-of-speech hints. Lemmas stay bare; tap chips to **append** with commas. |
| Example / usage sentences | **Same Google Translate `gtx` response** | Dictionary usage snippets in the **word** language when Google returns them (`dt=ex` / definition examples). Shown as a bullet list you can tap to add. |
| German gender + plural | [Wiktionary](https://www.wiktionary.org/) | Prefer `de.wiktionary.org` (`Deutsch Substantiv Übersicht`). Fall back to `en.wiktionary.org` (`{{de-noun|…}}`). |
| German verb conjugations | [Wiktionary](https://www.wiktionary.org/) | Fetches 3rd person singular present, Präteritum, and Partizip II forms (with auxiliary verb haben/sein) from `de.wiktionary.org` (`Deutsch Verb Übersicht`) or `en.wiktionary.org` conjugation tables. Displayed as `, denkt, dachte, hat gedacht` format. |
| German form fallback | Inferred from example text | If Wiktionary is slow or rate-limited, gender/plural may be guessed from example sentences (and cached in `localStorage` when resolved). |
| English `to` / German articles | Lingrow UI hints | Offered as **light accept chips** (`to`, `der` / `die` / `das`, and `, Plural` or verb forms) — not auto-inserted. Tap to apply. |

### Request flow (simplified)

1. Debounce the typed word (~450ms).
2. Call Google Translate `gtx` for `from → to` (DE / EN / RU pairs supported in the app).
3. If the word looks like a **German noun**, also ask Wiktionary for gender + plural.
4. If the word looks like a **German verb**, also ask Wiktionary for conjugated forms (3rd person singular, Präteritum, Partizip II with auxiliary).
5. Auto-fill bare translation + examples when those fields are empty.
6. Show light chips for `to` / `der|die|das` / plural / verb forms, and translation chips that **stack with commas**. Manual edits are not overwritten.

Relevant code:

- `src/lib/suggest.ts` — Google lookup, POS handling, hint assembly
- `src/lib/german-noun.ts` — Wiktionary + plural/gender helpers
- `src/lib/german-verb.ts` — Wiktionary + verb conjugation helpers (3rd person singular, Präteritum, Partizip II)
- `src/lib/suggest-format.ts` — apply prefix / comma-append helpers
- `src/lib/use-word-suggest.ts` — debounce / React hook
- `src/components/CollectionForm.tsx` — suggestion UI

## Limits and caveats

- **Unofficial Google endpoint** — convenient and keyless, but not a supported public API. It can change, throttle, or block clients without notice.
- **Wiktionary rate limits** — occasional misses are expected; we retry on later keystrokes and keep a small browser cache.
- **Quality** — machine translation and scraped dictionary data can be wrong or incomplete (homonyms, rare plurals, multi-word expressions).
- **Privacy** — the typed word is sent to Google and (for German nouns) to Wiktionary.

If we ever need a more formal setup (stable ToS, higher volume, offline), options include DeepL / Google Cloud Translation with a secret behind a small backend, or a local dictionary pack.

## Why this lives under `docs/`

For a code project, the usual practice is **docs-as-code**: Markdown in the repo
(e.g. `docs/`), reviewed with the same commits as the feature. That stays in sync
with the implementation better than a separate GitHub Wiki, which lives outside
the git history of the app.
