import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspacePanel({
  actions,
  children,
  className,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "workspace-panel group flex h-full min-h-0 w-full flex-col overflow-hidden border border-border/80 bg-card/94 shadow-soft backdrop-blur transition duration-200",
        className,
      )}
      {...props}
    >
      <header
        className="workspace-panel__header flex items-start justify-between gap-3 border-b border-border/60 px-4 py-2.5"
        data-window-drag-handle="true"
      >
        <div className="workspace-panel__heading">
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {description ? (
            <p className="workspace-panel__description mt-0.5 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="workspace-panel__actions flex items-center gap-1 opacity-90 transition">
            {actions}
          </div>
        ) : null}
      </header>
      <div className="workspace-panel__body min-h-0 flex-1 overflow-auto bg-gradient-to-b from-background/25 to-transparent p-3.5">
        {children}
      </div>
    </section>
  );
}
