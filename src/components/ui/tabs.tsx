import { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("inline-flex rounded-lg border border-border/80 bg-secondary/85 p-1 shadow-sm", className)}
      {...props}
    />
  );
}

type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function TabsTrigger({ className, active, ...props }: TabButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition duration-200 hover:text-foreground",
        active && "bg-background text-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
