import type { LangCode } from "@/types"
import { otherLangs } from "@/lib/languages"
import {
  articleForGender,
  bareGermanLemma,
  fetchGermanNounInfo,
  genderFromArticle,
  guessGenderFromTexts,
  guessPluralFromTexts,
  type GermanGender,
} from "@/lib/german-noun"
import type { PrefixHint } from "@/lib/suggest-format"

export interface WordSuggestion {
  /** Best single translation lemma for the “into” field (no article / “to”). */
  translation: string
  /** Alternative translation lemmas (excludes the primary). */
  alternatives: string[]
  /** Usage examples in the word language (from Google Translate). */
  examples: string[]
  /** Light accept chip for the word field: der / die / das / to. */
  wordPrefix?: PrefixHint
  /** German plural lemma to append after a comma on the word field. */
  wordPlural?: string
  /** Light accept chip for the translation field: der / die / das / to. */
  translationPrefix?: PrefixHint
  /** German plural lemma to append after a comma on the translation field. */
  translationPlural?: string
}

const MAX_ALTERNATIVES = 6
const MAX_EXAMPLES = 3
const MIN_QUERY_LEN = 2
const CACHE_LIMIT = 80

const cache = new Map<string, WordSuggestion>()

function cacheKey(text: string, from: LangCode, to: LangCode) {
  return `${from}|${to}|${normalizeLookupQuery(text, from).toLowerCase()}`
}

/** Strip articles / “to” / plural tails so lookups stay stable after enrichment. */
function normalizeLookupQuery(text: string, lang: LangCode): string {
  let s = text.trim()
  if (!s) return ""
  if (lang === "de") return bareGermanLemma(s)
  if (lang === "en") {
    s = s.replace(/^to\s+/i, "").trim()
  }
  return s
}

function stripTags(s: string) {
  return s.replace(/<\/?b>/gi, "").replace(/<[^>]+>/g, "").trim()
}

function normalizeExample(raw: string): string | null {
  let s = stripTags(raw)
    .replace(/\s+/g, " ")
    .trim()
  if (!s) return null
  if (s.length < 8) return null
  if (s.length > 140) s = `${s.slice(0, 137).trimEnd()}…`
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
  const lowerMatch = candidates.find(
    (a) => a.toLowerCase() === trimmed.toLowerCase() && a === a.toLowerCase(),
  )
  return lowerMatch ?? trimmed
}

function analyzePos(data: unknown[], primary: string): { isVerb: boolean; isNoun: boolean } {
  const dict = data[1]
  if (!Array.isArray(dict)) return { isVerb: false, isNoun: false }

  let verb = false
  let noun = false
  let primaryInVerb = false
  let primaryInNoun = false
  const primaryKey = primary.trim().toLowerCase()

  for (const block of dict) {
    if (!Array.isArray(block)) continue
    const label = typeof block[0] === "string" ? block[0].toLowerCase() : ""
    const words = Array.isArray(block[1])
      ? block[1].filter((w): w is string => typeof w === "string")
      : []
    const hit = !!primaryKey && words.some((w) => w.toLowerCase() === primaryKey)
    if (/\bverb\b/.test(label)) {
      verb = true
      if (hit) primaryInVerb = true
    }
    if (/\b(noun|substantiv)\b/.test(label)) {
      noun = true
      if (hit) primaryInNoun = true
    }
  }

  const germanInfinitive = /(?:en|eln|ern)$/i.test(primary.trim())
  const isVerb =
    primaryInVerb || (verb && !primaryInNoun) || (verb && germanInfinitive && !primaryInNoun)
  const isNoun =
    primaryInNoun || (noun && !isVerb) || (noun && !verb)

  return { isVerb, isNoun }
}

function articleFromDictEntry(entry: unknown): string | null {
  if (!Array.isArray(entry)) return null
  const art = entry[4]
  return typeof art === "string" && art.trim() ? art.trim().toLowerCase() : null
}

/** When translating into German, Google often attaches der/die/das on dict rows. */
function germanArticleForLemma(data: unknown[], lemma: string): string | null {
  const dict = data[1]
  if (!Array.isArray(dict)) return null
  const target = lemma.trim().toLowerCase()
  for (const block of dict) {
    if (!Array.isArray(block) || !Array.isArray(block[2])) continue
    for (const entry of block[2]) {
      if (!Array.isArray(entry) || typeof entry[0] !== "string") continue
      if (entry[0].trim().toLowerCase() !== target) continue
      const art = articleFromDictEntry(entry)
      if (art) return art
    }
  }
  // Fall back to the first noun entry’s article.
  for (const block of dict) {
    if (!Array.isArray(block)) continue
    const pos = typeof block[0] === "string" ? block[0].toLowerCase() : ""
    if (!/\b(noun|substantiv)\b/.test(pos)) continue
    if (!Array.isArray(block[2]) || !Array.isArray(block[2][0])) continue
    const art = articleFromDictEntry(block[2][0])
    if (art) return art
  }
  return null
}

interface ParsedCore {
  translations: string[]
  examples: string[]
  germanArticle: string | null
  raw: unknown[] | null
}

function parseGoogleCore(data: unknown, opts: { wantTranslation: boolean; to: LangCode }): ParsedCore {
  const translations: string[] = []
  const examples: string[] = []
  if (!Array.isArray(data)) {
    return { translations, examples, germanArticle: null, raw: null }
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
            // Prefer bare lemmas over “das Fenster” duplicates in the alt list.
            const raw = alt[0].trim().replace(/^(der|die|das)\s+/i, "")
            if (raw) pushUnique(translations, raw, MAX_ALTERNATIVES + 1)
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
  const ordered = primary
    ? [primary, ...translations.filter((t) => t.toLowerCase() !== primary.toLowerCase())]
    : translations

  const germanArticle =
    opts.wantTranslation && opts.to === "de" && primary
      ? germanArticleForLemma(data, primary)
      : null

  return {
    translations: ordered,
    examples,
    germanArticle,
    raw: data,
  }
}

async function fetchGoogleRaw(
  text: string,
  from: LangCode,
  to: LangCode,
  signal?: AbortSignal,
): Promise<unknown> {
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

interface NounHints {
  prefix?: PrefixHint
  plural?: string
  resolved: boolean
}

async function resolveGermanNounHints(
  lemma: string,
  genderHint: GermanGender | null,
  texts: string[],
  signal?: AbortSignal,
): Promise<NounHints> {
  const info = await fetchGermanNounInfo(lemma, signal)
  if (info?.plural || info?.gender) {
    const gender = info.gender ?? genderHint
    const prefix = articleForGender(gender) ?? undefined
    return {
      prefix,
      plural: info.plural ?? undefined,
      resolved: !!info.plural,
    }
  }

  let gender = genderHint ?? guessGenderFromTexts(lemma, texts)
  let plural = guessPluralFromTexts(lemma, texts) ?? undefined

  // When translating into German, examples are often English — pull German
  // usage snippets for the lemma so we can spot the plural.
  if (!plural) {
    try {
      const raw = await fetchGoogleRaw(lemma, "de", "en", signal)
      const scraped = parseGoogleCore(raw, { wantTranslation: false, to: "en" })
      const pool = [...texts, ...scraped.examples]
      plural = guessPluralFromTexts(lemma, pool) ?? undefined
      gender = gender ?? guessGenderFromTexts(lemma, pool)
    } catch {
      // optional enrichment
    }
  }

  if (!gender && !plural) return { resolved: false }

  return {
    prefix: articleForGender(gender) ?? undefined,
    plural,
    resolved: !!plural,
  }
}

/**
 * Look up a translation + usage examples for a typed word.
 * Uses Google Translate’s public gtx endpoint (no API key),
 * plus de.wiktionary for German noun plurals.
 */
export async function suggestForWord(
  text: string,
  from: LangCode,
  to: LangCode,
  signal?: AbortSignal,
): Promise<WordSuggestion | null> {
  const query = normalizeLookupQuery(text, from)
  if (query.length < MIN_QUERY_LEN) return null

  const key = cacheKey(query, from, to)
  const hit = cache.get(key)
  if (hit) return hit

  const sameLanguage = from === to
  const requestTo = sameLanguage ? otherLangs(from)[0]! : to
  const data = await fetchGoogleRaw(query, from, requestTo, signal)
  const core = parseGoogleCore(data, {
    wantTranslation: !sameLanguage,
    to: sameLanguage ? requestTo : to,
  })

  // Keep lemmas bare — prefixes (der/die/das/to) are offered as accept chips.
  const translation = (core.translations[0] ?? "").replace(/^to\s+/i, "").trim()
  const alternatives = core.translations
    .slice(1, MAX_ALTERNATIVES + 1)
    .map((a) => a.replace(/^to\s+/i, "").trim())
    .filter((a) => a && a.toLowerCase() !== translation.toLowerCase())

  let wordPrefix: PrefixHint | undefined
  let wordPlural: string | undefined
  let translationPrefix: PrefixHint | undefined
  let translationPlural: string | undefined
  let nounResolved = true

  const { isVerb, isNoun } = analyzePos(core.raw ?? [], translation)
  const hintTexts = core.examples

  if (!sameLanguage && translation) {
    if (to === "en" && isVerb) {
      translationPrefix = "to"
    } else if (to === "de" && isNoun) {
      const genderHint = genderFromArticle(core.germanArticle)
      const lemma = bareGermanLemma(translation) || translation
      const hints = await resolveGermanNounHints(lemma, genderHint, hintTexts, signal)
      translationPrefix = hints.prefix
      translationPlural = hints.plural
      nounResolved = hints.resolved
    }
  }

  if (from === "en" && isVerb) {
    wordPrefix = "to"
  } else if (from === "de" && isNoun) {
    const hints = await resolveGermanNounHints(query, null, hintTexts, signal)
    wordPrefix = hints.prefix
    wordPlural = hints.plural
    nounResolved = nounResolved && hints.resolved
  }

  const parsed: WordSuggestion = {
    translation,
    alternatives,
    examples: core.examples,
    wordPrefix,
    wordPlural,
    translationPrefix,
    translationPlural,
  }

  const hasHints = !!(wordPrefix || wordPlural || translationPrefix || translationPlural)
  if (!parsed.translation && parsed.alternatives.length === 0 && parsed.examples.length === 0 && !hasHints) {
    return null
  }
  if (
    parsed.translation &&
    parsed.translation.toLowerCase() === query.toLowerCase() &&
    parsed.alternatives.length === 0 &&
    parsed.examples.length === 0 &&
    !hasHints
  ) {
    return null
  }

  // Avoid caching incomplete noun enrichments (e.g. Wiktionary rate limit).
  if (nounResolved) {
    cache.set(key, parsed)
    if (cache.size > CACHE_LIMIT) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
  }
  return parsed
}

export function isSuggestableQuery(text: string, lang: LangCode = "en") {
  return normalizeLookupQuery(text, lang).length >= MIN_QUERY_LEN
}

