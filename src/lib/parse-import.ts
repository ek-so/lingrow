import type { WordPair } from "@/lib/collection-form"
import { pairFromParts } from "@/lib/collection-form"
import { splitExamplesCell } from "@/lib/examples"

const BULLET_RE = /^\s*(?:[-*•–—]|\d+[.)])\s+/
const SEPARATORS = [" — ", " – ", " - ", "\t", " = ", ": "] as const

function cleanCell(value: unknown): string {
  if (value == null) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

/**
 * Split “word — translation || example1 || example2” (or without examples).
 * Examples after ` || ` stay attached to the translation segment until peeled off.
 */
function splitPairLine(raw: string): WordPair | null {
  let line = raw.trim()
  if (!line) return null
  line = line.replace(BULLET_RE, "").trim()
  if (!line) return null

  for (const sep of SEPARATORS) {
    const idx = line.indexOf(sep)
    if (idx <= 0) continue
    const word = line.slice(0, idx).trim()
    const rest = line.slice(idx + sep.length).trim()
    return pairFromRest(word, rest)
  }

  for (const sep of [";", ","]) {
    const idx = line.lastIndexOf(sep)
    if (idx <= 0) continue
    const word = line.slice(0, idx).trim()
    const rest = line.slice(idx + 1).trim()
    return pairFromRest(word, rest)
  }

  return null
}

function pairFromRest(word: string, rest: string): WordPair | null {
  if (!word || !rest) return null
  const pipeIdx = rest.search(/\s*\|\|\s*/)
  if (pipeIdx >= 0) {
    const translation = rest.slice(0, pipeIdx).trim()
    const examplesRaw = rest.slice(pipeIdx).replace(/^\s*\|\|\s*/, "")
    return pairFromParts(word, translation, splitExamplesCell(examplesRaw))
  }
  return pairFromParts(word, rest)
}

/** Parse bullet / plain text lists into word–translation pairs (optional examples). */
export function parseBulletText(text: string): WordPair[] {
  const seen = new Set<string>()
  const pairs: WordPair[] = []

  for (const raw of text.split(/\r?\n/)) {
    const pair = splitPairLine(raw)
    if (!pair) continue
    const key = `${pair.word.toLowerCase()}::${pair.translation.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push(pair)
  }

  return pairs
}

const HEADERISH =
  /^(word|words|german|deutsch|english|russian|translation|from|to|examples?|example|usage)$/i

function sheetRowsToPairs(rows: unknown[][]): WordPair[] {
  const pairs: WordPair[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? []
    const a = cleanCell(row[0])
    const b = cleanCell(row[1])
    const c = cleanCell(row[2])
    if (!a || !b) continue

    if (i === 0 && HEADERISH.test(a) && HEADERISH.test(b)) continue

    const key = `${a.toLowerCase()}::${b.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const pair = pairFromParts(a, b, c ? splitExamplesCell(c) : undefined)
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
