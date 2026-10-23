import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        /* Legacy alias — gradients are retired; renders as the solid primary. */
        gradient: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary",
        /* Legacy alias — frosted pill retired; renders as the quiet secondary. */
        glass: "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost: "hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
      },
      size: {
        sm: "h-9 px-4 text-[13px]",
        default: "h-11 px-6 text-[15px] [&_svg]:size-4",
        lg: "h-12 px-7 text-[16px] [&_svg]:size-[18px]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
