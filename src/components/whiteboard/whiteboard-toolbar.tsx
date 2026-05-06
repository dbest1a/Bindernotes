import { Save, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WhiteboardSaveStatus } from "@/lib/whiteboards/whiteboard-types";

type WhiteboardToolbarProps = {
  title: string;
  objectCount: number;
  saveStatus: WhiteboardSaveStatus;
  storageLabel: string;
  warning: string | null;
  onSaveNow: () => void;
};

const saveLabels: Record<WhiteboardSaveStatus, string> = {
  saved: "Saved",
  saving: "Saving...",
  "offline-draft": "Offline draft",
  error: "Save error",
  limit: "Limit reached",
  "storage-limit": "Storage limit",
  unavailable: "Supabase unavailable",
};

export function WhiteboardToolbar({
  title,
  objectCount,
  saveStatus,
  storageLabel,
  warning,
  onSaveNow,
}: WhiteboardToolbarProps) {
  return (
    <div
      className="pointer-events-none absolute right-3 top-3 z-30 flex max-w-[min(24rem,calc(100%-1.5rem))] flex-col items-end gap-2"
      data-testid="whiteboard-toolbar"
    >
      <div
        className="pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-lg border border-border/70 bg-background/92 px-2 py-1.5 shadow-md backdrop-blur-sm"
        title={`${title} - ${storageLabel}`}
      >
        <div className="min-w-0">
          <h3 className="max-w-[12rem] truncate text-xs font-semibold leading-5">{title}</h3>
          <span className="sr-only">{storageLabel}</span>
        </div>
        <Badge className="shrink-0 px-2 py-0.5 text-[10px]" variant="secondary">
          {saveLabels[saveStatus]}
        </Badge>
        <Badge className="shrink-0 px-2 py-0.5 text-[10px]" variant="outline">
          {objectCount}
        </Badge>
        <Button
          aria-label="Save whiteboard now"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={onSaveNow}
          size="sm"
          type="button"
          variant="outline"
        >
          <Save data-icon="inline-start" />
          Save
        </Button>
      </div>
      {warning ? (
        <p className="pointer-events-auto flex max-w-full items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-950/80 px-2 py-1 text-xs text-amber-100 shadow-md">
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="truncate">{warning}</span>
        </p>
      ) : null}
    </div>
  );
}
