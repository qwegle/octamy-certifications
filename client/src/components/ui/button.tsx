import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-slate-950 bg-slate-950 text-white shadow-sm hover:bg-slate-800",
        destructive:
          "border border-rose-700 bg-rose-700 text-white shadow-sm hover:bg-rose-800",
        outline:
          "border border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400 hover:bg-slate-50",
        secondary:
          "border border-slate-200 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-xl",
        link: "text-primary underline-offset-4 hover:underline",
        neo: "bg-card text-foreground border-2 border-foreground shadow-[4px_4px_0_0_hsl(0,0%,6%)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_hsl(0,0%,6%)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[0_0_0_0_hsl(0,0%,6%)] rounded-2xl",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-10 px-4",
        lg: "h-12 px-8 text-base",
        icon: "h-11 w-11",
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
