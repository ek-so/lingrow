import type { LangCode } from "@/types"
import { otherLangs } from "@/lib/languages"

export interface WordSuggestion {
  /** Best single translation for the “into” field. */
  translation: string
  /** Alternative translations (excludes the primary). */
  alternatives: string[]
  /** Usage examples in the word language. */
  examples: string[]
}

const MAX_ALTERNATIVES = 6
const MAX_EXAMPLES = 3
const MIN_QUERY_LEN = 2
const CACHE_LIMIT = 80

const cache = new Map<string, WordSuggestion>()

function cacheKey(text: string, from: LangCode, to: LangCode) {
  return `${from}|${to}|${text.trim().toLowerCase()}`
}

function stripTags(s: string) {
  return s.replace(/<\/?b>/gi, "").replace(/<[^>]+>/g, "").trim()
}

function normalizeExample(raw: string): string | null {
  let s = stripTags(raw)
    .replace(/\s+/g, " ")
    .trim()
  if (!s) return null
  // Drop bare dictionary fragments that are just the headword-ish gloss.
  if (s.length < 8) return null
  if (s.length > 140) s = `${s.slice(0, 137).trimEnd()}…`
  // Capitalize first letter when the source starts lower (common for Google DE examples).
  if (/^[a-zäöüа-яё]/.test(s)) {
    s = s[0]!.toUpperCase() + s.slice(1)
  }
  if (!/[.!?…]$/.test(s) && s.split(/\s+/).length >= 4) {
    s = `${s}.`
  }
  return s
}

function pushUnique(list: string[], value: string, limit: number) {
  const key = value.toLowerCase()
  const idx = list.findIndex((v) => v.toLowerCase() === key)
  if (idx >= 0) {
    // Prefer lowercase lemma spelling when MT returns Title Case and the dict has lower.
    const existing = list[idx]!
    if (existing !== existing.toLowerCase() && value === value.toLowerCase()) {
      list[idx] = value
    }
    return
  }
  list.push(value)
  if (list.length > limit) list.length = limit
}

function preferLemmaCase(primary: string, candidates: string[]): string {
  const trimmed = primary.trim()
  if (!trimmed) return ""
  const looksTitleCase =
    trimmed[0] === trimmed[0]!.toUpperCase() && /[a-zäöü]/.test(trimmed.slice(1))
  if (!looksTitleCase) return trimmed
  // Prefer dictionary lemma casing (usually lowercase) over title-case MT output.
  const lowerMatch = candidates.find(
    (a) => a.toLowerCase() === trimmed.toLowerCase() && a === a.toLowerCase(),
  )
  return lowerMatch ?? trimmed
}

/** Parse Google Translate `client=gtx` JSON into translations + examples. */
export function parseGoogleSuggest(
  data: unknown,
  opts: { wantTranslation: boolean },
): WordSuggestion {
  const translations: string[] = []
  const examples: string[] = []

  if (!Array.isArray(data)) {
    return { translation: "", alternatives: [], examples: [] }
  }

  if (opts.wantTranslation) {
    const primaryBlock = data[0]
    if (Array.isArray(primaryBlock) && Array.isArray(primaryBlock[0])) {
      const primary = primaryBlock[0][0]
      if (typeof primary === "string" && primary.trim()) {
        pushUnique(translations, primary.trim(), MAX_ALTERNATIVES + 1)
      }
    }

    const dict = data[1]
    if (Array.isArray(dict)) {
      for (const block of dict) {
        if (!Array.isArray(block) || !Array.isArray(block[1])) continue
        for (const word of block[1]) {
          if (typeof word === "string" && word.trim()) {
            pushUnique(translations, word.trim(), MAX_ALTERNATIVES + 1)
          }
        }
      }
    }

    const alts = data[5]
    if (Array.isArray(alts)) {
      for (const item of alts) {
        if (!Array.isArray(item) || !Array.isArray(item[2])) continue
        for (const alt of item[2]) {
          if (Array.isArray(alt) && typeof alt[0] === "string" && alt[0].trim()) {
            pushUnique(translations, alt[0].trim(), MAX_ALTERNATIVES + 1)
          }
        }
      }
    }
  }

  const exampleBlock = data[13]
  if (Array.isArray(exampleBlock)) {
    for (const row of exampleBlock) {
      if (!Array.isArray(row) || typeof row[0] !== "string") continue
      const normalized = normalizeExample(row[0])
      if (normalized) pushUnique(examples, normalized, MAX_EXAMPLES)
    }
  }

  // Definition snippets sometimes carry short usage phrases (index 12).
  if (examples.length < MAX_EXAMPLES) {
    const defs = data[12]
    if (Array.isArray(defs)) {
      for (const block of defs) {
        if (!Array.isArray(block) || !Array.isArray(block[1])) continue
        for (const defn of block[1]) {
          if (!Array.isArray(defn) || typeof defn[2] !== "string") continue
          const normalized = normalizeExample(defn[2])
          if (normalized) pushUnique(examples, normalized, MAX_EXAMPLES)
        }
      }
    }
  }

  const primary = preferLemmaCase(translations[0] ?? "", translations)
  const alternatives = translations.filter((t) => t.toLowerCase() !== primary.toLowerCase())

  return {
    translation: primary,
    alternatives: alternatives.slice(0, MAX_ALTERNATIVES),
    examples,
  }
}

async function fetchGoogleRaw(
  text: string,
  from: LangCode,
  to: LangCode,
  signal?: AbortSignal,
): Promise<unknown> {
  // Repeat dt params manually — URLSearchParams would collapse duplicates.
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${encodeURIComponent(from)}` +
    `&tl=${encodeURIComponent(to)}` +
    `&dt=t&dt=bd&dt=ex&dt=md&dt=at` +
    `&q=${encodeURIComponent(text.trim())}`

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Suggest lookup failed (${res.status})`)
  return res.json()
}

/**
 * Look up a translation + usage examples for a typed word.
 * Uses Google Translate’s public gtx endpoint (no API key).
 */
export async function suggestForWord(
  text: string,
  from: LangCode,
  to: LangCode,
  signal?: AbortSignal,
): Promise<WordSuggestion | null> {
  const query = text.trim()
  if (query.length < MIN_QUERY_LEN) return null

  const key = cacheKey(query, from, to)
  const hit = cache.get(key)
  if (hit) return hit

  const sameLanguage = from === to
  const requestTo = sameLanguage ? otherLangs(from)[0]! : to
  const data = await fetchGoogleRaw(query, from, requestTo, signal)
  const parsed = parseGoogleSuggest(data, { wantTranslation: !sameLanguage })

  // Ignore identity / empty junk.
  if (
    !parsed.translation &&
    parsed.alternatives.length === 0 &&
    parsed.examples.length === 0
  ) {
    return null
  }
  if (
    parsed.translation &&
    parsed.translation.toLowerCase() === query.toLowerCase() &&
    parsed.alternatives.length === 0 &&
    parsed.examples.length === 0
  ) {
    return null
  }

  cache.set(key, parsed)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return parsed
}

export function isSuggestableQuery(text: string) {
  return text.trim().length >= MIN_QUERY_LEN
}
