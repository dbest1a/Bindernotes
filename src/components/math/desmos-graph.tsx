import { memo } from "react";
import { DesmosSurface } from "@/components/math/desmos-embed";

type GraphExpressionRequest = {
  id: string;
  latex: string;
};

type GraphLoadRequest = {
  id: string;
  expressions: string[];
  viewport?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
};

export const DesmosGraph = memo(function DesmosGraph({
  className,
  height,
  loadRequest,
  onLoadApplied,
  onExpressionApplied,
  onStateChange,
  pendingExpression,
  state,
}: {
  className?: string;
  height?: string;
  loadRequest?: GraphLoadRequest | null;
  onLoadApplied?: (id: string) => void;
  onExpressionApplied?: (id: string) => void;
  onStateChange?: (state: DesmosState) => void;
  pendingExpression?: GraphExpressionRequest | null;
  state: DesmosState | null;
}) {
  return (
    <DesmosSurface
      className={className}
      height={height}
      kind="graphing"
      loadRequest={loadRequest}
      onLoadApplied={onLoadApplied}
      onExpressionApplied={onExpressionApplied}
      onStateChange={onStateChange}
      pendingExpression={pendingExpression}
      state={state}
    />
  );
});

export const Desmos3DGraph = memo(function Desmos3DGraph({
  className,
  height,
  loadRequest,
  onLoadApplied,
  onExpressionApplied,
  onStateChange,
  pendingExpression,
  state,
}: {
  className?: string;
  height?: string;
  loadRequest?: GraphLoadRequest | null;
  onLoadApplied?: (id: string) => void;
  onExpressionApplied?: (id: string) => void;
  onStateChange?: (state: DesmosState) => void;
  pendingExpression?: GraphExpressionRequest | null;
  state: DesmosState | null;
}) {
  return (
    <DesmosSurface
      className={className}
      height={height}
      kind="graphing-3d"
      loadRequest={loadRequest}
      onLoadApplied={onLoadApplied}
      onExpressionApplied={onExpressionApplied}
      onStateChange={onStateChange}
      pendingExpression={pendingExpression}
      state={state}
    />
  );
});
