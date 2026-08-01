import { useEffect, useRef, useState } from "react"
import type { LangCode } from "@/types"
import {
  isSuggestableQuery,
  suggestForWord,
  type WordSuggestion,
} from "@/lib/suggest"

const DEBOUNCE_MS = 450

export type SuggestStatus = "idle" | "loading" | "ready" | "error"

export function useWordSuggest(
  word: string,
  wordLang: LangCode,
  translationLang: LangCode,
) {
  const [status, setStatus] = useState<SuggestStatus>("idle")
  const [suggestion, setSuggestion] = useState<WordSuggestion | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const query = word.trim()
    if (!isSuggestableQuery(query)) {
      setStatus("idle")
      setSuggestion(null)
      return
    }

    const id = ++requestId.current
    setStatus("loading")
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      suggestForWord(query, wordLang, translationLang, controller.signal)
        .then((result) => {
          if (id !== requestId.current) return
          setSuggestion(result)
          setStatus(result ? "ready" : "idle")
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted || id !== requestId.current) return
          console.warn("Word suggest failed", err)
          setSuggestion(null)
          setStatus("error")
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [word, wordLang, translationLang])

  return { status, suggestion }
}
