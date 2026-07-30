import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 text-sm shadow-surface [&>svg~*]:pl-8 [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-[1.125rem] [&>svg]:size-4",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-foreground [&>svg]:text-foreground",
        destructive:
          "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100 [&>svg]:text-red-700 dark:[&>svg]:text-red-300",
        success:
          "border-slate-300 bg-slate-50 text-slate-950 dark:border-slate-900 dark:bg-slate-950/40 dark:text-slate-100 [&>svg]:text-slate-700 dark:[&>svg]:text-slate-300",
        warning:
          "border-slate-300 bg-slate-50 text-slate-950 dark:border-slate-900 dark:bg-slate-950/40 dark:text-slate-100 [&>svg]:text-slate-700 dark:[&>svg]:text-slate-300",
        info:
          "border-slate-300 bg-slate-50 text-slate-950 dark:border-slate-900 dark:bg-slate-950/40 dark:text-slate-100 [&>svg]:text-slate-700 dark:[&>svg]:text-slate-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
