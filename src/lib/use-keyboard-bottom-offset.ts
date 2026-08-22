import { useEffect, useState } from "react"

/**
 * Returns the keyboard height when using overlay keyboard mode
 * (interactive-widget=resizes-visual). This allows fixed bottom elements
 * to stay visible above the keyboard. The keyboard overlays the content,
 * and the browser scrolls focused inputs into view automatically.
 */
export function useKeyboardBottomOffset() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function updateOffset() {
      // Calculate keyboard height: difference between layout and visual viewport
      // When keyboard is open, visual viewport is smaller
      const keyboardHeight = Math.max(
        0,
        window.innerHeight - (vv!.height + vv!.offsetTop)
      )
      
      // Only apply offset if it's significant (avoid tiny fluctuations)
      setOffset(keyboardHeight > 10 ? keyboardHeight : 0)
    }

    // Update immediately
    updateOffset()

    // Listen to visual viewport changes (keyboard open/close, orientation)
    vv.addEventListener("resize", updateOffset)
    vv.addEventListener("scroll", updateOffset)

    return () => {
      vv.removeEventListener("resize", updateOffset)
      vv.removeEventListener("scroll", updateOffset)
    }
  }, [])

  return offset
}
