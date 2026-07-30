import type { AppSettings, Collection, LangCode, PronounceFirst, Word } from "@/types"
import { isLangCode } from "@/lib/languages"
import { LINGROW_SPREADSHEET_TITLE } from "@/lib/google-config"
import { loadSpreadsheetId, saveSpreadsheetId } from "@/lib/prefs"

const COLLECTIONS_SHEET = "Collections"
const WORDS_SHEET = "Words"
const SETTINGS_SHEET = "Settings"

const COLLECTIONS_HEADER = [
  "id",
  "name",
  "description",
  "wordLang",
  "translationLang",
  "level",
  "theme",
] as const

const WORDS_HEADER = ["collectionId", "id", "word", "translation"] as const
const SETTINGS_HEADER = ["key", "value"] as const

export interface CloudBundle {
  collections: Collection[]
  settings: AppSettings | null
  spreadsheetId: string
  spreadsheetUrl: string
}

async function sheetsFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`https://sheets.googleapis.com/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  return res
}

async function driveFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  return res
}

function spreadsheetUrl(id: string) {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`
}

async function ensureSpreadsheet(accessToken: string, userId: string): Promise<string> {
  const cached = loadSpreadsheetId(userId)
  if (cached) {
    const probe = await sheetsFetch(accessToken, `/spreadsheets/${cached}?fields=spreadsheetId`)
    if (probe.ok) return cached
  }

  const q = encodeURIComponent(
    `name='${LINGROW_SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )
  const listed = await driveFetch(
    accessToken,
    `/files?q=${q}&spaces=drive&fields=files(id,name)&pageSize=1`
  )
  if (listed.ok) {
    const data = (await listed.json()) as { files?: Array<{ id: string }> }
    const existing = data.files?.[0]?.id
    if (existing) {
      saveSpreadsheetId(userId, existing)
      return existing
    }
  }

  const created = await sheetsFetch(accessToken, "/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title: LINGROW_SPREADSHEET_TITLE },
      sheets: [
        { properties: { title: COLLECTIONS_SHEET } },
        { properties: { title: WORDS_SHEET } },
        { properties: { title: SETTINGS_SHEET } },
      ],
    }),
  })
  if (!created.ok) {
    const text = await created.text()
    throw new Error(`Could not create Lingrow spreadsheet: ${text}`)
  }
  const body = (await created.json()) as { spreadsheetId: string }
  saveSpreadsheetId(userId, body.spreadsheetId)
  return body.spreadsheetId
}

function cell(value: string | undefined | null) {
  return value ?? ""
}

function collectionsToRows(collections: Collection[]): string[][] {
  return [
    [...COLLECTIONS_HEADER],
    ...collections.map((c) => [
      c.id,
      c.name,
      c.description,
      c.wordLang,
      c.translationLang,
      c.level ?? "",
      c.theme ?? "",
    ]),
  ]
}

function wordsToRows(collections: Collection[]): string[][] {
  const rows: string[][] = [[...WORDS_HEADER]]
  for (const c of collections) {
    for (const w of c.words) {
      rows.push([c.id, w.id, w.word, w.translation])
    }
  }
  return rows
}

function settingsToRows(settings: AppSettings): string[][] {
  return [[...SETTINGS_HEADER], ["pronounceFirst", settings.pronounceFirst]]
}

function parseCollections(
  collectionRows: string[][],
  wordRows: string[][]
): Collection[] {
  const [cHeader, ...cBody] = collectionRows
  if (!cHeader || cHeader[0] !== "id") return []

  const wordsByCollection = new Map<string, Word[]>()
  const [, ...wBody] = wordRows
  for (const row of wBody) {
    const [collectionId, id, word, translation] = row
    if (!collectionId || !id || !word || !translation) continue
    const list = wordsByCollection.get(collectionId) ?? []
    list.push({ id, word, translation })
    wordsByCollection.set(collectionId, list)
  }

  const collections: Collection[] = []
  for (const row of cBody) {
    const [id, name, description, wordLangRaw, translationLangRaw, level, theme] = row
    if (!id || !name) continue
    const wordLang: LangCode = isLangCode(wordLangRaw) ? wordLangRaw : "de"
    const translationLang: LangCode = isLangCode(translationLangRaw)
      ? translationLangRaw
      : "en"
    collections.push({
      id,
      name,
      description: description ?? "",
      wordLang,
      translationLang,
      level: level ? (level as Collection["level"]) : undefined,
      theme: theme || undefined,
      words: wordsByCollection.get(id) ?? [],
    })
  }
  return collections
}

function parseSettings(rows: string[][]): AppSettings | null {
  const [, ...body] = rows
  if (!body.length) return null
  const map = new Map<string, string>()
  for (const [key, value] of body) {
    if (key) map.set(key, value ?? "")
  }
  const raw = map.get("pronounceFirst")
  const pronounceFirst: PronounceFirst = raw === "word" ? "word" : "translation"
  return { pronounceFirst }
}

async function readRange(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const res = await sheetsFetch(
    accessToken,
    `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  )
  if (res.status === 400 || res.status === 404) return []
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to read ${range}: ${text}`)
  }
  const data = (await res.json()) as { values?: string[][] }
  return data.values ?? []
}

async function ensureSheetTabs(accessToken: string, spreadsheetId: string) {
  const meta = await sheetsFetch(
    accessToken,
    `/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`
  )
  if (!meta.ok) return
  const data = (await meta.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>
  }
  const existing = new Set(
    (data.sheets ?? []).map((s) => s.properties?.title).filter((t): t is string => Boolean(t))
  )
  const needed = [COLLECTIONS_SHEET, WORDS_SHEET, SETTINGS_SHEET].filter((t) => !existing.has(t))
  if (needed.length === 0) return

  await sheetsFetch(accessToken, `/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: needed.map((title) => ({ addSheet: { properties: { title } } })),
    }),
  })
}

async function clearAndWrite(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: string[][]
) {
  const clearRes = await sheetsFetch(
    accessToken,
    `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`,
    { method: "POST", body: "{}" }
  )
  if (!clearRes.ok && clearRes.status !== 400) {
    const text = await clearRes.text()
    throw new Error(`Failed to clear ${sheetName}: ${text}`)
  }

  const updateRes = await sheetsFetch(
    accessToken,
    `/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({
        range: sheetName,
        majorDimension: "ROWS",
        values: rows.map((r) => r.map(cell)),
      }),
    }
  )
  if (!updateRes.ok) {
    const text = await updateRes.text()
    throw new Error(`Failed to write ${sheetName}: ${text}`)
  }
}

export async function loadCloudBundle(
  accessToken: string,
  userId: string
): Promise<CloudBundle> {
  const spreadsheetId = await ensureSpreadsheet(accessToken, userId)
  await ensureSheetTabs(accessToken, spreadsheetId)
  const [collectionRows, wordRows, settingRows] = await Promise.all([
    readRange(accessToken, spreadsheetId, COLLECTIONS_SHEET),
    readRange(accessToken, spreadsheetId, WORDS_SHEET),
    readRange(accessToken, spreadsheetId, SETTINGS_SHEET),
  ])

  return {
    collections: parseCollections(collectionRows, wordRows),
    settings: parseSettings(settingRows),
    spreadsheetId,
    spreadsheetUrl: spreadsheetUrl(spreadsheetId),
  }
}

export async function saveCloudBundle(
  accessToken: string,
  userId: string,
  collections: Collection[],
  settings: AppSettings
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const spreadsheetId = await ensureSpreadsheet(accessToken, userId)
  await ensureSheetTabs(accessToken, spreadsheetId)

  await Promise.all([
    clearAndWrite(accessToken, spreadsheetId, COLLECTIONS_SHEET, collectionsToRows(collections)),
    clearAndWrite(accessToken, spreadsheetId, WORDS_SHEET, wordsToRows(collections)),
    clearAndWrite(accessToken, spreadsheetId, SETTINGS_SHEET, settingsToRows(settings)),
  ])

  return { spreadsheetId, spreadsheetUrl: spreadsheetUrl(spreadsheetId) }
}

export function cloudHasData(bundle: CloudBundle) {
  return bundle.collections.length > 0 || bundle.settings != null
}
