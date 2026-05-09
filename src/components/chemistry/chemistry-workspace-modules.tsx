import { useMemo, useReducer, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  ClipboardCheck,
  FlaskConical,
  LineChart,
  Scale,
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
  elementCategories,
  findElement,
  getTrendScore,
  periodicTableElements,
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

function elementSummary(element: PeriodicTableElement) {
  return `${element.name} (${element.symbol}) - group ${element.group}, period ${element.period}`;
}

function getValenceElectrons(element: PeriodicTableElement) {
  if (element.group >= 1 && element.group <= 2) {
    return element.group;
  }

  if (element.group >= 13 && element.group <= 18) {
    return element.group - 10;
  }

  return element.symbol === "Fe" ? 2 : "varies";
}

function getBondingBehavior(element: PeriodicTableElement) {
  const summaries: Partial<Record<string, string>> = {
    H: "usually forms one bond and completes a duet.",
    C: "usually forms four bonds, which makes it a backbone atom for many molecules.",
    N: "usually forms three bonds and keeps one lone pair in simple neutral molecules.",
    O: "usually forms two bonds and often carries two lone pairs.",
    Na: "usually loses one electron to form Na+ in ionic compounds.",
    Cl: "usually gains one electron or forms one covalent bond.",
    Ca: "usually loses two electrons to form Ca2+.",
    Fe: "often forms Fe2+ or Fe3+ depending on the reaction conditions.",
  };

  return (
    summaries[element.symbol] ??
    (element.category.includes("metal")
      ? "often forms positive ions and participates in ionic bonding."
      : "often shares or gains electrons to complete a valence shell.")
  );
}

function getWhyElementMatters(element: PeriodicTableElement) {
  return `${element.use} Study tip: ${element.studyTip}`;
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

export function InteractivePeriodicTableModule() {
  const [query, setQuery] = useState("Carbon");
  const [trendMode, setTrendMode] = useState<TrendMode>("electronegativity");
  const [comparison, setComparison] = useState<PeriodicTableElement[]>([]);
  const selected = findElement(query) ?? periodicTableElements[5];
  const schoolShortcuts = useMemo(
    () =>
      ["H", "C", "N", "O", "Na", "Cl", "Ca", "Fe"]
        .map((symbol) => periodicTableElements.find((element) => element.symbol === symbol))
        .filter((element): element is PeriodicTableElement => Boolean(element)),
    [],
  );
  const filteredElements = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return periodicTableElements;
    }
    return periodicTableElements.filter(
      (element) =>
        element.symbol.toLowerCase().includes(normalized) ||
        element.name.toLowerCase().includes(normalized) ||
        String(element.atomicNumber) === normalized,
    );
  }, [query]);

  function toggleCompare(element: PeriodicTableElement) {
    setComparison((current) => {
      if (current.some((candidate) => candidate.symbol === element.symbol)) {
        return current.filter((candidate) => candidate.symbol !== element.symbol);
      }
      return [...current.slice(-1), element];
    });
  }

  return (
    <WorkspacePanel
      description="Search, compare, and study periodic trends without leaving the chemistry workspace."
      title="Interactive periodic table"
    >
      <div
        className="chem-showcase-module chem-periodic-table-module"
        data-chem-layout="list-detail"
        data-chemistry-module="periodic-table"
        data-testid="chem-element-explorer-v2"
      >
        <div className="chem-showcase-toolbar">
          <label className="chem-showcase-search text-sm">
            Element search
            <Input onChange={(event) => setQuery(event.target.value)} value={query} />
          </label>
          <div className="chem-showcase-segment" role="group" aria-label="Trend overlay">
            {(["electronegativity", "atomic-radius", "ionization-energy", "metallic-character"] as TrendMode[]).map(
              (mode) => (
                <Button
                  key={mode}
                  onClick={() => setTrendMode(mode)}
                  type="button"
                  variant={trendMode === mode ? "default" : "outline"}
                >
                  {mode.replace(/-/g, " ")}
                </Button>
              ),
            )}
          </div>
        </div>
        <div className="chem-element-shortcuts" aria-label="Common school chemistry element shortcuts">
          {schoolShortcuts.map((element) => (
            <Button
              aria-label={`Shortcut ${element.name}`}
              key={element.symbol}
              onClick={() => setQuery(element.symbol)}
              type="button"
              variant={selected.symbol === element.symbol ? "default" : "outline"}
            >
              {element.symbol}
            </Button>
          ))}
        </div>

        <div className="chem-periodic-layout">
          <div className="chem-element-browser" aria-label="Filtered element browser">
            {filteredElements.slice(0, 10).map((element) => (
              <button
                className="chem-element-browser-item"
                key={element.symbol}
                onClick={() => setQuery(element.symbol)}
                type="button"
              >
                <strong>{element.symbol}</strong>
                <span>{element.name}</span>
                <small>#{element.atomicNumber}</small>
              </button>
            ))}
          </div>
          <div className="chem-periodic-grid" aria-label="Periodic table element buttons">
            {periodicTableElements.map((element) => {
              const trendScore = getTrendScore(element, trendMode);
              const opacity = trendMode === "metallic-character" ? 0.3 + trendScore * 0.55 : 0.28 + Math.min(trendScore / 4, 0.65);
              return (
                <button
                  aria-label={elementSummary(element)}
                  className="chem-element-cell"
                  data-category={element.category}
                  key={element.symbol}
                  onClick={() => {
                    setQuery(element.symbol);
                    toggleCompare(element);
                  }}
                  style={{
                    gridColumn: element.group,
                    gridRow: element.period,
                    opacity,
                  }}
                  type="button"
                >
                  <span>{element.atomicNumber}</span>
                  <strong>{element.symbol}</strong>
                  <small>{element.name}</small>
                </button>
              );
            })}
          </div>

          <aside aria-label="Selected element details" className="chem-element-detail">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  {elementCategories[selected.category]}
                </p>
                <h3 className="mt-1 text-2xl font-semibold">{selected.symbol}</h3>
                <p className="text-sm text-muted-foreground">{selected.name}</p>
              </div>
              <Badge variant="secondary">#{selected.atomicNumber}</Badge>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Atomic number</dt>
                <dd className="font-semibold">{selected.atomicNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Atomic mass</dt>
                <dd className="font-semibold">{selected.atomicMass}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Group / period</dt>
                <dd className="font-semibold">
                  {selected.group} / {selected.period}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Valence electrons</dt>
                <dd className="font-semibold">{getValenceElectrons(selected)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Electron config</dt>
                <dd className="font-semibold">{selected.electronConfiguration}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Common ion(s)</dt>
                <dd className="font-semibold">{selected.commonIons.join(", ") || "none common"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phase</dt>
                <dd className="font-semibold">{selected.phase}</dd>
              </div>
            </dl>
            <section className="mt-4 rounded-xl border border-border/65 bg-background/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Bonding behavior</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{getBondingBehavior(selected)}</p>
            </section>
            <section className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Why it matters</p>
              <p className="mt-2 text-xs leading-5">{getWhyElementMatters(selected)}</p>
            </section>
            <p className="mt-3 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs leading-5">{selected.studyTip}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={() => toggleCompare(selected)} type="button" variant="outline">
                Compare
              </Button>
              <Button type="button" variant="outline">
                Build this atom
              </Button>
            </div>
          </aside>
        </div>

        <div className="chem-comparison-row">
          {(comparison.length > 0 ? comparison : filteredElements.slice(0, 2)).map((element) => (
            <article className="chem-comparison-card" key={element.symbol}>
              <strong>{element.symbol}</strong>
              <span>{element.name}</span>
              <small>{element.studyTip}</small>
            </article>
          ))}
        </div>
      </div>
    </WorkspacePanel>
  );
}

export function ElementBuilderModule() {
  const [protons, setProtons] = useState(6);
  const [neutrons, setNeutrons] = useState(8);
  const [electrons, setElectrons] = useState(6);
  const element = periodicTableElements.find((candidate) => candidate.atomicNumber === protons) ?? periodicTableElements[5];
  const charge = protons - electrons;
  const massNumber = protons + neutrons;
  const shellText = protons <= 2 ? "1st shell" : protons <= 10 ? "2 shells" : protons <= 18 ? "3 shells" : "4+ shells";

  return (
    <WorkspacePanel description="Build isotopes and ions deterministically." title="Element builder">
      <div className="chem-showcase-module" data-chemistry-module="element-builder">
        <div className="chem-atom-display">
          <div className="chem-nucleus">
            <strong>{element.symbol}</strong>
            <span>{massNumber}</span>
          </div>
          <div className="chem-shell-ring" />
          <div className="chem-shell-ring chem-shell-ring-secondary" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: "Protons", value: protons, setter: setProtons },
            { label: "Neutrons", value: neutrons, setter: setNeutrons },
            { label: "Electrons", value: electrons, setter: setElectrons },
          ].map(({ label, value, setter }) => (
            <label className="grid gap-2 text-sm" key={label}>
              {label}
              <Input
                inputMode="numeric"
                min={0}
                onChange={(event) => setter(Number(event.target.value))}
                type="number"
                value={value}
              />
            </label>
          ))}
        </div>
        <div className="chem-stat-grid">
          <article>
            <span>Identity</span>
            <strong>{element.name}</strong>
          </article>
          <article>
            <span>Mass number</span>
            <strong>{massNumber}</strong>
          </article>
          <article>
            <span>Charge</span>
            <strong>{charge === 0 ? "neutral" : `${charge > 0 ? "+" : ""}${charge}`}</strong>
          </article>
          <article>
            <span>Shell model</span>
            <strong>{shellText}</strong>
          </article>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["Build Carbon-14", 6, 8, 6],
            ["Build Na+", 11, 12, 10],
            ["Build Cl-", 17, 18, 18],
          ].map(([label, nextProtons, nextNeutrons, nextElectrons]) => (
            <Button
              key={String(label)}
              onClick={() => {
                setProtons(Number(nextProtons));
                setNeutrons(Number(nextNeutrons));
                setElectrons(Number(nextElectrons));
              }}
              type="button"
              variant="outline"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>
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
  const points = periodicTableElements
    .filter((element) => element.atomicNumber <= 30)
    .map((element) => ({
      x: (element.atomicNumber / 30) * 100,
      y: Math.min(100, getTrendScore(element, trendMode) * (trendMode === "atomic-radius" ? 0.4 : 25)),
    }));

  return (
    <WorkspacePanel description="Desmos-ready periodic trend graph with a fast fallback chart." title="Periodic trends graph">
      <div className="chem-showcase-module" data-chemistry-module="periodic-trends-graph">
        <div className="chem-showcase-toolbar">
          <LineChart className="size-5 text-primary" />
          <p className="text-sm text-muted-foreground">{desmosStatusCopy()}</p>
        </div>
        <div className="chem-showcase-segment" role="group" aria-label="Trend">
          {(["electronegativity", "atomic-radius", "ionization-energy", "metallic-character"] as TrendMode[]).map((mode) => (
            <Button key={mode} onClick={() => setTrendMode(mode)} type="button" variant={trendMode === mode ? "default" : "outline"}>
              {mode.replace(/-/g, " ")}
            </Button>
          ))}
        </div>
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
