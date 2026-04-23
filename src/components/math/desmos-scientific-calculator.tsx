import { memo, type ReactNode } from "react";
import { DesmosSurface } from "@/components/math/desmos-embed";

export const DesmosScientificCalculator = memo(function DesmosScientificCalculator({
  className,
  fallback,
  height = "clamp(520px, 68vh, 720px)",
}: {
  className?: string;
  fallback?: ReactNode;
  height?: string;
}) {
  return (
    <DesmosSurface
      className={className}
      fallback={fallback}
      height={height}
      kind="scientific"
    />
  );
});
