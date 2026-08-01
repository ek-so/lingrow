import type { Collection, Folder } from "@/types"

export type LibrarySearchResult =
  | { kind: "folder"; id: string; name: string }
  | { kind: "collection"; id: string; name: string; description: string }
  | {
      kind: "word"
      wordId: string
      word: string
      translation: string
      collectionId: string
      collectionName: string
    }

const MAX_NAME_RESULTS = 24
const MAX_WORD_RESULTS = 24

function includesQuery(haystack: string, query: string) {
  return haystack.toLocaleLowerCase().includes(query)
}

/** Search folders/sets by name and words by word/translation text. */
export function searchLibrary(
  query: string,
  collections: Collection[],
  folders: Folder[],
): LibrarySearchResult[] {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return []

  const folderHits: LibrarySearchResult[] = []
  for (const folder of folders) {
    if (!includesQuery(folder.name, q)) continue
    folderHits.push({ kind: "folder", id: folder.id, name: folder.name })
    if (folderHits.length >= MAX_NAME_RESULTS) break
  }

  const collectionHits: LibrarySearchResult[] = []
  for (const collection of collections) {
    if (!includesQuery(collection.name, q)) continue
    collectionHits.push({
      kind: "collection",
      id: collection.id,
      name: collection.name,
      description: collection.description,
    })
    if (collectionHits.length >= MAX_NAME_RESULTS) break
  }

  const wordHits: LibrarySearchResult[] = []
  outer: for (const collection of collections) {
    for (const word of collection.words) {
      if (!includesQuery(word.word, q) && !includesQuery(word.translation, q)) continue
      wordHits.push({
        kind: "word",
        wordId: word.id,
        word: word.word,
        translation: word.translation,
        collectionId: collection.id,
        collectionName: collection.name,
      })
      if (wordHits.length >= MAX_WORD_RESULTS) break outer
    }
  }

  return [...folderHits, ...collectionHits, ...wordHits]
}
