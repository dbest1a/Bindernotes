import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getEmbeddableWhiteboardModules,
  type WhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";

type WhiteboardModuleLauncherProps = {
  onAddModule: (definition: WhiteboardModuleDefinition) => void;
  onClose?: () => void;
  placement?: "floating" | "panel" | "drawer";
};

export function WhiteboardModuleLauncher({ onAddModule, onClose, placement = "floating" }: WhiteboardModuleLauncherProps) {
  const [open, setOpen] = useState(false);
  const modules = getEmbeddableWhiteboardModules();
  const panelMode = placement === "panel";
  const drawerMode = placement === "drawer";
  const moduleGroups = [
    {
      label: "Core",
      modules: modules.filter((module) => module.moduleId === "lesson" || module.moduleId === "related-concepts"),
    },
    {
      label: "Math",
      modules: modules.filter(
        (module) =>
          module.moduleId === "formula-sheet" ||
          module.moduleId === "math-blocks" ||
          module.moduleId === "scientific-calculator",
      ),
    },
    {
      label: "Graphing",
      modules: modules.filter((module) => module.moduleId === "desmos-graph" || module.moduleId === "saved-graphs"),
    },
    {
      label: "Notes",
      modules: modules.filter(
        (module) =>
          module.moduleId === "private-notes" ||
          module.moduleId === "comments" ||
          module.moduleId === "recent-highlights",
      ),
    },
  ].filter((group) => group.modules.length > 0);

  const moduleButtons = (
    <div className="mt-3 grid max-h-[min(390px,calc(100svh-15rem))] gap-3 overflow-auto pr-1">
      {moduleGroups.map((group) => (
        <section className="grid gap-2" key={group.label}>
          <p className="whiteboard-toolbox-panel__muted text-[10px] font-semibold uppercase tracking-[0.18em]">
            {group.label}
          </p>
          {group.modules.map((module) => (
            <button
              className="whiteboard-toolbox-card rounded-md border p-3 text-left transition"
              key={module.moduleId}
              onClick={() => {
                onAddModule(module);
                setOpen(false);
                if (drawerMode) {
                  onClose?.();
                }
              }}
              type="button"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{module.label}</span>
                {module.heavy ? (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-secondary-foreground">
                    live
                  </span>
                ) : null}
              </span>
              <span className="whiteboard-toolbox-panel__muted mt-1 block text-xs leading-5">{module.description}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );

  if (drawerMode) {
    return (
      <div
        className="whiteboard-toolbox-panel pointer-events-auto absolute right-4 top-[22rem] z-40 max-h-[min(500px,calc(100svh-23rem))] w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-lg border p-3 transition duration-200 ease-out animate-in fade-in-0 slide-in-from-right-3"
        data-testid="whiteboard-module-drawer"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Board toolbox</p>
            <p className="whiteboard-toolbox-panel__muted text-xs">Add pinned study tools at the center of your view.</p>
          </div>
          <Button aria-label="Minimize modules toolbox" onClick={onClose} size="icon" type="button" variant="ghost">
            <Minus className="size-4" />
          </Button>
        </div>
        {moduleButtons}
      </div>
    );
  }

  return (
    <div className={panelMode ? "pointer-events-auto" : "pointer-events-auto absolute bottom-4 left-4 z-30"}>
      {open ? (
        <div className={panelMode ? "mb-2 rounded-lg border border-border bg-card p-3 text-card-foreground" : "mb-2 w-[min(380px,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Add BinderNotes module</p>
            <Button onClick={() => setOpen(false)} size="sm" type="button" variant="ghost">
              Close
            </Button>
          </div>
          {moduleButtons}
        </div>
      ) : null}
      <Button
        className={panelMode ? "w-full" : undefined}
        data-testid={panelMode ? undefined : "whiteboard-module-drawer-toggle"}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Plus data-icon="inline-start" />
        Add Module
      </Button>
    </div>
  );
}
