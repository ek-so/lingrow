import { useCallback, useEffect, useRef, useState } from "react"
import { useBlocker, useNavigate } from "react-router-dom"

export interface UnsavedChangesGuard {
  leaveOpen: boolean
  /** Navigate to `to`, prompting when dirty. */
  requestLeave: (to: string) => void
  /** Call before a successful save that will navigate away. */
  allowNextNavigation: () => void
  cancelLeave: () => void
  discardAndLeave: () => void
  saveAndLeave: () => void
}

/**
 * Shared leave-guard: in-app navigation (back link, router) + tab close.
 * When dirty and the user tries to leave without saving, opens the confirm sheet.
 */
export function useUnsavedChangesGuard(options: {
  dirty: boolean
  /** Attempt to save; return true if leave/navigation may proceed. */
  onSave: () => boolean
  onDiscard?: () => void
  /** Path prefixes that skip the prompt (e.g. import bridge). */
  allowPathPrefixes?: string[]
}): UnsavedChangesGuard {
  const { dirty, onSave, onDiscard, allowPathPrefixes = [] } = options
  const navigate = useNavigate()
  const [leaveOpen, setLeaveOpen] = useState(false)
  const allowNavRef = useRef(false)
  const onSaveRef = useRef(onSave)
  const onDiscardRef = useRef(onDiscard)
  onSaveRef.current = onSave
  onDiscardRef.current = onDiscard

  const blocker = useBlocker(({ nextLocation }) => {
    if (allowNavRef.current) return false
    if (!dirty) return false
    if (allowPathPrefixes.some((prefix) => nextLocation.pathname.startsWith(prefix))) {
      return false
    }
    return true
  })

  useEffect(() => {
    if (blocker.state !== "blocked") return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
    setLeaveOpen(true)
  }, [blocker.state])

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty || allowNavRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  const allowNextNavigation = useCallback(() => {
    allowNavRef.current = true
  }, [])

  const requestLeave = useCallback(
    (to: string) => {
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
      if (!dirty) {
        allowNavRef.current = true
        navigate(to)
        return
      }
      // Triggers the blocker → confirm sheet.
      navigate(to)
    },
    [dirty, navigate],
  )

  const cancelLeave = useCallback(() => {
    setLeaveOpen(false)
    if (blocker.state === "blocked") blocker.reset()
  }, [blocker])

  const discardAndLeave = useCallback(() => {
    onDiscardRef.current?.()
    setLeaveOpen(false)
    allowNavRef.current = true
    if (blocker.state === "blocked") {
      blocker.proceed()
    }
  }, [blocker])

  const saveAndLeave = useCallback(() => {
    setLeaveOpen(false)
    if (blocker.state === "blocked") blocker.reset()
    const ok = onSaveRef.current()
    if (!ok) {
      allowNavRef.current = false
    }
  }, [blocker])

  return {
    leaveOpen,
    requestLeave,
    allowNextNavigation,
    cancelLeave,
    discardAndLeave,
    saveAndLeave,
  }
}
