import type { AppSettings, Collection, Folder, LangCode, Library, PronounceFirst, Word } from "@/types"
import { normalizeExamples } from "@/lib/examples"
import { isLangCode } from "@/lib/languages"
import { getSupabase } from "@/lib/supabase"

export interface CloudBundle {
  collections: Collection[]
  folders: Folder[]
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
  folder_id: string | null
  sort_order: number
}

type FolderRow = {
  id: string
  name: string
  parent_id: string | null
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
  return bundle.collections.length > 0 || bundle.folders.length > 0 || bundle.settings != null
}

export async function loadCloudBundle(userId: string): Promise<CloudBundle> {
  const supabase = getSupabase()

  let collectionRowsRaw: CollectionRow[] = []
  {
    const withFolder = await supabase
      .from("collections")
      .select("id,name,description,word_lang,translation_lang,level,theme,folder_id,sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true })

    if (withFolder.error && /folder_id/i.test(withFolder.error.message)) {
      // Older schemas may not have folder_id yet.
      const legacy = await supabase
        .from("collections")
        .select("id,name,description,word_lang,translation_lang,level,theme,sort_order")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
      if (legacy.error) throw new Error(legacy.error.message)
      collectionRowsRaw = ((legacy.data ?? []) as Omit<CollectionRow, "folder_id">[]).map((row) => ({
        ...row,
        folder_id: null,
      }))
    } else if (withFolder.error) {
      throw new Error(withFolder.error.message)
    } else {
      collectionRowsRaw = (withFolder.data ?? []) as CollectionRow[]
    }
  }

  const [foldersRes, wordsRes, settingsRes] = await Promise.all([
    supabase
      .from("folders")
      .select("id,name,parent_id,sort_order")
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

  if (wordsRes.error) throw new Error(wordsRes.error.message)
  if (settingsRes.error) throw new Error(settingsRes.error.message)
  // Folders table may be missing until the schema migration is applied.
  const foldersUnavailable =
    foldersRes.error != null &&
    /relation .*folders.* does not exist|Could not find the table/i.test(foldersRes.error.message)
  if (foldersRes.error && !foldersUnavailable) throw new Error(foldersRes.error.message)

  const collectionRows = collectionRowsRaw
  const folderRows = (foldersUnavailable ? [] : (foldersRes.data ?? [])) as FolderRow[]
  const wordRows = (wordsRes.data ?? []) as WordRow[]

  const folders: Folder[] = folderRows.map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
  }))
  const folderIds = new Set(folders.map((f) => f.id))

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
    const folderId =
      row.folder_id && folderIds.has(row.folder_id) ? row.folder_id : null
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? "",
      wordLang,
      translationLang,
      level: row.level ? (row.level as Collection["level"]) : undefined,
      theme: row.theme || undefined,
      folderId,
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

  return { collections, folders, settings }
}

export async function saveCloudBundle(
  userId: string,
  library: Library,
  settings: AppSettings
): Promise<void> {
  const supabase = getSupabase()
  const { collections, folders } = library

  // Wipe-and-replace: collections first (cascades words), then folders.
  const { error: deleteCollectionsError } = await supabase
    .from("collections")
    .delete()
    .eq("user_id", userId)
  if (deleteCollectionsError) throw new Error(deleteCollectionsError.message)

  const { error: deleteFoldersError } = await supabase.from("folders").delete().eq("user_id", userId)
  const foldersTableMissing =
    deleteFoldersError != null &&
    /relation .*folders.* does not exist|Could not find the table/i.test(deleteFoldersError.message)
  if (deleteFoldersError && !foldersTableMissing) throw new Error(deleteFoldersError.message)

  if (!foldersTableMissing && folders.length > 0) {
    const folderRows = folders.map((f, index) => ({
      id: f.id,
      user_id: userId,
      name: f.name,
      parent_id: f.parentId,
      sort_order: index,
      updated_at: new Date().toISOString(),
    }))
    const { error: folderError } = await supabase.from("folders").insert(folderRows)
    if (folderError) throw new Error(folderError.message)
  }

  if (collections.length > 0) {
    const withFolderId = collections.map((c, index) => ({
      id: c.id,
      user_id: userId,
      name: c.name,
      description: c.description,
      word_lang: c.wordLang,
      translation_lang: c.translationLang,
      level: c.level ?? null,
      theme: c.theme ?? null,
      folder_id: foldersTableMissing ? null : (c.folderId ?? null),
      sort_order: index,
      updated_at: new Date().toISOString(),
    }))

    let { error: collectionError } = await supabase.from("collections").insert(withFolderId)
    if (collectionError && /folder_id/i.test(collectionError.message)) {
      const legacyRows = collections.map((c, index) => ({
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
      ;({ error: collectionError } = await supabase.from("collections").insert(legacyRows))
    }
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
