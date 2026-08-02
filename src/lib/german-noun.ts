/** Look up German gender + plural from Wiktionary (CORS-friendly). */

export type GermanGender = "m" | "f" | "n"

export interface GermanNounInfo {
  gender: GermanGender | null
  singular: string
  plural: string | null
}

const nounCache = new Map<string, GermanNounInfo | null>()
const CACHE_LIMIT = 100
const LS_KEY = "lingrow.deNounCache.v1"

function loadPersistedCache() {
  if (typeof localStorage === "undefined") return
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, GermanNounInfo | null>
    for (const [k, v] of Object.entries(parsed)) {
      nounCache.set(k, v)
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistCache() {
  if (typeof localStorage === "undefined") return
  try {
    const obj: Record<string, GermanNounInfo | null> = {}
    for (const [k, v] of nounCache) obj[k] = v
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {
    // quota / private mode
  }
}

loadPersistedCache()

const ARTICLE_RE = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|eines)\s+/i

/** Strip German articles and an already-appended “, die Plural” tail. */
export function bareGermanLemma(text: string): string {
  let s = text.trim()
  if (!s) return ""
  // “der Apfel, die Äpfel” → “Apfel”
  if (s.includes(",")) {
    s = s.split(",")[0]!.trim()
  }
  s = s.replace(ARTICLE_RE, "").trim()
  return s
}

export function articleForGender(gender: GermanGender | null): "der" | "die" | "das" | null {
  if (gender === "m") return "der"
  if (gender === "f") return "die"
  if (gender === "n") return "das"
  return null
}

export function genderFromArticle(article: string | null | undefined): GermanGender | null {
  if (!article) return null
  const a = article.trim().toLowerCase()
  if (a === "der") return "m"
  if (a === "die") return "f"
  if (a === "das") return "n"
  return null
}

function parseGenus(raw: string | null): GermanGender | null {
  if (!raw) return null
  const g = raw.trim().toLowerCase()
  if (g.startsWith("m")) return "m"
  if (g.startsWith("f")) return "f"
  if (g.startsWith("n")) return "n"
  return null
}

function templateField(body: string, key: string): string | null {
  const re = new RegExp(`\\|${key}\\s*=\\s*([^\\n|}]+)`, "i")
  const m = body.match(re)
  if (!m?.[1]) return null
  const value = m[1].trim()
  if (!value || value === "—" || value === "-" || value === "–") return null
  return value
}

/** Parse the first {{Deutsch Substantiv Übersicht …}} block. */
function parseGermanNounWikitext(wikitext: string, fallbackLemma: string): GermanNounInfo | null {
  const block = wikitext.match(/\{\{Deutsch Substantiv Übersicht\s*\n([\s\S]*?)\n\}\}/)
  if (!block?.[1]) return null
  const body = block[1]
  const singular =
    templateField(body, "Nominativ Singular") ??
    templateField(body, "Nominativ Singular 1") ??
    fallbackLemma
  const plural =
    templateField(body, "Nominativ Plural") ??
    templateField(body, "Nominativ Plural 1")
  const gender =
    parseGenus(templateField(body, "Genus")) ??
    parseGenus(templateField(body, "Genus 1"))

  if (!singular && !plural) return null
  return {
    gender,
    singular: singular || fallbackLemma,
    plural,
  }
}

/** Apply umlaut to the last a/o/u/au in a German stem. */
function umlautStem(stem: string): string {
  return stem.replace(/(au|a|o|u)(?!.*(au|a|o|u))/i, (m) => {
    const map: Record<string, string> = {
      a: "ä",
      o: "ö",
      u: "ü",
      au: "äu",
      A: "Ä",
      O: "Ö",
      U: "Ü",
      Au: "Äu",
      AU: "ÄU",
    }
    return map[m] ?? m
  })
}

/** Build plural from en.wiktionary `{{de-noun|gender,genitive,plural}}` specs. */
function pluralFromDeNounSpec(lemma: string, pluralSpec: string): string | null {
  let spec = pluralSpec.split(":")[0] ?? ""
  spec = spec.replace(/\[.*?\]/g, "").trim()
  if (!spec || spec === "-" || spec === "—" || spec === "–") return null
  let useUmlaut = false
  if (spec.includes("^")) {
    useUmlaut = true
    spec = spec.replace(/\^/g, "")
  }
  const stem = useUmlaut ? umlautStem(lemma) : lemma
  // Empty ending with umlaut only: Apfel + ^ → Äpfel
  return stem + spec
}

/** Parse English Wiktionary German section `{{de-noun|…}}`. */
function parseEnWiktionaryDeNoun(wikitext: string, lemma: string): GermanNounInfo | null {
  const german = wikitext.match(/==\s*German\s*==([\s\S]*?)(?:\n==\s*[^=]|\s*$)/i)
  const section = german?.[1] ?? ""
  if (!section) return null
  // Only treat as noun when a Noun heading or de-noun template is present.
  const nounHead = /===\s*Noun\s*===/i.test(section) || /\{\{de-noun\|/.test(section)
  if (!nounHead) return null
  const tm = section.match(/\{\{de-noun\|([^}]+)\}\}/)
  if (!tm?.[1]) return null
  // Positional params are comma-separated; named params (dim=, f=, …) follow with |.
  const positional = tm[1].split("|")[0] ?? ""
  const parts = positional.split(",")
  const gender = parseGenus(parts[0] ?? null)
  const hasPluralSlot = parts.length >= 3
  const pluralSpec = hasPluralSlot ? (parts[2] ?? "") : ""
  // Feminine with omitted plural often takes -n / -en.
  let plural = hasPluralSlot ? pluralFromDeNounSpec(lemma, pluralSpec) : null
  if (!plural && gender === "f" && !hasPluralSlot) {
    plural = lemma.endsWith("e") || lemma.endsWith("el") || lemma.endsWith("er")
      ? `${lemma}n`
      : `${lemma}en`
  }
  // Neuter/masc with omitted plural (Fenster) or explicit empty slot → same as singular.
  if (!plural && (gender === "n" || gender === "m") && (!hasPluralSlot || pluralSpec === "")) {
    plural = lemma
  }
  return {
    gender,
    singular: lemma,
    plural,
  }
}

function remember(key: string, value: GermanNounInfo | null) {
  nounCache.set(key, value)
  if (nounCache.size > CACHE_LIMIT) {
    const oldest = nounCache.keys().next().value
    if (oldest !== undefined) nounCache.delete(oldest)
  }
  persistCache()
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Infer der/die/das from surrounding text when Wiktionary is unavailable. */
const BOUNDARY_L = String.raw`(?<![\p{L}])`
const BOUNDARY_R = String.raw`(?![\p{L}])`

export function guessGenderFromTexts(lemma: string, texts: string[]): GermanGender | null {
  if (!lemma) return null
  // Avoid \b — it breaks on German umlauts in JS.
  const re = new RegExp(
    `${BOUNDARY_L}(der|die|das)\\s+${escapeRegExp(lemma)}${BOUNDARY_R}`,
    "iu",
  )
  for (const text of texts) {
    const m = text.match(re)
    if (!m?.[1]) continue
    return genderFromArticle(m[1])
  }
  return null
}

/**
 * Guess a plural by scanning example/definition text for common German plural
 * shapes of the lemma (umlaut, -e/-er/-en/-n/-s).
 */
export function guessPluralFromTexts(lemma: string, texts: string[]): string | null {
  if (!lemma || texts.length === 0) return null
  const umlauted = umlautStem(lemma)
  // Include umlaut-only form (Apfel → Äpfel) even when it equals umlautStem.
  const candidates = Array.from(
    new Set(
      [
        umlauted,
        `${umlauted}e`,
        `${umlauted}er`,
        `${umlauted}en`,
        `${umlauted}n`,
        `${lemma}e`,
        `${lemma}er`,
        `${lemma}en`,
        `${lemma}n`,
        `${lemma}s`,
        `${lemma}nen`,
        lemma,
      ].filter((c) => !!c && (c.toLowerCase() !== lemma.toLowerCase() || c === lemma)),
    ),
  )
  const counts = new Map<string, number>()
  const re = new RegExp(
    `${BOUNDARY_L}(${candidates.map(escapeRegExp).join("|")})${BOUNDARY_R}`,
    "giu",
  )
  for (const text of texts) {
    for (const match of text.matchAll(re)) {
      const word = match[1]
      if (!word) continue
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }
  // Prefer forms that differ from the singular, and umlauted plurals
  // (Männer over archaic/rare Mannen).
  const ranked = [...counts.entries()].sort((a, b) => {
    const aDiff = a[0].toLowerCase() === lemma.toLowerCase() ? 0 : 1
    const bDiff = b[0].toLowerCase() === lemma.toLowerCase() ? 0 : 1
    if (aDiff !== bDiff) return bDiff - aDiff
    const aUmlaut = /[äöü]/i.test(a[0]) ? 1 : 0
    const bUmlaut = /[äöü]/i.test(b[0]) ? 1 : 0
    if (aUmlaut !== bUmlaut) return bUmlaut - aUmlaut
    return b[1] - a[1]
  })
  const best = ranked[0]?.[0]
  if (!best) return null
  if (best.toLowerCase() === lemma.toLowerCase()) {
    // Same as singular — only accept if we saw it after “die ” (plural article).
    const diePlural = new RegExp(
      `${BOUNDARY_L}die\\s+${escapeRegExp(lemma)}${BOUNDARY_R}`,
      "iu",
    )
    if (texts.some((t) => diePlural.test(t))) return lemma
    return null
  }
  return best
}

async function fetchWikitext(
  host: "de.wiktionary.org" | "en.wiktionary.org",
  lemma: string,
  signal?: AbortSignal,
): Promise<{ ok: true; wikitext: string } | { ok: false; retryable: boolean }> {
  const url =
    `https://${host}/w/api.php?action=parse` +
    `&page=${encodeURIComponent(lemma)}` +
    `&prop=wikitext&format=json&origin=*&redirects=1`

  try {
    const res = await fetch(url, { signal })
    if (res.status === 429 || res.status >= 500) {
      return { ok: false, retryable: true }
    }
    if (!res.ok) return { ok: false, retryable: false }
    const text = await res.text()
    if (/too many requests/i.test(text)) {
      return { ok: false, retryable: true }
    }
    let data: unknown
    try {
      data = JSON.parse(text) as unknown
    } catch {
      return { ok: false, retryable: true }
    }
    if (data && typeof data === "object" && "error" in data) {
      const code =
        data.error && typeof data.error === "object" && data.error && "code" in data.error
          ? String((data.error as { code?: string }).code ?? "")
          : ""
      // missingtitle etc. are definitive misses
      if (code === "missingtitle" || code === "invalidtitle") {
        return { ok: true, wikitext: "" }
      }
      return { ok: false, retryable: true }
    }
    const wikitext =
      data &&
      typeof data === "object" &&
      "parse" in data &&
      data.parse &&
      typeof data.parse === "object" &&
      "wikitext" in data.parse &&
      data.parse.wikitext &&
      typeof data.parse.wikitext === "object" &&
      "*" in data.parse.wikitext
        ? String((data.parse.wikitext as { "*": string })["*"])
        : ""
    return { ok: true, wikitext }
  } catch (err) {
    if (signal?.aborted) throw err
    return { ok: false, retryable: true }
  }
}

export async function fetchGermanNounInfo(
  lemma: string,
  signal?: AbortSignal,
): Promise<GermanNounInfo | null> {
  const key = lemma.trim()
  if (!key) return null
  if (nounCache.has(key)) return nounCache.get(key) ?? null

  const de = await fetchWikitext("de.wiktionary.org", key, signal)
  if (de.ok) {
    const parsed = de.wikitext ? parseGermanNounWikitext(de.wikitext, key) : null
    if (parsed?.plural || parsed?.gender) {
      remember(key, parsed)
      return parsed
    }
    // Fall through to en.wiktionary when the DE page has no overview block.
  } else if (!de.retryable) {
    remember(key, null)
    return null
  }

  const en = await fetchWikitext("en.wiktionary.org", key, signal)
  if (en.ok) {
    const parsed = en.wikitext ? parseEnWiktionaryDeNoun(en.wikitext, key) : null
    remember(key, parsed)
    return parsed
  }

  // Transient failure — do not cache, so the next keystroke can retry.
  const deRetry = !de.ok && de.retryable
  const enRetry = !en.ok && en.retryable
  if (deRetry || enRetry) return null

  remember(key, null)
  return null
}
