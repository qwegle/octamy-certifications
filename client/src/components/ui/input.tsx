import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 min-h-control w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-base text-foreground shadow-surface ring-offset-background transition-[border-color,box-shadow,background-color] duration-180 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 read-only:bg-muted/50 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 sm:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }