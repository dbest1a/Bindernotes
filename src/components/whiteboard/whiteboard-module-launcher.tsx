import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getEmbeddableWhiteboardModules,
  type WhiteboardModuleContextKind,
  type WhiteboardModuleDefinition,
} from "@/lib/whiteboards/whiteboard-module-registry";

type WhiteboardModuleLauncherProps = {
  compact?: boolean;
  contextKind?: WhiteboardModuleContextKind;
  defaultOpen?: boolean;
  onAddModule: (definition: WhiteboardModuleDefinition) => void;
  onClose?: () => void;
  placement?: "floating" | "panel" | "drawer";
};

export function WhiteboardModuleLauncher({
  compact = false,
  contextKind = "math",
  defaultOpen = false,
  onAddModule,
  onClose,
  placement = "floating",
}: WhiteboardModuleLauncherProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const modules = getEmbeddableWhiteboardModules(contextKind);
  const panelMode = placement === "panel";
  const drawerMode = placement === "drawer";
  const filteredModules = modules.filter((module) => {
    const searchText = `${module.label} ${module.description} ${module.moduleId}`.toLowerCase();
    return searchText.includes(query.trim().toLowerCase());
  });
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
      label: "History",
      modules: modules.filter(
        (module) =>
          module.moduleId === "history-timeline" ||
          module.moduleId === "history-evidence" ||
          module.moduleId === "history-argument",
      ),
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

  const handleAddModule = (module: WhiteboardModuleDefinition) => {
    onAddModule(module);
    setOpen(false);
    setQuery("");
    if (drawerMode) {
      onClose?.();
    }
  };

  const compactModuleButtons = (
    <div className="mt-3 grid gap-2">
      <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
        Search modules
        <input
          className="rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-primary"
          data-testid="whiteboard-module-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search modules"
          type="search"
          value={query}
        />
      </label>
      <div className="grid max-h-[min(260px,calc(100svh-18rem))] gap-2 overflow-auto pr-1">
        {filteredModules.length > 0 ? (
          filteredModules.map((module) => (
            <button
              className="whiteboard-toolbox-card rounded-md border p-3 text-left transition"
              key={module.moduleId}
              onClick={() => handleAddModule(module)}
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
          ))
        ) : (
          <p className="rounded-md border border-border/70 px-3 py-2 text-xs text-muted-foreground">
            No modules match that search.
          </p>
        )}
      </div>
    </div>
  );

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
              onClick={() => handleAddModule(module)}
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
        {compact ? compactModuleButtons : moduleButtons}
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
          {compact ? compactModuleButtons : moduleButtons}
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
