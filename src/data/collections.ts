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
      {
        id: "w1",
        word: "der Apfel",
        translation: "the apple",
        examples: [
          "Ich esse einen Apfel.",
          "Der Apfel ist rot und süß.",
          "Möchtest du einen Apfel?",
        ],
      },
      {
        id: "w2",
        word: "laufen",
        translation: "to run",
        examples: ["Ich laufe jeden Morgen.", "Kannst du schnell laufen?"],
      },
      {
        id: "w3",
        word: "schnell",
        translation: "fast",
        examples: ["Das Auto ist sehr schnell.", "Bitte nicht so schnell sprechen."],
      },
      {
        id: "w4",
        word: "das Fenster",
        translation: "the window",
        examples: ["Bitte öffne das Fenster.", "Das Fenster ist geschlossen."],
      },
      {
        id: "w5",
        word: "verstehen",
        translation: "to understand",
        examples: [
          "Ich verstehe die Frage.",
          "Verstehst du Deutsch?",
          "Er hat mich nicht verstanden.",
        ],
      },
    ],
  },
]
