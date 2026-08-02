import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

function setDraggingUserSelect(dragging: boolean) {
  const value = dragging ? "none" : ""
  document.body.style.userSelect = value
  document.body.style.webkitUserSelect = value
}

export function SortableList({
  ids,
  onReorder,
  children,
  className,
}: {
  ids: UniqueIdentifier[]
  onReorder: (orderedIds: string[]) => void
  children: ReactNode
  className?: string
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Allow taps/clicks on links and inputs; only start after a short drag.
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragStart(_event: DragStartEvent) {
    setDraggingUserSelect(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingUserSelect(false)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id)
    const newIndex = ids.indexOf(over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(ids, oldIndex, newIndex).map(String))
  }

  function handleDragCancel() {
    setDraggingUserSelect(false)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  )
}

export function SortableItem({
  id,
  children,
  className,
  handleClassName,
  handleLabel = "Drag to reorder",
}: {
  id: UniqueIdentifier
  children: ReactNode
  className?: string
  handleClassName?: string
  handleLabel?: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: "relative",
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-1",
        isDragging && "opacity-90 shadow-md",
        className,
      )}
    >
      <button
        type="button"
        aria-label={handleLabel}
        className={cn(
          "mt-3 inline-flex h-10 w-8 shrink-0 cursor-grab touch-none select-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing",
          handleClassName,
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
