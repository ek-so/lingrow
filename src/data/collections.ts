import type { Collection } from "@/types"

/** Default lists seeded into localStorage on first visit. */
export const seedCollections: Collection[] = [
  {
    id: "test-5",
    name: "Test Collection",
    description: "Five random words, just to check everything works end to end.",
    wordLang: "de",
    translationLang: "en",
    level: "A1",
    theme: "Sanity check",
    words: [
      { id: "w1", word: "der Apfel", translation: "the apple" },
      { id: "w2", word: "laufen", translation: "to run" },
      { id: "w3", word: "schnell", translation: "fast" },
      { id: "w4", word: "das Fenster", translation: "the window" },
      { id: "w5", word: "verstehen", translation: "to understand" },
    ],
  },
]
