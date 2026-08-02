import { useEffect } from "react"

/**
 * Keep the screen awake while `active` is true (Screen Wake Lock API).
 * No-ops when unsupported or when the browser denies the request.
 * Re-acquires after the tab becomes visible again (browsers release on hide).
 *
 * Lock-screen pronunciation does not depend on this — see `speech-audio.ts`.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    if (!("wakeLock" in navigator)) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      if (cancelled || document.visibilityState !== "visible") return
      try {
        // Release any prior sentinel before requesting a new one.
        await lock?.release().catch(() => undefined)
        if (cancelled) return
        lock = await navigator.wakeLock.request("screen")
      } catch {
        // Denied, low power mode, or transient failure — pronunciation still works while unlocked.
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void acquire()
      }
    }

    void acquire()
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibility)
      void lock?.release().catch(() => undefined)
      lock = null
    }
  }, [active])
}
