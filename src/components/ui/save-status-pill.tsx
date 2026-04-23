import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SaveStatusSnapshot } from "@/types";

export function SaveStatusPill({
  snapshot,
  onRetry,
}: {
  snapshot: SaveStatusSnapshot;
  onRetry?: () => void;
}) {
  const icon =
    snapshot.state === "saving" || snapshot.state === "retrying" ? (
      <Loader2 className="size-3.5 animate-spin" />
    ) : snapshot.state === "saved" ? (
      <CheckCircle2 className="size-3.5" />
    ) : snapshot.state === "offline" ? (
      <WifiOff className="size-3.5" />
    ) : snapshot.state === "failed" || snapshot.state === "conflict" ? (
      <AlertTriangle className="size-3.5" />
    ) : (
      <CheckCircle2 className="size-3.5" />
    );

  const variant =
    snapshot.state === "failed" || snapshot.state === "conflict"
      ? "destructive"
      : snapshot.state === "offline"
        ? "outline"
        : "secondary";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge className="gap-1.5" variant={variant}>
        {icon}
        {snapshot.detail}
      </Badge>
      {snapshot.state === "failed" && onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          <RefreshCcw data-icon="inline-start" />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
