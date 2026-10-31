import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Atom, ChevronDown, FlaskConical, Hash, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadRDKit, type RDKitModule } from "@/lib/chemistry/rdkit-loader";
import {
  defaultMoleculeExample,
  defaultReactionExample,
  getLibraryEntry,
  moleculeFromLibraryEntry,
  resolveMoleculeInput,
  searchLibrary,
  type MoleculeLibraryEntry,
} from "@/lib/chemistry/molecule-library";
import {
  analyzeMoleculeDocument,
  describeForScreenReader,
  drawOptionsKey,
  renderMoleculeSvg,
  splitReactionSmiles,
  type ComponentInfo,
  type MoleculeAnalysis,
  type RenderResult,
} from "@/lib/chemistry/molecule-render";
import {
  createMolecule,
  moleculeDocumentsEqual,
  type MoleculeDocument,
  type MoleculeKind,
} from "@/lib/chemistry/molecule-types";

export type MoleculeCardProps = {
  value: MoleculeDocument | undefined;
  onChange: (next: MoleculeDocument) => void;
  readOnly?: boolean;
  className?: string;
};

// ---------------------------------------------------------------------------------------------------------------------
// Engine loading

type EngineState =
  | { status: "loading" }
  | { status: "ready"; rdkit: RDKitModule }
  | { status: "error"; message: string };

function useRdkit() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<EngineState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loadRDKit().then(
      (rdkit) => {
        if (!cancelled) setState({ status: "ready", rdkit });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "The chemistry engine could not be loaded.",
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  return { state, retry };
}

// ---------------------------------------------------------------------------------------------------------------------
// Sizing: observe the tile, round to 16px steps so React only re-renders when the drawing really needs a new size.

const SIZE_STEP = 16;
const DEFAULT_SIZE = { width: 320, height: 240 };
/** Cards narrower or shorter than this switch to a one-row footer with icon-only buttons. */
const COMPACT_WIDTH = 380;
const COMPACT_HEIGHT = 340;

function useObservedSize<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState(DEFAULT_SIZE);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    let latest = { width: 0, height: 0 };
    const apply = () => {
      frame = 0;
      const width = Math.max(SIZE_STEP * 8, Math.round(latest.width / SIZE_STEP) * SIZE_STEP);
      const height = Math.max(SIZE_STEP * 6, Math.round(latest.height / SIZE_STEP) * SIZE_STEP);
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box || box.width < 1 || box.height < 1) return;
      latest = { width: box.width, height: box.height };
      if (!frame) frame = requestAnimationFrame(apply);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, size };
}

// ---------------------------------------------------------------------------------------------------------------------
// SVG cache keyed by (smiles, options, size).

const SVG_CACHE_LIMIT = 80;
const svgCache = new Map<string, RenderResult>();

/** Test hook: forget every cached drawing. */
export function clearMoleculeSvgCache() {
  svgCache.clear();
}

function cachedRender(rdkit: RDKitModule, doc: MoleculeDocument, size: { width: number; height: number }): RenderResult {
  const key = drawOptionsKey(doc, size);
  const hit = svgCache.get(key);
  if (hit) {
    svgCache.delete(key);
    svgCache.set(key, hit);
    return hit;
  }
  const result = renderMoleculeSvg(rdkit, doc, {
    ...size,
    showAtomNumbers: doc.showAtomNumbers,
    showHydrogens: doc.showHydrogens,
    highlightAtoms: doc.highlightAtoms,
  });
  svgCache.set(key, result);
  if (svgCache.size > SVG_CACHE_LIMIT) {
    const oldest = svgCache.keys().next().value;
    if (oldest !== undefined) svgCache.delete(oldest);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers

export function parseAtomNumberList(text: string): number[] {
  const numbers = new Set<number>();
  for (const part of text.split(/[\s,;]+/)) {
    if (!part) continue;
    const range = /^(\d{1,4})-(\d{1,4})$/.exec(part);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      for (let atom = Math.min(from, to); atom <= Math.max(from, to) && numbers.size < 200; atom += 1) if (atom >= 1) numbers.add(atom);
    } else if (/^\d{1,4}$/.test(part) && Number(part) >= 1) {
      numbers.add(Number(part));
    }
  }
  return [...numbers].slice(0, 200);
}

const ROLE_LABEL: Record<ComponentInfo["role"], string> = {
  molecule: "Molecule",
  reactant: "Reactant",
  agent: "Agent",
  product: "Product",
};

function formatMass(mw: number) {
  return `${mw.toFixed(mw >= 1000 ? 1 : 2)} g/mol`;
}

function stereoText(stereo: ComponentInfo["stereo"][number]) {
  return stereo.kind === "atom" ? `${stereo.atoms[0]}${stereo.label}` : `${stereo.atoms[0]}=${stereo.atoms[1]} ${stereo.label}`;
}

function stereoSpoken(stereo: ComponentInfo["stereo"][number]) {
  return stereo.kind === "atom"
    ? `Atom ${stereo.atoms[0]} is ${stereo.label}`
    : `Double bond between atoms ${stereo.atoms[0]} and ${stereo.atoms[1]} is ${stereo.label}`;
}

function exampleFor(kind: MoleculeKind): MoleculeDocument {
  const entry = getLibraryEntry(kind === "reaction" ? defaultReactionExample : defaultMoleculeExample);
  return entry ? moleculeFromLibraryEntry(entry) : createMolecule(kind === "reaction" ? "C=CC=C.C=C>>C1CCC=CC1" : "CCO");
}

const chipClass = "inline-flex min-h-7 items-center gap-1 rounded-lg bg-white/[0.08] px-2 py-0.5 text-xs font-medium text-[#dbeafe]";
const controlButton =
  "inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32d5c8]/70 disabled:cursor-not-allowed disabled:opacity-40";

// ---------------------------------------------------------------------------------------------------------------------
// Component

export function MoleculeCard({ value, onChange, readOnly = false, className }: MoleculeCardProps) {
  const { state: engine, retry } = useRdkit();
  const { ref: stageRef, size } = useObservedSize();
  const { ref: rootRef, size: cardSize } = useObservedSize<HTMLElement>();
  const compact = cardSize.width < COMPACT_WIDTH || cardSize.height < COMPACT_HEIGHT;
  const listboxId = useId();
  const [localKind, setLocalKind] = useState<MoleculeKind>("molecule");
  const [draft, setDraft] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [highlightDraft, setHighlightDraft] = useState("");

  const activeKind: MoleculeKind = value?.kind ?? localKind;
  const shownText = value ? value.name || value.smiles : "";
  const rdkit = engine.status === "ready" ? engine.rdkit : null;

  useEffect(() => setDraft(shownText), [shownText]);
  useEffect(() => setCaptionDraft(value?.caption ?? ""), [value?.caption]);
  const highlightKey = (value?.highlightAtoms ?? []).join(", ");
  useEffect(() => setHighlightDraft(highlightKey), [highlightKey]);

  const analysis: MoleculeAnalysis | null = useMemo(
    () => (rdkit && value ? analyzeMoleculeDocument(rdkit, value) : null),
    [rdkit, value],
  );
  const rendered: RenderResult | null = useMemo(
    () => (rdkit && value && analysis?.ok ? cachedRender(rdkit, value, size) : null),
    [rdkit, value, analysis, size],
  );

  const suggestions: MoleculeLibraryEntry[] = useMemo(
    () => (suggestionsOpen && !readOnly ? searchLibrary(draft === shownText ? "" : draft, 6, activeKind) : []),
    [suggestionsOpen, readOnly, draft, shownText, activeKind],
  );

  const emit = useCallback(
    (next: MoleculeDocument) => {
      if (!moleculeDocumentsEqual(next, value)) onChange(next);
    },
    [onChange, value],
  );

  /** Resolves typed text (a library name or a SMILES) into a document, carrying over the card's display options. */
  const commitText = useCallback(
    (text: string) => {
      const resolved = resolveMoleculeInput(text);
      if (!resolved) return;
      const changedStructure = resolved.smiles !== value?.smiles;
      const next: MoleculeDocument = { ...resolved };
      if (value?.caption) next.caption = value.caption;
      if (value?.showAtomNumbers !== undefined) next.showAtomNumbers = value.showAtomNumbers;
      if (value?.showHydrogens !== undefined) next.showHydrogens = value.showHydrogens;
      if (!changedStructure && value?.highlightAtoms) next.highlightAtoms = value.highlightAtoms;
      setLocalKind(next.kind);
      emit(next);
    },
    [emit, value],
  );

  // Commit a valid entry once typing pauses, so the board updates without waiting for blur or Enter.
  useEffect(() => {
    if (readOnly || !rdkit) return;
    const text = draft.trim();
    if (!text || draft === shownText) return;
    const timer = window.setTimeout(() => {
      const resolved = resolveMoleculeInput(text);
      if (resolved && analyzeMoleculeDocument(rdkit, resolved).ok) commitText(text);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, shownText, rdkit, readOnly, commitText]);

  const pickSuggestion = (entry: MoleculeLibraryEntry) => {
    setSuggestionsOpen(false);
    setActiveIndex(-1);
    setDraft(entry.name);
    commitText(entry.name);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestions.length) {
        setSuggestionsOpen(true);
        return;
      }
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const picked = suggestions[activeIndex];
      if (picked) pickSuggestion(picked);
      else {
        setSuggestionsOpen(false);
        commitText(draft);
      }
    } else if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
  };

  const switchKind = (kind: MoleculeKind) => {
    if (kind === activeKind && value) return;
    setLocalKind(kind);
    if (!value || value.kind === kind) return;
    if (kind === "reaction") {
      emit({ ...exampleFor("reaction"), ...(value.caption ? { caption: value.caption } : {}) });
      return;
    }
    const firstReactant = splitReactionSmiles(value.smiles)?.reactants[0];
    emit({ ...(firstReactant ? createMolecule(firstReactant) : exampleFor("molecule")), ...(value.caption ? { caption: value.caption } : {}) });
  };

  const toggleFlag = (flag: "showAtomNumbers" | "showHydrogens") => {
    if (!value) return;
    emit({ ...value, [flag]: !value[flag] });
  };

  const commitCaption = () => {
    if (!value) return;
    const caption = captionDraft.trim();
    const { caption: _previous, ...rest } = value;
    emit(caption ? { ...rest, caption } : rest);
  };

  const commitHighlights = () => {
    if (!value) return;
    const atoms = parseAtomNumberList(highlightDraft);
    const { highlightAtoms: _previous, ...rest } = value;
    emit(atoms.length ? { ...rest, highlightAtoms: atoms } : rest);
  };

  const isReaction = activeKind === "reaction";
  const molecule = analysis?.ok && analysis.kind === "molecule" ? analysis.components[0] : undefined;
  const label = value ? describeForScreenReader(value, analysis) : "Chemical structure";
  const failure = analysis && !analysis.ok ? analysis.message : rendered && !rendered.ok ? rendered.message : null;
  const examples = (["ethanol", "aspirin", activeKind === "reaction" ? "diels-alder" : "caffeine"] as const)
    .map((id) => getLibraryEntry(id))
    .filter((entry): entry is MoleculeLibraryEntry => Boolean(entry && entry.kind === activeKind));

  return (
    <section
      ref={rootRef}
      aria-label={value?.name ? `Molecule card: ${value.name}` : "Molecule card"}
      data-testid="molecule-card"
      className={cn(
        "flex h-full min-h-[240px] w-full min-w-[260px] flex-col gap-2 rounded-2xl border border-white/10 bg-[#111827] p-2.5 text-[#dbeafe] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      {!readOnly && (
        <div className={cn("flex items-center gap-2", !compact && "flex-wrap")}>
          <div className="relative min-w-[7rem] flex-1">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#dbeafe]/60" />
            <input
              type="text"
              role="combobox"
              aria-label="Molecule name or SMILES"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={draft}
              placeholder={isReaction ? "Reaction SMILES, e.g. A.B>>C" : "Name or SMILES, e.g. ethanol"}
              onChange={(event) => {
                setDraft(event.target.value);
                setSuggestionsOpen(true);
                setActiveIndex(-1);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={() => {
                setSuggestionsOpen(false);
                setActiveIndex(-1);
                if (draft.trim() && draft !== shownText) commitText(draft);
              }}
              onKeyDown={onInputKeyDown}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#1e293b] pl-9 pr-3 font-mono text-sm text-[#dbeafe] placeholder:font-sans placeholder:text-[#dbeafe]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32d5c8]/70"
            />
            {suggestions.length > 0 && (
              <ul
                id={listboxId}
                role="listbox"
                aria-label="Matching molecules"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-xl border border-white/10 bg-[#1e293b] p-1 shadow-xl"
              >
                {suggestions.map((entry, index) => (
                  <li
                    key={entry.id}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pickSuggestion(entry)}
                    className={cn(
                      "flex min-h-10 cursor-pointer flex-col justify-center rounded-lg px-2.5 py-1 text-sm",
                      index === activeIndex ? "bg-[#32d5c8]/20" : "hover:bg-white/[0.07]",
                    )}
                  >
                    <span className="truncate font-medium">{entry.name}</span>
                    <span className="truncate font-mono text-[11px] text-[#dbeafe]/60">{entry.smiles}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div role="group" aria-label="Structure type" className="flex shrink-0 rounded-xl bg-[#1e293b] p-0.5">
            {(["molecule", "reaction"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={activeKind === kind}
                onClick={() => switchKind(kind)}
                className={cn(
                  controlButton,
                  activeKind === kind ? "bg-[#32d5c8] text-[#06201e]" : "text-[#dbeafe]/80 hover:bg-white/[0.07]",
                )}
              >
                {kind === "molecule" ? <Atom aria-hidden className="h-4 w-4" /> : <FlaskConical aria-hidden className="h-4 w-4" />}
                <span className={compact ? "sr-only" : undefined}>{kind === "molecule" ? "Molecule" : "Reaction"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        ref={stageRef}
        className="relative min-h-[96px] flex-1 overflow-hidden rounded-xl bg-[#f7f3ea] bg-[radial-gradient(120%_90%_at_50%_0%,#fffdf8_0%,#f7f3ea_55%,#efe9db_100%)] shadow-inner ring-1 ring-black/10"
      >
        {engine.status === "loading" && value && (
          <div role="status" aria-label="Loading the chemistry engine" className="flex h-full w-full flex-col items-center justify-center gap-3 p-6">
            <div className="h-16 w-28 animate-pulse rounded-2xl bg-slate-900/10 motion-reduce:animate-none" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-slate-900/10 motion-reduce:animate-none" />
            <span className="sr-only">Loading the chemistry engine…</span>
          </div>
        )}
        {engine.status === "error" && (
          <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center text-slate-800">
            <AlertTriangle aria-hidden className="h-6 w-6 text-amber-600" />
            <p className="max-w-xs text-sm">{engine.message}</p>
            <button type="button" onClick={retry} className={cn(controlButton, "bg-slate-900 text-white hover:bg-slate-700")}>
              <RefreshCw aria-hidden className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}
        {!value && engine.status !== "error" && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center text-slate-700">
            <Atom aria-hidden className="h-7 w-7 text-slate-400" />
            <p className="max-w-xs text-sm">
              {readOnly
                ? "No structure on this card yet."
                : isReaction
                  ? "Type a reaction SMILES such as C=CC=C.C=C>>C1CCC=CC1, or try an example."
                  : "Type a name like ethanol, or paste a SMILES. Stereochemistry is drawn automatically."}
            </p>
            {!readOnly && (
              <div className="flex flex-wrap justify-center gap-2">
                {examples.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => emit(moleculeFromLibraryEntry(entry))}
                    className={cn(controlButton, "bg-slate-900/90 text-white hover:bg-slate-800")}
                  >
                    {entry.kind === "reaction" ? "Diels–Alder" : entry.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {failure && engine.status === "ready" && (
          <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-2 p-5 text-center text-slate-800">
            <AlertTriangle aria-hidden className="h-6 w-6 text-amber-600" />
            <p className="max-w-xs text-sm font-medium">{failure}</p>
            {value && <p className="max-w-full truncate font-mono text-xs text-slate-500">{value.smiles}</p>}
          </div>
        )}
        {rendered?.ok && (
          <div
            role="img"
            aria-label={label}
            data-testid="molecule-drawing"
            className="flex h-full w-full items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full [&>svg]:shrink-0"
            dangerouslySetInnerHTML={{ __html: rendered.svg }}
          />
        )}
      </div>

      {value && (
        <div className={cn("gap-1.5", compact ? "flex flex-row flex-wrap items-center" : "flex flex-col")}>
          {(value.caption || (value.name && (readOnly || !compact))) && (
            <div className={cn("min-w-0 px-0.5", compact && "w-full")}>
              {value.name && (readOnly || !compact) && <p className="truncate text-sm font-semibold text-white">{value.name}</p>}
              {value.caption && <p className="line-clamp-2 text-xs text-[#dbeafe]/80">{value.caption}</p>}
            </div>
          )}
          <div
            className={cn(
              "flex items-center gap-1.5",
              compact ? "min-w-0 flex-1 flex-nowrap overflow-x-auto [scrollbar-width:none] [&>*]:shrink-0" : "flex-wrap",
            )}
          >
            {molecule && (
              <>
                <span className={chipClass} aria-label={`Formula ${molecule.formulaDisplay}`}>
                  {molecule.formulaDisplay}
                </span>
                <span className={chipClass} aria-label={`Molecular weight ${formatMass(molecule.mw)}`}>
                  {formatMass(molecule.mw)}
                </span>
              </>
            )}
            {analysis?.ok && analysis.kind === "reaction" && (
              <>
                <span className={chipClass}>
                  {analysis.components.filter((c) => c.role === "reactant").map((c) => c.formulaDisplay).join(" + ")}
                  {" → "}
                  {analysis.components.filter((c) => c.role === "product").map((c) => c.formulaDisplay).join(" + ")}
                </span>
                <span
                  className={cn(chipClass, analysis.balanced ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200")}
                >
                  {analysis.balanced ? "Atoms balanced" : "Not balanced"}
                </span>
              </>
            )}
            {analysis?.ok &&
              analysis.components.map((component, index) =>
                component.stereo.length ? (
                  <span
                    key={`${component.role}-${index}`}
                    className={cn(chipClass, "bg-[#7c5cff]/20 text-[#e4dcff]")}
                    aria-label={`${ROLE_LABEL[component.role]} stereochemistry: ${component.stereo.map(stereoSpoken).join("; ")}`}
                  >
                    {analysis.kind === "reaction" ? `${ROLE_LABEL[component.role]} ` : ""}
                    {component.stereo.slice(0, 8).map(analysis.kind === "reaction" ? (item) => item.label : stereoText).join(analysis.kind === "reaction" ? ", " : " · ")}
                    {component.stereo.length > 8 ? ` +${component.stereo.length - 8}` : ""}
                  </span>
                ) : null,
              )}
          </div>

          {!readOnly && (
            <div className={cn("flex items-center gap-1.5", compact ? "ml-auto shrink-0" : "flex-wrap")}>
              <button
                type="button"
                aria-pressed={Boolean(value.showAtomNumbers)}
                disabled={isReaction}
                title={isReaction ? "Atom numbers apply to single molecules" : "Number the atoms for NMR assignments and mechanisms"}
                onClick={() => toggleFlag("showAtomNumbers")}
                className={cn(controlButton, value.showAtomNumbers ? "bg-[#32d5c8] text-[#06201e]" : "bg-white/[0.08] text-[#dbeafe] hover:bg-white/[0.14]")}
              >
                <Hash aria-hidden className="h-4 w-4" />
                <span className={compact ? "sr-only" : undefined}>Atom numbers</span>
              </button>
              <button
                type="button"
                aria-pressed={Boolean(value.showHydrogens)}
                title="Draw every hydrogen"
                onClick={() => toggleFlag("showHydrogens")}
                className={cn(controlButton, value.showHydrogens ? "bg-[#32d5c8] text-[#06201e]" : "bg-white/[0.08] text-[#dbeafe] hover:bg-white/[0.14]")}
              >
                <span aria-hidden className="font-mono text-sm leading-none">H</span>
                <span className={compact ? "sr-only" : undefined}>Show H</span>
              </button>
              <button
                type="button"
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen((open) => !open)}
                className={cn(controlButton, !compact && "ml-auto", "bg-white/[0.08] text-[#dbeafe] hover:bg-white/[0.14]")}
              >
                <SlidersHorizontal aria-hidden className="h-4 w-4" />
                <span className={compact ? "sr-only" : undefined}>More</span>
                <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 transition-transform motion-reduce:transition-none", compact && "hidden", optionsOpen && "rotate-180")} />
              </button>
            </div>
          )}

          {!readOnly && optionsOpen && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[#dbeafe]/80">
                Caption
                <input
                  type="text"
                  value={captionDraft}
                  maxLength={500}
                  placeholder="Add a caption"
                  onChange={(event) => setCaptionDraft(event.target.value)}
                  onBlur={commitCaption}
                  onKeyDown={(event) => event.key === "Enter" && commitCaption()}
                  className="h-10 rounded-lg border border-white/10 bg-[#1e293b] px-2.5 text-sm text-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32d5c8]/70"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[#dbeafe]/80">
                Highlight atoms (by number, e.g. 1, 3-5)
                <input
                  type="text"
                  inputMode="numeric"
                  value={highlightDraft}
                  disabled={isReaction}
                  placeholder="None"
                  onChange={(event) => setHighlightDraft(event.target.value)}
                  onBlur={commitHighlights}
                  onKeyDown={(event) => event.key === "Enter" && commitHighlights()}
                  className="h-10 rounded-lg border border-white/10 bg-[#1e293b] px-2.5 font-mono text-sm text-[#dbeafe] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#32d5c8]/70 disabled:opacity-40"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default MoleculeCard;
