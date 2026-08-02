import type { Collection } from "@/types"

/** Demo list shown to new guests (not signed in) on first visit. */
export const seedCollections: Collection[] = [
  {
    id: "demo-vocab-5",
    name: "Sample vocabulary",
    description: "Five German–English words to try study mode before you make your own list.",
    wordLang: "de",
    translationLang: "en",
    level: "A1",
    theme: "Vocabulary basics",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    words: [
      {
        id: "demo-w1",
        word: "das Wort",
        translation: "the word",
        examples: [
          "Was bedeutet dieses Wort?",
          "Ich lerne jeden Tag neue Wörter.",
        ],
      },
      {
        id: "demo-w2",
        word: "lernen",
        translation: "to learn",
        examples: [
          "Ich lerne Deutsch.",
          "Sie lernt schnell neue Vokabeln.",
        ],
      },
      {
        id: "demo-w3",
        word: "die Bedeutung",
        translation: "the meaning",
        examples: [
          "Die Bedeutung ist klar.",
          "Kennst du die Bedeutung dieses Satzes?",
        ],
      },
      {
        id: "demo-w4",
        word: "üben",
        translation: "to practice",
        examples: [
          "Wir üben die Aussprache.",
          "Du solltest jeden Tag üben.",
        ],
      },
      {
        id: "demo-w5",
        word: "die Übersetzung",
        translation: "the translation",
        examples: [
          "Die Übersetzung ist richtig.",
          "Schreib die Übersetzung auf.",
        ],
      },
    ],
  },
]
