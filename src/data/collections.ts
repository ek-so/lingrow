import type { Collection } from "@/types"

export const collections: Collection[] = [
  {
    id: "test-5",
    name: "Test Collection",
    description: "Five random words, just to check everything works end to end.",
    level: "A1",
    theme: "Sanity check",
    words: [
      { id: "w1", de: "der Apfel", en: "the apple" },
      { id: "w2", de: "laufen", en: "to run" },
      { id: "w3", de: "schnell", en: "fast" },
      { id: "w4", de: "das Fenster", en: "the window" },
      { id: "w5", de: "verstehen", en: "to understand" },
    ],
  },
]
