import { useEffect, useRef, useState } from "react"

/**
 * Distance from the layout viewport bottom to the visual viewport bottom —
 * typically the soft-keyboard height on mobile. Use to lift fixed footers.
 */
export function useKeyboardBottomOffset() {
  const [offset, setOffset] = useState(0)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function sync() {
      const inset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop)
      
      // Clear any pending timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // If keyboard is closing (inset is very small), add a small delay to ensure smooth transition
      if (inset < 10) {
        timeoutRef.current = window.setTimeout(() => {
          setOffset(0)
        }, 100)
      } else {
        setOffset(inset)
      }
    }

    function handleFocusOut() {
      // When input loses focus, wait a moment and check if another input gained focus
      // If not, the keyboard is likely closing
      timeoutRef.current = window.setTimeout(() => {
        const activeEl = document.activeElement
        const isInput = activeEl?.tagName === "INPUT" || 
                       activeEl?.tagName === "TEXTAREA" ||
                       activeEl?.hasAttribute("contenteditable")
        if (!isInput) {
          setOffset(0)
        }
      }, 150)
    }

    sync()
    vv.addEventListener("resize", sync)
    vv.addEventListener("scroll", sync)
    
    // Also listen to window resize as a fallback
    window.addEventListener("resize", sync)
    
    // Listen for focus changes to detect keyboard closing
    document.addEventListener("focusout", handleFocusOut)
    
    return () => {
      vv.removeEventListener("resize", sync)
      vv.removeEventListener("scroll", sync)
      window.removeEventListener("resize", sync)
      document.removeEventListener("focusout", handleFocusOut)
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return offset
}
