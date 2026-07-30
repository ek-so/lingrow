import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { AppSettings, Collection, LangCode, PronounceFirst, Word } from "@/types"
import {
  loadCollections,
  loadSettings,
  newId,
  saveCollections,
  saveSettings,
} from "@/lib/storage"
import type { WordPair } from "@/lib/collection-form"
import { useAuth } from "@/lib/auth-context"
import { cloudHasData, loadCloudBundle, saveCloudBundle } from "@/lib/google-sheets"

interface CollectionFields {
  name: string
  description?: string
  wordLang: LangCode
  translationLang: LangCode
  words: WordPair[]
}

export type SyncStatus = "local" | "idle" | "syncing" | "error"

interface CollectionsContextValue {
  collections: Collection[]
  settings: AppSettings
  syncStatus: SyncStatus
  syncError: string | null
  getCollection: (id: string) => Collection | undefined
  addCollection: (input: CollectionFields) => Collection
  updateCollection: (id: string, input: CollectionFields) => Collection | undefined
  deleteCollection: (id: string) => void
  setPronounceFirst: (value: PronounceFirst) => void
  refreshFromCloud: () => Promise<void>
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null)

function normalizeWords(words: WordPair[]): Word[] {
  return words
    .map((w) => ({
      id: newId("w"),
      word: w.word.trim(),
      translation: w.translation.trim(),
    }))
    .filter((w) => w.word && w.translation)
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const {
    status: authStatus,
    user,
    getAccessToken,
    setSyncing,
    setSpreadsheetUrl,
  } = useAuth()

  const userId = user?.id ?? null
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections())
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(userId))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local")
  const [syncError, setSyncError] = useState<string | null>(null)

  const collectionsRef = useRef(collections)
  const settingsRef = useRef(settings)
  collectionsRef.current = collections
  settingsRef.current = settings

  const pushTimer = useRef<number | null>(null)
  const cloudReady = useRef(false)

  // Reload local settings when the signed-in user changes.
  useEffect(() => {
    setSettings(loadSettings(userId))
  }, [userId])

  const pushToCloud = useCallback(
    async (nextCollections: Collection[], nextSettings: AppSettings) => {
      if (authStatus !== "signed_in" || !user) return
      setSyncStatus("syncing")
      setSyncing(true)
      setSyncError(null)
      try {
        const token = await getAccessToken()
        const result = await saveCloudBundle(token, user.id, nextCollections, nextSettings)
        setSpreadsheetUrl(result.spreadsheetUrl)
        setSyncStatus("idle")
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Cloud sync failed"
        setSyncError(msg)
        setSyncStatus("error")
      } finally {
        setSyncing(false)
      }
    },
    [authStatus, user, getAccessToken, setSyncing, setSpreadsheetUrl]
  )

  const schedulePush = useCallback(
    (nextCollections: Collection[], nextSettings: AppSettings) => {
      if (authStatus !== "signed_in" || !user || !cloudReady.current) return
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
      pushTimer.current = window.setTimeout(() => {
        void pushToCloud(nextCollections, nextSettings)
      }, 700)
    },
    [authStatus, user, pushToCloud]
  )

  const refreshFromCloud = useCallback(async () => {
    if (!user) return
    setSyncStatus("syncing")
    setSyncing(true)
    setSyncError(null)
    try {
      const token = await getAccessToken()
      const bundle = await loadCloudBundle(token, user.id)
      setSpreadsheetUrl(bundle.spreadsheetUrl)

      if (cloudHasData(bundle)) {
        setCollections(bundle.collections)
        saveCollections(bundle.collections)
        if (bundle.settings) {
          setSettings(bundle.settings)
          saveSettings(bundle.settings, user.id)
        }
      } else {
        // First sign-in: upload local collections + settings to Google.
        const localCollections = collectionsRef.current
        const localSettings = settingsRef.current
        const result = await saveCloudBundle(token, user.id, localCollections, localSettings)
        setSpreadsheetUrl(result.spreadsheetUrl)
      }
      cloudReady.current = true
      setSyncStatus("idle")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load Google spreadsheet"
      setSyncError(msg)
      setSyncStatus("error")
      cloudReady.current = true
    } finally {
      setSyncing(false)
    }
  }, [user, getAccessToken, setSyncing, setSpreadsheetUrl])

  useEffect(() => {
    if (authStatus === "signed_in" && user) {
      cloudReady.current = false
      void refreshFromCloud()
    } else {
      cloudReady.current = false
      setSyncStatus("local")
      setSyncError(null)
      setSpreadsheetUrl(null)
    }
  }, [authStatus, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
    }
  }, [])

  function getCollection(id: string) {
    return collections.find((c) => c.id === id)
  }

  function addCollection(input: CollectionFields) {
    const collection: Collection = {
      id: newId("list"),
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      wordLang: input.wordLang,
      translationLang: input.translationLang,
      words: normalizeWords(input.words),
    }
    setCollections((prev) => {
      const next = [collection, ...prev]
      saveCollections(next)
      schedulePush(next, settingsRef.current)
      return next
    })
    return collection
  }

  function updateCollection(id: string, input: CollectionFields) {
    let updated: Collection | undefined
    setCollections((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c
        updated = {
          ...c,
          name: input.name.trim(),
          description: (input.description ?? "").trim(),
          wordLang: input.wordLang,
          translationLang: input.translationLang,
          words: normalizeWords(input.words),
        }
        return updated
      })
      saveCollections(next)
      schedulePush(next, settingsRef.current)
      return next
    })
    return updated
  }

  function deleteCollection(id: string) {
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveCollections(next)
      schedulePush(next, settingsRef.current)
      return next
    })
  }

  function setPronounceFirst(pronounceFirst: PronounceFirst) {
    setSettings((prev) => {
      const next = { ...prev, pronounceFirst }
      saveSettings(next, userId)
      schedulePush(collectionsRef.current, next)
      return next
    })
  }

  return (
    <CollectionsContext.Provider
      value={{
        collections,
        settings,
        syncStatus,
        syncError,
        getCollection,
        addCollection,
        updateCollection,
        deleteCollection,
        setPronounceFirst,
        refreshFromCloud,
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
