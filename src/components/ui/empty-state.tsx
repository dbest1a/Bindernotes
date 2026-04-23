import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo-mark";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed border-border/70 bg-card/75 shadow-none">
      <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:p-10">
        <LogoMark className="size-12 rounded-lg" />
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
