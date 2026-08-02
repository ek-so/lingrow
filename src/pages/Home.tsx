import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useCollections } from "@/lib/collections-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OverflowMenu } from "@/components/OverflowMenu"
import { CreateItemSheet } from "@/components/CreateItemSheet"
import { MoveHereSheet } from "@/components/MoveHereSheet"
import { MoveToFolderSheet } from "@/components/MoveToFolderSheet"
import { NameFolderSheet } from "@/components/NameFolderSheet"
import { SearchSheet } from "@/components/SearchSheet"
import { SortableItem, SortableList } from "@/components/SortableList"
import { AppHeader } from "@/components/AppHeader"
import { AppShell } from "@/components/AppShell"
import { PageBody, PageTitle } from "@/components/PageTitle"
import { downloadCollectionExcel } from "@/lib/export-collection"
import { countItemsInFolder, descendantFolderIds, folderTrailUp } from "@/lib/folders"
import { pairLabel } from "@/lib/languages"
import { recordRecentOpen } from "@/lib/recent"
import {
  Folder as FolderIcon,
  FolderInput,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  Download,
  UserRound,
} from "lucide-react"
import type { Collection, Folder } from "@/types"

type MoveTarget =
  | { kind: "collection"; id: string; name: string; folderId: string | null }
  | { kind: "folder"; id: string; name: string; parentId: string | null }

export default function Home() {
  const navigate = useNavigate()
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

  useEffect(() => {
    if (currentFolderId && currentFolder) {
      recordRecentOpen("folder", currentFolderId)
    }
    // Record once per folder id when the folder exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId])

  const childFolders = useMemo(
    () => folders.filter((f) => f.parentId === currentFolderId),
    [folders, currentFolderId],
  )

  const childCollections = useMemo(
    () => collections.filter((c) => (c.folderId ?? null) === currentFolderId),
    [collections, currentFolderId],
  )

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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Search"
      onClick={() => setSearchOpen(true)}
    >
      <Search className="h-4 w-4" />
    </Button>
  )

  const createButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Create"
      onClick={() => setCreateOpen(true)}
    >
      <Plus className="h-4 w-4" />
    </Button>
  )

  const profileButton = (
    <button
      type="button"
      aria-label="Profile"
      onClick={() => navigate("/profile")}
      className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {user?.picture && status === "signed_in" ? (
        <img
          src={user.picture}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <UserRound className="h-5 w-5" />
      )}
    </button>
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
      actions={
        <>
          {searchButton}
          {createButton}
          <OverflowMenu
            label={`Actions for ${currentFolder.name}`}
            items={[
              {
                label: "Rename",
                icon: <Pencil />,
                onSelect: () => setRenameTarget(currentFolder),
              },
              {
                label: "Move to…",
                icon: <FolderInput />,
                onSelect: () =>
                  setMoveTarget({
                    kind: "folder",
                    id: currentFolder.id,
                    name: currentFolder.name,
                    parentId: currentFolder.parentId,
                  }),
              },
              {
                label: "Delete",
                icon: <Trash2 />,
                destructive: true,
                onSelect: () => onDeleteFolder(currentFolder),
              },
            ]}
          />
        </>
      }
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
        <PageTitle
          className="mb-6"
          actions={
            currentFolder ? undefined : (
              createButton
            )
          }
        >
          {currentFolder ? currentFolder.name : "My sets"}
        </PageTitle>

        <div className="flex flex-col gap-3">
          {childFolders.length > 0 ? (
            <SortableList
              ids={childFolders.map((f) => f.id)}
              onReorder={(orderedIds) => reorderFolders(currentFolderId, orderedIds)}
              className="flex flex-col gap-3"
            >
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
                  <SortableItem
                    key={folder.id}
                    id={folder.id}
                    handleLabel={`Reorder folder ${folder.name}`}
                  >
                    {(dragHandle) => (
                      <Card className="transition-colors hover:border-primary/50">
                        <CardHeader>
                          <div className="flex items-start gap-1">
                            {dragHandle}
                            <Link to={`/folder/${folder.id}`} className="min-w-0 flex-1 pt-2">
                              <CardTitle className="flex items-center gap-2">
                                <FolderIcon className="h-5 w-5 shrink-0 text-primary" />
                                <span className="truncate">{folder.name}</span>
                              </CardTitle>
                              <CardDescription className="mt-1">{itemLabel}</CardDescription>
                            </Link>
                            <OverflowMenu
                              label={`Actions for ${folder.name}`}
                              items={[
                                {
                                  label: "Rename",
                                  icon: <Pencil />,
                                  onSelect: () => setRenameTarget(folder),
                                },
                                {
                                  label: "Move to…",
                                  icon: <FolderInput />,
                                  onSelect: () =>
                                    setMoveTarget({
                                      kind: "folder",
                                      id: folder.id,
                                      name: folder.name,
                                      parentId: folder.parentId,
                                    }),
                                },
                                {
                                  label: "Delete",
                                  icon: <Trash2 />,
                                  destructive: true,
                                  onSelect: () => onDeleteFolder(folder),
                                },
                              ]}
                            />
                          </div>
                        </CardHeader>
                      </Card>
                    )}
                  </SortableItem>
                )
              })}
            </SortableList>
          ) : null}

          {childCollections.length > 0 ? (
            <SortableList
              ids={childCollections.map((c) => c.id)}
              onReorder={(orderedIds) => reorderCollections(currentFolderId, orderedIds)}
              className="flex flex-col gap-3"
            >
              {childCollections.map((c) => (
                <SortableItem key={c.id} id={c.id} handleLabel={`Reorder set ${c.name}`}>
                  {(dragHandle) => (
                    <Card className="transition-colors hover:border-primary/50">
                      <CardHeader>
                        <div className="flex items-start gap-1">
                          {dragHandle}
                          <Link to={`/study/${c.id}`} className="min-w-0 flex-1 pt-2">
                            <CardTitle>{c.name}</CardTitle>
                            {c.description ? (
                              <CardDescription className="mt-1">{c.description}</CardDescription>
                            ) : null}
                          </Link>
                          <OverflowMenu
                            label={`Actions for ${c.name}`}
                            items={[
                              {
                                label: "Edit",
                                icon: <Pencil />,
                                onSelect: () => navigate(`/edit/${c.id}`),
                              },
                              {
                                label: "Move to…",
                                icon: <FolderInput />,
                                onSelect: () =>
                                  setMoveTarget({
                                    kind: "collection",
                                    id: c.id,
                                    name: c.name,
                                    folderId: c.folderId ?? null,
                                  }),
                              },
                              {
                                label: "Export",
                                icon: <Download />,
                                onSelect: () => onExport(c),
                              },
                              {
                                label: "Delete",
                                icon: <Trash2 />,
                                destructive: true,
                                onSelect: () => onDeleteSet(c.id, c.name),
                              },
                            ]}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Link
                          to={`/study/${c.id}`}
                          className="flex flex-wrap gap-2 text-xs text-muted-foreground"
                        >
                          <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground font-medium">
                            {pairLabel(c.wordLang, c.translationLang)}
                          </span>
                          {c.level && (
                            <span className="rounded-full bg-secondary px-2.5 py-1 font-medium">
                              {c.level}
                            </span>
                          )}
                          {c.theme && (
                            <span className="rounded-full bg-secondary px-2.5 py-1">{c.theme}</span>
                          )}
                          <span className="rounded-full bg-secondary px-2.5 py-1">
                            {c.words.length} words
                          </span>
                        </Link>
                      </CardContent>
                    </Card>
                  )}
                </SortableItem>
              ))}
            </SortableList>
          ) : null}

          {childFolders.length === 0 && childCollections.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {currentFolder
                ? "This folder is empty. Create a set or another folder."
                : "No sets yet. Create a set or a folder to get started."}
            </p>
          ) : null}

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
        </div>
      </PageBody>
      </AppShell>

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
