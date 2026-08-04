import type { ReactNode } from "react"
import {
  ArrowUpDown,
  ClipboardPaste,
  Download,
  FolderInput,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { OverflowMenu } from "@/components/OverflowMenu"
import { IconButton } from "@/components/ui/icon-button"
import { cn } from "@/lib/utils"

/**
 * Soft default order for title actions (lower = earlier). Callers may pass
 * actions in any order; use {@link sortTitleActions} only when you want this.
 * Delete / clear stay last among known kinds.
 */
export const TITLE_ACTION_ORDER: Record<string, number> = {
  sort: 10,
  search: 20,
  create: 30,
  createFolder: 35,
  reorder: 40,
  paste: 45,
  edit: 50,
  rename: 60,
  move: 70,
  export: 80,
  clear: 100,
  delete: 110,
}

export interface TitleAction {
  /** Stable id for soft ordering / keys. Prefer preset ids when applicable. */
  id: string
  label: string
  icon: ReactNode
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  /**
   * Custom control (e.g. SortMenu). Counts as one visible slot; not placed in
   * the overflow menu.
   */
  control?: ReactNode
}

/** ≤3 → all visible. ≥4 → first 2 visible, rest in ⋮ overflow. */
function splitTitleActions(actions: TitleAction[]) {
  if (actions.length <= 3) {
    return { visible: actions, overflow: [] as TitleAction[] }
  }
  return {
    visible: actions.slice(0, 2),
    overflow: actions.slice(2),
  }
}

/** Soft sort by {@link TITLE_ACTION_ORDER}; unknown ids keep relative order at the end. */
export function sortTitleActions(actions: TitleAction[]): TitleAction[] {
  return actions
    .map((action, index) => ({ action, index }))
    .sort((a, b) => {
      const ao = TITLE_ACTION_ORDER[a.action.id] ?? 1000 + a.index
      const bo = TITLE_ACTION_ORDER[b.action.id] ?? 1000 + b.index
      return ao - bo || a.index - b.index
    })
    .map(({ action }) => action)
}

function TitleActionButton({ action }: { action: TitleAction }) {
  if (action.control) return <>{action.control}</>

  // Outside the overflow menu every icon stays muted gray — even clear/delete.
  // Destructive red is reserved for overflow (and other) menu rows.
  return (
    <IconButton
      aria-label={action.label}
      disabled={action.disabled}
      onClick={action.onSelect}
    >
      {action.icon}
    </IconButton>
  )
}

/**
 * Unified action cluster for the right side of PageTitle.
 * Preserves caller order. Visibility: up to 3 icon buttons; with 4+, shows 2
 * and puts the rest in a ⋮ menu.
 */
export function TitleActions({
  actions,
  menuLabel = "More actions",
  className,
}: {
  actions: TitleAction[]
  menuLabel?: string
  className?: string
}) {
  if (actions.length === 0) return null

  const { visible, overflow } = splitTitleActions(actions)

  return (
    <div className={cn("flex shrink-0 items-center gap-1", className)}>
      {visible.map((action) => (
        <TitleActionButton key={action.id} action={action} />
      ))}
      {overflow.length > 0 ? (
        <OverflowMenu
          label={menuLabel}
          items={overflow.map((action) => ({
            label: action.label,
            icon: action.icon,
            destructive: action.destructive,
            onSelect: action.onSelect,
          }))}
        />
      ) : null}
    </div>
  )
}

/** Map title actions into OverflowMenu items (same labels/icons/destructive). */
export function toOverflowMenuItems(actions: TitleAction[]) {
  return actions.map((action) => ({
    label: action.label,
    icon: action.icon,
    destructive: action.destructive,
    onSelect: action.onSelect,
  }))
}

/** Hard-rule presets: same label, icon, and destructive styling everywhere. */
export const titleAction = {
  sort: (control: ReactNode): TitleAction => ({
    id: "sort",
    label: "Sort",
    icon: <ArrowUpDown />,
    onSelect: () => undefined,
    control,
  }),
  search: (onSelect: () => void): TitleAction => ({
    id: "search",
    label: "Search",
    icon: <Search />,
    onSelect,
  }),
  create: (onSelect: () => void, label = "Create"): TitleAction => ({
    id: "create",
    label,
    icon: <Plus />,
    onSelect,
  }),
  createFolder: (onSelect: () => void): TitleAction => ({
    id: "createFolder",
    label: "New folder",
    icon: <FolderPlus />,
    onSelect,
  }),
  paste: (onSelect: () => void): TitleAction => ({
    id: "paste",
    label: "Paste from clipboard",
    icon: <ClipboardPaste />,
    onSelect,
  }),
  edit: (onSelect: () => void): TitleAction => ({
    id: "edit",
    label: "Edit",
    icon: <Pencil />,
    onSelect,
  }),
  rename: (onSelect: () => void): TitleAction => ({
    id: "rename",
    label: "Rename",
    icon: <Pencil />,
    onSelect,
  }),
  move: (onSelect: () => void): TitleAction => ({
    id: "move",
    label: "Move to…",
    icon: <FolderInput />,
    onSelect,
  }),
  export: (onSelect: () => void): TitleAction => ({
    id: "export",
    label: "Export",
    icon: <Download />,
    onSelect,
  }),
  reorder: (onSelect: () => void): TitleAction => ({
    id: "reorder",
    label: "Reorder",
    icon: <ArrowUpDown />,
    onSelect,
  }),
  clear: (onSelect: () => void, opts?: { disabled?: boolean; label?: string }): TitleAction => ({
    id: "clear",
    label: opts?.label ?? "Clear",
    icon: <Trash2 />,
    destructive: true,
    disabled: opts?.disabled,
    onSelect,
  }),
  delete: (onSelect: () => void): TitleAction => ({
    id: "delete",
    label: "Delete",
    icon: <Trash2 />,
    destructive: true,
    onSelect,
  }),
}
