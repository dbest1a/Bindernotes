import { useMemo } from "react";
import { cn } from "@/lib/utils";

type FunctionGraphProps = {
  expressions: string[];
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  className?: string;
};

const colors = ["#0f7b72", "#7c3aed", "#c2410c", "#be123c"];

function compileExpression(expression: string) {
  const body = expression.replace(/^y\s*=\s*/i, "").replace(/\^/g, "**");
  const normalized = body
    .replace(/\bsin\(/g, "Math.sin(")
    .replace(/\bcos\(/g, "Math.cos(")
    .replace(/\btan\(/g, "Math.tan(")
    .replace(/\bsqrt\(/g, "Math.sqrt(")
    .replace(/\babs\(/g, "Math.abs(")
    .replace(/\bpi\b/gi, "Math.PI")
    .replace(/(\d)(x)/g, "$1*$2");

  if (!/^[\d\sx+\-*/().MathPI]+$/.test(normalized)) {
    return null;
  }

  try {
    return new Function("x", `return ${normalized}`) as (x: number) => number;
  } catch {
    return null;
  }
}

export function FunctionGraph({
  expressions,
  xMin = -5,
  xMax = 5,
  yMin = -5,
  yMax = 5,
  className,
}: FunctionGraphProps) {
  const paths = useMemo(() => {
    const width = 640;
    const height = 320;
    const xScale = (x: number) => ((x - xMin) / (xMax - xMin)) * width;
    const yScale = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height;

    return expressions.map((expression) => {
      const fn = compileExpression(expression);
      if (!fn) {
        return "";
      }

      const points: string[] = [];
      for (let index = 0; index <= 180; index += 1) {
        const x = xMin + ((xMax - xMin) * index) / 180;
        const y = fn(x);
        if (Number.isFinite(y) && y >= yMin - 20 && y <= yMax + 20) {
          points.push(`${index === 0 ? "M" : "L"} ${xScale(x).toFixed(2)} ${yScale(y).toFixed(2)}`);
        }
      }

      return points.join(" ");
    });
  }, [expressions, xMax, xMin, yMax, yMin]);

  const xAxis = 320 - ((0 - yMin) / (yMax - yMin)) * 320;
  const yAxis = ((0 - xMin) / (xMax - xMin)) * 640;

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <svg viewBox="0 0 640 320" className="h-64 w-full" role="img" aria-label="Function graph">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeOpacity="0.08" />
          </pattern>
        </defs>
        <rect width="640" height="320" fill="url(#grid)" />
        <line x1="0" x2="640" y1={xAxis} y2={xAxis} stroke="currentColor" strokeOpacity="0.25" />
        <line x1={yAxis} x2={yAxis} y1="0" y2="320" stroke="currentColor" strokeOpacity="0.25" />
        {paths.map((path, index) => (
          <path
            key={`${expressions[index]}-${index}`}
            d={path}
            fill="none"
            stroke={colors[index % colors.length]}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-2">
        {expressions.map((expression, index) => (
          <span
            className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
            key={`${expression}-${index}`}
            style={{ color: colors[index % colors.length] }}
          >
            {expression}
          </span>
        ))}
      </div>
    </div>
  );
}
