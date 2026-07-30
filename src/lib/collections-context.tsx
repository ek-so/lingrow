import { createContext, useContext, useState, type ReactNode } from "react"
import type { AppSettings, Collection, LangCode, PronounceFirst, Word } from "@/types"
import {
  loadCollections,
  loadSettings,
  newId,
  saveCollections,
  saveSettings,
} from "@/lib/storage"

interface CollectionsContextValue {
  collections: Collection[]
  settings: AppSettings
  getCollection: (id: string) => Collection | undefined
  addCollection: (input: {
    name: string
    description?: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<Pick<Word, "word" | "translation">>
  }) => Collection
  deleteCollection: (id: string) => void
  setPronounceFirst: (value: PronounceFirst) => void
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null)

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  function getCollection(id: string) {
    return collections.find((c) => c.id === id)
  }

  function addCollection(input: {
    name: string
    description?: string
    wordLang: LangCode
    translationLang: LangCode
    words: Array<Pick<Word, "word" | "translation">>
  }) {
    const collection: Collection = {
      id: newId("list"),
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      wordLang: input.wordLang,
      translationLang: input.translationLang,
      words: input.words
        .map((w) => ({
          id: newId("w"),
          word: w.word.trim(),
          translation: w.translation.trim(),
        }))
        .filter((w) => w.word && w.translation),
    }
    setCollections((prev) => {
      const next = [collection, ...prev]
      saveCollections(next)
      return next
    })
    return collection
  }

  function deleteCollection(id: string) {
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveCollections(next)
      return next
    })
  }

  function setPronounceFirst(pronounceFirst: PronounceFirst) {
    setSettings((prev) => {
      const next = { ...prev, pronounceFirst }
      saveSettings(next)
      return next
    })
  }

  return (
    <CollectionsContext.Provider
      value={{
        collections,
        settings,
        getCollection,
        addCollection,
        deleteCollection,
        setPronounceFirst,
      }}
    >
      {children}
    </CollectionsContext.Provider>
  )
}

export function useCollections() {
  const ctx = useContext(CollectionsContext)
  if (!ctx) throw new Error("useCollections must be used within CollectionsProvider")
  return ctx
}
