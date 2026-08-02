/** Join/split usage examples for sheets, import, and forms. */

const EXAMPLE_SEP = " || "

/** Trim and drop empties. Keeps every non-empty example (no hard cap). */
export function normalizeExamples(raw: unknown): string[] | undefined {
  let parts: string[] = []
  if (Array.isArray(raw)) {
    parts = raw.map((p) => String(p ?? "").trim()).filter(Boolean)
  } else if (typeof raw === "string") {
    parts = splitExamplesCell(raw)
  }
  return parts.length > 0 ? parts : undefined
}

/** Split a spreadsheet/import cell into example sentences. */
export function splitExamplesCell(cell: string): string[] {
  const trimmed = cell.trim()
  if (!trimmed) return []
  if (trimmed.includes(EXAMPLE_SEP.trim())) {
    return trimmed
      .split(/\s*\|\|\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  // Newlines or single pipes also work in paste/spreadsheet cells.
  if (/\r?\n/.test(trimmed)) {
    return trimmed
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (trimmed.includes(" | ")) {
    return trimmed
      .split(/\s+\|\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return [trimmed]
}

export function examplesTextareaValue(examples: string[] | undefined): string {
  return examples?.join("\n") ?? ""
}

export function examplesFromTextarea(text: string): string[] | undefined {
  return normalizeExamples(text.split(/\r?\n/))
}
