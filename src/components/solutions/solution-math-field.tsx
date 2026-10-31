import { useEffect, useId, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type MathfieldCtor = typeof MathfieldElement;

let mathliveLoader: Promise<MathfieldCtor | undefined> | undefined;

/**
 * Loads MathLive on demand. The bundle is only fetched when a student starts editing a step.
 * Fonts: MathLive uses the KaTeX font families, which the card already loads through KaTeX's CSS,
 * so no extra font directory is needed.
 */
export function loadMathfield(): Promise<MathfieldCtor | undefined> {
  mathliveLoader ??= import("mathlive")
    .then((module) => {
      const ctor = module.MathfieldElement;
      try {
        ctor.fontsDirectory = null;
        ctor.soundsDirectory = null;
      } catch {
        // Static setters may be unavailable in some environments; MathLive still works.
      }
      return ctor;
    })
    .catch(() => undefined);
  return mathliveLoader;
}

export type SolutionMathFieldProps = {
  value: string;
  onChange: (latex: string) => void;
  ariaLabel: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Forces the plain LaTeX editor (used by tests and by students who prefer typing LaTeX). */
  plain?: boolean;
  onTogglePlain?: (plain: boolean) => void;
};

/**
 * A math input: MathLive's <math-field> when available, a LaTeX textarea otherwise.
 * The textarea shows immediately so typing never waits for the lazy chunk.
 */
export function SolutionMathField({ value, onChange, ariaLabel, placeholder, autoFocus, className, plain, onTogglePlain }: SolutionMathFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const latestValue = useRef(value);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">(plain ? "fallback" : "loading");
  const describedById = useId();
  latestValue.current = value;

  useEffect(() => {
    if (plain) {
      setStatus("fallback");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    loadMathfield().then((ctor) => {
      if (cancelled) {
        return;
      }
      if (!ctor || !hostRef.current || typeof customElements === "undefined") {
        setStatus("fallback");
        return;
      }
      try {
        const field = new ctor();
        field.className = "solution-mathfield";
        field.setAttribute("aria-label", ariaLabel);
        field.setAttribute("math-virtual-keyboard-policy", "auto");
        field.setAttribute("aria-describedby", describedById);
        field.value = latestValue.current;
        field.addEventListener("input", () => {
          const next = field.value;
          if (next !== latestValue.current) {
            latestValue.current = next;
            onChange(next);
          }
        });
        hostRef.current.replaceChildren(field);
        fieldRef.current = field;
        setStatus("ready");
        if (autoFocus) {
          field.focus();
        }
      } catch {
        setStatus("fallback");
      }
    });
    return () => {
      cancelled = true;
      fieldRef.current?.remove();
      fieldRef.current = null;
    };
    // The field is created once; prop updates are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plain]);

  useEffect(() => {
    const field = fieldRef.current;
    if (field && field.value !== value) {
      field.value = value;
    }
  }, [value, status]);

  useEffect(() => {
    fieldRef.current?.setAttribute("aria-label", ariaLabel);
  }, [ariaLabel]);

  const showTextarea = status !== "ready";

  return (
    <div className={cn("solution-mathfield-wrap", className)}>
      <div className={showTextarea ? "hidden" : "block"} data-testid="solution-mathfield-host" ref={hostRef} />
      {showTextarea ? (
        <Textarea
          aria-describedby={describedById}
          aria-label={`${ariaLabel} (LaTeX)`}
          autoFocus={autoFocus}
          className="min-h-[56px] font-mono text-[13px] leading-5"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder ?? "\\frac{d}{dx}\\left(x^2\\right) = 2x"}
          rows={2}
          spellCheck={false}
          value={value}
        />
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground" id={describedById}>
        <span>{status === "loading" && !plain ? "Loading the math keyboard…" : status === "ready" ? "Math keyboard" : "LaTeX"}</span>
        {onTogglePlain ? (
          <button
            className="rounded px-1.5 py-0.5 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            onClick={() => onTogglePlain(!plain)}
            type="button"
          >
            {plain ? "Use math keyboard" : "Type LaTeX instead"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
