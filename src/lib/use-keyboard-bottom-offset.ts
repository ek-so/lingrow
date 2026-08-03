import { useEffect, useState } from "react"

/**
 * Distance from the layout viewport bottom to the visual viewport bottom —
 * typically the soft-keyboard height on mobile. Use to lift fixed footers.
 */
export function useKeyboardBottomOffset() {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function sync() {
      const inset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop)
      setOffset(inset)
    }

    sync()
    vv.addEventListener("resize", sync)
    vv.addEventListener("scroll", sync)
    return () => {
      vv.removeEventListener("resize", sync)
      vv.removeEventListener("scroll", sync)
    }
  }, [])

  return offset
}
