import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Toolbar / title-bar icon control. Always muted gray outside menus so search,
 * sort, create, overflow ⋮, etc. share one look. Menu item colors live on the
 * menu rows themselves (foreground, destructive).
 */
const IconButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, type = "button", ...props }, ref) => {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4",
        className,
      )}
      {...props}
    />
  )
})
IconButton.displayName = "IconButton"

export { IconButton }
