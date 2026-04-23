import { ButtonHTMLAttributes, ReactElement, cloneElement, forwardRef } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:-translate-y-px hover:bg-primary/92 hover:shadow-md hover:shadow-primary/20",
  secondary:
    "bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-px hover:bg-secondary/88",
  outline:
    "border border-border/80 bg-background/92 shadow-sm hover:-translate-y-px hover:bg-secondary/80",
  ghost: "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
  icon: "size-10 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild, children, className, variant = "default", size = "md", ...props }, ref) => {
    const classes = cn(
        "ui-button-motion inline-flex items-center justify-center gap-2 rounded-lg font-medium transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      );

    if (asChild && children && typeof children === "object") {
      return cloneElement(children as ReactElement<{ className?: string }>, {
        className: cn((children as ReactElement<{ className?: string }>).props.className, classes),
      });
    }

    return <button ref={ref} className={classes} {...props}>{children}</button>;
  },
);

Button.displayName = "Button";
