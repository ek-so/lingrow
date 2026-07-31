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
import { normalizeExamples } from "@/lib/examples"
import { useAuth } from "@/lib/auth-context"
import { cloudHasData, loadCloudBundle, saveCloudBundle } from "@/lib/cloud-sync"

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
  pushToCloudNow: () => Promise<void>
}

const CollectionsContext = createContext<CollectionsContextValue | null>(null)

const PUSH_DEBOUNCE_MS = 500

function normalizeWords(words: WordPair[], previous?: Word[]): Word[] {
  const prevById = new Map((previous ?? []).map((w) => [w.id, w]))
  return words
    .map((w) => {
      const word = w.word.trim()
      const translation = w.translation.trim()
      const existing = w.id && prevById.has(w.id) ? prevById.get(w.id) : undefined
      return {
        id: existing?.id ?? newId("w"),
        word,
        translation,
        examples: normalizeExamples(w.examples),
      }
    })
    .filter((w) => w.word && w.translation)
}

type PushPayload = {
  collections: Collection[]
  settings: AppSettings
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user, setSyncing } = useAuth()

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
  const pushInFlight = useRef(false)
  const queuedPush = useRef<PushPayload | null>(null)
  const suppressAutoPush = useRef(false)

  useEffect(() => {
    setSettings(loadSettings(userId))
  }, [userId])

  const runPush = useCallback(
    async (payload: PushPayload) => {
      if (authStatus !== "signed_in" || !user) return
      setSyncStatus("syncing")
      setSyncing(true)
      setSyncError(null)
      try {
        await saveCloudBundle(user.id, payload.collections, payload.settings)
        setSyncStatus("idle")
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Cloud sync failed"
        setSyncError(msg)
        setSyncStatus("error")
        throw e
      } finally {
        setSyncing(false)
      }
    },
    [authStatus, user, setSyncing]
  )

  const flushPushQueue = useCallback(async () => {
    if (pushInFlight.current) return
    if (authStatus !== "signed_in" || !user || !cloudReady.current) return

    let lastError: unknown = null
    while (queuedPush.current) {
      const payload = queuedPush.current
      queuedPush.current = null
      pushInFlight.current = true
      try {
        await runPush(payload)
        lastError = null
      } catch (e) {
        lastError = e
        if (!queuedPush.current) queuedPush.current = payload
        break
      } finally {
        pushInFlight.current = false
      }
    }
    if (lastError) throw lastError
  }, [authStatus, user, runPush])

  const schedulePush = useCallback(
    (nextCollections: Collection[], nextSettings: AppSettings) => {
      if (authStatus !== "signed_in" || !user || !cloudReady.current) return
      if (suppressAutoPush.current) return
      queuedPush.current = { collections: nextCollections, settings: nextSettings }
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
      pushTimer.current = window.setTimeout(() => {
        void flushPushQueue()
      }, PUSH_DEBOUNCE_MS)
    },
    [authStatus, user, flushPushQueue]
  )

  const pushToCloudNow = useCallback(async () => {
    if (authStatus !== "signed_in" || !user) return
    if (pushTimer.current) {
      window.clearTimeout(pushTimer.current)
      pushTimer.current = null
    }
    queuedPush.current = {
      collections: collectionsRef.current,
      settings: settingsRef.current,
    }
    cloudReady.current = true
    await flushPushQueue()
  }, [authStatus, user, flushPushQueue])

  const refreshFromCloud = useCallback(async () => {
    if (!user) return
    setSyncStatus("syncing")
    setSyncing(true)
    setSyncError(null)
    suppressAutoPush.current = true
    try {
      const bundle = await loadCloudBundle(user.id)

      if (cloudHasData(bundle)) {
        setCollections(bundle.collections)
        collectionsRef.current = bundle.collections
        saveCollections(bundle.collections)
        if (bundle.settings) {
          setSettings(bundle.settings)
          settingsRef.current = bundle.settings
          saveSettings(bundle.settings, user.id)
        }
      } else {
        const localCollections = collectionsRef.current
        const localSettings = settingsRef.current
        await saveCloudBundle(user.id, localCollections, localSettings)
      }
      cloudReady.current = true
      setSyncStatus("idle")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not sync with the cloud"
      setSyncError(msg)
      setSyncStatus("error")
      cloudReady.current = true
      throw e
    } finally {
      suppressAutoPush.current = false
      setSyncing(false)
    }
  }, [user, setSyncing])

  useEffect(() => {
    if (authStatus === "signed_in" && user) {
      cloudReady.current = false
      void refreshFromCloud().catch(() => undefined)
    } else {
      cloudReady.current = false
      queuedPush.current = null
      setSyncStatus("local")
      setSyncError(null)
    }
  }, [authStatus, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== "hidden") return
      if (pushTimer.current) {
        window.clearTimeout(pushTimer.current)
        pushTimer.current = null
      }
      void flushPushQueue()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onHide)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onHide)
      if (pushTimer.current) window.clearTimeout(pushTimer.current)
    }
  }, [flushPushQueue])

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
          words: normalizeWords(input.words, c.words),
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
        pushToCloudNow,
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
