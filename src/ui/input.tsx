import * as React from "react"

import { cn } from "@/shared/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
          "h-10 w-full min-w-0 rounded-none border border-white/15 bg-transparent px-3.5 text-sm text-white transition-colors outline-none selection:bg-white selection:text-black",
          "placeholder:text-white/25",
          "focus-visible:border-white/50",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "[color-scheme:dark]",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
