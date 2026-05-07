import { ChevronDown, LayoutDashboard } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { workspaceViewModeOptions } from "@/lib/workspace-preferences";
import { cn } from "@/lib/utils";
import type { WorkspaceViewMode } from "@/types";

export function WorkspaceModeSwitcher({
  className,
  currentMode,
  onChangeMode,
}: {
  className?: string;
  currentMode: WorkspaceViewMode;
  onChangeMode: (mode: WorkspaceViewMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeOption = workspaceViewModeOptions.find((option) => option.id === currentMode) ?? workspaceViewModeOptions[0];
  const closeMenu = () => {
    setOpen(false);
    focusTriggerAfterFrame(triggerRef.current);
  };
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  };

  return (
    <div className={cn("workspace-mode-switcher", className)}>
      <Button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Workspace mode ${activeOption.name}`}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        size="sm"
        type="button"
        variant="outline"
      >
        <LayoutDashboard className="size-4" />
        <span>{activeOption.name}</span>
        <ChevronDown className="size-4" />
      </Button>
      {open ? (
        <div
          className="workspace-mode-switcher__menu"
          onKeyDown={handleMenuKeyDown}
          role="menu"
          aria-label="Workspace mode choices"
        >
          {workspaceViewModeOptions.map((option) => (
            <button
              aria-current={option.id === currentMode ? "true" : undefined}
              aria-label={`Switch workspace mode to ${option.name}`}
              className="workspace-mode-switcher__item"
              data-workspace-view-option={option.id}
              key={option.id}
              onClick={() => {
                onChangeMode(option.id);
                closeMenu();
              }}
              role="menuitem"
              type="button"
            >
              <span>{option.name}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function focusTriggerAfterFrame(trigger: HTMLButtonElement | null) {
  if (typeof window === "undefined" || !trigger) {
    return;
  }

  const focus = () => trigger.focus();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focus);
    return;
  }

  window.setTimeout(focus, 0);
}
