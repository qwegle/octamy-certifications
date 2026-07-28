import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-control items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-[color,background-color,border-color,box-shadow,transform] duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:pointer-events-none disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-55 aria-[busy=true]:cursor-wait aria-[busy=true]:opacity-75 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-primary bg-primary text-primary-foreground shadow-surface hover:bg-foreground/90 hover:shadow-raised",
        destructive:
          "border border-destructive bg-destructive text-destructive-foreground shadow-surface hover:brightness-90",
        outline:
          "border border-input bg-card text-foreground shadow-surface hover:border-foreground/30 hover:bg-accent",
        secondary:
          "border border-border bg-secondary text-secondary-foreground shadow-surface hover:bg-accent",
        ghost: "border border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "min-h-0 rounded-none text-primary underline-offset-4 shadow-none hover:underline",
        neo: "bg-card text-foreground border-2 border-foreground shadow-[4px_4px_0_0_hsl(0,0%,6%)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_hsl(0,0%,6%)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0_0_0_0_hsl(0,0%,6%)] rounded-xl",
        success: "border border-emerald-700 bg-emerald-700 text-white shadow-surface hover:bg-emerald-800",
        subtle: "border border-transparent bg-muted text-foreground hover:bg-accent",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-11 px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
