import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-9 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20",
        className,
      )}
    >
      <span className="absolute inset-x-2 top-2 h-px bg-primary-foreground/45" />
      <span className="absolute inset-y-2 left-2 w-px bg-primary-foreground/16" />
      <BookOpen className="relative size-4" data-icon="inline-start" />
    </span>
  );
}
