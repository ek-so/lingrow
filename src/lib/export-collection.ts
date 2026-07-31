import type { Collection } from "@/types"
import { langLabel } from "@/lib/languages"

/** Sanitize a collection name for use as a download filename. */
export function excelFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
  return `${cleaned || "lingrow-set"}.xlsx`
}

/** Build spreadsheet rows: word, translation, then one column per example. */
export function collectionToSheetRows(collection: Collection): string[][] {
  const maxExamples = collection.words.reduce(
    (max, w) => Math.max(max, w.examples?.length ?? 0),
    0,
  )

  const header = [
    langLabel(collection.wordLang),
    langLabel(collection.translationLang),
    ...Array.from({ length: maxExamples }, (_, i) =>
      maxExamples === 1 ? "Example" : `Example ${i + 1}`,
    ),
  ]

  const rows = collection.words.map((w) => {
    const examples = w.examples ?? []
    return [
      w.word,
      w.translation,
      ...Array.from({ length: maxExamples }, (_, i) => examples[i] ?? ""),
    ]
  })

  return [header, ...rows]
}

/** Download a collection as an .xlsx file (word, translation, examples). */
export async function downloadCollectionExcel(collection: Collection): Promise<void> {
  const XLSX = await import("xlsx")
  const data = collectionToSheetRows(collection)
  const sheet = XLSX.utils.aoa_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Words")

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = excelFilename(collection.name)
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
