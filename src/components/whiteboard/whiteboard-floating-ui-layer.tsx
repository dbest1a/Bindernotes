import { Focus, Home, Maximize2, Minimize2, PanelLeftOpen, PanelRightOpen, Plus, Save, Settings2, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WhiteboardBoardList } from "@/components/whiteboard/whiteboard-board-list";
import { WhiteboardModuleLauncher } from "@/components/whiteboard/whiteboard-module-launcher";
import type { BinderWhiteboard, WhiteboardSaveStatus } from "@/lib/whiteboards/whiteboard-types";
import type { WhiteboardModuleContextKind, WhiteboardModuleDefinition } from "@/lib/whiteboards/whiteboard-module-registry";

type WhiteboardFloatingUiLayerProps = {
  activeBoard: BinderWhiteboard;
  browserFullscreen: boolean;
  boards: BinderWhiteboard[];
  drawerOpen: boolean;
  moduleContextKind?: WhiteboardModuleContextKind;
  onAddModule: (definition: WhiteboardModuleDefinition) => void;
  onArchiveBoard: (boardId: string) => void;
  onBack?: () => void;
  onCreateBoard: () => void;
  onDrawerOpenChange: (open: boolean) => void;
  onRenameBoard: (title: string) => void;
  onSaveNow: () => void;
  onSelectBoard: (boardId: string) => void;
  onToggleFullscreen: () => void;
  saveMessage: string;
  saveStatus: WhiteboardSaveStatus;
  warning: string | null;
  studyTools?: ReactNode;
  templates?: ReactNode;
  /** Minimal mode: the board and one small pill (save state, add, the way back). */
  minimalMode?: boolean;
  onMinimalModeChange?: (enabled: boolean) => void;
};

const CONTROLS_COLLAPSED_KEY = "bindernotes:whiteboard:controls-collapsed";

const fallbackSaveLabels: Record<WhiteboardSaveStatus, string> = {
  saved: "Saved",
  saving: "Saving...",
  "offline-draft": "Local draft",
  error: "Remote save failed",
  limit: "Whiteboard limit reached",
  "storage-limit": "Storage limit exceeded",
  unavailable: "Cloud saving unavailable",
};

export function WhiteboardFloatingUiLayer({
  activeBoard,
  browserFullscreen,
  boards,
  drawerOpen,
  moduleContextKind = "math",
  onAddModule,
  onArchiveBoard,
  onBack,
  onCreateBoard,
  onDrawerOpenChange,
  onRenameBoard,
  onSaveNow,
  onSelectBoard,
  onToggleFullscreen,
  saveMessage,
  saveStatus,
  warning,
  studyTools,
  templates,
  minimalMode = false,
  onMinimalModeChange,
}: WhiteboardFloatingUiLayerProps) {
  // The panel remembers whether it was collapsed. Without a saved choice it starts as a chip
  // on a phone, where the full panel would cover most of the board.
  const [controlsCollapsed, setControlsCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = window.localStorage.getItem(CONTROLS_COLLAPSED_KEY);
      if (saved === "1" || saved === "0") return saved === "1";
    } catch {
      // Fall back to the screen-size default.
    }
    return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 640px)").matches;
  });
  const setControlsCollapsed = (collapsed: boolean) => {
    setControlsCollapsedState(collapsed);
    try {
      window.localStorage.setItem(CONTROLS_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      // The choice still applies for this visit.
    }
  };
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const statusLabel = saveMessage || fallbackSaveLabels[saveStatus];
  const visibleStatusLabel = saveStatus === "offline-draft" ? "Local draft" : statusLabel;
  const showSecondaryWarning = Boolean(warning && saveStatus === "error" && warning !== statusLabel);

  useEffect(() => {
    setDeleteConfirming(false);
  }, [activeBoard.id]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]" data-testid="whiteboard-floating-ui-layer">
      <div
        className="pointer-events-none absolute right-4 top-24 flex justify-end"
        data-testid="whiteboard-lab-dock"
      >
        {minimalMode ? (
          <div
            aria-label="Board controls"
            className="whiteboard-minimal-pill pointer-events-auto"
            data-testid="whiteboard-minimal-pill"
            role="toolbar"
          >
            <span
              aria-live="polite"
              className="whiteboard-minimal-pill__status"
              data-status={saveStatus}
              role="status"
              title={visibleStatusLabel}
            >
              <span className="sr-only">{visibleStatusLabel}</span>
            </span>
            <Button
              aria-label="Add module"
              className="whiteboard-minimal-pill__button"
              onClick={() => onDrawerOpenChange(!drawerOpen)}
              size="icon"
              title="Add module"
              type="button"
              variant="ghost"
            >
              <Plus className="size-4" />
            </Button>
            <Button
              aria-label="Show all controls"
              className="whiteboard-minimal-pill__button"
              data-testid="whiteboard-minimal-exit"
              onClick={() => onMinimalModeChange?.(false)}
              size="icon"
              title="Show all controls (Alt+Z)"
              type="button"
              variant="ghost"
            >
              <PanelRightOpen className="size-4" />
            </Button>
          </div>
        ) : controlsCollapsed ? (
          <button
            aria-label="Open whiteboard controls"
            className="whiteboard-control-chip pointer-events-auto"
            data-testid="whiteboard-control-chip"
            onClick={() => setControlsCollapsed(false)}
            type="button"
          >
            <Settings2 className="size-4" />
          </button>
        ) : (
        <div className="whiteboard-control-panel pointer-events-auto grid max-h-[calc(100svh-8rem)] w-[min(19rem,calc(100vw-2rem))] gap-2 overflow-y-auto rounded-lg border p-2 text-xs" onKeyDown={(event) => event.stopPropagation()}>
          <div className="flex items-center gap-2">
          <Button
            className="whiteboard-action-button flex-1 justify-start"
            data-testid="whiteboard-module-drawer-toggle"
            onClick={() => onDrawerOpenChange(!drawerOpen)}
            size="sm"
            type="button"
          >
            <PanelLeftOpen data-icon="inline-start" />
            Add module
          </Button>
          {onMinimalModeChange ? (
            <Button
              aria-label="Minimal mode"
              className="whiteboard-action-button"
              data-testid="whiteboard-minimal-enter"
              onClick={() => {
                onDrawerOpenChange(false);
                onMinimalModeChange(true);
              }}
              size="icon"
              title="Minimal mode (Alt+Z)"
              type="button"
              variant="ghost"
            >
              <Focus className="size-4" />
            </Button>
          ) : null}
          <Button
            aria-label="Minimize whiteboard controls"
            className="whiteboard-action-button"
            data-testid="whiteboard-controls-minimize"
            onClick={() => {
              setControlsCollapsed(true);
              onDrawerOpenChange(false);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Minimize2 className="size-4" />
          </Button>
          </div>
          <label className="grid gap-1">
            <span className="whiteboard-control-panel__label text-xs font-medium">Board name</span>
            <input
              aria-label="Whiteboard name"
              className="whiteboard-control-panel__input h-9 rounded-md border px-2 text-sm outline-none transition"
              data-testid="whiteboard-board-title-input"
              defaultValue={activeBoard.title}
              key={activeBoard.id}
              onBlur={(event) => onRenameBoard(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
            />
          </label>
          <div className="flex items-stretch gap-2">
            <div
              className="whiteboard-save-status min-w-0 flex-1 rounded-md border px-2.5 py-2 text-xs font-semibold"
              data-status={saveStatus}
              data-testid="whiteboard-save-confirmation"
              role="status"
              aria-live="polite"
            >
              {visibleStatusLabel}
              {saveStatus === "saved" && <time className="mt-1 block font-normal" dateTime={activeBoard.updatedAt}>Last saved {new Date(activeBoard.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>}
            </div>
            <Button
              aria-label="Save now"
              className="whiteboard-action-button h-auto self-stretch"
              onClick={onSaveNow}
              size="icon"
              title="Save now"
              type="button"
              variant="secondary"
            >
              <Save className="size-4" />
            </Button>
          </div>
          {showSecondaryWarning ? (
            <span className="whiteboard-save-status inline-flex items-start gap-1 rounded-md border px-2 py-1.5" data-status="offline-draft">
              <TriangleAlert className="size-3.5" />
              {warning}
            </span>
          ) : null}
          <Button
            className="whiteboard-action-button justify-start"
            data-testid="whiteboard-new-board"
            onClick={onCreateBoard}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Plus data-icon="inline-start" />
            New Whiteboard
          </Button>
          {templates}
          {studyTools}
          <WhiteboardBoardList
            activeBoardId={activeBoard.id}
            boards={boards}
            onArchiveBoard={onArchiveBoard}
            onSelectBoard={onSelectBoard}
          />
          <Button
            className="whiteboard-action-button justify-start"
            data-testid="whiteboard-delete-board"
            onClick={() => {
              if (!deleteConfirming) {
                setDeleteConfirming(true);
                return;
              }

              setDeleteConfirming(false);
              onArchiveBoard(activeBoard.id);
            }}
            size="sm"
            type="button"
            variant={deleteConfirming ? "destructive" : "outline"}
          >
            <Trash2 data-icon="inline-start" />
            {deleteConfirming ? "Confirm archive board" : "Archive board"}
          </Button>
          <div className="grid grid-cols-2 gap-2" data-testid="whiteboard-corner-controls">
            {onBack ? (
              <Button
                aria-label="Home"
                className="whiteboard-action-button whiteboard-nav-button whiteboard-nav-button--home justify-center gap-1.5"
                data-testid="whiteboard-corner-back"
                onClick={onBack}
                size="sm"
                type="button"
                variant="outline"
              >
                <Home className="size-4" />
                <span>Home</span>
              </Button>
            ) : null}
            <Button
              aria-label={browserFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="whiteboard-action-button whiteboard-nav-button whiteboard-nav-button--fullscreen justify-center gap-1.5"
              data-testid="whiteboard-corner-fullscreen"
              onClick={onToggleFullscreen}
              size="sm"
              type="button"
              variant="outline"
            >
              {browserFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              <span>{browserFullscreen ? "Exit full" : "Full screen"}</span>
            </Button>
          </div>
        </div>
        )}
      </div>

      {drawerOpen && (minimalMode || !controlsCollapsed) ? (
        <WhiteboardModuleLauncher
          contextKind={moduleContextKind}
          onAddModule={(definition) => {
            onAddModule(definition);
            onDrawerOpenChange(false);
          }}
          onClose={() => onDrawerOpenChange(false)}
          placement="drawer"
        />
      ) : null}
    </div>
  );
}
