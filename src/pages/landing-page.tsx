import { CSSProperties, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  CalendarClock,
  Check,
  ChevronRight,
  FileText,
  FunctionSquare,
  Grid3X3,
  Highlighter,
  Layers3,
  ListChecks,
  MousePointer2,
  NotebookPen,
  PenLine,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { useAuth } from "@/hooks/use-auth";
import { useBetaFeatures } from "@/hooks/use-beta-features";

const heroNotes = [
  "Derivative from first principles",
  "Highlight -> explain -> save",
  "Timeline evidence",
  "Private note beside source",
  "Graph idea pinned to board",
];

const proofItems = [
  {
    icon: <BookOpenCheck data-icon="inline-start" />,
    title: "Source and notes stay separate",
    body: "Read the lesson without losing your own explanation, comments, highlights, and writing flow.",
  },
  {
    icon: <FunctionSquare data-icon="inline-start" />,
    title: "Math tools live where studying happens",
    body: "Graphing, formulas, calculators, proof work, and whiteboards sit inside the binder instead of scattered tabs.",
  },
  {
    icon: <Grid3X3 data-icon="inline-start" />,
    title: "Workspaces adapt to the moment",
    body: "Switch from split study to canvas, graph lab, or fullscreen whiteboard without rebuilding your setup.",
  },
];

const foundationItems = [
  {
    title: "Real API-backed accounts",
    body: "Supabase auth and cloud data paths power real sign-in and saved study work.",
  },
  {
    title: "Open-source drawing foundation",
    body: "The whiteboard experience builds on Excalidraw while BinderNotes adds study-native modules.",
  },
  {
    title: "Built-in Desmos graphing",
    body: "Students can use Desmos-powered graphing inside the study flow instead of jumping to another tab.",
  },
];

const showcaseTabs = [
  {
    id: "study",
    label: "Study Workspace",
    kicker: "Read beside your thinking",
    title: "A calm two-pane desk for real studying.",
    body: "Published source on one side. Private notes, quote capture, and structure on the other. No copy-paste archaeology later.",
  },
  {
    id: "whiteboard",
    label: "Whiteboard Lab",
    kicker: "Think in space",
    title: "A math whiteboard that still knows your binder.",
    body: "Sketch, place modules, open source lessons, pin graph work, and keep the board connected to the lesson you are studying.",
  },
  {
    id: "graph",
    label: "Graph + Formula",
    kicker: "Math first",
    title: "Graphing and formulas are first-class study objects.",
    body: "Use graph states, formula blocks, calculator work, and lesson notes as one connected workspace.",
  },
] as const;

type ShowcaseId = (typeof showcaseTabs)[number]["id"];

const workflowSteps = [
  {
    icon: <FileText data-icon="inline-start" />,
    title: "Open a binder",
    body: "Start from a real lesson instead of a blank document.",
  },
  {
    icon: <Highlighter data-icon="inline-start" />,
    title: "Mark what matters",
    body: "Turn highlights and comments into study structure.",
  },
  {
    icon: <PenLine data-icon="inline-start" />,
    title: "Write beside the source",
    body: "Keep private notes attached to the exact lesson context.",
  },
  {
    icon: <Wand2 data-icon="inline-start" />,
    title: "Expand into tools",
    body: "Open graphing, formulas, whiteboards, and presets only when they help.",
  },
];

const differentiators = [
  "Not a blank notes app pretending to be a classroom.",
  "Not a whiteboard floating away from the lesson.",
  "Not a graph pasted later as a screenshot.",
  "One premium study surface that keeps context intact.",
];

export function LandingPage() {
  return <ClassicLandingPage />;
}

export function HomepageBetaPage() {
  const { profile } = useAuth();
  const betaFeatures = useBetaFeatures(profile?.id);

  if (!betaFeatures.isFeatureEnabled("betaRevampCalmStudyHomepage")) {
    return <ClassicLandingPage />;
  }

  return <CalmStudyHomepage previewRoute />;
}

function ClassicLandingPage() {
  const heroRef = useRef<HTMLElement | null>(null);
  const heroPointerRafRef = useRef<number | null>(null);
  const pendingHeroPointerRef = useRef({
    x: "0px",
    y: "0px",
    tiltX: "0deg",
    tiltY: "0deg",
  });
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseId>("study");

  const applyHeroPointer = useCallback(() => {
    heroPointerRafRef.current = null;
    const hero = heroRef.current;
    if (!hero) {
      return;
    }

    const pointer = pendingHeroPointerRef.current;
    hero.style.setProperty("--hero-x", pointer.x);
    hero.style.setProperty("--hero-y", pointer.y);
    hero.style.setProperty("--hero-tilt-x", pointer.tiltX);
    hero.style.setProperty("--hero-tilt-y", pointer.tiltY);
  }, []);

  const scheduleHeroPointer = useCallback(
    (nextPointer: typeof pendingHeroPointerRef.current) => {
      pendingHeroPointerRef.current = nextPointer;
      if (heroPointerRafRef.current !== null) {
        return;
      }

      heroPointerRafRef.current = window.requestAnimationFrame(applyHeroPointer);
    },
    [applyHeroPointer],
  );

  useEffect(
    () => () => {
      if (heroPointerRafRef.current !== null) {
        window.cancelAnimationFrame(heroPointerRafRef.current);
      }
    },
    [],
  );

  const updateHeroPointer = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left - rect.width / 2) / rect.width;
    const normalizedY = (event.clientY - rect.top - rect.height / 2) / rect.height;
    scheduleHeroPointer({
      x: `${normalizedX * 34}px`,
      y: `${normalizedY * 28}px`,
      tiltX: `${normalizedY * -7}deg`,
      tiltY: `${normalizedX * 9}deg`,
    });
  };

  return (
    <main className="marketing-page">
      <section
        className="marketing-hero"
        onPointerLeave={() => scheduleHeroPointer({ x: "0px", y: "0px", tiltX: "0deg", tiltY: "0deg" })}
        onPointerMove={updateHeroPointer}
        ref={heroRef}
      >
        <MarketingNav />
        <div className="marketing-hero__glow" aria-hidden="true" />
        <div className="marketing-hero__notes" aria-hidden="true">
          {heroNotes.map((note, index) => (
            <span className="marketing-flying-note" key={note} style={{ "--note-index": index } as CSSProperties}>
              {note}
            </span>
          ))}
        </div>

        <div className="marketing-hero__inner">
          <div className="marketing-hero__copy">
            <div className="marketing-kicker marketing-kicker--bright">
              <Sparkles data-icon="inline-start" />
              Built for serious students
            </div>
            <h1>
              Study notes that feel like a living, premium workspace.
            </h1>
            <p>
              BinderNotes brings lessons, private notes, highlights, formulas, graphing, and
              whiteboards into one cinematic study system that stays organized while your thinking
              gets bigger and stronger.
            </p>
            <div className="marketing-hero__actions">
              <Button asChild className="marketing-button marketing-button--primary" size="lg">
                <Link to="/auth">
                  Start studying
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild className="marketing-button marketing-button--ghost" size="lg" variant="outline">
                <a href="#showcase">
                  Watch it unfold
                  <Play data-icon="inline-end" />
                </a>
              </Button>
            </div>
            <div className="marketing-hero__proof" aria-label="Product strengths">
              <span><Check data-icon="inline-start" /> Real Supabase accounts</span>
              <span><Check data-icon="inline-start" /> Math-ready workspaces</span>
              <span><Check data-icon="inline-start" /> Built-in Desmos graphing</span>
              <span><Check data-icon="inline-start" /> Full whiteboard lab</span>
              <span><Check data-icon="inline-start" /> Open-source foundations</span>
            </div>
          </div>

          <ProductConstellation />
        </div>
      </section>

      <section className="marketing-proof marketing-section">
        <div className="marketing-section__intro">
          <span className="marketing-kicker">What it is</span>
          <h2>A binder, notebook, graph lab, and whiteboard that behave like one product.</h2>
          <p>
            BinderNotes is not just another note page. It is a structured study workspace that
            keeps sources, thinking, and tools connected.
          </p>
        </div>
        <div className="marketing-proof__grid">
          {proofItems.map((item, index) => (
            <article className="marketing-proof-card marketing-reveal" key={item.title} style={{ "--reveal-index": index } as CSSProperties}>
              <div className="marketing-proof-card__icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-foundations marketing-section" aria-labelledby="marketing-foundations-title">
        <div className="marketing-foundations__header">
          <span className="marketing-kicker">APIs + open source</span>
          <h2 id="marketing-foundations-title">Built on serious infrastructure, not fake demo magic.</h2>
        </div>
        <div className="marketing-foundations__grid">
          {foundationItems.map((item) => (
            <article className="marketing-foundation-card" key={item.title}>
              <span />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-showcase marketing-section" id="showcase">
        <div className="marketing-showcase__header">
          <div>
            <span className="marketing-kicker">Interactive product showcase</span>
            <h2>Move from reading to graphing to whiteboarding without leaving the lesson.</h2>
          </div>
          <div className="marketing-showcase__tabs" role="tablist" aria-label="Product showcase">
            {showcaseTabs.map((tab) => (
              <button
                aria-selected={activeShowcase === tab.id}
                className="marketing-showcase__tab"
                key={tab.id}
                onClick={() => setActiveShowcase(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="marketing-showcase__stage">
          <div className="marketing-showcase__copy">
            {showcaseTabs.map((tab) => (
              <article
                aria-hidden={activeShowcase !== tab.id}
                className="marketing-showcase__panel-copy"
                data-active={activeShowcase === tab.id}
                key={tab.id}
              >
                <span>{tab.kicker}</span>
                <h3>{tab.title}</h3>
                <p>{tab.body}</p>
              </article>
            ))}
            <Link className="marketing-inline-cta" to="/auth">
              Open your first workspace
              <ChevronRight data-icon="inline-end" />
            </Link>
          </div>
          <ShowcaseVisual active={activeShowcase} />
        </div>
      </section>

      <section className="marketing-whiteboard marketing-section" id="whiteboard">
        <div className="marketing-whiteboard__visual marketing-reveal">
          <WhiteboardProductMockup />
        </div>
        <div className="marketing-whiteboard__copy marketing-reveal">
          <span className="marketing-kicker">Whiteboard Lab</span>
          <h2>Sketch the messy part, then keep the useful part attached to the lesson.</h2>
          <p>
            The whiteboard is not a separate island. It can hold BinderNotes modules, graph work,
            source context, and notes so visual thinking becomes a study artifact.
          </p>
          <div className="marketing-feature-list">
            <span><MousePointer2 data-icon="inline-start" /> Place modules on the board</span>
            <span><Calculator data-icon="inline-start" /> Open graph and calculator tools</span>
            <span><Layers3 data-icon="inline-start" /> Keep context with binder lessons</span>
          </div>
        </div>
      </section>

      <section className="marketing-notes marketing-section">
        <div className="marketing-section__intro">
          <span className="marketing-kicker">Notes that move with meaning</span>
          <h2>From scattered thoughts to a clean study trail.</h2>
          <p>
            Highlights, quotes, private explanations, and math blocks stop drifting around. They
            land where they belong.
          </p>
        </div>
        <div className="marketing-note-river" aria-label="Animated note workflow">
          {[
            "Read the source",
            "Capture the quote",
            "Add your explanation",
            "Graph the idea",
            "Save the note",
            "Review with context",
          ].map((item, index) => (
            <article className="marketing-note-card" key={item} style={{ "--river-index": index } as CSSProperties}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-workflow marketing-section">
        <div className="marketing-section__intro">
          <span className="marketing-kicker">How it works</span>
          <h2>A premium study flow without setup drag.</h2>
        </div>
        <div className="marketing-workflow__track">
          {workflowSteps.map((step, index) => (
            <article className="marketing-workflow__step marketing-reveal" key={step.title} style={{ "--reveal-index": index } as CSSProperties}>
              <div className="marketing-workflow__number">{String(index + 1).padStart(2, "0")}</div>
              <div className="marketing-workflow__icon">{step.icon}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-difference marketing-section">
        <div className="marketing-difference__copy">
          <span className="marketing-kicker">Why it feels different</span>
          <h2>BinderNotes turns academic chaos into a workspace you want to come back to.</h2>
          <p>
            The difference is context. Your lesson, private note, highlight, graph, formula, and
            whiteboard are not separate chores. They are parts of the same thinking surface.
          </p>
        </div>
        <div className="marketing-difference__stack">
          {differentiators.map((item, index) => (
            <div className="marketing-difference__card marketing-reveal" key={item} style={{ "--reveal-index": index } as CSSProperties}>
              <span>{index < 3 ? "Without" : "With BinderNotes"}</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-final-cta">
        <div className="marketing-final-cta__scene" aria-hidden="true">
          <div className="marketing-final-cta__panel" />
          <div className="marketing-final-cta__panel" />
          <div className="marketing-final-cta__panel" />
        </div>
        <div className="marketing-final-cta__content">
          <span className="marketing-kicker marketing-kicker--bright">Start with one binder</span>
          <h2>Build the study workspace your brain has been trying to draw.</h2>
          <p>
            Open BinderNotes, choose a real lesson, and let your notes, graph work, highlights, and
            whiteboards finally share one home.
          </p>
          <div className="marketing-hero__actions">
            <Button asChild className="marketing-button marketing-button--primary" size="lg">
              <Link to="/auth">
                Start studying now
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild className="marketing-button marketing-button--ghost" size="lg" variant="outline">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="marketing-footer">
        <Link className="marketing-footer__brand" to="/">
          <LogoMark />
          <span>BinderNotes</span>
        </Link>
        <nav aria-label="Footer">
          <Link to="/auth">Sign in</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/tutorial">Tutorial</Link>
        </nav>
        <Link className="marketing-footer__easter-egg" to="/hidden-hollow" aria-label="Loose stone under the footer">
          loose stone
        </Link>
      </footer>
    </main>
  );
}

const calmWorkflowSteps = [
  {
    body: "Keep the exact textbook, PDF, or lesson moment beside the note it created.",
    id: "source",
    label: "Source excerpt",
    title: "Start with the source",
  },
  {
    body: "Rewrite the idea in your own words while the excerpt is still in view.",
    id: "note",
    label: "Student note",
    title: "Make it yours",
  },
  {
    body: "Save the graph state, formula, or problem setup next to the explanation.",
    id: "graph",
    label: "Graph + formula context",
    title: "Attach the math",
  },
  {
    body: "Turn the note into a small review card so it comes back on schedule.",
    id: "review",
    label: "Review card",
    title: "Review on purpose",
  },
  {
    body: "Collect missed steps before the exam so practice becomes targeted.",
    id: "mistakes",
    label: "Exam-ready mistake list",
    title: "Know what to fix",
  },
] as const;

const calmHelpItems = [
  {
    icon: <BookOpenCheck data-icon="inline-start" />,
    title: "Capture source",
    body: "Keep source excerpts, highlights, and binder context connected instead of scattered across tabs.",
  },
  {
    icon: <NotebookPen data-icon="inline-start" />,
    title: "Write in your own words",
    body: "Private notes stay student-owned and close to the material that made them useful.",
  },
  {
    icon: <FunctionSquare data-icon="inline-start" />,
    title: "Save math context",
    body: "Graphs, formulas, problem setups, and theorem notes become study objects, not screenshots.",
  },
  {
    icon: <CalendarClock data-icon="inline-start" />,
    title: "Review on schedule",
    body: "Notes can become small review moments that support steady exam confidence.",
  },
  {
    icon: <ListChecks data-icon="inline-start" />,
    title: "Track mistakes",
    body: "Missed signs, formula mixups, and problem-type patterns stay visible before test day.",
  },
];

const mathHeavyAudiences = [
  "AP Calculus",
  "College calculus",
  "STEM gateway courses",
  "Tutoring workflows",
];

function CalmStudyHomepage({ previewRoute }: { previewRoute: boolean }) {
  const heroRef = useRef<HTMLElement | null>(null);
  const pointerRafRef = useRef<number | null>(null);
  const pendingPointerRef = useRef({
    x: "0px",
    y: "0px",
    tiltX: "0deg",
    tiltY: "0deg",
  });

  const applyPointer = useCallback(() => {
    pointerRafRef.current = null;
    const hero = heroRef.current;
    if (!hero) {
      return;
    }

    const pointer = pendingPointerRef.current;
    hero.style.setProperty("--beta-pointer-x", pointer.x);
    hero.style.setProperty("--beta-pointer-y", pointer.y);
    hero.style.setProperty("--beta-tilt-x", pointer.tiltX);
    hero.style.setProperty("--beta-tilt-y", pointer.tiltY);
  }, []);

  const schedulePointer = useCallback(
    (nextPointer: typeof pendingPointerRef.current) => {
      pendingPointerRef.current = nextPointer;
      if (pointerRafRef.current !== null) {
        return;
      }

      pointerRafRef.current = 0;
      const frameId = window.requestAnimationFrame(applyPointer);
      if (pointerRafRef.current === 0) {
        pointerRafRef.current = frameId;
      }
    },
    [applyPointer],
  );

  useEffect(
    () => () => {
      if (pointerRafRef.current !== null) {
        window.cancelAnimationFrame(pointerRafRef.current);
      }
    },
    [],
  );

  const updatePointer = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left - rect.width / 2) / Math.max(rect.width, 1);
    const normalizedY = (event.clientY - rect.top - rect.height / 2) / Math.max(rect.height, 1);
    schedulePointer({
      x: `${(normalizedX * 64).toFixed(2)}px`,
      y: `${(normalizedY * 56).toFixed(2)}px`,
      tiltX: `${(normalizedY * -8).toFixed(2)}deg`,
      tiltY: `${(normalizedX * 12).toFixed(2)}deg`,
    });
  };

  return (
    <main
      className="marketing-page beta-homepage"
      data-beta-performance-mode="lean"
      data-beta-preview-route={previewRoute ? "homepage-beta" : "home"}
      data-testid="beta-calm-homepage"
    >
      <section
        className="beta-homepage-hero"
        data-testid="beta-calm-hero"
        id="top"
        onPointerLeave={() => schedulePointer({ x: "0px", y: "0px", tiltX: "0deg", tiltY: "0deg" })}
        onPointerMove={updatePointer}
        ref={heroRef}
      >
        <MarketingNav />
        <div className="beta-homepage-hero__inner">
          <div className="beta-homepage-hero__copy">
            <div className="marketing-kicker marketing-kicker--bright">
              <Sparkles data-icon="inline-start" />
              Beta Revamp homepage
            </div>
            <h1>Study notes that remember the source.</h1>
            <p>
              A calmer workspace for calculus notes, graphs, and review. BinderNotes helps students
              move from source to note to math context to practice without turning studying into a
              pile of disconnected tabs.
            </p>
            <div className="marketing-hero__actions">
              <Button asChild className="marketing-button marketing-button--primary" size="lg">
                <Link to="/auth">
                  Start studying
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild className="marketing-button marketing-button--ghost" size="lg" variant="outline">
                <a href="#showcase">
                  See the workflow
                  <Play data-icon="inline-end" />
                </a>
              </Button>
            </div>
            <div className="marketing-hero__proof" aria-label="Beta homepage strengths">
              <span><Check data-icon="inline-start" /> Source-linked notes</span>
              <span><Check data-icon="inline-start" /> Graphs beside formulas</span>
              <span><Check data-icon="inline-start" /> Review and mistakes</span>
              <span><Check data-icon="inline-start" /> Real accounts</span>
            </div>
            <p className="beta-homepage-ai-note">
              AI study helpers, when enabled, work from your notes and sources.
            </p>
          </div>

          <BetaFloatingWorkflowVisual />
        </div>
      </section>

      <section
        className="beta-homepage-workflow marketing-section"
        data-testid="beta-calm-study-workflow"
        id="showcase"
      >
        <div className="marketing-section__intro">
          <span className="marketing-kicker">One concrete study loop</span>
          <h2>From source excerpt to exam-ready mistakes.</h2>
          <p>
            The beta message focuses on the habit BinderNotes should own first: source-linked
            studying for math-heavy classes.
          </p>
        </div>
        <div className="beta-homepage-workflow__track">
          {calmWorkflowSteps.map((step, index) => (
            <article
              className="beta-homepage-workflow__step"
              data-beta-workflow-step={step.id}
              key={step.id}
              style={{ "--workflow-index": index } as CSSProperties}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.label}</strong>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="beta-homepage-help marketing-section">
        <div className="marketing-section__intro">
          <span className="marketing-kicker">How BinderNotes helps</span>
          <h2>Less scattered study, more connected practice.</h2>
        </div>
        <div className="beta-homepage-help__grid">
          {calmHelpItems.map((item) => (
            <article className="beta-homepage-help__card" key={item.title}>
              <div>{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="beta-homepage-math marketing-section" id="whiteboard">
        <div className="beta-homepage-math__copy">
          <span className="marketing-kicker">Built for math-heavy students first</span>
          <h2>Calculus and STEM courses need more than a blank note.</h2>
          <p>
            BinderNotes should win where source excerpts, problem work, formulas, graphs, tutoring
            notes, and mistake review all need to stay connected.
          </p>
        </div>
        <div className="beta-homepage-math__list" aria-label="Math-heavy student use cases">
          {mathHeavyAudiences.map((item) => (
            <span key={item}>
              <Target data-icon="inline-start" />
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="beta-homepage-trust marketing-section">
        <article>
          <ShieldCheck data-icon="inline-start" />
          <h2>Real accounts, no demo workspace in account areas.</h2>
          <p>
            The product promise stays grounded in real Supabase auth, user-owned notes, and account
            data paths. Public copy should earn trust without implying a fake workspace or generic
            answer engine.
          </p>
        </article>
        <article>
          <BookOpenCheck data-icon="inline-start" />
          <h2>Student-owned study records.</h2>
          <p>
            Source-linked notes, graph context, and review history should belong to the learner and
            remain portable as BinderNotes grows export and data controls.
          </p>
        </article>
      </section>

      <section className="marketing-final-cta beta-homepage-final">
        <div className="marketing-final-cta__content">
          <span className="marketing-kicker marketing-kicker--bright">Beta gated for review</span>
          <h2>Start with one source, one note, one better review session.</h2>
          <p>
            This homepage path keeps the floating BinderNotes feel while making the promise more
            concrete, faster to load, and easier for students to understand.
          </p>
          <div className="marketing-hero__actions">
            <Button asChild className="marketing-button marketing-button--primary" size="lg">
              <Link to="/auth">
                Start studying now
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild className="marketing-button marketing-button--ghost" size="lg" variant="outline">
              <Link to="/pricing-beta">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function BetaFloatingWorkflowVisual() {
  return (
    <div className="beta-floating-workflow" data-testid="beta-calm-floating-modules" aria-label="Source-linked study workflow preview">
      <article className="beta-floating-card beta-floating-card--source">
        <div className="beta-floating-card__top">
          <span>Source excerpt</span>
          <strong>Calc I</strong>
        </div>
        <p>
          A derivative measures the instantaneous rate of change at a point, built from the limit
          of secant slopes.
        </p>
        <mark>limit of secant slopes</mark>
      </article>
      <article className="beta-floating-card beta-floating-card--note">
        <div className="beta-floating-card__top">
          <span>Student note</span>
          <strong>Own words</strong>
        </div>
        <p>
          If h gets tiny, the average slope becomes the tangent slope. That is why the limit matters.
        </p>
      </article>
      <article className="beta-floating-card beta-floating-card--graph">
        <div className="beta-floating-card__top">
          <span>Graph + formula context</span>
          <strong>Saved</strong>
        </div>
        <div className="mini-graph mini-graph--small">
          <span className="mini-graph__axis mini-graph__axis--x" />
          <span className="mini-graph__axis mini-graph__axis--y" />
          <span className="mini-graph__curve" />
        </div>
        <div className="product-formula">f'(x) = lim (f(x+h) - f(x)) / h</div>
      </article>
      <article className="beta-floating-card beta-floating-card--review">
        <div className="beta-floating-card__top">
          <span>Review card</span>
          <strong>Tomorrow</strong>
        </div>
        <p>Explain why the derivative definition uses a limit.</p>
      </article>
      <article className="beta-floating-card beta-floating-card--mistakes">
        <div className="beta-floating-card__top">
          <span>Exam-ready mistake list</span>
          <strong>3 patterns</strong>
        </div>
        <ul>
          <li>Forgot to divide by h</li>
          <li>Mixed average and tangent slope</li>
          <li>Dropped expansion parentheses</li>
        </ul>
      </article>
    </div>
  );
}

function MarketingNav() {
  return (
    <nav className="marketing-nav" aria-label="Public navigation">
      <Link className="marketing-nav__brand" to="/">
        <LogoMark />
        <span>
          <strong>BinderNotes</strong>
          <small>Study workspace</small>
        </span>
      </Link>
      <div className="marketing-nav__links">
        <a href="#showcase">Product</a>
        <a href="#whiteboard">Whiteboard</a>
        <Link to="/pricing">Pricing</Link>
      </div>
      <div className="marketing-nav__actions">
        <Link className="marketing-nav__signin" to="/auth">Sign in</Link>
        <Link className="marketing-nav__start" to="/auth">
          Start
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>
    </nav>
  );
}

function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <Link className="marketing-footer__brand" to="/">
        <LogoMark />
        <span>BinderNotes</span>
      </Link>
      <nav aria-label="Footer">
        <Link to="/auth">Sign in</Link>
        <Link to="/pricing">Pricing</Link>
        <Link to="/tutorial">Tutorial</Link>
      </nav>
      <Link className="marketing-footer__easter-egg" to="/hidden-hollow" aria-label="Loose stone under the footer">
        loose stone
      </Link>
    </footer>
  );
}

function ProductConstellation() {
  return (
    <div className="marketing-product-scene" aria-label="BinderNotes product preview">
      <div className="marketing-product-scene__depth" data-depth="back">
        <GraphMiniPanel />
      </div>
      <div className="marketing-product-scene__depth" data-depth="mid">
        <WhiteboardMiniPanel />
      </div>
      <div className="marketing-product-scene__depth" data-depth="front">
        <StudyWorkspaceMockup />
      </div>
      <div className="marketing-product-scene__status">
        <Zap data-icon="inline-start" />
        Saved to your workspace
      </div>
    </div>
  );
}

function StudyWorkspaceMockup() {
  return (
    <article className="product-window product-window--study">
      <div className="product-window__topbar">
        <span>Split Study</span>
        <span className="product-window__pill">Locked study mode</span>
      </div>
      <div className="product-window__grid">
        <section className="product-panel product-panel--lesson">
          <span className="product-panel__eyebrow">Source lesson</span>
          <h3>Calculus Limits and the Derivative Definition</h3>
          <p>
            The calculus section reopens limits with more precision: important limits,
            epsilon-delta language, and formal reasoning.
          </p>
          <div className="product-highlight-line">Important limits anchor derivative rules.</div>
          <div className="product-formula">f'(x) = lim (f(x+h) - f(x)) / h</div>
        </section>
        <section className="product-panel product-panel--notes">
          <span className="product-panel__eyebrow">Private notes</span>
          <h3>My explanation</h3>
          <p>
            Limits describe behavior near a value. Derivatives turn that local behavior into a
            rate of change.
          </p>
          <div className="product-toolbar">
            <span>H2</span>
            <span>B</span>
            <span>Quote</span>
            <span>Graph</span>
          </div>
        </section>
      </div>
    </article>
  );
}

function WhiteboardMiniPanel() {
  return (
    <article className="floating-product-card floating-product-card--whiteboard">
      <div className="floating-product-card__top">
        <span>Math Whiteboard Lab</span>
        <span>6 objects</span>
      </div>
      <div className="mini-whiteboard-grid">
        <span className="mini-stroke mini-stroke--one" />
        <span className="mini-stroke mini-stroke--two" />
        <div className="mini-module-card">Source Lesson</div>
        <div className="mini-module-card mini-module-card--notes">Private Notes</div>
      </div>
    </article>
  );
}

function GraphMiniPanel() {
  return (
    <article className="floating-product-card floating-product-card--graph">
      <div className="floating-product-card__top">
        <span>Desmos Graph</span>
        <span>Live</span>
      </div>
      <div className="mini-graph">
        <span className="mini-graph__axis mini-graph__axis--x" />
        <span className="mini-graph__axis mini-graph__axis--y" />
        <span className="mini-graph__curve" />
      </div>
    </article>
  );
}

function ShowcaseVisual({ active }: { active: ShowcaseId }) {
  return (
    <div className="marketing-showcase-visual" data-active-showcase={active}>
      <div className="marketing-showcase-visual__frame">
        <StudyWorkspaceMockup />
        <div className="marketing-showcase-visual__overlay marketing-showcase-visual__overlay--whiteboard">
          <WhiteboardMiniPanel />
        </div>
        <div className="marketing-showcase-visual__overlay marketing-showcase-visual__overlay--graph">
          <GraphMiniPanel />
        </div>
      </div>
    </div>
  );
}

function WhiteboardProductMockup() {
  return (
    <article className="whiteboard-product">
      <div className="whiteboard-product__toolbar">
        <span><PenLine data-icon="inline-start" /> Draw</span>
        <span>Text</span>
        <span>Shape</span>
        <span>Modules</span>
      </div>
      <div className="whiteboard-product__canvas">
        <div className="whiteboard-product__module whiteboard-product__module--lesson">
          <strong>Right Triangle Trig</strong>
          <p>SOH-CAH-TOA connects angle, side, and ratio.</p>
        </div>
        <div className="whiteboard-product__module whiteboard-product__module--graph">
          <strong>Graph</strong>
          <div className="mini-graph mini-graph--small">
            <span className="mini-graph__axis mini-graph__axis--x" />
            <span className="mini-graph__axis mini-graph__axis--y" />
            <span className="mini-graph__curve" />
          </div>
        </div>
        <div className="whiteboard-product__sticky">
          sin(theta) = opposite / hypotenuse
        </div>
        <span className="whiteboard-product__stroke whiteboard-product__stroke--one" />
        <span className="whiteboard-product__stroke whiteboard-product__stroke--two" />
      </div>
    </article>
  );
}
