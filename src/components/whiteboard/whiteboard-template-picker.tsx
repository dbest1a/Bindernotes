import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mathWhiteboardTemplates } from "@/lib/whiteboards/whiteboard-templates";
import type { WhiteboardTemplate } from "@/lib/whiteboards/whiteboard-types";

type WhiteboardTemplatePickerProps = {
  compact?: boolean;
  onCreateFromTemplate: (template: WhiteboardTemplate) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  templates?: WhiteboardTemplate[];
};

export function WhiteboardTemplatePicker({
  compact = false,
  onCreateFromTemplate,
  onOpenChange,
  open = true,
  templates = mathWhiteboardTemplates,
}: WhiteboardTemplatePickerProps) {
  if (compact && !open) {
    return (
      <Button
        aria-label="Open whiteboard templates"
        className="justify-start"
        data-testid="whiteboard-templates-toggle"
        onClick={() => onOpenChange?.(true)}
        type="button"
        variant="outline"
      >
        <LayoutTemplate data-icon="inline-start" />
        Templates
      </Button>
    );
  }

  return (
    <div className="whiteboard-template-picker grid gap-2" data-testid={compact ? "whiteboard-templates-panel" : undefined}>
      <p className="whiteboard-sidebar-section-heading flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <LayoutTemplate className="size-3.5" />
        <span>Math templates</span>
      </p>
      <div className={compact ? "grid gap-2" : "grid max-h-72 gap-2 overflow-auto pr-1"}>
        {templates.map((template) => (
          <button
            className="whiteboard-template-card rounded-xl border border-border/70 bg-background/70 p-3 text-left transition hover:border-primary/45 hover:bg-card"
            key={template.id}
            onClick={() => onCreateFromTemplate(template)}
            type="button"
          >
            <span className="block text-sm font-semibold">{template.name}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span>
          </button>
        ))}
      </div>
      {!compact ? (
        <Button onClick={() => onCreateFromTemplate(mathWhiteboardTemplates[0])} type="button" variant="outline">
          New blank board
        </Button>
      ) : null}
    </div>
  );
}
