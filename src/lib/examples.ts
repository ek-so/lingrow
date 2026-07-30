/** Join/split usage examples for sheets, import, and forms. */

export const EXAMPLE_SEP = " || "
export const MAX_EXAMPLES = 3

/** Trim, drop empties, cap at MAX_EXAMPLES. */
export function normalizeExamples(raw: unknown): string[] | undefined {
  let parts: string[] = []
  if (Array.isArray(raw)) {
    parts = raw.map((p) => String(p ?? "").trim()).filter(Boolean)
  } else if (typeof raw === "string") {
    parts = splitExamplesCell(raw)
  }
  const capped = parts.slice(0, MAX_EXAMPLES)
  return capped.length > 0 ? capped : undefined
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
      .slice(0, MAX_EXAMPLES)
  }
  // Newlines or single pipes also work in paste/spreadsheet cells.
  if (/\r?\n/.test(trimmed)) {
    return trimmed
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_EXAMPLES)
  }
  if (trimmed.includes(" | ")) {
    return trimmed
      .split(/\s+\|\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_EXAMPLES)
  }
  return [trimmed].slice(0, MAX_EXAMPLES)
}

export function joinExamples(examples: string[] | undefined): string {
  const normalized = normalizeExamples(examples)
  return normalized ? normalized.join(EXAMPLE_SEP) : ""
}

export function examplesTextareaValue(examples: string[] | undefined): string {
  return examples?.join("\n") ?? ""
}

export function examplesFromTextarea(text: string): string[] | undefined {
  return normalizeExamples(text.split(/\r?\n/))
}
