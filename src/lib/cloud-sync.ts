import type { AppSettings, Collection, LangCode, PronounceFirst, Word } from "@/types"
import { normalizeExamples } from "@/lib/examples"
import { isLangCode } from "@/lib/languages"
import { getSupabase } from "@/lib/supabase"

export interface CloudBundle {
  collections: Collection[]
  settings: AppSettings | null
}

type CollectionRow = {
  id: string
  name: string
  description: string
  word_lang: string
  translation_lang: string
  level: string | null
  theme: string | null
  sort_order: number
}

type WordRow = {
  id: string
  collection_id: string
  word: string
  translation: string
  examples: unknown
  sort_order: number
}

type SettingsRow = {
  pronounce_first: string
}

export function cloudHasData(bundle: CloudBundle) {
  return bundle.collections.length > 0 || bundle.settings != null
}

export async function loadCloudBundle(userId: string): Promise<CloudBundle> {
  const supabase = getSupabase()

  const [collectionsRes, wordsRes, settingsRes] = await Promise.all([
    supabase
      .from("collections")
      .select("id,name,description,word_lang,translation_lang,level,theme,sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("words")
      .select("id,collection_id,word,translation,examples,sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_settings")
      .select("pronounce_first")
      .eq("user_id", userId)
      .maybeSingle(),
  ])

  if (collectionsRes.error) throw new Error(collectionsRes.error.message)
  if (wordsRes.error) throw new Error(wordsRes.error.message)
  if (settingsRes.error) throw new Error(settingsRes.error.message)

  const collectionRows = (collectionsRes.data ?? []) as CollectionRow[]
  const wordRows = (wordsRes.data ?? []) as WordRow[]

  const wordsByCollection = new Map<string, Word[]>()
  for (const row of wordRows) {
    const list = wordsByCollection.get(row.collection_id) ?? []
    list.push({
      id: row.id,
      word: row.word,
      translation: row.translation,
      examples: normalizeExamples(row.examples),
    })
    wordsByCollection.set(row.collection_id, list)
  }

  const collections: Collection[] = collectionRows.map((row) => {
    const wordLang: LangCode = isLangCode(row.word_lang) ? row.word_lang : "de"
    const translationLang: LangCode = isLangCode(row.translation_lang)
      ? row.translation_lang
      : "en"
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      wordLang,
      translationLang,
      level: row.level ? (row.level as Collection["level"]) : undefined,
      theme: row.theme || undefined,
      words: wordsByCollection.get(row.id) ?? [],
    }
  })

  let settings: AppSettings | null = null
  const settingsRow = settingsRes.data as SettingsRow | null
  if (settingsRow) {
    const pronounceFirst: PronounceFirst =
      settingsRow.pronounce_first === "word" ? "word" : "translation"
    settings = { pronounceFirst }
  }

  return { collections, settings }
}

export async function saveCloudBundle(
  userId: string,
  collections: Collection[],
  settings: AppSettings
): Promise<void> {
  const supabase = getSupabase()

  const { error: deleteError } = await supabase.from("collections").delete().eq("user_id", userId)
  if (deleteError) throw new Error(deleteError.message)

  if (collections.length > 0) {
    const collectionRows = collections.map((c, index) => ({
      id: c.id,
      user_id: userId,
      name: c.name,
      description: c.description,
      word_lang: c.wordLang,
      translation_lang: c.translationLang,
      level: c.level ?? null,
      theme: c.theme ?? null,
      sort_order: index,
      updated_at: new Date().toISOString(),
    }))

    const { error: collectionError } = await supabase.from("collections").insert(collectionRows)
    if (collectionError) throw new Error(collectionError.message)

    const wordRows = collections.flatMap((c) =>
      c.words.map((w, index) => ({
        id: w.id,
        collection_id: c.id,
        user_id: userId,
        word: w.word,
        translation: w.translation,
        examples: w.examples ?? [],
        sort_order: index,
      }))
    )

    if (wordRows.length > 0) {
      const { error: wordsError } = await supabase.from("words").insert(wordRows)
      if (wordsError) throw new Error(wordsError.message)
    }
  }

  const { error: settingsError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      pronounce_first: settings.pronounceFirst,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (settingsError) throw new Error(settingsError.message)
}
