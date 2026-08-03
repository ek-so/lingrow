import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { AppSettings, Collection, Folder, LangCode, Library, PronounceFirst, Word } from "@/types"
import {
  loadLibrary,
  loadSettings,
  newId,
  nowIso,
  saveLibrary,
  saveSettings,
} from "@/lib/storage"
import type { WordPair } from "@/lib/collection-form"
import { normalizeExamples } from "@/lib/examples"
import { wouldCreateFolderCycle } from "@/lib/folders"
import { reorderSiblingsByIds } from "@/lib/reorder"
import { useAuth } from "@/lib/auth-context"
import { cloudHasData, loadCloudBundle, saveCloudBundle } from "@/lib/cloud-sync"

interface CollectionFields {
  name: string
  description?: string
  wordLang: LangCode
  translationLang: LangCode
  words: WordPair[]
  folderId?: string | null
}

export type SyncStatus = "local" | "idle" | "syncing" | "error"

interface CollectionsContextValue {
  collections: Collection[]
  folders: Folder[]
  settings: AppSettings
  syncStatus: SyncStatus
  syncError: string | null
  getCollection: (id: string) => Collection | undefined
  getFolder: (id: string) => Folder | undefined
  addCollection: (input: CollectionFields) => Collection
  updateCollection: (id: string, input: CollectionFields) => Collection | undefined
  deleteCollection: (id: string) => void
  moveCollection: (id: string, folderId: string | null) => void
  reorderCollections: (folderId: string | null, orderedIds: string[]) => void
  addFolder: (name: string, parentId?: string | null) => Folder
  renameFolder: (id: string, name: string) => void
  moveFolder: (id: string, parentId: string | null) => void
  reorderFolders: (parentId: string | null, orderedIds: string[]) => void
  deleteFolder: (id: string) => void
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
  library: Library
  settings: AppSettings
}

export function CollectionsProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user, setSyncing } = useAuth()

  const userId = user?.id ?? null
  const [collections, setCollections] = useState<Collection[]>(() => loadLibrary(userId).collections)
  const [folders, setFolders] = useState<Folder[]>(() => loadLibrary(userId).folders)
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings(userId))
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local")
  const [syncError, setSyncError] = useState<string | null>(null)

  const collectionsRef = useRef(collections)
  const foldersRef = useRef(folders)
  const settingsRef = useRef(settings)
  collectionsRef.current = collections
  foldersRef.current = folders
  settingsRef.current = settings

  const pushTimer = useRef<number | null>(null)
  const cloudReady = useRef(false)
  const pushInFlight = useRef(false)
  const queuedPush = useRef<PushPayload | null>(null)
  const suppressAutoPush = useRef(false)

  const persistLibrary = useCallback(
    (nextCollections: Collection[], nextFolders: Folder[]) => {
      saveLibrary({ collections: nextCollections, folders: nextFolders }, userId)
    },
    [userId]
  )

  useEffect(() => {
    const library = loadLibrary(userId)
    setCollections(library.collections)
    setFolders(library.folders)
    collectionsRef.current = library.collections
    foldersRef.current = library.folders
    setSettings(loadSettings(userId))
  }, [userId])

  const runPush = useCallback(
    async (payload: PushPayload) => {
      if (authStatus !== "signed_in" || !user) return
      setSyncStatus("syncing")
      setSyncing(true)
      setSyncError(null)
      try {
        await saveCloudBundle(user.id, payload.library, payload.settings)
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
    (nextCollections: Collection[], nextFolders: Folder[], nextSettings: AppSettings) => {
      if (authStatus !== "signed_in" || !user || !cloudReady.current) return
      if (suppressAutoPush.current) return
      queuedPush.current = {
        library: { collections: nextCollections, folders: nextFolders },
        settings: nextSettings,
      }
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
      library: {
        collections: collectionsRef.current,
        folders: foldersRef.current,
      },
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
        setFolders(bundle.folders)
        collectionsRef.current = bundle.collections
        foldersRef.current = bundle.folders
        saveLibrary(
          { collections: bundle.collections, folders: bundle.folders },
          user.id
        )
        if (bundle.settings) {
          setSettings(bundle.settings)
          settingsRef.current = bundle.settings
          saveSettings(bundle.settings, user.id)
        }
      } else {
        const localLibrary: Library = {
          collections: collectionsRef.current,
          folders: foldersRef.current,
        }
        const localSettings = settingsRef.current
        await saveCloudBundle(user.id, localLibrary, localSettings)
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

  function getFolder(id: string) {
    return folders.find((f) => f.id === id)
  }

  function commitLibrary(nextCollections: Collection[], nextFolders: Folder[]) {
    persistLibrary(nextCollections, nextFolders)
    schedulePush(nextCollections, nextFolders, settingsRef.current)
  }

  function addCollection(input: CollectionFields) {
    const folderId =
      typeof input.folderId === "string" && foldersRef.current.some((f) => f.id === input.folderId)
        ? input.folderId
        : null
    const stamp = nowIso()
    const collection: Collection = {
      id: newId("list"),
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      wordLang: input.wordLang,
      translationLang: input.translationLang,
      folderId,
      words: normalizeWords(input.words),
      createdAt: stamp,
      updatedAt: stamp,
    }
    setCollections((prev) => {
      const next = [collection, ...prev]
      commitLibrary(next, foldersRef.current)
      return next
    })
    return collection
  }

  function updateCollection(id: string, input: CollectionFields) {
    let updated: Collection | undefined
    setCollections((prev) => {
      const next = prev.map((c) => {
        if (c.id !== id) return c
        const folderId =
          input.folderId === undefined
            ? (c.folderId ?? null)
            : typeof input.folderId === "string" &&
                foldersRef.current.some((f) => f.id === input.folderId)
              ? input.folderId
              : null
        updated = {
          ...c,
          name: input.name.trim(),
          description: (input.description ?? "").trim(),
          wordLang: input.wordLang,
          translationLang: input.translationLang,
          folderId,
          words: normalizeWords(input.words, c.words),
          updatedAt: nowIso(),
        }
        return updated
      })
      commitLibrary(next, foldersRef.current)
      return next
    })
    return updated
  }

  function deleteCollection(id: string) {
    setCollections((prev) => {
      const next = prev.filter((c) => c.id !== id)
      commitLibrary(next, foldersRef.current)
      return next
    })
  }

  function moveCollection(id: string, folderId: string | null) {
    const target =
      folderId == null || foldersRef.current.some((f) => f.id === folderId) ? folderId : null
    const stamp = nowIso()
    setCollections((prev) => {
      const next = prev.map((c) =>
        c.id === id ? { ...c, folderId: target, updatedAt: stamp } : c,
      )
      commitLibrary(next, foldersRef.current)
      return next
    })
  }

  function reorderCollections(folderId: string | null, orderedIds: string[]) {
    const siblingIds = collectionsRef.current
      .filter((c) => (c.folderId ?? null) === folderId)
      .map((c) => c.id)
    if (
      orderedIds.length !== siblingIds.length ||
      orderedIds.some((id) => !siblingIds.includes(id))
    ) {
      return
    }
    setCollections((prev) => {
      const next = reorderSiblingsByIds(prev, orderedIds)
      collectionsRef.current = next
      commitLibrary(next, foldersRef.current)
      return next
    })
  }

  function addFolder(name: string, parentId: string | null = null) {
    const trimmed = name.trim() || "Untitled folder"
    const parent =
      parentId != null && foldersRef.current.some((f) => f.id === parentId) ? parentId : null
    const stamp = nowIso()
    const folder: Folder = {
      id: newId("folder"),
      name: trimmed,
      parentId: parent,
      createdAt: stamp,
      updatedAt: stamp,
    }
    setFolders((prev) => {
      const next = [folder, ...prev]
      foldersRef.current = next
      commitLibrary(collectionsRef.current, next)
      return next
    })
    return folder
  }

  function renameFolder(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    const stamp = nowIso()
    setFolders((prev) => {
      const next = prev.map((f) =>
        f.id === id ? { ...f, name: trimmed, updatedAt: stamp } : f,
      )
      foldersRef.current = next
      commitLibrary(collectionsRef.current, next)
      return next
    })
  }

  function moveFolder(id: string, parentId: string | null) {
    if (wouldCreateFolderCycle(foldersRef.current, id, parentId)) return
    const target =
      parentId == null || foldersRef.current.some((f) => f.id === parentId) ? parentId : null
    const stamp = nowIso()
    setFolders((prev) => {
      const next = prev.map((f) =>
        f.id === id ? { ...f, parentId: target, updatedAt: stamp } : f,
      )
      foldersRef.current = next
      commitLibrary(collectionsRef.current, next)
      return next
    })
  }

  function reorderFolders(parentId: string | null, orderedIds: string[]) {
    const siblingIds = foldersRef.current
      .filter((f) => f.parentId === parentId)
      .map((f) => f.id)
    if (
      orderedIds.length !== siblingIds.length ||
      orderedIds.some((id) => !siblingIds.includes(id))
    ) {
      return
    }
    setFolders((prev) => {
      const next = reorderSiblingsByIds(prev, orderedIds)
      foldersRef.current = next
      commitLibrary(collectionsRef.current, next)
      return next
    })
  }

  function deleteFolder(id: string) {
    const folder = foldersRef.current.find((f) => f.id === id)
    if (!folder) return
    const parentId = folder.parentId

    // Unwrap: move immediate child folders/sets to the parent, then remove the folder.
    const nextFolders = foldersRef.current
      .filter((f) => f.id !== id)
      .map((f) => (f.parentId === id ? { ...f, parentId } : f))
    const nextCollections = collectionsRef.current.map((c) =>
      c.folderId === id ? { ...c, folderId: parentId } : c
    )
    foldersRef.current = nextFolders
    collectionsRef.current = nextCollections
    setFolders(nextFolders)
    setCollections(nextCollections)
    commitLibrary(nextCollections, nextFolders)
  }

  function setPronounceFirst(pronounceFirst: PronounceFirst) {
    setSettings((prev) => {
      const next = { ...prev, pronounceFirst }
      saveSettings(next, userId)
      schedulePush(collectionsRef.current, foldersRef.current, next)
      return next
    })
  }

  return (
    <CollectionsContext.Provider
      value={{
        collections,
        folders,
        settings,
        syncStatus,
        syncError,
        getCollection,
        getFolder,
        addCollection,
        updateCollection,
        deleteCollection,
        moveCollection,
        reorderCollections,
        addFolder,
        renameFolder,
        moveFolder,
        reorderFolders,
        deleteFolder,
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
