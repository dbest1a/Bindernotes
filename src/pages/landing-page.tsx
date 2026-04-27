import { CSSProperties, PointerEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  Check,
  ChevronRight,
  FileText,
  FunctionSquare,
  Grid3X3,
  Highlighter,
  Layers3,
  MousePointer2,
  PenLine,
  Play,
  Sparkles,
  Wand2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";

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
  const [heroPointer, setHeroPointer] = useState({
    x: "0px",
    y: "0px",
    tiltX: "0deg",
    tiltY: "0deg",
  });
  const [activeShowcase, setActiveShowcase] = useState<ShowcaseId>("study");

  const updateHeroPointer = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left - rect.width / 2) / rect.width;
    const normalizedY = (event.clientY - rect.top - rect.height / 2) / rect.height;
    setHeroPointer({
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
        onPointerLeave={() => setHeroPointer({ x: "0px", y: "0px", tiltX: "0deg", tiltY: "0deg" })}
        onPointerMove={updateHeroPointer}
        style={
          {
            "--hero-x": heroPointer.x,
            "--hero-y": heroPointer.y,
            "--hero-tilt-x": heroPointer.tiltX,
            "--hero-tilt-y": heroPointer.tiltY,
          } as CSSProperties
        }
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
              gets bigger.
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
      </footer>
    </main>
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
