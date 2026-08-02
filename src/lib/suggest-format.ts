/** Helpers for accepting suggestion chips into word/translation fields. */

const DE_ARTICLE_RE = /^(der|die|das)\s+/i
const EN_TO_RE = /^to\s+/i

export type PrefixHint = "der" | "die" | "das" | "to"

/** True if the field already starts with this article / “to”. */
export function hasPrefix(text: string, prefix: PrefixHint): boolean {
  const t = text.trim()
  if (!t) return false
  if (prefix === "to") return EN_TO_RE.test(t)
  return new RegExp(`^${prefix}\\s+`, "i").test(t)
}

/** Prepend der/die/das/to, replacing a different article if present. */
export function applyPrefix(text: string, prefix: PrefixHint): string {
  let body = text.trim()
  if (!body) return prefix === "to" ? "to " : `${prefix} `
  if (prefix === "to") {
    body = body.replace(EN_TO_RE, "").trim()
    return `to ${body}`
  }
  body = body.replace(DE_ARTICLE_RE, "").trim()
  // Keep any “, die Plural” tail intact on the first segment.
  return `${prefix} ${body}`
}

/** Split a comma-separated translation list into trimmed parts. */
function splitCommaList(text: string): string[] {
  return text
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean)
}

/** Append a translation if it isn’t already in the comma list. */
export function appendCommaItem(current: string, addition: string): string {
  const item = addition.trim()
  if (!item) return current.trim()
  const parts = splitCommaList(current)
  if (parts.some((p) => p.toLowerCase() === item.toLowerCase())) {
    return parts.join(", ")
  }
  return [...parts, item].join(", ")
}

/** True if this item is already one of the comma-separated values. */
export function commaListIncludes(current: string, item: string): boolean {
  const needle = item.trim().toLowerCase()
  if (!needle) return false
  return splitCommaList(current).some((p) => p.toLowerCase() === needle)
}

/**
 * Append a German plural after a comma: “Apfel” → “Apfel, Äpfel”
 * or “der Apfel” → “der Apfel, die Äpfel”.
 */
export function applyGermanPlural(text: string, plural: string): string {
  const pl = plural.trim()
  if (!pl) return text.trim()
  const current = text.trim()
  if (!current) return pl

  // Already has a comma tail — replace/update the plural segment.
  const head = current.includes(",") ? current.split(",")[0]!.trim() : current
  const hasArticle = DE_ARTICLE_RE.test(head)
  const tail = hasArticle ? `die ${pl}` : pl
  return `${head}, ${tail}`
}

export function hasGermanPlural(text: string, plural: string): boolean {
  const pl = plural.trim().toLowerCase()
  if (!pl || !text.includes(",")) return false
  const tail = text.split(",").slice(1).join(",").toLowerCase()
  return tail.includes(pl)
}
