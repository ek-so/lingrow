import type { WordPair } from "@/lib/collection-form"
import { pairFromParts } from "@/lib/collection-form"
import { normalizeExamples, splitExamplesCell } from "@/lib/examples"
import type { LangCode } from "@/types"

const BULLET_RE = /^\s*(?:[-*•–—]|\d+[.)])\s+/
/** Separators that clearly mean “word ↔ translation” on one line. */
const PAIR_SEPARATORS = [" — ", " – ", " - ", "\t", " = ", ": "] as const

export interface ParsedImportText {
  pairs: WordPair[]
  /** Best-guess language of the word column, when detectable. */
  wordLang?: LangCode
  /** Best-guess language of the translation column, when detectable. */
  translationLang?: LangCode
  /** Which layout produced the pairs. */
  layout: "inline" | "alternating" | "mixed"
}

function cleanCell(value: unknown): string {
  if (value == null) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

function stripBullet(raw: string): string {
  return raw.replace(BULLET_RE, "").trim()
}

function letterCounts(text: string) {
  let latin = 0
  let cyrillic = 0
  let germanExtra = 0
  for (const ch of text) {
    if (/[A-Za-z]/.test(ch)) latin += 1
    else if (/[À-ÿÄÖÜäöüß]/.test(ch)) {
      latin += 1
      if (/[ÄÖÜäöüß]/.test(ch)) germanExtra += 1
    } else if (/[\u0400-\u04FF]/.test(ch)) cyrillic += 1
  }
  return { latin, cyrillic, germanExtra, total: latin + cyrillic }
}

/** Best-effort script → app language for a single string. */
export function detectLangHint(text: string): LangCode | null {
  const { latin, cyrillic, germanExtra, total } = letterCounts(text)
  if (total === 0) return null
  if (cyrillic / total >= 0.35) return "ru"
  if (germanExtra > 0 || /\b(der|die|das|ein|eine|einen|dem|den|des)\b/i.test(text)) {
    return "de"
  }
  if (latin / total >= 0.5) return "en"
  return null
}

function majorityLang(texts: string[]): LangCode | undefined {
  const votes: Record<LangCode, number> = { de: 0, en: 0, ru: 0 }
  for (const text of texts) {
    const lang = detectLangHint(text)
    if (lang) votes[lang] += 1
  }
  const ranked = (Object.entries(votes) as [LangCode, number][]).sort((a, b) => b[1] - a[1])
  const [best, count] = ranked[0]!
  if (count <= 0) return undefined
  // Need a clear winner (strictly more than second place).
  if (count === ranked[1]![1]) return undefined
  return best
}

export function detectPairLanguages(pairs: WordPair[]): {
  wordLang?: LangCode
  translationLang?: LangCode
} {
  if (pairs.length === 0) return {}
  const wordLang = majorityLang(pairs.map((p) => p.word))
  const translationLang = majorityLang(pairs.map((p) => p.translation))
  if (wordLang && translationLang && wordLang === translationLang) {
    // Same-language vote is fine for drills; keep it.
    return { wordLang, translationLang }
  }
  return { wordLang, translationLang }
}

function hasInlinePairSeparator(line: string): boolean {
  return PAIR_SEPARATORS.some((sep) => {
    const idx = line.indexOf(sep)
    return idx > 0 && idx < line.length - sep.length
  })
}

/**
 * Split “word — translation || example1 || example2” (or without examples).
 * Examples after ` || ` stay attached to the translation segment until peeled off.
 */
function splitPairLine(raw: string): WordPair | null {
  let line = stripBullet(raw)
  if (!line) return null

  for (const sep of PAIR_SEPARATORS) {
    const idx = line.indexOf(sep)
    if (idx <= 0) continue
    const word = line.slice(0, idx).trim()
    const rest = line.slice(idx + sep.length).trim()
    return pairFromRest(word, rest)
  }

  // Comma / semicolon only when the two sides look like different scripts
  // (e.g. “apple, яблоко”) — never split “шовинист, ура-патриот” alone.
  for (const sep of [";", ","] as const) {
    const parts = line.split(sep).map((p) => p.trim()).filter(Boolean)
    if (parts.length < 2) continue
    // Try splitting after the first segment if scripts differ.
    const word = parts[0]!
    const rest = parts.slice(1).join(sep === "," ? ", " : "; ")
    const a = detectLangHint(word)
    const b = detectLangHint(rest)
    if (a && b && a !== b) {
      return pairFromRest(word, rest)
    }
  }

  return null
}

function pairFromRest(word: string, rest: string): WordPair | null {
  if (!word || !rest) return null

  // Legacy: translation || example1 || example2
  const pipeIdx = rest.search(/\s*\|\|\s*/)
  if (pipeIdx >= 0) {
    const translation = rest.slice(0, pipeIdx).trim()
    const examplesRaw = rest.slice(pipeIdx).replace(/^\s*\|\|\s*/, "")
    return pairFromParts(word, translation, splitExamplesCell(examplesRaw))
  }

  // Preferred: translation (Example one.) (Example two.)
  let translation = rest
  const bracketExamples: string[] = []
  while (true) {
    const match = translation.match(/\s*[(\[]([^)\]]+)[)\]]\s*$/)
    if (!match || match.index == null) break
    const inner = match[1]!.trim()
    if (!inner) break
    bracketExamples.unshift(inner)
    translation = translation.slice(0, match.index).trim()
  }
  if (bracketExamples.length > 0 && translation) {
    const examples = bracketExamples.flatMap((part) => splitExamplesCell(part))
    return pairFromParts(word, translation, examples)
  }

  return pairFromParts(word, rest)
}

function dedupePairs(pairs: WordPair[]): WordPair[] {
  const seen = new Set<string>()
  const out: WordPair[] = []
  for (const pair of pairs) {
    const key = `${pair.word.toLowerCase()}::${pair.translation.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(pair)
  }
  return out
}

/** Classic “word — translation” (optionally with bullets), one pair per line. */
function parseInlinePairs(text: string): WordPair[] {
  const pairs: WordPair[] = []
  for (const raw of text.split(/\r?\n/)) {
    const pair = splitPairLine(raw)
    if (pair) pairs.push(pair)
  }
  return dedupePairs(pairs)
}

/**
 * Alternating lines: word, translation, word, translation, …
 * Empty lines are skipped. Commas/semicolons inside the translation stay intact.
 */
export function parseAlternatingPairs(text: string): WordPair[] {
  const lines = text
    .split(/\r?\n/)
    .map(stripBullet)
    .filter(Boolean)

  const pairs: WordPair[] = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const word = lines[i]!
    const translation = lines[i + 1]!
    // If this “word” line itself is an inline pair, prefer that and don't consume the next line as translation.
    if (hasInlinePairSeparator(word)) {
      const inline = splitPairLine(word)
      if (inline) {
        pairs.push(inline)
        i -= 1 // re-process translation line as a potential word
        continue
      }
    }
    const pair = pairFromParts(word, translation)
    if (pair) pairs.push(pair)
  }
  return dedupePairs(pairs)
}

function alternatingLooksRight(pairs: WordPair[]): boolean {
  if (pairs.length < 2) return pairs.length === 1
  let bilingual = 0
  for (const pair of pairs) {
    const a = detectLangHint(pair.word)
    const b = detectLangHint(pair.translation)
    if (a && b && a !== b) bilingual += 1
  }
  // Most pairs should look like two different languages.
  return bilingual / pairs.length >= 0.5
}

/**
 * Parse pasted vocabulary text. Supports:
 * - inline: `word — translation || example`
 * - alternating lines: English on one line, Russian (etc.) on the next
 */
export function parseImportText(text: string): ParsedImportText {
  const inline = parseInlinePairs(text)
  const alternating = parseAlternatingPairs(text)

  const nonEmpty = text
    .split(/\r?\n/)
    .map(stripBullet)
    .filter(Boolean)
  const inlineSepShare =
    nonEmpty.length === 0
      ? 0
      : nonEmpty.filter((line) => hasInlinePairSeparator(line)).length / nonEmpty.length

  let pairs: WordPair[]
  let layout: ParsedImportText["layout"]

  const altGood = alternating.length > 0 && alternatingLooksRight(alternating)
  const preferAlternating =
    altGood &&
    (alternating.length > inline.length ||
      (inlineSepShare < 0.3 && alternating.length >= Math.max(1, inline.length)))

  if (preferAlternating) {
    pairs = alternating
    layout = inline.length > 0 ? "mixed" : "alternating"
  } else if (inline.length > 0) {
    pairs = inline
    layout = "inline"
  } else if (alternating.length > 0) {
    pairs = alternating
    layout = "alternating"
  } else {
    return { pairs: [], layout: "inline" }
  }

  const langs = detectPairLanguages(pairs)
  return { pairs, layout, ...langs }
}

/** @deprecated Prefer `parseImportText` — kept for call sites that only need pairs. */
export function parseBulletText(text: string): WordPair[] {
  return parseImportText(text).pairs
}

const HEADERISH =
  /^(word|words|german|deutsch|english|russian|translation|from|to|examples?|example(?:\s*\d+)?|usage)$/i

/** Collect examples from column 3 onward (joined cell or one example per column). */
function examplesFromRow(row: unknown[]): string[] | undefined {
  const cells = row.slice(2).map(cleanCell).filter(Boolean)
  if (cells.length === 0) return undefined
  if (cells.length === 1) return splitExamplesCell(cells[0]!)
  const parts = cells.flatMap((cell) =>
    /\|\|/.test(cell) ? splitExamplesCell(cell) : [cell],
  )
  return normalizeExamples(parts)
}

function sheetRowsToPairs(rows: unknown[][]): WordPair[] {
  const pairs: WordPair[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? []
    const a = cleanCell(row[0])
    const b = cleanCell(row[1])
    if (!a || !b) continue

    if (i === 0 && HEADERISH.test(a) && HEADERISH.test(b)) continue

    const key = `${a.toLowerCase()}::${b.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const pair = pairFromParts(a, b, examplesFromRow(row))
    if (pair) pairs.push(pair)
  }

  return pairs
}

/** Parse .xlsx / .xls / .csv files with word | translation | examples columns. */
export async function parseSpreadsheetFile(file: File): Promise<WordPair[]> {
  const XLSX = await import("xlsx")
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  })
  return sheetRowsToPairs(rows)
}

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    file.type.includes("sheet") ||
    file.type === "text/csv"
  )
}
