import { Home, Maximize2, Minimize2, PanelLeftOpen, Save, Settings2, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { WhiteboardBoardList } from "@/components/whiteboard/whiteboard-board-list";
import { WhiteboardModuleLauncher } from "@/components/whiteboard/whiteboard-module-launcher";
import type { BinderWhiteboard, WhiteboardSaveStatus } from "@/lib/whiteboards/whiteboard-types";
import type { WhiteboardModuleDefinition } from "@/lib/whiteboards/whiteboard-module-registry";

type WhiteboardFloatingUiLayerProps = {
  activeBoard: BinderWhiteboard;
  browserFullscreen: boolean;
  boards: BinderWhiteboard[];
  drawerOpen: boolean;
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
};

const fallbackSaveLabels: Record<WhiteboardSaveStatus, string> = {
  saved: "Saved to Supabase",
  saving: "Saving...",
  "offline-draft": "Local draft",
  error: "Remote save failed",
  limit: "Whiteboard limit reached",
  "storage-limit": "Storage limit exceeded",
  unavailable: "Supabase unavailable",
};

export function WhiteboardFloatingUiLayer({
  activeBoard,
  browserFullscreen,
  boards,
  drawerOpen,
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
}: WhiteboardFloatingUiLayerProps) {
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
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
        {controlsCollapsed ? (
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
        <div className="whiteboard-control-panel pointer-events-auto grid w-[min(17rem,calc(100vw-2rem))] gap-2 rounded-lg border p-2 text-xs">
          <div className="flex items-center gap-2">
          <Button
            className="whiteboard-action-button flex-1 justify-start"
            data-testid="whiteboard-module-drawer-toggle"
            onClick={() => onDrawerOpenChange(!drawerOpen)}
            size="sm"
            type="button"
          >
            <PanelLeftOpen data-icon="inline-start" />
            Modules
          </Button>
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
            <span className="whiteboard-control-panel__label text-[10px] font-semibold uppercase tracking-[0.16em]">Board name</span>
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
          <div
            className="whiteboard-save-status rounded-md border px-2.5 py-2 text-xs font-semibold"
            data-status={saveStatus}
            data-testid="whiteboard-save-confirmation"
          >
            {visibleStatusLabel}
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
            New Whiteboard
          </Button>
          <WhiteboardBoardList
            activeBoardId={activeBoard.id}
            boards={boards}
            onArchiveBoard={onArchiveBoard}
            onSelectBoard={onSelectBoard}
          />
          <Button className="whiteboard-action-button justify-start" onClick={onSaveNow} size="sm" type="button" variant="secondary">
            <Save data-icon="inline-start" />
            Save
          </Button>
          <Button
            className="whiteboard-action-button justify-start"
            data-testid="whiteboard-delete-broken-board"
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
            {deleteConfirming ? "Confirm delete board" : "Delete broken board"}
          </Button>
          <div className="grid grid-cols-2 gap-2" data-testid="whiteboard-corner-controls">
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

      {drawerOpen && !controlsCollapsed ? (
        <WhiteboardModuleLauncher
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
