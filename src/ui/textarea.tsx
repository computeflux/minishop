import * as React from "react"

import { cn } from "@/shared/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          "min-h-24 w-full rounded-none border border-white/15 bg-transparent px-3.5 py-2.5 text-sm text-white transition-colors outline-none placeholder:text-white/25",
          "focus-visible:border-white/50 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
