import * as React from "react"
import { AlertTriangle } from "lucide-react"

import { cn } from "@/lib/utils"

type ErrorStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      title = "Something went wrong",
      description = "Please try again. If the problem continues, contact support.",
      action,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      role="alert"
      className={cn(
        "flex min-h-48 w-full flex-col items-center justify-center rounded-xl border border-red-300 bg-red-50 p-6 text-center text-red-950 shadow-surface dark:border-red-900 dark:bg-red-950/40 dark:text-red-100 sm:p-8",
        className
      )}
      {...props}
    >
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-200">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm leading-6 opacity-85">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
)
ErrorState.displayName = "ErrorState"

export { ErrorState, type ErrorStateProps }
