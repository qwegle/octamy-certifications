import * as React from "react"
import { Inbox } from "lucide-react"

import { cn } from "@/lib/utils"

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/35 p-6 text-center sm:p-8",
        className
      )}
      {...props}
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-surface [&_svg]:h-5 [&_svg]:w-5">
        {icon ?? <Inbox aria-hidden="true" />}
      </span>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
)
EmptyState.displayName = "EmptyState"

export { EmptyState, type EmptyStateProps }
