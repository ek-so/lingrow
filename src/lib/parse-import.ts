import type { WordPair } from "@/lib/collection-form"

const BULLET_RE = /^\s*(?:[-*•–—]|\d+[.)])\s+/
const SEPARATORS = [" — ", " – ", " - ", "\t", " = ", ": "] as const

function cleanCell(value: unknown): string {
  if (value == null) return ""
  return String(value).replace(/\s+/g, " ").trim()
}

function splitPairLine(raw: string): WordPair | null {
  let line = raw.trim()
  if (!line) return null
  line = line.replace(BULLET_RE, "").trim()
  if (!line) return null

  for (const sep of SEPARATORS) {
    const idx = line.indexOf(sep)
    if (idx <= 0) continue
    const word = line.slice(0, idx).trim()
    const translation = line.slice(idx + sep.length).trim()
    if (word && translation) return { word, translation }
  }

  for (const sep of [";", ","]) {
    const idx = line.lastIndexOf(sep)
    if (idx <= 0) continue
    const word = line.slice(0, idx).trim()
    const translation = line.slice(idx + 1).trim()
    if (word && translation) return { word, translation }
  }

  return null
}

/** Parse bullet / plain text lists into word–translation pairs. */
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

function sheetRowsToPairs(rows: unknown[][]): WordPair[] {
  const pairs: WordPair[] = []
  const seen = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? []
    const a = cleanCell(row[0])
    const b = cleanCell(row[1])
    if (!a || !b) continue

    if (i === 0) {
      const headerish = /^(word|words|german|deutsch|english|russian|translation|from|to)$/i
      if (headerish.test(a) && headerish.test(b)) continue
    }

    const key = `${a.toLowerCase()}::${b.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push({ word: a, translation: b })
  }

  return pairs
}

/** Parse .xlsx / .xls / .csv files with word | translation columns. */
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
