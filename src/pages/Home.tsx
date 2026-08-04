import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Progress } from "@/components/ui/progress"
import { OverflowMenu } from "@/components/OverflowMenu"
import { CreateItemSheet } from "@/components/CreateItemSheet"
import { MoveHereSheet } from "@/components/MoveHereSheet"
import { MoveToFolderSheet } from "@/components/MoveToFolderSheet"
import { NameFolderSheet } from "@/components/NameFolderSheet"
import { SearchSheet } from "@/components/SearchSheet"
import { SortMenu } from "@/components/SortMenu"
import { SortableItem, SortableList } from "@/components/SortableList"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { TitleActions, titleAction, toOverflowMenuItems } from "@/components/TitleActions"
import { downloadCollectionExcel } from "@/lib/export-collection"
import { countItemsInFolder, descendantFolderIds, folderTrailUp } from "@/lib/folders"
import { pairLabel } from "@/lib/languages"
import { sortCollections, sortFolders, type LibrarySortMode } from "@/lib/library-sort"
import { loadLibrarySortMode, saveLibrarySortMode } from "@/lib/prefs"
import { recordRecentOpen } from "@/lib/recent"
import { formatLastRepetition, loadStudyProgressMap } from "@/lib/study-progress"
import {
  Folder as FolderIcon,
  FolderPlus,
  Plus,
  Search,
  UserRound,
} from "lucide-react"
import type { Collection, Folder } from "@/types"

type MoveTarget =
  | { kind: "collection"; id: string; name: string; folderId: string | null }
  | { kind: "folder"; id: string; name: string; parentId: string | null }

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { folderId: routeFolderId } = useParams()
  const {
    collections,
    folders,
    deleteCollection,
    moveCollection,
    reorderCollections,
    addFolder,
    renameFolder,
    moveFolder,
    reorderFolders,
    deleteFolder,
    getFolder,
  } = useCollections()
  const { user, status } = useAuth()

  const currentFolderId = routeFolderId ?? null
  const currentFolder = currentFolderId ? getFolder(currentFolderId) : undefined

  const [createOpen, setCreateOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [moveHereOpen, setMoveHereOpen] = useState(false)
  const [nameFolderOpen, setNameFolderOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [sortMode, setSortMode] = useState<LibrarySortMode>(() => loadLibrarySortMode())
  const [reorderMode, setReorderMode] = useState(false)

  useEffect(() => {
    if (currentFolderId && currentFolder) {
      recordRecentOpen("folder", currentFolderId)
    }
    // Record once per folder id when the folder exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId])

  const childFolders = useMemo(() => {
    const siblings = folders.filter((f) => f.parentId === currentFolderId)
    return sortFolders(siblings, sortMode, {
      collections,
      allFolders: folders,
      progressByCollectionId: loadStudyProgressMap(),
    })
    // Recompute when returning from study so “recently exercised” stays fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders, collections, currentFolderId, sortMode, location.key])

  const childCollections = useMemo(() => {
    const siblings = collections.filter((c) => (c.folderId ?? null) === currentFolderId)
    return sortCollections(siblings, sortMode, loadStudyProgressMap())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collections, currentFolderId, sortMode, location.key])

  // Refresh when returning from study so resume position stays current.
  const progressById = useMemo(() => loadStudyProgressMap(), [location.key])

  // Leave reorder mode when navigating to another folder.
  useEffect(() => {
    setReorderMode(false)
  }, [currentFolderId])

  function onSortChange(mode: LibrarySortMode) {
    setSortMode(mode)
    saveLibrarySortMode(mode)
  }

  function startReorderMode() {
    // Lock in the currently visible order as manual, then enable grips.
    const folderIds = childFolders.map((f) => f.id)
    const collectionIds = childCollections.map((c) => c.id)
    if (folderIds.length > 1) reorderFolders(currentFolderId, folderIds)
    if (collectionIds.length > 1) reorderCollections(currentFolderId, collectionIds)
    onSortChange("manual")
    setReorderMode(true)
  }

  function finishReorderMode() {
    setReorderMode(false)
  }

  function renderFolderCompact(folder: Folder, dragHandle: ReactNode) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-1.5">
        <div className="flex items-center gap-1">
          {dragHandle}
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{folder.name}</p>
          <OverflowMenu
            label={`Actions for ${folder.name}`}
            items={toOverflowMenuItems([
              titleAction.delete(() => onDeleteFolder(folder)),
            ])}
          />
        </div>
      </div>
    )
  }

  function renderCollectionCompact(c: Collection, dragHandle: ReactNode) {
    return (
      <div className="rounded-lg border border-border bg-card px-3 py-1.5">
        <div className="flex items-center gap-1">
          {dragHandle}
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</p>
          <OverflowMenu
            label={`Actions for ${c.name}`}
            items={toOverflowMenuItems([
              titleAction.delete(() => onDeleteSet(c.id, c.name)),
            ])}
          />
        </div>
      </div>
    )
  }

  // Invalid deep link → treat as root.
  const folderMissing = Boolean(currentFolderId && !currentFolder)

  function onDeleteSet(id: string, name: string) {
    if (!window.confirm(`Delete “${name}”? This can’t be undone.`)) return
    deleteCollection(id)
  }

  function onDeleteFolder(folder: Folder) {
    if (
      !window.confirm(
        `Delete folder “${folder.name}”? Sets and folders inside move up one level.`,
      )
    ) {
      return
    }
    deleteFolder(folder.id)
    if (currentFolderId === folder.id) {
      navigate(folder.parentId ? `/folder/${folder.parentId}` : "/")
    }
  }

  function onExport(collection: Collection) {
    void downloadCollectionExcel(collection)
  }

  function goNewSet() {
    setCreateOpen(false)
    const q = currentFolderId ? `?folder=${encodeURIComponent(currentFolderId)}` : ""
    navigate(`/new${q}`)
  }

  function openCreateFolder() {
    setCreateOpen(false)
    setNameFolderOpen(true)
  }

  function openMoveHere() {
    setCreateOpen(false)
    setMoveHereOpen(true)
  }

  function parentPath() {
    if (!currentFolder) return "/"
    return currentFolder.parentId ? `/folder/${currentFolder.parentId}` : "/"
  }

  const moveDisabledIds = useMemo(() => {
    if (!moveTarget || moveTarget.kind !== "folder") return undefined
    const ids = descendantFolderIds(folders, moveTarget.id)
    ids.add(moveTarget.id)
    return ids
  }, [moveTarget, folders])

  if (folderMissing) {
    return (
      <AppShell header={<AppHeader leading={{ kind: "brand" }} />}>
        <PageBody className="pb-8">
          <p className="text-muted-foreground">This folder no longer exists.</p>
          <Button type="button" className="mt-4" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </PageBody>
      </AppShell>
    )
  }

  const searchButton = (
    <IconButton aria-label="Search" onClick={() => setSearchOpen(true)}>
      <Search />
    </IconButton>
  )

  const profileButton = (
    <IconButton
      aria-label="Profile"
      onClick={() => navigate("/profile")}
      className="overflow-hidden"
    >
      {user?.picture && status === "signed_in" ? (
        <img
          src={user.picture}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <UserRound />
      )}
    </IconButton>
  )

  const canReorder = childFolders.length > 1 || childCollections.length > 1

  const titleActions = reorderMode
    ? null
    : (
        <TitleActions
          menuLabel={
            currentFolder ? `Actions for ${currentFolder.name}` : "Library actions"
          }
          actions={[
            titleAction.sort(
              <SortMenu value={sortMode} onChange={onSortChange} />,
            ),
            titleAction.create(() => setCreateOpen(true)),
            ...(canReorder ? [titleAction.reorder(startReorderMode)] : []),
            ...(currentFolder
              ? [
                  titleAction.rename(() => setRenameTarget(currentFolder)),
                  titleAction.move(() =>
                    setMoveTarget({
                      kind: "folder" as const,
                      id: currentFolder.id,
                      name: currentFolder.name,
                      parentId: currentFolder.parentId,
                    }),
                  ),
                  titleAction.delete(() => onDeleteFolder(currentFolder)),
                ]
              : []),
          ]}
        />
      )

  const header = currentFolder ? (
    <AppHeader
      leading={{
        kind: "back",
        label: currentFolder.parentId
          ? (getFolder(currentFolder.parentId)?.name ?? "Back")
          : "My sets",
        to: parentPath(),
        trail: folderTrailUp(folders, currentFolder.parentId),
      }}
      actions={searchButton}
    />
  ) : (
    <AppHeader
      leading={{ kind: "brand" }}
      actions={
        <>
          {searchButton}
          {profileButton}
        </>
      }
    />
  )

  return (
    <>
      <AppShell header={header}>
      <PageBody className="pb-8">
        <PageTitle className="mb-6" actions={titleActions}>
          {currentFolder ? currentFolder.name : "My sets"}
        </PageTitle>

        {!currentFolder && status !== "signed_in" ? (
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-secondary/60 px-3.5 py-3">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              Progress on this device can be lost if you clear site data. Sign in to sync to the
              cloud.
            </p>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => navigate("/profile")}
            >
              Sign in
            </Button>
          </div>
        ) : null}

        <div className={`flex flex-col ${reorderMode ? "gap-2 pb-24" : "gap-3"}`}>
          {reorderMode ? (
            <>
              {childFolders.length > 0 ? (
                <SortableList
                  ids={childFolders.map((f) => f.id)}
                  onReorder={(orderedIds) => reorderFolders(currentFolderId, orderedIds)}
                  className="flex flex-col gap-2"
                >
                  {childFolders.map((folder) => (
                    <SortableItem
                      key={folder.id}
                      id={folder.id}
                      handleLabel={`Reorder folder ${folder.name}`}
                    >
                      {(dragHandle) => renderFolderCompact(folder, dragHandle)}
                    </SortableItem>
                  ))}
                </SortableList>
              ) : null}

              {childCollections.length > 0 ? (
                <SortableList
                  ids={childCollections.map((c) => c.id)}
                  onReorder={(orderedIds) => reorderCollections(currentFolderId, orderedIds)}
                  className="flex flex-col gap-2"
                >
                  {childCollections.map((c) => (
                    <SortableItem
                      key={c.id}
                      id={c.id}
                      handleLabel={`Reorder set ${c.name}`}
                    >
                      {(dragHandle) => renderCollectionCompact(c, dragHandle)}
                    </SortableItem>
                  ))}
                </SortableList>
              ) : null}
            </>
          ) : (
            <>
              {childFolders.map((folder) => {
                const counts = countItemsInFolder(
                  folders,
                  collections.map((c) => c.folderId),
                  folder.id,
                )
                const itemLabel = [
                  counts.folders > 0
                    ? `${counts.folders} folder${counts.folders === 1 ? "" : "s"}`
                    : null,
                  `${counts.sets} set${counts.sets === 1 ? "" : "s"}`,
                ]
                  .filter(Boolean)
                  .join(" · ")

                return (
                  <Card key={folder.id} className="transition-colors hover:border-primary/50">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/folder/${folder.id}`} className="min-w-0 flex-1">
                          <CardTitle className="flex items-center gap-2">
                            <FolderIcon className="h-5 w-5 shrink-0 text-primary" />
                            <span className="truncate">{folder.name}</span>
                          </CardTitle>
                          <CardDescription className="mt-1">{itemLabel}</CardDescription>
                        </Link>
                        <OverflowMenu
                          label={`Actions for ${folder.name}`}
                          items={toOverflowMenuItems([
                            titleAction.rename(() => setRenameTarget(folder)),
                            titleAction.move(() =>
                              setMoveTarget({
                                kind: "folder",
                                id: folder.id,
                                name: folder.name,
                                parentId: folder.parentId,
                              }),
                            ),
                            titleAction.delete(() => onDeleteFolder(folder)),
                          ])}
                        />
                      </div>
                    </CardHeader>
                  </Card>
                )
              })}

              {childCollections.map((c) => {
                const total = c.words.length
                const saved = progressById[c.id]
                const opened = Boolean(saved)
                const at = saved ? Math.min(saved.index, Math.max(0, total - 1)) : 0
                const position = opened ? at + 1 : 0
                const progressPct = total > 0 ? (position / total) * 100 : 0
                const whenLabel = saved?.updatedAt
                  ? formatLastRepetition(saved.updatedAt)
                  : "Never opened"

                return (
                  <Card key={c.id} className="transition-colors hover:border-primary/50">
                    <div className="flex items-start gap-2 p-4">
                      <Link to={`/study/${c.id}`} className="min-w-0 flex-1">
                        <CardTitle className="text-base">{c.name}</CardTitle>
                        {c.description ? (
                          <CardDescription className="mt-0.5 line-clamp-2">
                            {c.description}
                          </CardDescription>
                        ) : null}
                        <span className="mt-1.5 inline-flex rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          {pairLabel(c.wordLang, c.translationLang)}
                        </span>
                        {total > 0 ? (
                          <div className="mt-2.5">
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span className="tabular-nums">
                                {position} of {total}
                              </span>
                              <span>{whenLabel}</span>
                            </div>
                            <Progress value={progressPct} className="h-1.5" />
                          </div>
                        ) : null}
                      </Link>
                      <OverflowMenu
                        label={`Actions for ${c.name}`}
                        items={toOverflowMenuItems([
                          titleAction.edit(() => navigate(`/edit/${c.id}`)),
                          titleAction.move(() =>
                            setMoveTarget({
                              kind: "collection",
                              id: c.id,
                              name: c.name,
                              folderId: c.folderId ?? null,
                            }),
                          ),
                          titleAction.export(() => onExport(c)),
                          titleAction.delete(() => onDeleteSet(c.id, c.name)),
                        ])}
                      />
                    </div>
                  </Card>
                )
              })}
            </>
          )}

          {childFolders.length === 0 && childCollections.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {currentFolder
                ? "This folder is empty. Create a set or another folder."
                : "No sets yet. Create a set or a folder to get started."}
            </p>
          ) : null}

          {reorderMode ? null : (
            <div className="flex h-14 w-full overflow-hidden rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground">
              <button
                type="button"
                onClick={goNewSet}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
              >
                <Plus className="h-4 w-4 shrink-0" />
                New set
              </button>
              <div className="w-px self-stretch bg-border" aria-hidden />
              <button
                type="button"
                onClick={openCreateFolder}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 transition-colors hover:border-primary/40 hover:bg-secondary hover:text-foreground"
              >
                <FolderPlus className="h-4 w-4 shrink-0" />
                New folder
              </button>
            </div>
          )}
        </div>
      </PageBody>
      </AppShell>

      {reorderMode ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-background/90 backdrop-blur-md">
          <div className="mx-auto max-w-2xl px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              key="save-order"
              type="button"
              size="lg"
              className="w-full"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                finishReorderMode()
              }}
            >
              Save order
            </Button>
          </div>
        </div>
      ) : null}

      <SearchSheet
        open={searchOpen}
        collections={collections}
        folders={folders}
        onClose={() => setSearchOpen(false)}
      />

      <CreateItemSheet
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onNewSet={goNewSet}
        onNewFolder={openCreateFolder}
        onMoveHere={openMoveHere}
      />

      <MoveHereSheet
        open={moveHereOpen}
        destinationFolderId={currentFolderId}
        folders={folders}
        collections={collections}
        onCancel={() => setMoveHereOpen(false)}
        onSelect={(item) => {
          if (item.kind === "collection") {
            moveCollection(item.id, currentFolderId)
          } else {
            moveFolder(item.id, currentFolderId)
          }
          setMoveHereOpen(false)
        }}
      />

      <NameFolderSheet
        open={nameFolderOpen}
        title="New folder"
        confirmLabel="Create folder"
        onCancel={() => setNameFolderOpen(false)}
        onConfirm={(name) => {
          const created = addFolder(name, currentFolderId)
          setNameFolderOpen(false)
          navigate(`/folder/${created.id}`)
        }}
      />

      <NameFolderSheet
        open={renameTarget != null}
        title="Rename folder"
        initialName={renameTarget?.name ?? ""}
        confirmLabel="Save"
        onCancel={() => setRenameTarget(null)}
        onConfirm={(name) => {
          if (renameTarget) renameFolder(renameTarget.id, name)
          setRenameTarget(null)
        }}
      />

      <MoveToFolderSheet
        open={moveTarget != null}
        title={moveTarget ? `Move “${moveTarget.name}”` : "Move"}
        folders={folders}
        currentFolderId={
          moveTarget?.kind === "collection"
            ? moveTarget.folderId
            : moveTarget?.kind === "folder"
              ? moveTarget.parentId
              : null
        }
        disabledFolderIds={moveDisabledIds}
        onCancel={() => setMoveTarget(null)}
        onSelect={(folderId) => {
          if (!moveTarget) return
          if (moveTarget.kind === "collection") {
            moveCollection(moveTarget.id, folderId)
          } else {
            moveFolder(moveTarget.id, folderId)
          }
          setMoveTarget(null)
        }}
      />
    </>
  )
}
