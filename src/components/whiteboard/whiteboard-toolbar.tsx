import { Download, Save, TriangleAlert } from "lucide-react";
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
    <div className="pointer-events-auto absolute left-4 right-4 top-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/88 px-3 py-2 shadow-lg backdrop-blur">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <Badge variant="secondary">{saveLabels[saveStatus]}</Badge>
          <Badge variant="outline">{storageLabel}</Badge>
          <Badge variant="outline">{objectCount} objects</Badge>
        </div>
        {warning ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-200">
            <TriangleAlert className="size-3.5" />
            {warning}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSaveNow} size="sm" type="button" variant="outline">
          <Save data-icon="inline-start" />
          Save now
        </Button>
        <Button disabled size="sm" type="button" variant="ghost" title="Export comes after local review">
          <Download data-icon="inline-start" />
          Export
        </Button>
      </div>
    </div>
  );
}
