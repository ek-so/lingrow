import { langLabel } from "@/lib/languages"
import type { WordPair } from "@/lib/collection-form"
import type { LangCode } from "@/types"

interface ImportPreviewProps {
  pairs: WordPair[]
  wordLang: LangCode
  translationLang: LangCode
  langsChanged: boolean
}

/** Shared preview table for paste-text and spreadsheet import screens. */
export function ImportPreview({
  pairs,
  wordLang,
  translationLang,
  langsChanged,
}: ImportPreviewProps) {
  if (pairs.length === 0) return null

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Preview · {pairs.length} pairs</span>
      </div>
      {langsChanged ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Detected language pair: {langLabel(wordLang)} → {langLabel(translationLang)}. The list
          will switch to this when you add the words.
        </p>
      ) : null}
      <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{langLabel(wordLang)}</th>
              <th className="px-3 py-2 font-medium">{langLabel(translationLang)}</th>
              <th className="px-3 py-2 font-medium">Examples</th>
            </tr>
          </thead>
          <tbody>
            {pairs.slice(0, 50).map((p, i) => (
              <tr key={`${p.word}-${i}`} className="border-t border-border">
                <td className="px-3 py-2">{p.word}</td>
                <td className="px-3 py-2">{p.translation}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.examples?.length ? p.examples.join(" · ") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pairs.length > 50 ? (
          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Showing first 50 of {pairs.length}.
          </p>
        ) : null}
      </div>
    </div>
  )
}
