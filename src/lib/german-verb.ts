/** Look up German verb conjugations from Wiktionary (CORS-friendly). */

export interface GermanVerbInfo {
  infinitive: string
  thirdPersonSingular: string | null
  preterite: string | null
  partizipII: string | null
  auxiliary: "haben" | "sein" | null
}

const verbCache = new Map<string, GermanVerbInfo | null>()
const CACHE_LIMIT = 100
const LS_KEY = "lingrow.deVerbCache.v1"

function loadPersistedCache() {
  if (typeof localStorage === "undefined") return
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, GermanVerbInfo | null>
    for (const [k, v] of Object.entries(parsed)) {
      verbCache.set(k, v)
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistCache() {
  if (typeof localStorage === "undefined") return
  try {
    const obj: Record<string, GermanVerbInfo | null> = {}
    for (const [k, v] of verbCache) obj[k] = v
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {
    // quota / private mode
  }
}

loadPersistedCache()

/** Strip "zu " prefix from infinitives. */
export function bareGermanVerb(text: string): string {
  const s = text.trim()
  if (!s) return ""
  return s.replace(/^zu\s+/i, "").trim()
}

/** Format verb forms as a single string: "denkt, dachte, hat gedacht" */
export function formatVerbForms(info: GermanVerbInfo): string {
  const parts: string[] = []
  if (info.thirdPersonSingular) parts.push(info.thirdPersonSingular)
  if (info.preterite) parts.push(info.preterite)
  if (info.partizipII && info.auxiliary) {
    parts.push(`${info.auxiliary} ${info.partizipII}`)
  } else if (info.partizipII) {
    parts.push(info.partizipII)
  }
  return parts.join(", ")
}

function templateField(body: string, key: string): string | null {
  const re = new RegExp(`\\|${key}\\s*=\\s*([^\\n|}]+)`, "i")
  const m = body.match(re)
  if (!m?.[1]) return null
  const value = m[1].trim()
  if (!value || value === "—" || value === "-" || value === "–") return null
  return value
}

/** Parse the first {{Deutsch Verb Übersicht …}} block from de.wiktionary. */
function parseGermanVerbWikitext(wikitext: string, fallbackLemma: string): GermanVerbInfo | null {
  const block = wikitext.match(/\{\{Deutsch Verb Übersicht\s*\n([\s\S]*?)\n\}\}/)
  if (!block?.[1]) return null
  const body = block[1]
  
  const infinitive = fallbackLemma
  const thirdPersonSingular =
    templateField(body, "Präsens_er, sie, es") ??
    templateField(body, "Präsens_du")
  const preterite =
    templateField(body, "Präteritum_ich") ??
    templateField(body, "Präteritum_er, sie, es")
  const partizipII = templateField(body, "Partizip II")
  const auxiliaryRaw = templateField(body, "Hilfsverb")
  
  let auxiliary: "haben" | "sein" | null = null
  if (auxiliaryRaw?.toLowerCase().includes("haben")) auxiliary = "haben"
  else if (auxiliaryRaw?.toLowerCase().includes("sein")) auxiliary = "sein"
  
  if (!thirdPersonSingular && !preterite && !partizipII) return null
  
  return {
    infinitive,
    thirdPersonSingular,
    preterite,
    partizipII,
    auxiliary,
  }
}

/** Parse English Wiktionary German section `{{de-verb|…}}` or conjugation tables. */
function parseEnWiktionaryDeVerb(wikitext: string, lemma: string): GermanVerbInfo | null {
  const german = wikitext.match(/==\s*German\s*==([\s\S]*?)(?:\n==\s*[^=]|\s*$)/i)
  const section = german?.[1] ?? ""
  if (!section) return null
  
  const verbHead = /===\s*Verb\s*===/i.test(section)
  if (!verbHead) return null
  
  // Look for conjugation table with key forms
  const thirdSgMatch = section.match(/\|\s*3s\s*=\s*([^\n|}]+)/i)
  const preteriteMatch = section.match(/\|\s*preterite_(?:3s|ich)\s*=\s*([^\n|}]+)/i)
  const partizipMatch = section.match(/\|\s*pp\s*=\s*([^\n|}]+)/i)
  const auxMatch = section.match(/\|\s*auxiliary\s*=\s*(haben|sein)/i)
  
  const thirdPersonSingular = thirdSgMatch?.[1]?.trim() || null
  const preterite = preteriteMatch?.[1]?.trim() || null
  const partizipII = partizipMatch?.[1]?.trim() || null
  const auxiliary = auxMatch?.[1]?.toLowerCase() === "sein" ? "sein" : "haben"
  
  if (!thirdPersonSingular && !preterite && !partizipII) return null
  
  return {
    infinitive: lemma,
    thirdPersonSingular,
    preterite,
    partizipII,
    auxiliary,
  }
}

function remember(key: string, value: GermanVerbInfo | null) {
  verbCache.set(key, value)
  if (verbCache.size > CACHE_LIMIT) {
    const oldest = verbCache.keys().next().value
    if (oldest !== undefined) verbCache.delete(oldest)
  }
  persistCache()
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

export async function fetchGermanVerbInfo(
  lemma: string,
  signal?: AbortSignal,
): Promise<GermanVerbInfo | null> {
  const key = lemma.trim()
  if (!key) return null
  if (verbCache.has(key)) return verbCache.get(key) ?? null

  const de = await fetchWikitext("de.wiktionary.org", key, signal)
  if (de.ok) {
    const parsed = de.wikitext ? parseGermanVerbWikitext(de.wikitext, key) : null
    if (parsed?.thirdPersonSingular || parsed?.preterite || parsed?.partizipII) {
      remember(key, parsed)
      return parsed
    }
  } else if (!de.retryable) {
    remember(key, null)
    return null
  }

  const en = await fetchWikitext("en.wiktionary.org", key, signal)
  if (en.ok) {
    const parsed = en.wikitext ? parseEnWiktionaryDeVerb(en.wikitext, key) : null
    remember(key, parsed)
    return parsed
  }

  const deRetry = !de.ok && de.retryable
  const enRetry = !en.ok && en.retryable
  if (deRetry || enRetry) return null

  remember(key, null)
  return null
}

/** Guess verb forms from example text by looking for common conjugation patterns. */
export function guessVerbFormsFromTexts(infinitive: string, texts: string[]): Partial<GermanVerbInfo> {
  const result: Partial<GermanVerbInfo> = {}
  
  // Common patterns for 3rd person singular (add 't' or 'et')
  const stem = infinitive.replace(/(?:en|eln|ern)$/i, "")
  const candidates3sg = [
    `${stem}t`,
    `${stem}et`,
    infinitive.replace(/en$/i, "t"),
  ]
  
  // Look for these forms in the texts
  for (const text of texts) {
    for (const candidate of candidates3sg) {
      const re = new RegExp(`\\b${candidate}\\b`, "i")
      if (re.test(text)) {
        result.thirdPersonSingular = candidate
        break
      }
    }
  }
  
  return result
}
