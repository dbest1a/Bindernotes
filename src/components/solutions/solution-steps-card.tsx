import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleDashed,
  Eye,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createEmptySolution,
  createSolutionStep,
  SOLUTION_LIMITS,
  type SolutionDocument,
  type SolutionStep,
  type StepCheck,
} from "@/lib/solutions/solution-types";
import { checkSolution } from "@/lib/solutions/verify";
import { detectSolutionGenerator, solutionGenerators } from "@/lib/solutions/generators";
import { SolutionMath, SolutionRichText } from "./solution-math";
import { SolutionMathField } from "./solution-math-field";
import "./solution-steps-card.css";

export type SolutionStepsCardProps = {
  value: SolutionDocument | undefined;
  onChange: (next: SolutionDocument) => void;
  readOnly?: boolean;
  className?: string;
};

const AUTOPLAY_INTERVAL_MS = 1200;
const SAVE_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", listener);
    return () => query.removeEventListener?.("change", listener);
  }, []);
  return reduced;
}

/** Keeps a local draft and calls onChange after the student pauses typing. */
function useDebouncedDocument(value: SolutionDocument | undefined, onChange: (next: SolutionDocument) => void) {
  const [draft, setDraft] = useState<SolutionDocument>(() => value ?? createEmptySolution());
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(draft);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  latest.current = draft;

  // Adopt outside changes (e.g. a collaborator or undo) when there is nothing pending locally.
  useEffect(() => {
    if (value && !dirty.current && value !== latest.current) {
      setDraft(value);
    }
  }, [value]);

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
    if (dirty.current) {
      dirty.current = false;
      onChangeRef.current(latest.current);
    }
  }, []);

  const update = useCallback(
    (updater: (current: SolutionDocument) => SolutionDocument, immediate = false) => {
      // Compute from the latest draft outside the React updater so side effects run exactly once.
      const next = updater(latest.current);
      latest.current = next;
      dirty.current = true;
      setDraft(next);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = undefined;
      }
      if (immediate) {
        dirty.current = false;
        onChangeRef.current(next);
      } else {
        timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
      }
    },
    [flush],
  );

  useEffect(() => () => flush(), [flush]);

  return { draft, update, flush };
}

// ---------------------------------------------------------------------------
// Check chip
// ---------------------------------------------------------------------------

function chipLabel(check: StepCheck | undefined): string {
  if (!check) {
    return "Not checked yet";
  }
  switch (check.status) {
    case "verified":
      return check.method === "approx" ? "Checked (≈)" : "Checked";
    case "mismatch":
      return "Doesn't match";
    case "error":
      return "Check failed";
    default:
      switch (check.method) {
        case "given":
          return "Given";
        case "partial":
          return "Partly checked";
        case "prose":
          return "Note";
        default:
          return "Not checked";
      }
  }
}

const CheckChip = memo(function CheckChip({ check, expanded, onToggle }: { check: StepCheck | undefined; expanded: boolean; onToggle: () => void }) {
  const status = check?.status ?? "unchecked";
  const Icon = status === "verified" ? Check : status === "mismatch" ? AlertTriangle : status === "error" ? AlertTriangle : CircleDashed;
  return (
    <button
      aria-expanded={expanded}
      aria-label={`${chipLabel(check)}${check?.detail ? ". Show details" : ""}`}
      className={cn(
        "solution-chip inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border border-border/70 bg-secondary/70 px-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 touch-manipulation sm:min-h-6",
        check?.detail ? "cursor-pointer" : "cursor-default",
      )}
      data-status={status}
      onClick={check?.detail ? onToggle : undefined}
      type="button"
    >
      <Icon aria-hidden className="size-3" />
      <span>{chipLabel(check)}</span>
    </button>
  );
});

// ---------------------------------------------------------------------------
// Present mode rows
// ---------------------------------------------------------------------------

type StepRowProps = {
  step: SolutionStep;
  index: number;
  entering: boolean;
  isCurrent: boolean;
  detailsOpen: boolean;
  onToggleDetails: (id: string) => void;
};

const StepRow = memo(function StepRow({ step, index, entering, isCurrent, detailsOpen, onToggleDetails }: StepRowProps) {
  const toggle = useCallback(() => onToggleDetails(step.id), [onToggleDetails, step.id]);
  const showDetail = Boolean(step.check?.detail) && (detailsOpen || step.check?.status === "mismatch" || step.check?.status === "error");
  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className={cn(
        "solution-step relative rounded-xl border px-3 py-2.5 transition-colors duration-200 sm:px-4",
        isCurrent ? "border-primary/35 bg-primary/[0.06]" : "border-transparent",
      )}
      data-entering={entering ? "true" : "false"}
      data-step-index={index}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold tabular-nums text-muted-foreground"
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <SolutionMath ariaLabel={`Step ${index + 1}: ${step.math}`} latex={step.math} />
          {step.note ? <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{step.note}</p> : null}
          {showDetail ? (
            <p className="mt-1.5 rounded-lg bg-background/70 px-2.5 py-1.5 text-[12px] leading-5 text-muted-foreground" data-testid="solution-check-detail">
              {step.check?.detail}
            </p>
          ) : null}
        </div>
        <CheckChip check={step.check} expanded={showDetail} onToggle={toggle} />
      </div>
    </li>
  );
});

// ---------------------------------------------------------------------------
// Generate panel
// ---------------------------------------------------------------------------

function GeneratePanel({
  hasSteps,
  onGenerate,
  onCancel,
}: {
  hasSteps: boolean;
  onGenerate: (doc: SolutionDocument) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState("");
  const [typeId, setTypeId] = useState<string>("auto");
  const [message, setMessage] = useState<string | undefined>();
  const [pendingDoc, setPendingDoc] = useState<SolutionDocument | undefined>();
  const selectId = useId();
  const inputId = useId();
  const detected = useMemo(() => detectSolutionGenerator(input), [input]);
  const active = typeId === "auto" ? detected : solutionGenerators.find((generator) => generator.id === typeId) ?? detected;

  const run = () => {
    if (!input.trim()) {
      setMessage("Type a problem first.");
      return;
    }
    const result = active.generate(input);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(undefined);
    if (hasSteps) {
      setPendingDoc(result.doc);
      return;
    }
    onGenerate(result.doc);
  };

  return (
    <section aria-labelledby={`${inputId}-title`} className="rounded-xl border border-border/70 bg-background/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight" id={`${inputId}-title`}>
          Generate steps
        </h3>
        <span className="text-[11px] text-muted-foreground">Free, local, no AI</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="sr-only" htmlFor={inputId}>
          Problem
        </label>
        <Input
          autoComplete="off"
          id={inputId}
          onChange={(event) => {
            setInput(event.target.value);
            setMessage(undefined);
            setPendingDoc(undefined);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              run();
            }
          }}
          placeholder={active.placeholder}
          spellCheck={false}
          value={input}
        />
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={selectId}>
            Problem type
          </label>
          <select
            className="h-10 min-w-0 flex-1 rounded-lg border border-input/85 bg-background/92 px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/10"
            id={selectId}
            onChange={(event) => setTypeId(event.target.value)}
            value={typeId}
          >
            <option value="auto">Auto: {detected.label}</option>
            {solutionGenerators.map((generator) => (
              <option key={generator.id} value={generator.id}>
                {generator.label}
              </option>
            ))}
          </select>
          <Button className="h-10 shrink-0" onClick={run} type="button">
            <Wand2 aria-hidden className="size-4" />
            Generate
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{active.description}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {active.examples.map((example) => (
          <button
            className="rounded-md border border-border/60 bg-secondary/60 px-2 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            key={example}
            onClick={() => {
              setInput(example);
              setMessage(undefined);
              setPendingDoc(undefined);
            }}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>
      <p aria-live="polite" className={cn("mt-2 text-[13px] leading-5", message ? "text-destructive" : "sr-only")} role="status">
        {message ?? ""}
      </p>
      {pendingDoc ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] p-2.5" role="alertdialog" aria-label="Replace existing steps?">
          <p className="min-w-0 flex-1 text-[13px] leading-5">
            Replace the current steps with {pendingDoc.steps.length} generated steps? The old steps will be lost.
          </p>
          <Button onClick={() => onGenerate(pendingDoc)} size="sm" type="button">
            Replace steps
          </Button>
          <Button onClick={() => setPendingDoc(undefined)} size="sm" type="button" variant="ghost">
            Keep mine
          </Button>
        </div>
      ) : null}
      {hasSteps ? (
        <div className="mt-3 flex justify-end">
          <Button onClick={onCancel} size="sm" type="button" variant="ghost">
            Close
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Edit mode step editor
// ---------------------------------------------------------------------------

type StepEditorProps = {
  step: SolutionStep;
  index: number;
  total: number;
  plain: boolean;
  onTogglePlain: (plain: boolean) => void;
  onChangeStep: (id: string, patch: Partial<Pick<SolutionStep, "math" | "note">>) => void;
  onInsertAfter: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  autoFocus: boolean;
};

const StepEditor = memo(function StepEditor({ step, index, total, plain, onTogglePlain, onChangeStep, onInsertAfter, onDelete, onMove, autoFocus }: StepEditorProps) {
  const onMath = useCallback((latex: string) => onChangeStep(step.id, { math: latex }), [onChangeStep, step.id]);
  return (
    <li className="rounded-xl border border-border/70 bg-background/60 p-3" data-step-index={index}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Step {index + 1}</span>
        <div className="flex items-center gap-1">
          <Button aria-label={`Move step ${index + 1} up`} className="size-11 sm:size-8" disabled={index === 0} onClick={() => onMove(step.id, -1)} size="icon" type="button" variant="ghost">
            <ArrowUp aria-hidden className="size-4" />
          </Button>
          <Button aria-label={`Move step ${index + 1} down`} className="size-11 sm:size-8" disabled={index === total - 1} onClick={() => onMove(step.id, 1)} size="icon" type="button" variant="ghost">
            <ArrowDown aria-hidden className="size-4" />
          </Button>
          <Button aria-label={`Insert a step after step ${index + 1}`} className="size-11 sm:size-8" onClick={() => onInsertAfter(step.id)} size="icon" type="button" variant="ghost">
            <Plus aria-hidden className="size-4" />
          </Button>
          <Button aria-label={`Delete step ${index + 1}`} className="size-11 sm:size-8" onClick={() => onDelete(step.id)} size="icon" type="button" variant="ghost">
            <Trash2 aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
      <SolutionMathField ariaLabel={`Step ${index + 1} math`} autoFocus={autoFocus} onChange={onMath} onTogglePlain={onTogglePlain} plain={plain} value={step.math} />
      {step.math.trim() ? (
        <div className="mt-2 rounded-lg bg-card/70 px-3 py-2">
          <SolutionMath ariaLabel={`Step ${index + 1} preview`} latex={step.math} />
        </div>
      ) : null}
      <Input
        aria-label={`Step ${index + 1} reason`}
        className="mt-2 h-10 text-[13px]"
        maxLength={SOLUTION_LIMITS.maxNoteLength}
        onChange={(event) => onChangeStep(step.id, { note: event.target.value })}
        placeholder="Why this step? (optional)"
        value={step.note ?? ""}
      />
      {step.check ? (
        <div className="mt-2 flex items-start gap-2">
          <CheckChip check={step.check} expanded onToggle={() => undefined} />
          {step.check.detail ? <p className="text-[12px] leading-5 text-muted-foreground">{step.check.detail}</p> : null}
        </div>
      ) : null}
    </li>
  );
});

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function SolutionStepsCard({ value, onChange, readOnly = false, className }: SolutionStepsCardProps) {
  const { draft, update, flush } = useDebouncedDocument(value, onChange);
  const steps = draft.steps;
  const total = steps.length;
  const reducedMotion = useReducedMotion();
  const [mode, setMode] = useState<"present" | "edit">(() => (value && value.steps.length > 0 ? "present" : readOnly ? "present" : "edit"));
  const [revealed, setRevealedState] = useState(() => (value && value.steps.length > 0 ? value.steps.length : 0));
  const [playing, setPlaying] = useState(false);
  const [enteringIndex, setEnteringIndex] = useState(-1);
  const [openDetails, setOpenDetails] = useState<Set<string>>(() => new Set());
  const [showGenerate, setShowGenerate] = useState(false);
  const [plainEditor, setPlainEditor] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkSummary, setCheckSummary] = useState("");
  const [focusStepId, setFocusStepId] = useState<string | undefined>();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const titleId = useId();
  const scrubberId = useId();
  const effectiveMode = readOnly ? "present" : mode;

  const setRevealed = useCallback(
    (next: number | ((current: number) => number)) => {
      setRevealedState((current) => {
        const resolved = Math.max(0, Math.min(total, typeof next === "function" ? next(current) : next));
        if (resolved === current + 1 && !reducedMotion) {
          setEnteringIndex(resolved - 1);
        } else {
          setEnteringIndex(-1);
        }
        return resolved;
      });
    },
    [reducedMotion, total],
  );

  // Clamp when steps are removed.
  useEffect(() => {
    setRevealedState((current) => Math.min(current, total));
  }, [total]);

  // Autoplay.
  useEffect(() => {
    if (!playing) {
      return;
    }
    if (revealed >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setRevealed((current) => current + 1), AUTOPLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, revealed, total, setRevealed]);

  // Keep the newest revealed line in view.
  useEffect(() => {
    if (effectiveMode !== "present" || revealed === 0) {
      return;
    }
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-step-index="${revealed - 1}"]`);
    row?.scrollIntoView?.({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
  }, [revealed, effectiveMode, reducedMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (effectiveMode !== "present") {
      return;
    }
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    // Inputs (including the range scrubber, which handles arrows natively) keep their own keys.
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "MATH-FIELD" || target.isContentEditable) {
      return;
    }
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setRevealed((current) => current + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        setRevealed((current) => current - 1);
        break;
      case "Home":
        event.preventDefault();
        setRevealed(0);
        break;
      case "End":
        event.preventDefault();
        setRevealed(total);
        break;
      case " ":
        if (tag === "BUTTON") {
          return;
        }
        event.preventDefault();
        setPlaying((current) => !current && revealed < total);
        break;
      default:
        break;
    }
  };

  const toggleDetails = useCallback((id: string) => {
    setOpenDetails((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ----- editing -----------------------------------------------------------

  const changeStep = useCallback(
    (id: string, patch: Partial<Pick<SolutionStep, "math" | "note">>) => {
      update((current) => ({
        ...current,
        steps: current.steps.map((step) => {
          if (step.id !== id) {
            return step;
          }
          const next: SolutionStep = { ...step, ...patch };
          if (patch.math !== undefined && patch.math !== step.math) {
            delete next.check;
          }
          if (next.note === "") {
            delete next.note;
          }
          return next;
        }),
      }));
    },
    [update],
  );

  const insertAfter = useCallback(
    (id: string | undefined) => {
      const fresh = createSolutionStep("");
      setFocusStepId(fresh.id);
      update(
        (current) => {
          if (current.steps.length >= SOLUTION_LIMITS.maxSteps) {
            return current;
          }
          const index = id ? current.steps.findIndex((step) => step.id === id) : current.steps.length - 1;
          const steps = [...current.steps];
          steps.splice(index + 1, 0, fresh);
          return { ...current, steps };
        },
        true,
      );
    },
    [update],
  );

  const deleteStep = useCallback(
    (id: string) => {
      update((current) => ({ ...current, steps: current.steps.filter((step) => step.id !== id) }), true);
    },
    [update],
  );

  const moveStep = useCallback(
    (id: string, direction: -1 | 1) => {
      update((current) => {
        const index = current.steps.findIndex((step) => step.id === id);
        const target = index + direction;
        if (index === -1 || target < 0 || target >= current.steps.length) {
          return current;
        }
        const steps = [...current.steps];
        [steps[index], steps[target]] = [steps[target], steps[index]];
        return { ...current, steps };
      }, true);
    },
    [update],
  );

  const runCheck = useCallback(
    async (doc: SolutionDocument) => {
      setChecking(true);
      setCheckSummary("Checking steps…");
      try {
        const checked = await checkSolution(doc);
        update(() => checked, true);
        const counts = checked.steps.reduce(
          (acc, step) => {
            const status = step.check?.status ?? "unchecked";
            acc[status] = (acc[status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );
        const parts = [
          counts.verified ? `${counts.verified} checked` : "",
          counts.mismatch ? `${counts.mismatch} don't match` : "",
          counts.unchecked ? `${counts.unchecked} not checked` : "",
          counts.error ? `${counts.error} failed` : "",
        ].filter(Boolean);
        setCheckSummary(`Check complete: ${parts.join(", ")}.`);
      } catch {
        setCheckSummary("The checker couldn't run. Your steps were not changed.");
      } finally {
        setChecking(false);
      }
    },
    [update],
  );

  const applyGenerated = useCallback(
    (doc: SolutionDocument) => {
      update(() => doc, true);
      setShowGenerate(false);
      setMode("present");
      setRevealedState(0);
      setEnteringIndex(-1);
      setPlaying(false);
      void runCheck(doc);
      requestAnimationFrame(() => rootRef.current?.focus());
    },
    [runCheck, update],
  );

  const enterPresent = () => {
    flush();
    setMode("present");
    setRevealedState(total);
    setEnteringIndex(-1);
  };

  // ----- render -------------------------------------------------------------

  const visibleSteps = useMemo(() => steps.slice(0, revealed), [steps, revealed]);
  const answerVisible = effectiveMode === "present" && revealed >= total && total > 0 && Boolean(draft.answer);
  const checkedCount = steps.filter((step) => step.check?.status === "verified").length;

  const header = (
    <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3 pb-2.5 pt-3 sm:px-4">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Worked solution</p>
        {effectiveMode === "edit" ? (
          <Input
            aria-label="Title"
            className="mt-1 h-9 text-sm font-semibold"
            maxLength={SOLUTION_LIMITS.maxTitleLength}
            onChange={(event) => update((current) => ({ ...current, title: event.target.value || undefined }))}
            placeholder="Title (optional)"
            value={draft.title ?? ""}
          />
        ) : draft.title ? (
          <h2 className="truncate text-[15px] font-semibold tracking-tight" id={titleId}>
            {draft.title}
          </h2>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!readOnly ? (
          effectiveMode === "present" ? (
            <Button aria-label="Edit steps" className="h-11 px-3 sm:h-8" onClick={() => setMode("edit")} size="sm" type="button" variant="ghost">
              <Pencil aria-hidden className="size-4" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          ) : (
            <Button aria-label="Present steps" className="h-11 px-3 sm:h-8" onClick={enterPresent} size="sm" type="button" variant="ghost">
              <Eye aria-hidden className="size-4" />
              <span className="hidden sm:inline">Present</span>
            </Button>
          )
        ) : null}
      </div>
    </header>
  );

  let body: ReactNode;
  if (effectiveMode === "present") {
    body = (
      <>
        {draft.problem ? (
          <p className="px-3 pt-3 text-[14px] leading-6 sm:px-4">
            <SolutionRichText text={draft.problem} />
          </p>
        ) : null}
        {total === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No steps yet.</p>
            {!readOnly ? (
              <Button onClick={() => setMode("edit")} size="sm" type="button" variant="outline">
                <Pencil aria-hidden className="size-4" />
                Write or generate steps
              </Button>
            ) : null}
          </div>
        ) : (
          <ol aria-label="Solution steps" className="flex flex-col gap-1.5 px-2 py-3 sm:px-3" ref={listRef}>
            {visibleSteps.map((step, index) => (
              <StepRow
                detailsOpen={openDetails.has(step.id)}
                entering={index === enteringIndex}
                index={index}
                isCurrent={index === revealed - 1}
                key={step.id}
                onToggleDetails={toggleDetails}
                step={step}
              />
            ))}
            {answerVisible ? (
              <li
                className="solution-answer mt-1 rounded-xl border border-primary/40 bg-primary/[0.08] px-3 py-3 shadow-sm sm:px-4"
                data-entering={enteringIndex === total - 1 && !reducedMotion ? "true" : "false"}
                data-testid="solution-answer"
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Answer</p>
                <SolutionMath ariaLabel={`Answer: ${draft.answer}`} latex={draft.answer ?? ""} />
              </li>
            ) : null}
          </ol>
        )}
      </>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3 px-3 py-3 sm:px-4">
        <Textarea
          aria-label="Problem statement"
          className="min-h-[64px] text-[13px]"
          maxLength={SOLUTION_LIMITS.maxProblemLength}
          onChange={(event) => update((current) => ({ ...current, problem: event.target.value || undefined }))}
          placeholder="Problem statement (optional). Use $...$ for math, e.g. Solve $x^2 - 5x + 6 = 0$."
          rows={2}
          value={draft.problem ?? ""}
        />
        {showGenerate || total === 0 ? (
          <GeneratePanel hasSteps={total > 0} onCancel={() => setShowGenerate(false)} onGenerate={applyGenerated} />
        ) : null}
        <ol aria-label="Edit steps" className="flex flex-col gap-2">
          {steps.map((step, index) => (
            <StepEditor
              autoFocus={focusStepId === step.id}
              index={index}
              key={step.id}
              onChangeStep={changeStep}
              onDelete={deleteStep}
              onInsertAfter={insertAfter}
              onMove={moveStep}
              onTogglePlain={setPlainEditor}
              plain={plainEditor}
              step={step}
              total={total}
            />
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 sm:h-9" disabled={total >= SOLUTION_LIMITS.maxSteps} onClick={() => insertAfter(undefined)} size="sm" type="button" variant="outline">
            <Plus aria-hidden className="size-4" />
            Add step
          </Button>
          {total > 0 ? (
            <Button className="h-11 sm:h-9" onClick={() => setShowGenerate((current) => !current)} size="sm" type="button" variant="outline">
              <Wand2 aria-hidden className="size-4" />
              Generate steps
            </Button>
          ) : null}
          <Button className="h-11 sm:h-9" disabled={checking || total === 0} onClick={() => runCheck(draft)} size="sm" type="button" variant="outline">
            {checking ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <ShieldCheck aria-hidden className="size-4" />}
            Check all steps
          </Button>
        </div>
        <Input
          aria-label="Final answer (LaTeX)"
          className="h-10 font-mono text-[13px]"
          maxLength={SOLUTION_LIMITS.maxAnswerLength}
          onChange={(event) => update((current) => ({ ...current, answer: event.target.value || undefined }))}
          placeholder="Final answer in LaTeX, e.g. x = 2 \quad\text{or}\quad x = 3"
          spellCheck={false}
          value={draft.answer ?? ""}
        />
      </div>
    );
  }

  const controls =
    effectiveMode === "present" && total > 0 ? (
      <footer className="border-t border-border/60 px-2 pb-2 pt-1.5 sm:px-3">
        <div className="flex items-center gap-1">
          <Button aria-label="Hide all steps" className="size-11 sm:size-9" disabled={revealed === 0} onClick={() => setRevealed(0)} size="icon" type="button" variant="ghost">
            <ChevronsLeft aria-hidden className="size-4" />
          </Button>
          <Button aria-label="Previous step" className="size-11 sm:size-9" disabled={revealed === 0} onClick={() => setRevealed((current) => current - 1)} size="icon" type="button" variant="ghost">
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <Button
            aria-label={playing ? "Pause" : "Play"}
            aria-pressed={playing}
            className="size-11 sm:size-9"
            disabled={revealed >= total && !playing}
            onClick={() => setPlaying((current) => !current)}
            size="icon"
            type="button"
            variant={playing ? "secondary" : "ghost"}
          >
            {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
          </Button>
          <Button aria-label="Next step" className="size-11 sm:size-9" disabled={revealed >= total} onClick={() => setRevealed((current) => current + 1)} size="icon" type="button" variant="ghost">
            <ChevronRight aria-hidden className="size-4" />
          </Button>
          <Button aria-label="Show all steps" className="size-11 sm:size-9" disabled={revealed >= total} onClick={() => setRevealed(total)} size="icon" type="button" variant="ghost">
            <ChevronsRight aria-hidden className="size-4" />
          </Button>
          <label className="sr-only" htmlFor={scrubberId}>
            Steps revealed
          </label>
          <input
            aria-valuetext={`${revealed} of ${total} steps shown`}
            className="solution-scrubber min-w-0 flex-1"
            id={scrubberId}
            max={total}
            min={0}
            onChange={(event) => setRevealed(Number(event.target.value))}
            step={1}
            type="range"
            value={revealed}
          />
          <span aria-hidden className="w-12 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
            {revealed}/{total}
          </span>
        </div>
      </footer>
    ) : null;

  return (
    <div
      aria-labelledby={draft.title ? titleId : undefined}
      aria-label={draft.title ? undefined : "Worked solution"}
      className={cn(
        "solution-card flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm",
        "focus:outline-none focus-visible:ring-4 focus-visible:ring-ring/15",
        className,
      )}
      data-mode={effectiveMode}
      data-revealed={revealed}
      onKeyDown={onKeyDown}
      ref={rootRef}
      role="region"
      tabIndex={0}
    >
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{body}</div>
      {controls}
      <p aria-live="polite" className="sr-only" role="status">
        {checkSummary || (total > 0 && effectiveMode === "present" ? `${revealed} of ${total} steps shown. ${checkedCount} of ${total} steps checked.` : "")}
      </p>
    </div>
  );
}

export default SolutionStepsCard;
