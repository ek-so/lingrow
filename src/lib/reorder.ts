/**
 * Reorder items that share a parent/folder by applying `orderedIds` into the
 * existing sibling slots in `items`, leaving non-siblings untouched.
 */
export function reorderSiblingsByIds<T extends { id: string }>(
  items: T[],
  orderedIds: string[],
): T[] {
  if (orderedIds.length <= 1) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const siblingIds = new Set(orderedIds)
  if (orderedIds.some((id) => !byId.has(id))) return items

  const queue = [...orderedIds]
  return items.map((item) => {
    if (!siblingIds.has(item.id)) return item
    const nextId = queue.shift()
    return nextId ? (byId.get(nextId) ?? item) : item
  })
}
