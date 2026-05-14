import { useMemo, useReducer, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  Atom,
  Beaker,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  GitCompare,
  Grid2X2,
  Layers,
  LineChart,
  ListFilter,
  Microscope,
  NotebookPen,
  Scale,
  Search,
  ShieldCheck,
  Table2,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspacePanel } from "@/components/workspace/workspace-panel";
import { calculateStrongAcidBase, getPhScaleLabel } from "@/lib/chemistry/acid-base";
import { chemistryConceptCards } from "@/lib/chemistry/chemistry-concepts";
import { commonIons } from "@/lib/chemistry/common-ions";
import { demoReactions } from "@/lib/chemistry/demo-reactions";
import { generateKineticsDataset, type KineticsOrder } from "@/lib/chemistry/kinetics";
import { calculateMolarMass } from "@/lib/chemistry/molar-mass";
import {
  buildAtomModel,
  elementCategories,
  findElement,
  formatCharge,
  formatNumber,
  getTrendDisplay,
  getTrendNumericValue,
  getTrendRange,
  getTrendScore,
  periodicTableDataLedger,
  periodicTableElements,
  searchElements,
  trendModeLabels,
  type PeriodicTableElement,
  type TrendMode,
} from "@/lib/chemistry/periodic-table-data";
import { balanceEquation } from "@/lib/chemistry/reaction-balancer";
import { solubilityRules } from "@/lib/chemistry/solubility-rules";
import { solveStoichiometryProblem } from "@/lib/chemistry/stoichiometry";
import { calculateHeatTransfer, describeHeatSign } from "@/lib/chemistry/thermochemistry";
import { generateStrongAcidStrongBaseCurve } from "@/lib/chemistry/titration";
import {
  createTitrationInitialState,
  titrationReducer,
} from "@/lib/chemistry/titration-lab";
import { hasDesmosApiKey } from "@/lib/desmos-loader";
import type { WorkspaceModuleId } from "@/types";

const stoichTemplate = {
  id: "template-water-from-hydrogen",
  equation: "H2 + O2 -> H2O",
  givenFormula: "H2",
  targetFormula: "H2O",
};

function Sparkline({
  points,
  ariaLabel,
}: {
  points: Array<{ x: number; y: number }>;
  ariaLabel: string;
}) {
  const path = points
    .map((point, index) => {
      const x = Math.max(0, Math.min(100, point.x));
      const y = 100 - Math.max(0, Math.min(100, point.y));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg aria-label={ariaLabel} className="chem-showcase-chart" viewBox="0 0 100 100">
      <line stroke="currentColor" strokeOpacity="0.15" x1="0" x2="100" y1="50" y2="50" />
      <line stroke="currentColor" strokeOpacity="0.15" x1="50" x2="50" y1="0" y2="100" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function desmosStatusCopy() {
  const hasKey = hasDesmosApiKey();
  return hasKey
    ? "Desmos key detected; this graph surface is ready to mount the live chemistry graph when selected."
    : "Desmos unavailable locally. Showing the lightweight fallback chart so the preset does not waste space.";
}

type PeriodicViewMode = "table" | "list" | "builder" | "compare";
type StudyLayer = "chem101" | "ap";

const coreTrendModes: TrendMode[] = [
  "category",
  "electronegativity",
  "atomic-radius",
  "ionization-energy",
  "electron-affinity",
  "density",
  "melting-point",
  "boiling-point",
  "metallic-character",
  "valence-electrons",
  "oxidation-state",
  "discovery-year",
  "abundance",
];

const mobilePeriodicViews: Array<{ id: PeriodicViewMode; label: string }> = [
  { id: "table", label: "Table" },
  { id: "list", label: "Search" },
  { id: "builder", label: "Builder" },
  { id: "compare", label: "Compare" },
];

const periodicViewButtons = [
  { id: "table" as const, label: "Table", Icon: Grid2X2 },
  { id: "list" as const, label: "List", Icon: ListFilter },
  { id: "builder" as const, label: "Builder", Icon: Atom },
  { id: "compare" as const, label: "Compare", Icon: GitCompare },
];

function elementSummary(element: PeriodicTableElement, trendMode?: TrendMode) {
  const trend = trendMode ? `, ${trendModeLabels[trendMode].label}: ${getTrendDisplay(element, trendMode)}` : "";
  return `${element.name} (${element.symbol}), atomic number ${element.atomicNumber}, group ${element.groupDisplay}, period ${element.period}${trend}`;
}

function trendHue(trendMode: TrendMode, score: number) {
  if (trendMode === "atomic-radius" || trendMode === "metallic-character") {
    return 35 + score * 28;
  }
  if (trendMode === "electronegativity" || trendMode === "ionization-energy" || trendMode === "electron-affinity") {
    return 205 + score * 60;
  }
  if (trendMode === "density" || trendMode === "melting-point" || trendMode === "boiling-point") {
    return 10 + score * 330;
  }
  if (trendMode === "abundance") {
    return 150 + score * 55;
  }
  return 205;
}

function selectedElementFallback() {
  return periodicTableElements.find((element) => element.symbol === "C") ?? periodicTableElements[0];
}

function periodicTableElementsByNumber(atomicNumber: number) {
  return periodicTableElements.find((element) => element.atomicNumber === atomicNumber) ?? selectedElementFallback();
}

function tileStyle(element: PeriodicTableElement, trendMode: TrendMode): CSSProperties {
  const score = getTrendScore(element, trendMode);
  const hue = trendHue(trendMode, score);
  const alpha = trendMode === "category" || trendMode === "state" || trendMode === "block" ? 0.18 : 0.18 + score * 0.42;
  return {
    gridColumn: element.tableColumn + 1,
    gridRow: element.tableRow,
    "--chem-trend-hue": `${hue}`,
    "--chem-trend-alpha": `${alpha}`,
  } as CSSProperties;
}

function ShellMiniModel({ shells }: { shells: number[] }) {
  const maxShell = Math.max(...shells, 2);
  return (
    <div className="chem-shell-mini" aria-label={`Electron shells ${shells.join(", ")}`}>
      {shells.map((count, index) => (
        <span
          aria-hidden="true"
          key={`${index}-${count}`}
          style={{ width: `${32 + (index + 1) * 22}px`, height: `${32 + (index + 1) * 22}px`, opacity: 0.35 + count / maxShell / 1.8 }}
        />
      ))}
      <strong>{shells.join("-")}</strong>
    </div>
  );
}

function OrbitalLadder({ configuration }: { configuration: string }) {
  const orbitals = configuration.replace(/^\[[^\]]+\]\s*/, "").split(/\s+/).filter(Boolean).slice(0, 8);
  return (
    <div className="chem-orbital-mini" aria-label={`Electron configuration ${configuration}`}>
      {(orbitals.length ? orbitals : [configuration]).map((orbital) => (
        <span key={orbital}>{orbital}</span>
      ))}
    </div>
  );
}

function ElementInspector({
  element,
  studyLayer,
  onCompare,
  onBuild,
  onSendToNotes,
  onOpenPractice,
}: {
  element: PeriodicTableElement;
  studyLayer: StudyLayer;
  onCompare: (element: PeriodicTableElement) => void;
  onBuild: (element: PeriodicTableElement) => void;
  onSendToNotes?: (text: string) => void;
  onOpenPractice?: () => void;
}) {
  const noteText = `${element.name} (${element.symbol}) - ${element.chem101Note} AP angle: ${element.apChemistryNote}`;
  return (
    <aside aria-label="Selected element inspector" className="chem-element-inspector-v3">
      <header className="chem-element-hero-card">
        <div>
          <p>{elementCategories[element.category]}</p>
          <h3>{element.symbol}</h3>
          <strong>{element.name}</strong>
          <span>Atomic number {element.atomicNumber}</span>
        </div>
        <ShellMiniModel shells={element.shells} />
      </header>

      <dl className="chem-property-matrix">
        <div>
          <dt>Atomic weight</dt>
          <dd>{element.atomicWeightDisplay}</dd>
        </div>
        <div>
          <dt>Group / period</dt>
          <dd>
            {element.groupDisplay} / {element.period}
          </dd>
        </div>
        <div>
          <dt>Block / state</dt>
          <dd>
            {element.block}-block / {element.phase}
          </dd>
        </div>
        <div>
          <dt>Valence</dt>
          <dd>{element.valenceElectrons}</dd>
        </div>
        <div>
          <dt>Common ions</dt>
          <dd>{element.commonIons.join(", ") || "none common"}</dd>
        </div>
        <div>
          <dt>Oxidation states</dt>
          <dd>{element.commonOxidationStates.length ? element.commonOxidationStates.map((state) => (state > 0 ? `+${state}` : state)).join(", ") : "unknown"}</dd>
        </div>
        <div>
          <dt>Electronegativity</dt>
          <dd>{element.electronegativity ?? "unknown"}</dd>
        </div>
        <div>
          <dt>Ionization energy</dt>
          <dd>{element.firstIonizationEnergyEv ? `${formatNumber(element.firstIonizationEnergyEv)} eV` : "unknown"}</dd>
        </div>
      </dl>

      <section className="chem-inspector-section">
        <p className="chem-section-kicker">Electron configuration</p>
        <strong>{element.electronConfiguration}</strong>
        <OrbitalLadder configuration={element.electronConfiguration} />
      </section>

      <section className="chem-inspector-section" data-tone="learning">
        <p className="chem-section-kicker">{studyLayer === "ap" ? "AP Chemistry angle" : "Chem 101 angle"}</p>
        <p>{studyLayer === "ap" ? element.apChemistryNote : element.chem101Note}</p>
      </section>

      <section className="chem-inspector-section">
        <p className="chem-section-kicker">Bonding behavior</p>
        <p>{element.bondingBehavior}</p>
      </section>

      <section className="chem-inspector-section" data-tone="warning">
        <p className="chem-section-kicker">Common trap</p>
        <p>{element.commonMisconception}</p>
      </section>

      <section className="chem-inspector-section">
        <p className="chem-section-kicker">Quick check</p>
        <p>{element.quickCheck}</p>
      </section>

      <div className="chem-inspector-actions" aria-label="Element study actions">
        <Button onClick={() => onCompare(element)} type="button" variant="outline">
          <GitCompare data-icon="inline-start" />
          Compare
        </Button>
        <Button onClick={() => onBuild(element)} type="button" variant="outline">
          <Atom data-icon="inline-start" />
          Build atom
        </Button>
        <Button disabled={!onSendToNotes} onClick={() => onSendToNotes?.(noteText)} type="button" variant="outline">
          <NotebookPen data-icon="inline-start" />
          Send to notes
        </Button>
        <Button disabled={!onOpenPractice} onClick={onOpenPractice} type="button" variant="outline">
          <Brain data-icon="inline-start" />
          Practice
        </Button>
      </div>

      <details className="chem-data-provenance">
        <summary>Data quality and provenance</summary>
        <ul>
          {element.dataQualityNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <p>{periodicTableDataLedger[0].source} ({periodicTableDataLedger[0].license}). Source text was not copied.</p>
      </details>
    </aside>
  );
}

function TrendReasoningPanel({
  selected,
  trendMode,
}: {
  selected: PeriodicTableElement;
  trendMode: TrendMode;
}) {
  const meta = trendModeLabels[trendMode];
  const range = getTrendRange(trendMode);
  const value = getTrendDisplay(selected, trendMode);
  const points = periodicTableElements
    .map((element) => {
      const numeric = getTrendNumericValue(element, trendMode);
      if (numeric === null || !range || range.max === range.min) {
        return null;
      }
      return {
        x: (element.atomicNumber / 118) * 100,
        y: 92 - ((numeric - range.min) / (range.max - range.min)) * 78,
      };
    })
    .filter((point): point is { x: number; y: number } => Boolean(point));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");

  return (
    <section className="chem-trend-learning-panel" aria-label="Trend explanation and graph">
      <div>
        <p className="chem-section-kicker">Trend mode</p>
        <h3>{meta.label}</h3>
        <p>{meta.explanation}</p>
        <p className="chem-ap-reasoning">
          <Brain className="size-4" />
          {meta.apReasoning}
        </p>
      </div>
      <div className="chem-trend-legend">
        <span>Selected value</span>
        <strong>
          {selected.symbol}: {value} {value !== "unknown" && meta.unit !== "family" && meta.unit !== "state" && meta.unit !== "block" ? meta.unit : ""}
        </strong>
        <small>{meta.outlierNote}</small>
        {range ? (
          <div className="chem-legend-scale">
            <span>{formatNumber(range.min)}</span>
            <i />
            <span>{formatNumber(range.max)}</span>
          </div>
        ) : (
          <small>Color groups are categorical in this mode.</small>
        )}
      </div>
      {path ? (
        <svg className="chem-trend-sparkline" viewBox="0 0 100 100" aria-label={`${meta.label} by atomic number`}>
          <line x1="0" x2="100" y1="92" y2="92" />
          <line x1="0" x2="0" y1="8" y2="92" />
          <path d={path} />
        </svg>
      ) : null}
      <div className="chem-trend-quick-check">
        <p className="chem-section-kicker">AP launch prompt</p>
        <strong>Explain one exception or outlier without saying "because the table says so."</strong>
      </div>
    </section>
  );
}

function CompareElementsPanel({
  comparison,
  selected,
  onRemove,
  onAddSelected,
}: {
  comparison: PeriodicTableElement[];
  selected: PeriodicTableElement;
  onRemove: (atomicNumber: number) => void;
  onAddSelected: () => void;
}) {
  const visible = comparison.length ? comparison : [selected];
  return (
    <section className="chem-compare-panel-v3" aria-label="Compare elements">
      <header>
        <div>
          <p className="chem-section-kicker">Compare mode</p>
          <h3>Explain why elements differ</h3>
        </div>
        <Button disabled={comparison.some((element) => element.atomicNumber === selected.atomicNumber) || comparison.length >= 4} onClick={onAddSelected} type="button" variant="outline">
          Add selected
        </Button>
      </header>
      <div className="chem-compare-grid-v3">
        {visible.map((element) => (
          <article key={element.atomicNumber}>
            <button aria-label={`Remove ${element.name} from compare`} onClick={() => onRemove(element.atomicNumber)} type="button">
              x
            </button>
            <strong>{element.symbol}</strong>
            <span>{element.name}</span>
            <dl>
              <div>
                <dt>Radius</dt>
                <dd>{element.atomicRadiusPm ? `${element.atomicRadiusPm} pm` : "unknown"}</dd>
              </div>
              <div>
                <dt>EN</dt>
                <dd>{element.electronegativity ?? "unknown"}</dd>
              </div>
              <div>
                <dt>IE1</dt>
                <dd>{element.firstIonizationEnergyEv ? `${formatNumber(element.firstIonizationEnergyEv)} eV` : "unknown"}</dd>
              </div>
              <div>
                <dt>Valence</dt>
                <dd>{element.valenceElectrons}</dd>
              </div>
            </dl>
            <p>{element.apChemistryNote}</p>
          </article>
        ))}
      </div>
      <p className="chem-compare-prompt">
        AP prompt: Compare the elements using shells, shielding, and effective nuclear charge. Then name the common trap.
      </p>
    </section>
  );
}

function AtomBuilderWorkbench({
  initialElement,
  onSelectElement,
}: {
  initialElement?: PeriodicTableElement;
  onSelectElement?: (element: PeriodicTableElement) => void;
}) {
  const startingElement = initialElement ?? selectedElementFallback();
  const [protons, setProtons] = useState(startingElement.atomicNumber);
  const [neutrons, setNeutrons] = useState(Math.max(0, Math.round(startingElement.atomicMass) - startingElement.atomicNumber));
  const [electrons, setElectrons] = useState(startingElement.atomicNumber);
  const model = buildAtomModel(protons, neutrons, electrons);
  const element = model.element ?? startingElement;

  function applyPreset(nextProtons: number, nextNeutrons: number, nextElectrons: number) {
    setProtons(nextProtons);
    setNeutrons(nextNeutrons);
    setElectrons(nextElectrons);
    const nextElement = periodicTableElements.find((candidate) => candidate.atomicNumber === nextProtons);
    if (nextElement) {
      onSelectElement?.(nextElement);
    }
  }

  function applySelectedElement(nextElement: PeriodicTableElement) {
    setProtons(nextElement.atomicNumber);
    setNeutrons(Math.max(0, Math.round(nextElement.atomicMass) - nextElement.atomicNumber));
    setElectrons(nextElement.atomicNumber);
    onSelectElement?.(nextElement);
  }

  return (
    <div className="chem-builder-workbench-v3" data-testid="chem-atom-builder-v3">
      <section className="chem-builder-visual">
        <div className="chem-isotope-card">
          <span>{model.massNumber}</span>
          <strong>{element.symbol}</strong>
          <small>{model.charge === 0 ? "neutral" : formatCharge(model.charge)}</small>
        </div>
        <ShellMiniModel shells={model.shells.length ? model.shells : [0]} />
        <div className="chem-charge-balance" aria-label="Charge balance">
          <span style={{ width: `${Math.min(100, Math.max(8, model.protons * 2))}%` }}>p+ {model.protons}</span>
          <span style={{ width: `${Math.min(100, Math.max(8, model.electrons * 2))}%` }}>e- {model.electrons}</span>
        </div>
      </section>

      <section className="chem-builder-controls">
        <div className="chem-builder-input-grid">
          {[
            { label: "Protons", value: protons, setter: setProtons, helper: "identity" },
            { label: "Neutrons", value: neutrons, setter: setNeutrons, helper: "isotope" },
            { label: "Electrons", value: electrons, setter: setElectrons, helper: "charge" },
          ].map(({ label, value, setter, helper }) => (
            <label key={label}>
              <span>{label}</span>
              <Input inputMode="numeric" min={0} onChange={(event) => setter(Number(event.target.value))} type="number" value={value} />
              <small>{helper}</small>
            </label>
          ))}
        </div>
        <div className="chem-builder-presets">
          {[
            ["Carbon-12", 6, 6, 6],
            ["Carbon-14", 6, 8, 6],
            ["Na+", 11, 12, 10],
            ["Cl-", 17, 18, 18],
            ["O2-", 8, 8, 10],
            ["Ca2+", 20, 20, 18],
          ].map(([label, nextProtons, nextNeutrons, nextElectrons]) => (
            <Button key={String(label)} onClick={() => applyPreset(Number(nextProtons), Number(nextNeutrons), Number(nextElectrons))} type="button" variant="outline">
              Build {label}
            </Button>
          ))}
          {initialElement ? (
            <Button onClick={() => applySelectedElement(initialElement)} type="button" variant="secondary">
              Build selected element
            </Button>
          ) : null}
        </div>
      </section>

      <section className="chem-builder-output">
        <div className="chem-stat-grid">
          <article>
            <span>Identity</span>
            <strong>{model.element?.name ?? "Unknown"}</strong>
          </article>
          <article>
            <span>Isotope</span>
            <strong>{model.isotopeNotation}</strong>
          </article>
          <article>
            <span>Charge</span>
            <strong>{model.chargeLabel} ({model.particleClass})</strong>
          </article>
          <article>
            <span>Configuration</span>
            <strong>{model.electronConfiguration}</strong>
          </article>
        </div>
        <div className="chem-builder-explanation">
          <p className="chem-section-kicker">What changed?</p>
          {model.whatChanged.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {model.warnings.map((warning) => (
            <p className="chem-builder-warning" key={warning}>
              <AlertTriangle className="size-4" />
              {warning}
            </p>
          ))}
        </div>
      </section>
    </div>
  );
}

function getTitrationObservation(progress: number) {
  if (progress >= 0.96 && progress <= 1.04) {
    return "Endpoint zone; pH jumps sharply near equivalence.";
  }

  if (progress < 0.96) {
    return "acidic; keep adding titrant";
  }

  return "basic after endpoint; stop and evaluate overshoot";
}

function getTitrationHint(progress: number) {
  if (progress === 0) {
    return "Next: add titrant and record pH.";
  }

  if (progress >= 0.96 && progress <= 1.04) {
    return "Endpoint zone. Equivalence point is near 25.00 mL.";
  }

  if (progress < 0.96) {
    return "Approaching endpoint. Slow down near 25.00 mL.";
  }

  return "Past endpoint. Compare your overshoot to the measurement table.";
}

export function InteractivePeriodicTableModule({
  onSendToNotes,
  onOpenPractice,
  onSendToWhiteboard,
}: {
  onSendToNotes?: (text: string) => void;
  onOpenPractice?: () => void;
  onSendToWhiteboard?: (text: string) => void;
} = {}) {
  const [query, setQuery] = useState("");
  const [selectedAtomicNumber, setSelectedAtomicNumber] = useState(6);
  const [trendMode, setTrendMode] = useState<TrendMode>("category");
  const [viewMode, setViewMode] = useState<PeriodicViewMode>("table");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [studyLayer, setStudyLayer] = useState<StudyLayer>("ap");
  const [comparison, setComparison] = useState<PeriodicTableElement[]>([
    periodicTableElements.find((element) => element.symbol === "F") ?? periodicTableElements[8],
    periodicTableElements.find((element) => element.symbol === "Cl") ?? periodicTableElements[16],
  ]);
  const selected = periodicTableElementsByNumber(selectedAtomicNumber);
  const searchResults = useMemo(() => searchElements(query), [query]);
  const highlightedAtomicNumbers = useMemo(() => new Set(searchResults.map((element) => element.atomicNumber)), [searchResults]);
  const selectedTrendValue = getTrendDisplay(selected, trendMode);

  function selectElement(element: PeriodicTableElement) {
    setSelectedAtomicNumber(element.atomicNumber);
    setQuery(element.symbol);
  }

  function addToCompare(element: PeriodicTableElement) {
    setComparison((current) => {
      if (current.some((candidate) => candidate.atomicNumber === element.atomicNumber)) {
        return current;
      }
      return [...current, element].slice(-4);
    });
    setViewMode("compare");
  }

  function buildSelected(element: PeriodicTableElement) {
    setSelectedAtomicNumber(element.atomicNumber);
    setViewMode("builder");
  }

  function moveSelection(delta: number) {
    const next = periodicTableElementsByNumber(Math.max(1, Math.min(118, selected.atomicNumber + delta)));
    setSelectedAtomicNumber(next.atomicNumber);
    setQuery(next.symbol);
  }

  return (
    <WorkspacePanel
      description="Complete 118-element explorer with trends, builder, compare, and AP reasoning."
      title="Interactive periodic table"
    >
      <div
        className="chem-periodic-explorer-v3"
        data-chem-layout="flagship-periodic-table"
        data-chemistry-module="periodic-table"
        data-testid="chem-element-explorer-v3"
      >
        <header className="chem-periodic-command-bar-v3">
          <label className="chem-command-search">
            <Search className="size-4" />
            <span className="sr-only">Search elements</span>
            <Input
              aria-label="Element search"
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                const exactMatch = findElement(nextQuery);
                if (exactMatch) {
                  setSelectedAtomicNumber(exactMatch.atomicNumber);
                }
              }}
              placeholder="Search carbon, group 17, 2p, forms 2+, semiconductor..."
              value={query}
            />
          </label>
          <div className="chem-command-pills" role="group" aria-label="Periodic table views">
            {periodicViewButtons.map(({ id, label, Icon }) => (
              <Button
                aria-pressed={viewMode === id}
                key={id}
                onClick={() => setViewMode(id)}
                type="button"
                variant={viewMode === id ? "default" : "outline"}
              >
                <Icon data-icon="inline-start" />
                {label}
              </Button>
            ))}
          </div>
          <label className="chem-trend-select">
            <Layers className="size-4" />
            <span className="sr-only">Trend mode</span>
            <select aria-label="Trend mode" className="chem-select" onChange={(event) => setTrendMode(event.target.value as TrendMode)} value={trendMode}>
              {coreTrendModes.map((mode) => (
                <option key={mode} value={mode}>
                  {trendModeLabels[mode].label}
                </option>
              ))}
            </select>
          </label>
          <div className="chem-command-pills" role="group" aria-label="Study layer">
            <Button onClick={() => setStudyLayer("chem101")} type="button" variant={studyLayer === "chem101" ? "default" : "outline"}>
              Chem 101
            </Button>
            <Button onClick={() => setStudyLayer("ap")} type="button" variant={studyLayer === "ap" ? "default" : "outline"}>
              AP
            </Button>
          </div>
          <Button onClick={() => setDensity((current) => (current === "comfortable" ? "compact" : "comfortable"))} type="button" variant="outline">
            {density === "comfortable" ? "Compact" : "Comfortable"}
          </Button>
        </header>

        <nav className="chem-mobile-periodic-tabs" aria-label="Periodic table mobile views">
          {mobilePeriodicViews.map((view) => (
            <button aria-pressed={viewMode === view.id} key={view.id} onClick={() => setViewMode(view.id)} type="button">
              {view.label}
            </button>
          ))}
        </nav>

        <main className="chem-periodic-main-v3" data-view={viewMode}>
          <section className="chem-periodic-table-zone-v3" data-density={density} aria-label="Complete periodic table">
            <div className="chem-periodic-status-row">
              <Badge variant="secondary">118 elements</Badge>
              <span>
                {trendModeLabels[trendMode].label}: <strong>{selected.symbol} {selectedTrendValue}</strong>
              </span>
              <span>{searchResults.length} match{searchResults.length === 1 ? "" : "es"}</span>
            </div>
            <div className="chem-periodic-grid-v3" role="grid" aria-label="Periodic table grid">
              {Array.from({ length: 18 }, (_, index) => (
                <span className="chem-group-label" key={`group-${index + 1}`} style={{ gridColumn: index + 2, gridRow: 1 }}>
                  {index + 1}
                </span>
              ))}
              {Array.from({ length: 7 }, (_, index) => (
                <span className="chem-period-label" key={`period-${index + 1}`} style={{ gridColumn: 1, gridRow: index + 2 }}>
                  {index + 1}
                </span>
              ))}
              <span className="chem-series-label" style={{ gridColumn: "1 / span 4", gridRow: 9 }}>Lanthanides</span>
              <span className="chem-series-label" style={{ gridColumn: "1 / span 4", gridRow: 10 }}>Actinides</span>
              {periodicTableElements.map((element) => {
                const isSelected = element.atomicNumber === selected.atomicNumber;
                const isSearchMatch = !query.trim() || highlightedAtomicNumbers.has(element.atomicNumber);
                const value = getTrendDisplay(element, trendMode);
                return (
                  <button
                    aria-label={elementSummary(element, trendMode)}
                    className="chem-element-tile-v3"
                    data-category={element.category}
                    data-highlight={isSearchMatch ? "true" : "false"}
                    data-selected={isSelected ? "true" : "false"}
                    data-trend-kind={getTrendNumericValue(element, trendMode) === null ? "category" : "numeric"}
                    key={element.symbol}
                    onClick={() => selectElement(element)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight") {
                        event.preventDefault();
                        moveSelection(1);
                      }
                      if (event.key === "ArrowLeft") {
                        event.preventDefault();
                        moveSelection(-1);
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveSelection(18);
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveSelection(-18);
                      }
                    }}
                    role="gridcell"
                    style={tileStyle(element, trendMode)}
                    type="button"
                  >
                    <span>{element.atomicNumber}</span>
                    <strong>{element.symbol}</strong>
                    <small>{density === "comfortable" ? element.name : element.atomicWeightDisplay}</small>
                    <em>{value}</em>
                  </button>
                );
              })}
            </div>
            <div className="chem-category-legend-v3" aria-label="Element category legend">
              {Object.entries(elementCategories).map(([category, label]) => (
                <span data-category={category} key={category}>{label}</span>
              ))}
            </div>
          </section>

          <section className="chem-search-panel-v3" aria-label="Element search results">
            <header>
              <p className="chem-section-kicker">Search results</p>
              <strong>{searchResults.length} elements</strong>
            </header>
            <div className="chem-search-results-v3">
              {searchResults.slice(0, 30).map((element) => (
                <button key={element.atomicNumber} onClick={() => selectElement(element)} type="button">
                  <strong>{element.symbol}</strong>
                  <span>{element.name}</span>
                  <small>{elementCategories[element.category]} - group {element.groupDisplay}</small>
                </button>
              ))}
            </div>
          </section>

          <ElementInspector
            element={selected}
            onBuild={buildSelected}
            onCompare={addToCompare}
            onOpenPractice={onOpenPractice}
            onSendToNotes={onSendToNotes}
            studyLayer={studyLayer}
          />
        </main>

        <TrendReasoningPanel selected={selected} trendMode={trendMode} />

        <div className="chem-periodic-secondary-v3" data-view={viewMode}>
          {viewMode === "builder" ? (
            <section className="chem-builder-panel-v3" aria-label="Element builder">
              <header>
                <p className="chem-section-kicker">Atom / isotope / ion builder</p>
                <h3>Changing protons changes identity. Neutrons change isotope. Electrons change charge.</h3>
              </header>
              <AtomBuilderWorkbench initialElement={selected} onSelectElement={(element) => setSelectedAtomicNumber(element.atomicNumber)} />
            </section>
          ) : null}

          {viewMode === "compare" ? (
            <CompareElementsPanel
              comparison={comparison}
              onAddSelected={() => addToCompare(selected)}
              onRemove={(atomicNumber) => setComparison((current) => current.filter((element) => element.atomicNumber !== atomicNumber))}
              selected={selected}
            />
          ) : null}

          <section className="chem-bindernotes-actions-v3" aria-label="BinderNotes integrations">
            <div>
              <p className="chem-section-kicker">BinderNotes study actions</p>
              <h3>Turn the table into work</h3>
            </div>
            <Button disabled={!onSendToNotes} onClick={() => onSendToNotes?.(`${selected.name}: ${selected.quickCheck}`)} type="button" variant="outline">
              <NotebookPen data-icon="inline-start" />
              Send quick check to notes
            </Button>
            <Button disabled={!onSendToWhiteboard} onClick={() => onSendToWhiteboard?.(`Draw ${selected.name} as shells ${selected.shells.join("-")} and annotate valence electrons.`)} type="button" variant="outline">
              <Microscope data-icon="inline-start" />
              Diagram prompt
            </Button>
            <Button disabled={!onOpenPractice} onClick={onOpenPractice} type="button" variant="outline">
              <BookOpen data-icon="inline-start" />
              Launch practice
            </Button>
          </section>
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function ElementBuilderModule() {
  return (
    <WorkspacePanel description="Build atoms, isotopes, and ions with particle-level feedback." title="Element builder">
      <AtomBuilderWorkbench />
    </WorkspacePanel>
  );
}

export function ElectronConfigurationBuilderModule() {
  const [elementSymbol, setElementSymbol] = useState("O");
  const element = findElement(elementSymbol) ?? periodicTableElements[7];

  return (
    <WorkspacePanel description="Guided orbital filling practice with block awareness." title="Electron configuration builder">
      <div className="chem-showcase-module" data-chemistry-module="electron-config-builder">
        <div className="chem-showcase-toolbar">
          <Input onChange={(event) => setElementSymbol(event.target.value)} value={elementSymbol} />
          <Badge variant="outline">{element.category.replace(/-/g, " ")}</Badge>
        </div>
        <div className="chem-orbital-ladder">
          {["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p"].map((orbital, index) => (
            <div className="chem-orbital-row" key={orbital}>
              <span>{orbital}</span>
              <div aria-hidden="true" className={index < Math.ceil(element.atomicNumber / 2) ? "is-filled" : ""} />
            </div>
          ))}
        </div>
        <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">
          {element.name}: <strong>{element.electronConfiguration}</strong>
        </p>
      </div>
    </WorkspacePanel>
  );
}

export function PeriodicTrendsGraphModule() {
  const [trendMode, setTrendMode] = useState<TrendMode>("electronegativity");
  const trendRange = getTrendRange(trendMode);
  const points = periodicTableElements
    .filter((element) => element.atomicNumber <= 60)
    .filter((element) => getTrendNumericValue(element, trendMode) !== null)
    .map((element) => ({
      x: (element.atomicNumber / 60) * 100,
      y: trendRange ? getTrendScore(element, trendMode) * 100 : 0,
    }));

  return (
    <WorkspacePanel description="Desmos-ready periodic trend graph with a fast fallback chart." title="Periodic trends graph">
      <div className="chem-showcase-module" data-chemistry-module="periodic-trends-graph">
        <div className="chem-showcase-toolbar">
          <LineChart className="size-5 text-primary" />
          <p className="text-sm text-muted-foreground">{desmosStatusCopy()}</p>
        </div>
        <div className="chem-showcase-segment" role="group" aria-label="Trend">
          {(["electronegativity", "atomic-radius", "ionization-energy", "electron-affinity", "density", "metallic-character"] as TrendMode[]).map((mode) => (
            <Button key={mode} onClick={() => setTrendMode(mode)} type="button" variant={trendMode === mode ? "default" : "outline"}>
              {trendModeLabels[mode].label}
            </Button>
          ))}
        </div>
        <p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs leading-5">
          {trendModeLabels[trendMode].apReasoning}
        </p>
        <Sparkline ariaLabel={`${trendMode} fallback chart`} points={points} />
      </div>
    </WorkspacePanel>
  );
}

export function MoleculeLewisBuilderModule() {
  const [molecule, setMolecule] = useState("H2O");
  const moleculeMap: Record<string, { geometry: string; valence: number; note: string }> = {
    H2O: { geometry: "bent", valence: 8, note: "Two O-H bonds and two lone pairs on oxygen." },
    CO2: { geometry: "linear", valence: 16, note: "Two C=O double bonds keep carbon at an octet." },
    NH3: { geometry: "trigonal pyramidal", valence: 8, note: "Three N-H bonds and one lone pair." },
    CH4: { geometry: "tetrahedral", valence: 8, note: "Four C-H bonds around carbon." },
    NO3: { geometry: "trigonal planar", valence: 24, note: "Resonance spreads charge across oxygens." },
  };
  const detail = moleculeMap[molecule] ?? moleculeMap.H2O;

  return (
    <WorkspacePanel description="MVP Lewis builder for valence, octet, formal charge, and VSEPR thinking." title="Molecule / Lewis builder">
      <div className="chem-showcase-module" data-chemistry-module="molecule-builder">
        <div className="chem-showcase-toolbar">
          <select className="chem-select" onChange={(event) => setMolecule(event.target.value)} value={molecule}>
            {Object.keys(moleculeMap).map((formula) => (
              <option key={formula} value={formula}>
                {formula}
              </option>
            ))}
          </select>
          <Badge variant="secondary">{detail.geometry}</Badge>
        </div>
        <div className="chem-molecule-stage">
          <div className="chem-molecule-node">{molecule.replace(/\d/g, "")[0]}</div>
          <div className="chem-bond-line" />
          <div className="chem-molecule-node chem-molecule-node-small">H</div>
          <div className="chem-bond-line chem-bond-line-alt" />
          <div className="chem-molecule-node chem-molecule-node-small">O</div>
        </div>
        <div className="chem-stat-grid">
          <article>
            <span>Valence electrons</span>
            <strong>{detail.valence}</strong>
          </article>
          <article>
            <span>Geometry</span>
            <strong>{detail.geometry}</strong>
          </article>
          <article>
            <span>Octet check</span>
            <strong>guided</strong>
          </article>
        </div>
        <p className="rounded-xl border border-border/70 bg-card/80 p-3 text-sm">{detail.note}</p>
      </div>
    </WorkspacePanel>
  );
}

export function ReactionBalancerModule() {
  const [equation, setEquation] = useState("H2 + O2 -> H2O");
  const result = useMemo(() => balanceEquation(equation), [equation]);

  return (
    <WorkspacePanel description="Balance reactions while keeping subscripts locked." title="Reaction balancer">
      <div className="chem-showcase-module" data-chemistry-module="reaction-balancer">
        <div className="grid gap-2">
          <label className="grid gap-2 text-sm">
            Equation
            <Input onChange={(event) => setEquation(event.target.value)} value={equation} />
          </label>
          <div className="flex flex-wrap gap-2">
            {demoReactions.map((reaction) => (
              <Button key={reaction.id} onClick={() => setEquation(reaction.equation)} type="button" variant="outline">
                {reaction.type}
              </Button>
            ))}
          </div>
        </div>
        <section className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Balanced result</p>
          <p className="mt-2 font-mono text-sm">{result.ok ? result.balancedEquation : result.message}</p>
        </section>
        <div className="chem-conservation-meter" data-balanced={result.ok ? "true" : "false"}>
          <span />
          <strong>{result.ok ? "Atoms conserved" : "Needs attention"}</strong>
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function TriRepresentationReactionViewModule() {
  const reaction = demoReactions[2];
  return (
    <WorkspacePanel description="Symbolic, particle, and macroscopic views move together." title="Tri-representation reaction view">
      <div className="chem-showcase-module" data-chemistry-module="tri-reaction-view">
        <div className="grid gap-3 md:grid-cols-3">
          <article className="chem-tri-card">
            <Badge variant="outline">Symbolic</Badge>
            <p>{reaction.equation}</p>
          </article>
          <article className="chem-tri-card">
            <Badge variant="outline">Particle</Badge>
            <div className="chem-particles">
              {Array.from({ length: 12 }, (_, index) => (
                <span key={index} style={{ animationDelay: `${index * 60}ms` }} />
              ))}
            </div>
          </article>
          <article className="chem-tri-card">
            <Badge variant="outline">Observation</Badge>
            <p>{reaction.observation}</p>
          </article>
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryMolarMassCalculatorModule() {
  const [formula, setFormula] = useState("Ca(OH)2");
  const result = useMemo(() => calculateMolarMass(formula), [formula]);

  return (
    <WorkspacePanel description="Fast molar mass lookup for stoichiometry ladders." title="Molar mass calculator">
      <div className="chem-showcase-module" data-chemistry-module="molar-mass-calculator">
        <Input onChange={(event) => setFormula(event.target.value)} value={formula} />
        <div className="chem-result-tile">
          {result.ok ? `${result.gramsPerMole.toFixed(3)} g/mol` : result.message}
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function SolutionMixerModule() {
  const [stock, setStock] = useState("1.00");
  const [target, setTarget] = useState("0.100");
  const [volume, setVolume] = useState("250");
  const stockM = Number(stock) || 1;
  const targetM = Number(target) || 0;
  const targetMl = Number(volume) || 0;
  const stockVolumeMl = stockM > 0 ? (targetM * targetMl) / stockM : 0;

  return (
    <WorkspacePanel description="M1V1 = M2V2 solution mixer with safety-aware data capture." title="Solution mixer">
      <div className="chem-showcase-module" data-chemistry-module="solution-mixer">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2 text-sm">
            Stock M
            <Input onChange={(event) => setStock(event.target.value)} value={stock} />
          </label>
          <label className="grid gap-2 text-sm">
            Target M
            <Input onChange={(event) => setTarget(event.target.value)} value={target} />
          </label>
          <label className="grid gap-2 text-sm">
            Target mL
            <Input onChange={(event) => setVolume(event.target.value)} value={volume} />
          </label>
        </div>
        <div className="chem-beaker">
          <span style={{ height: `${Math.min(90, Math.max(12, (targetM / stockM) * 90))}%` }} />
        </div>
        <p className="chem-result-tile">Use {stockVolumeMl.toFixed(2)} mL stock, then dilute to {targetMl.toFixed(0)} mL.</p>
      </div>
    </WorkspacePanel>
  );
}

export function AcidBaseCalculatorModule() {
  const [kind, setKind] = useState<"acid" | "base">("acid");
  const [concentration, setConcentration] = useState("0.010");
  const result = calculateStrongAcidBase({ kind, concentrationM: Number(concentration) || 0.01 });

  return (
    <WorkspacePanel description="Strong acid/base pH plus buffer-preview guardrails." title="pH / acid-base calculator">
      <div className="chem-showcase-module" data-chemistry-module="ph-calculator">
        <div className="chem-showcase-toolbar">
          <select className="chem-select" onChange={(event) => setKind(event.target.value as "acid" | "base")} value={kind}>
            <option value="acid">Strong acid</option>
            <option value="base">Strong base</option>
          </select>
          <Input onChange={(event) => setConcentration(event.target.value)} value={concentration} />
        </div>
        <div className="chem-ph-scale">
          <span style={{ left: `${Math.max(0, Math.min(100, (result.ph / 14) * 100))}%` }} />
        </div>
        <div className="chem-stat-grid">
          <article>
            <span>pH</span>
            <strong>{result.ph.toFixed(2)}</strong>
          </article>
          <article>
            <span>pOH</span>
            <strong>{result.poh.toFixed(2)}</strong>
          </article>
          <article>
            <span>Meaning</span>
            <strong>{getPhScaleLabel(result.ph)}</strong>
          </article>
        </div>
        <p className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs">
          Strong acid does not mean concentrated acid. Strength describes ionization; concentration describes amount per liter.
        </p>
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryGraphModule({ kind = "titration" }: { kind?: "titration" | "kinetics" | "concentration" }) {
  const titrationPoints = generateStrongAcidStrongBaseCurve({
    acidMolarity: 0.1,
    acidVolumeMl: 25,
    baseMolarity: 0.1,
    stepMl: 2.5,
  }).map((point) => ({ x: (point.volumeMl / 50) * 100, y: (point.ph / 14) * 100 }));
  const kineticsPoints = generateKineticsDataset({
    order: 1,
    initialConcentrationM: 1,
    rateConstant: 0.02,
  }).map((point) => ({ x: (point.timeS / 120) * 100, y: point.concentrationM * 100 }));
  const concentrationPoints = Array.from({ length: 8 }, (_, index) => ({ x: index * 14, y: 90 - index * 10 }));
  const points = kind === "kinetics" ? kineticsPoints : kind === "concentration" ? concentrationPoints : titrationPoints;

  return (
    <WorkspacePanel description={desmosStatusCopy()} title={`Desmos ${kind} graph`}>
      <div className="chem-showcase-module" data-chemistry-module={`desmos-${kind}-graph`}>
        <Sparkline ariaLabel={`${kind} chemistry graph fallback`} points={points} />
      </div>
    </WorkspacePanel>
  );
}

export function KineticsSimulatorModule() {
  const [order, setOrder] = useState<KineticsOrder>(1);
  const [rate, setRate] = useState("0.020");
  const dataset = generateKineticsDataset({
    order,
    initialConcentrationM: 1,
    rateConstant: Number(rate) || 0.02,
  });
  const points = dataset.map((point) => ({ x: (point.timeS / 120) * 100, y: point.concentrationM * 100 }));

  return (
    <WorkspacePanel description="Reaction-order simulator with linearized plot helpers." title="Kinetics simulator">
      <div className="chem-showcase-module" data-chemistry-module="kinetics-simulator">
        <div className="chem-showcase-toolbar">
          <select className="chem-select" onChange={(event) => setOrder(Number(event.target.value) as KineticsOrder)} value={order}>
            <option value={0}>Zero order</option>
            <option value={1}>First order</option>
            <option value={2}>Second order</option>
          </select>
          <Input onChange={(event) => setRate(event.target.value)} value={rate} />
        </div>
        <Sparkline ariaLabel="Kinetics concentration vs time" points={points} />
        <div className="chem-data-table">
          {dataset.slice(0, 5).map((point) => (
            <div key={point.timeS}>
              <span>{point.timeS}s</span>
              <strong>{point.concentrationM} M</strong>
            </div>
          ))}
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function ThermochemistryModule() {
  const [mass, setMass] = useState("100");
  const [delta, setDelta] = useState("8");
  const q = calculateHeatTransfer({
    massG: Number(mass) || 0,
    specificHeatJPerGC: 4.184,
    deltaTemperatureC: Number(delta) || 0,
  });

  return (
    <WorkspacePanel description="Calorimetry, energy diagrams, and q = mc delta T." title="Thermochemistry studio">
      <div className="chem-showcase-module" data-chemistry-module="thermochemistry">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            Water mass (g)
            <Input onChange={(event) => setMass(event.target.value)} value={mass} />
          </label>
          <label className="grid gap-2 text-sm">
            delta T (C)
            <Input onChange={(event) => setDelta(event.target.value)} value={delta} />
          </label>
        </div>
        <div className="chem-energy-diagram">
          <span className={q >= 0 ? "is-endo" : "is-exo"} />
          <strong>{describeHeatSign(q)}</strong>
        </div>
        <p className="chem-result-tile">q = {q.toFixed(1)} J</p>
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryConceptCardsModule() {
  return (
    <WorkspacePanel description="Concept, formula, misconception, and AP/Gen Chem alignment cards." title="Chemistry concept cards">
      <div className="chem-showcase-module chem-card-stack" data-chemistry-module="concept-cards">
        {chemistryConceptCards.map((card) => (
          <article className="chem-concept-card" key={card.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{card.unit}</p>
                <h3 className="mt-1 text-base font-semibold">{card.title}</h3>
              </div>
              <Badge variant="outline">{card.tags[0]}</Badge>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{card.misconception}</p>
            <p className="mt-2 rounded-xl border border-border/70 bg-background/72 p-3 text-xs">{card.check}</p>
          </article>
        ))}
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryQuickToolsModule() {
  return (
    <WorkspacePanel description="Compact chemistry helpers for fast study work." title="Chemistry quick tools">
      <div className="chem-showcase-module" data-chemistry-module="quick-tools">
        <div className="grid gap-3 md:grid-cols-2">
          <article className="chem-tool-card">
            <Scale className="size-4 text-primary" />
            <strong>Molar mass</strong>
            <span>H2O = 18.015 g/mol</span>
          </article>
          <article className="chem-tool-card">
            <Zap className="size-4 text-primary" />
            <strong>Sig figs</strong>
            <span>Track measured precision before rounding.</span>
          </article>
          <article className="chem-tool-card">
            <Table2 className="size-4 text-primary" />
            <strong>Common ions</strong>
            <span>{commonIons.slice(0, 4).map((ion) => ion.formula).join(", ")}</span>
          </article>
          <article className="chem-tool-card">
            <FlaskConical className="size-4 text-primary" />
            <strong>Solubility</strong>
            <span>{solubilityRules[0].summary}</span>
          </article>
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function SafetyReagentCardsModule() {
  const cards = ["HCl", "NaOH", "AgNO3", "CuSO4", "ethanol", "water", "acetic acid"];
  return (
    <WorkspacePanel description="Safety-first reagent cards for virtual labs." title="Safety + reagent cards">
      <div className="chem-showcase-module chem-reagent-grid" data-chemistry-module="safety-cards">
        {cards.map((card) => (
          <article className="chem-reagent-card" key={card}>
            <ShieldCheck className="size-4 text-primary" />
            <strong>{card}</strong>
            <span>Wear PPE. Do not perform outside a supervised lab.</span>
          </article>
        ))}
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryChallengeReviewModule() {
  const challenges = [
    "Build Na+",
    "Predict oxygen vs sulfur electronegativity",
    "Balance Fe + O2 -> Fe2O3",
    "Complete one mole bridge",
    "Interpret the titration curve",
  ];
  return (
    <WorkspacePanel description="Deterministic chemistry review hooks without AI." title="Chem challenge queue">
      <div className="chem-showcase-module" data-chemistry-module="review-queue">
        {challenges.map((challenge, index) => (
          <article className="chem-review-card" key={challenge}>
            <span>{index + 1}</span>
            <strong>{challenge}</strong>
            <Badge variant="outline">checkable</Badge>
          </article>
        ))}
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryDataTableModule() {
  const rows = generateStrongAcidStrongBaseCurve({
    acidMolarity: 0.1,
    acidVolumeMl: 25,
    baseMolarity: 0.1,
    stepMl: 5,
  });
  return (
    <WorkspacePanel description="Lightweight lab data table; no animation frames are saved." title="Chemistry data table">
      <div className="chem-data-table">
        {rows.map((row) => (
          <div key={row.volumeMl}>
            <span>{row.volumeMl.toFixed(1)} mL</span>
            <strong>pH {row.ph.toFixed(2)}</strong>
          </div>
        ))}
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryStoichiometryCoachModule() {
  const [givenQuantity, setGivenQuantity] = useState("4.032");
  const quantity = Number(givenQuantity);
  const solution = useMemo(
    () =>
      solveStoichiometryProblem({
        equation: stoichTemplate.equation,
        given: {
          formula: stoichTemplate.givenFormula,
          quantity: Number.isFinite(quantity) ? quantity : 0,
          unit: "g",
        },
        target: {
          formula: stoichTemplate.targetFormula,
          unit: "g",
        },
      }),
    [quantity],
  );
  const h2Mass = calculateMolarMass("H2");
  const waterMass = calculateMolarMass("H2O");

  return (
    <WorkspacePanel
      description="Deterministic stoichiometry practice with conservation and unit checks."
      title="Chemistry Stoichiometry Coach"
    >
      <div className="grid gap-4">
        <section className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Unit ladder</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Start from grams, cross the mole bridge, then use the balanced mole ratio.
              </p>
            </div>
            <Badge variant="secondary">No AI</Badge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <label className="grid gap-1.5 text-sm">
              Given grams of H2
              <Input
                inputMode="decimal"
                onChange={(event) => setGivenQuantity(event.target.value)}
                value={givenQuantity}
              />
            </label>
            <div className="rounded-xl border border-border/70 bg-card/80 p-3 text-xs leading-5 text-muted-foreground">
              {h2Mass.ok ? `H2: ${h2Mass.gramsPerMole.toFixed(3)} g/mol` : "H2 mass unavailable"}
              <br />
              {waterMass.ok ? `H2O: ${waterMass.gramsPerMole.toFixed(3)} g/mol` : "H2O mass unavailable"}
            </div>
          </div>
        </section>

        {solution.ok ? (
          <section className="grid gap-3">
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Balanced equation</p>
              <p className="mt-2 font-mono text-sm">{solution.balancedEquation}</p>
            </div>
            <div className="grid gap-2">
              {solution.steps.map((step, index) => (
                <article
                  className="rounded-xl border border-border/70 bg-card/82 p-3 text-sm"
                  key={`${step.kind}-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{step.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Number(step.value.toPrecision(5))} {step.unit}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
              <p className="text-sm font-semibold">
                Final answer: {solution.finalAnswer.value} {solution.finalAnswer.unit} {solution.finalAnswer.formula}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {solution.conceptTags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            {solution.message}
          </div>
        )}
      </div>
    </WorkspacePanel>
  );
}

const chemistryLabCoachSteps = [
  {
    title: "Read objective",
    status: "Current lab goal",
    detail: "Find the concentration pattern in a simplified acid-base titration and connect evidence to a claim.",
    next: "check safety",
  },
  {
    title: "Check safety",
    status: "Safety ready",
    detail: "Wear goggles, label acid/base solutions, and slow down near the expected endpoint.",
    next: "write a hypothesis",
  },
  {
    title: "Predict / hypothesis",
    status: "Ready for prediction",
    detail: "Predict where pH will change fastest before adding more titrant.",
    next: "measure and observe",
  },
  {
    title: "Measure / observe",
    status: "Ready for observation",
    detail: "Add titrant in controlled increments and watch the pH curve for a sharp jump.",
    next: "record pH",
  },
  {
    title: "Record data",
    status: "Data checkpoint",
    detail: "Copy the volume, pH, and observation into the table before moving on.",
    next: "calculate and graph",
  },
  {
    title: "Calculate / graph",
    status: "Graph checkpoint",
    detail: "Use the endpoint region to reason about moles acid and moles base.",
    next: "explain result",
  },
  {
    title: "Explain result",
    status: "Reasoning checkpoint",
    detail: "Connect your observation to the endpoint instead of only reporting a number.",
    next: "write conclusion",
  },
  {
    title: "Write conclusion",
    status: "Conclusion ready",
    detail: "Use claim, evidence, and reasoning to explain whether the data supports your hypothesis.",
    next: "review your notebook",
  },
];

export function ChemistryLabCoachModule({
  onOpenTool,
}: {
  onOpenTool?: (moduleId: WorkspaceModuleId) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState("Ready to start the lab flow.");
  const step = chemistryLabCoachSteps[stepIndex];
  const progress = ((stepIndex + 1) / chemistryLabCoachSteps.length) * 100;

  function moveStep(direction: -1 | 1) {
    setStepIndex((current) => {
      const next = Math.max(0, Math.min(chemistryLabCoachSteps.length - 1, current + direction));
      const nextStep = chemistryLabCoachSteps[next];
      setStatus(`Step complete: ${nextStep.title} is ready.`);
      return next;
    });
  }

  function openTool(moduleId: WorkspaceModuleId, label: string) {
    onOpenTool?.(moduleId);
    setStatus(`${label} opened from Chemistry Lab Coach.`);
  }

  return (
    <WorkspacePanel description="Step-by-step chemistry lab guidance without AI or background writes." title="Chemistry Lab Coach">
      <div className="chem-showcase-module chem-lab-coach" data-chemistry-module="lab-coach">
        <header className="chem-lab-coach-hero">
          <div>
            <Badge variant="outline">Step {stepIndex + 1} of 8</Badge>
            <h3 className="mt-3 text-lg font-semibold">{step.status}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Next: {step.next}</p>
          </div>
          <div className="chem-lab-coach-orb" aria-hidden="true">
            <FlaskConical />
          </div>
        </header>

        <div className="chem-lab-coach-progress" aria-label="Chemistry Lab Coach progress">
          <span style={{ width: `${progress}%` }} />
        </div>

        <div className="chem-lab-step-grid">
          {chemistryLabCoachSteps.map((candidate, index) => (
            <button
              className="chem-lab-step"
              data-state={index === stepIndex ? "active" : index < stepIndex ? "complete" : "pending"}
              key={candidate.title}
              onClick={() => {
                setStepIndex(index);
                setStatus(`${candidate.title} selected.`);
              }}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{candidate.title}</strong>
            </button>
          ))}
        </div>

        <section className="chem-lab-coach-actions" aria-label="Related chemistry tools">
          <Button onClick={() => openTool("chem-titration-lab", "Titration Lab")} type="button">
            Open Titration Lab
          </Button>
          <Button onClick={() => openTool("chem-periodic-table", "Element Explorer")} type="button" variant="outline">
            Open Element Explorer
          </Button>
          <Button onClick={() => openTool("chem-safety-cards", "Safety cards")} type="button" variant="outline">
            Open Safety Cards
          </Button>
          <Button onClick={() => openTool("private-notes", "Notes")} type="button" variant="outline">
            Open Notes
          </Button>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button disabled={stepIndex === 0} onClick={() => moveStep(-1)} type="button" variant="outline">
              Previous step
            </Button>
            <Button disabled={stepIndex === chemistryLabCoachSteps.length - 1} onClick={() => moveStep(1)} type="button">
              Next step
            </Button>
          </div>
          <p className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs" role="status">
            {status}
          </p>
        </footer>
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryTitrationLabModule() {
  const [state, dispatch] = useReducer(titrationReducer, undefined, createTitrationInitialState);
  const points = state.measurements.length > 0 ? state.measurements : [{ titrantVolumeMl: 0, ph: state.ph, equivalenceProgress: 0 }];
  const latestProgress = state.measurements.at(-1)?.equivalenceProgress ?? 0;
  const endpointHint = getTitrationHint(latestProgress);
  const desmosReady = hasDesmosApiKey();
  const path = points
    .map((point, index) => {
      const x = Math.min(100, (point.titrantVolumeMl / 50) * 100);
      const y = 100 - Math.min(100, Math.max(0, (point.ph / 14) * 100));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <WorkspacePanel
      description="Strong acid and strong base titration with controlled checkpoints."
      title="Acid-base titration lab"
    >
      <div className="chem-titration-v2 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-3">
          <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Objective</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Determine the endpoint for 25.00 mL of 0.100 M HCl using 0.100 M NaOH.
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Simplified strong acid/strong base model
                </p>
              </div>
              <Badge variant="outline">{state.ph.toFixed(2)} pH</Badge>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              {["0.50", "1.00", "5.00"].map((volume) => (
                <Button
                  key={volume}
                  onClick={() => dispatch({ type: "add_titrant", volumeMl: Number(volume) })}
                  type="button"
                  variant="outline"
                >
                  <Beaker data-icon="inline-start" />
                  Add {volume} mL
                </Button>
              ))}
              <Button onClick={() => dispatch({ type: "reset" })} type="button" variant="secondary">
                Reset
              </Button>
            </div>
          </div>

          <div className="chem-titration-chart-card rounded-2xl border border-border/70 bg-card/85 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Live titration curve</p>
              <span className="text-xs text-muted-foreground">{state.titrantAddedMl.toFixed(2)} mL NaOH</span>
            </div>
            <p className="mt-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {desmosReady ? "Desmos curve ready when this graph surface is selected." : "Fallback chart active"}
            </p>
            <svg aria-label="Titration curve" className="mt-3 h-48 w-full overflow-visible rounded-xl bg-background/75" viewBox="0 0 100 100">
              <line stroke="currentColor" strokeOpacity="0.18" x1="0" x2="100" y1="50" y2="50" />
              <line stroke="currentColor" strokeOpacity="0.18" x1="50" x2="50" y1="0" y2="100" />
              <line stroke="hsl(var(--primary))" strokeDasharray="3 4" strokeOpacity="0.55" x1="50" x2="50" y1="0" y2="100" />
              <path d={path} fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeWidth="3" />
            </svg>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={latestProgress >= 0.96 && latestProgress <= 1.04 ? "default" : "outline"}>
                {latestProgress >= 0.96 && latestProgress <= 1.04 ? "Endpoint zone" : "Endpoint watch"}
              </Badge>
              <span className="text-xs text-muted-foreground">{endpointHint}</span>
            </div>
          </div>
        </section>

        <aside className="grid gap-3">
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4" />
              Safety card
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Wear goggles, label acid/base solutions, and add titrant in small increments near the endpoint.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
            <p className="text-sm font-semibold">Measurement table</p>
            <div className="mt-3 max-h-48 overflow-auto rounded-xl border border-border/60">
              {state.measurements.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">
                  No measurements yet. Add titrant to record the first checkpoint.
                </p>
              ) : (
                state.measurements.map((measurement) => (
                  <div
                    className="grid grid-cols-[80px_72px_minmax(0,1fr)] gap-2 border-b border-border/50 px-3 py-2 text-xs last:border-b-0"
                    key={`${measurement.titrantVolumeMl}-${measurement.ph}`}
                  >
                    <span>{measurement.titrantVolumeMl.toFixed(2)} mL</span>
                    <span className="font-medium">pH {measurement.ph.toFixed(2)}</span>
                    <span className="text-muted-foreground">{getTitrationObservation(measurement.equivalenceProgress)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/72 p-4">
            <p className="text-sm font-semibold">Notebook prompts</p>
            <div className="mt-3 grid gap-2">
              {[
                "Hypothesis",
                "Procedure",
                "Data table",
                "Calculations",
                "Observations",
                "Error analysis",
                "Conclusion",
              ].map((prompt) => (
                <p className="rounded-xl border border-border/55 bg-card/70 px-3 py-2 text-xs" key={prompt}>
                  {prompt}
                </p>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryLabNotebookModule() {
  const [conclusion, setConclusion] = useState("");

  return (
    <WorkspacePanel description="Structured notebook sections for lab thinking." title="Smart lab notebook">
      <div className="grid gap-3">
        {[
          ["Hypothesis", "Predict how pH will change near the endpoint."],
          ["Procedure", "List the exact increments and measurement routine."],
          ["Data table", "Use the titration lab measurement table as the checkpoint source."],
          ["Calculations", "Show moles acid, moles base, and endpoint logic."],
          ["Observations", "Record color, pH jump, and endpoint behavior."],
          ["Error analysis", "Name overshoot, reading, or concentration error."],
        ].map(([title, description]) => (
          <section className="rounded-xl border border-border/70 bg-card/80 p-3" key={title}>
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </section>
        ))}
        <label className="grid gap-2 text-sm">
          Conclusion
          <Textarea
            onChange={(event) => setConclusion(event.target.value)}
            placeholder="Explain whether the titration result supports your claim."
            value={conclusion}
          />
        </label>
      </div>
    </WorkspacePanel>
  );
}

export function ChemistryReferenceSafetyModule() {
  return (
    <WorkspacePanel description="Reference cards for careful chemistry work." title="Chemistry reference">
      <div className="grid gap-3">
        <article className="rounded-2xl border border-border/70 bg-background/72 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="size-4" />
            Conservation check
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            A valid equation keeps every atom count and net charge equal on both sides.
          </p>
        </article>
        <article className="rounded-2xl border border-border/70 bg-background/72 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="size-4" />
            Safety check
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Read reagent labels, keep glassware upright, and treat unknown concentration as a source of error.
          </p>
        </article>
        <article className="rounded-2xl border border-border/70 bg-background/72 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ClipboardCheck className="size-4" />
            Misconception tags
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["mole ratio flipped", "unit not cancelled", "molar mass error", "equation not balanced"].map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </article>
        <p className="flex items-start gap-2 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-xs leading-5 text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          BinderNotes saves summaries and checkpoints only. It does not save every small lab interaction.
        </p>
      </div>
    </WorkspacePanel>
  );
}
