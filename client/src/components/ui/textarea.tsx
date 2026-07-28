import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-24 w-full resize-y rounded-lg border border-input bg-card px-3.5 py-3 text-base text-foreground shadow-surface ring-offset-background transition-[border-color,box-shadow,background-color] duration-180 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:bg-muted/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 sm:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }