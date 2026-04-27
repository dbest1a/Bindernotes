import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mathWhiteboardTemplates } from "@/lib/whiteboards/whiteboard-templates";
import type { WhiteboardTemplate } from "@/lib/whiteboards/whiteboard-types";

type WhiteboardTemplatePickerProps = {
  onCreateFromTemplate: (template: WhiteboardTemplate) => void;
};

export function WhiteboardTemplatePicker({ onCreateFromTemplate }: WhiteboardTemplatePickerProps) {
  return (
    <div className="grid gap-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <LayoutTemplate className="size-3.5" />
        Math templates
      </p>
      <div className="grid max-h-72 gap-2 overflow-auto pr-1">
        {mathWhiteboardTemplates.map((template) => (
          <button
            className="rounded-xl border border-border/70 bg-background/70 p-3 text-left transition hover:border-primary/45 hover:bg-card"
            key={template.id}
            onClick={() => onCreateFromTemplate(template)}
            type="button"
          >
            <span className="block text-sm font-semibold">{template.name}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{template.description}</span>
          </button>
        ))}
      </div>
      <Button onClick={() => onCreateFromTemplate(mathWhiteboardTemplates[0])} type="button" variant="outline">
        New blank board
      </Button>
    </div>
  );
}
