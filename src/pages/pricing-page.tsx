import { CSSProperties, PointerEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  CreditCard,
  FunctionSquare,
  GraduationCap,
  Grid3X3,
  Highlighter,
  LockKeyhole,
  PenLine,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";

const pricingProof = [
  "View pricing before sign-in",
  "Real Supabase accounts",
  "Built-in Desmos graphing",
  "Open-source whiteboard foundation",
];

const planCards = [
  {
    id: "free",
    eyebrow: "Start calm",
    name: "Free",
    price: "$0",
    cadence: "forever",
    summary: "For students building a private study routine with real lessons and notes.",
    cta: "Start free",
    href: "/auth",
    badge: "Student",
    features: [
      "Read free binders and lessons",
      "Private notes beside sources",
      "Highlights and comments",
      "Math blocks and formula references",
      "Cloud account sign-in",
    ],
  },
  {
    id: "plus",
    eyebrow: "More room",
    name: "Plus",
    price: "$8",
    cadence: "per month",
    summary: "For students who want bigger notebooks, more graphs, and a real whiteboard habit.",
    cta: "Start Plus",
    href: "/auth",
    badge: "Study upgrade",
    features: [
      "Unlimited binders",
      "3 Math Whiteboards",
      "Desmos PowerGraphs",
      "Graph states and formula study",
      "No Admin Studio",
    ],
  },
  {
    id: "studio",
    eyebrow: "Publish your work",
    name: "Studio",
    price: "$20",
    cadence: "per month",
    summary: "For creators, tutors, and serious learners who publish their own notes and materials.",
    cta: "Start Studio",
    href: "/auth",
    badge: "Best value",
    features: [
      "Admin Studio",
      "Publish your own notes",
      "Control your own files",
      "Upload and annotate PDFs",
      "20 Math Whiteboards",
    ],
  },
  {
    id: "everything",
    eyebrow: "Everything unlocked",
    name: "Everything",
    price: "$35",
    cadence: "per month",
    summary: "For the full BinderNotes setup: studying, publishing, files, whiteboards, and premium controls.",
    cta: "Get Everything",
    href: "/auth",
    badge: "All access",
    features: [
      "Everything in Studio",
      "Full Admin Studio controls",
      "Expanded whiteboard capacity",
      "All Desmos, PDF, and publishing tools",
      "Premium workspace customization",
    ],
  },
];

const comparisonRows = [
  ["Source lessons + private notes", "Included", "Included", "Included", "Included"],
  ["Highlights, comments, and quote capture", "Included", "Included", "Included", "Included"],
  ["Binders", "Starter access", "Unlimited", "Unlimited", "Unlimited"],
  ["Math Whiteboards", "Starter access", "3 boards", "20 boards", "Expanded capacity"],
  ["Desmos PowerGraphs", "Basic graphing", "Included", "Included", "Included"],
  ["Admin Studio", "Not included", "Not included", "Included", "Full controls"],
  ["Publish your own notes", "Not included", "Not included", "Included", "Included"],
  ["Upload and annotate PDFs", "Not included", "Not included", "Included", "Included"],
];

function renderComparisonValue(value: string) {
  if (value === "Included") {
    return (
      <span aria-label="Included" className="pricing-comparison-table__icon pricing-comparison-table__icon--included">
        <Check aria-hidden="true" />
      </span>
    );
  }

  if (value === "Not included") {
    return (
      <span aria-label="Not included" className="pricing-comparison-table__icon pricing-comparison-table__icon--missing">
        <X aria-hidden="true" />
      </span>
    );
  }

  return value;
}

const workflowCards = [
  {
    icon: <BookOpenCheck data-icon="inline-start" />,
    title: "Read",
    body: "Open a real source lesson without turning pricing into a login wall.",
  },
  {
    icon: <PenLine data-icon="inline-start" />,
    title: "Write",
    body: "Keep private notes, quotes, and highlights attached to your study context.",
  },
  {
    icon: <FunctionSquare data-icon="inline-start" />,
    title: "Graph",
    body: "Use built-in Desmos graphing when formulas need a visual surface.",
  },
  {
    icon: <Grid3X3 data-icon="inline-start" />,
    title: "Board",
    body: "Move into a whiteboard lab that still knows the lesson you came from.",
  },
];

const faqs = [
  {
    question: "Do I need to sign in to see pricing?",
    answer: "No. This page is public so students and parents can understand the options before creating an account.",
  },
  {
    question: "What is the best plan for one student?",
    answer: "Start with Free if you are exploring. Plus is the clean upgrade for students who want unlimited binders, 3 whiteboards, and stronger graphing.",
  },
  {
    question: "Which plan includes Admin Studio?",
    answer: "Studio includes Admin Studio at $20/month. Everything includes the full admin, publishing, PDF, graph, and workspace feature set.",
  },
  {
    question: "Is Desmos included?",
    answer: "Yes. BinderNotes includes Desmos-powered graphing inside the math study flow.",
  },
  {
    question: "What is open source here?",
    answer: "The whiteboard drawing foundation builds on open-source Excalidraw, with BinderNotes adding study-native modules and storage.",
  },
];

export function PricingPage() {
  const [heroPointer, setHeroPointer] = useState({
    x: "0px",
    y: "0px",
    tiltX: "0deg",
    tiltY: "0deg",
  });
  const [expandedFaq, setExpandedFaq] = useState(faqs[0].question);

  const updateHeroPointer = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left - rect.width / 2) / rect.width;
    const normalizedY = (event.clientY - rect.top - rect.height / 2) / rect.height;
    setHeroPointer({
      x: `${normalizedX * 26}px`,
      y: `${normalizedY * 20}px`,
      tiltX: `${normalizedY * -5}deg`,
      tiltY: `${normalizedX * 7}deg`,
    });
  };

  return (
    <main className="pricing-page">
      <section
        className="pricing-hero"
        onPointerLeave={() => setHeroPointer({ x: "0px", y: "0px", tiltX: "0deg", tiltY: "0deg" })}
        onPointerMove={updateHeroPointer}
        style={
          {
            "--pricing-x": heroPointer.x,
            "--pricing-y": heroPointer.y,
            "--pricing-tilt-x": heroPointer.tiltX,
            "--pricing-tilt-y": heroPointer.tiltY,
          } as CSSProperties
        }
      >
        <PricingNav />
        <div className="pricing-hero__glow" aria-hidden="true" />
        <div className="pricing-hero__inner">
          <div className="pricing-hero__copy">
            <div className="marketing-kicker marketing-kicker--bright">
              <Sparkles data-icon="inline-start" />
              Public pricing, no login wall
            </div>
            <h1>Pricing for the study workspace you actually use.</h1>
            <p>
              Simple student-first pricing with the same premium product system: source lessons,
              private notes, Desmos graphing, whiteboards, highlights, and real cloud accounts.
            </p>
            <div className="pricing-hero__actions">
              <Button asChild className="marketing-button marketing-button--primary" size="lg">
                <Link to="/auth">
                  Start studying
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild className="marketing-button marketing-button--ghost" size="lg" variant="outline">
                <a href="#plans">Compare plans</a>
              </Button>
            </div>
            <div className="pricing-hero__proof">
              {pricingProof.map((item) => (
                <span key={item}>
                  <Check data-icon="inline-start" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <PricingConstellation />
        </div>
      </section>

      <section className="pricing-plans pricing-section" id="plans">
        <div className="pricing-section__intro">
          <span className="marketing-kicker">Plans</span>
          <h2>Four clear paths. No maze of hidden packages.</h2>
          <p>
            Start free, upgrade to deeper study tools at $8, publish your own work at $20, or
            unlock the full BinderNotes setup at $35.
          </p>
        </div>
        <div className="pricing-plan-grid">
          {planCards.map((plan) => (
            <article className="pricing-plan-card" data-featured={plan.id === "studio"} key={plan.id}>
              <div className="pricing-plan-card__ambient" aria-hidden="true" />
              <div className="pricing-plan-card__top">
                <span>{plan.eyebrow}</span>
                <strong>{plan.badge}</strong>
              </div>
              <h3>{plan.name}</h3>
              <p>{plan.summary}</p>
              <div className="pricing-plan-card__price">
                <span>{plan.price}</span>
                <small>{plan.cadence}</small>
              </div>
              <Link className="pricing-plan-card__cta" to={plan.href}>
                {plan.cta}
                <ArrowRight data-icon="inline-end" />
              </Link>
              <div className="pricing-plan-card__features">
                {plan.features.map((feature) => (
                  <span key={feature}>
                    <Check data-icon="inline-start" />
                    {feature}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="pricing-story pricing-section">
        <div className="pricing-story__visual">
          <div className="pricing-story__track" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          {workflowCards.map((card, index) => (
            <article className="pricing-workflow-card" key={card.title} style={{ "--pricing-card-index": index } as CSSProperties}>
              <div>{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
        <div className="pricing-story__copy">
          <span className="marketing-kicker">What you are paying for</span>
          <h2>A study system, not another subscription badge.</h2>
          <p>
            The value is context: every note, graph, formula, highlight, and board stays attached
            to what you were learning when you made it.
          </p>
          <div className="pricing-story__badges">
            <span>
              <Highlighter data-icon="inline-start" />
              Highlights
            </span>
            <span>
              <FunctionSquare data-icon="inline-start" />
              Desmos built in
            </span>
            <span>
              <Wand2 data-icon="inline-start" />
              Open-source board foundation
            </span>
          </div>
        </div>
      </section>

      <section className="pricing-compare pricing-section">
        <div className="pricing-section__intro">
          <span className="marketing-kicker">Compare</span>
          <h2>Enough detail to decide without making you do homework.</h2>
        </div>
        <div className="pricing-comparison-table" role="table" aria-label="Plan comparison">
          <div className="pricing-comparison-table__row pricing-comparison-table__row--header" role="row">
            <span role="columnheader">Feature</span>
            <span role="columnheader">Free</span>
            <span role="columnheader">Plus</span>
            <span role="columnheader">Studio</span>
            <span role="columnheader">Everything</span>
          </div>
          {comparisonRows.map(([feature, free, plus, studio, everything]) => (
            <div className="pricing-comparison-table__row" key={feature} role="row">
              <span role="cell">{feature}</span>
              <span role="cell">{renderComparisonValue(free)}</span>
              <span role="cell">{renderComparisonValue(plus)}</span>
              <span role="cell">{renderComparisonValue(studio)}</span>
              <span role="cell">{renderComparisonValue(everything)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pricing-trust pricing-section">
        <article className="pricing-trust-card">
          <LockKeyhole data-icon="inline-start" />
          <h2>Real accounts. Real saving. No demo pricing fog.</h2>
          <p>
            Pricing is visible before sign-in, but the actual study workspace still uses real
            Supabase auth and user-owned data paths.
          </p>
        </article>
        <article className="pricing-trust-card">
          <CreditCard data-icon="inline-start" />
          <h2>Payment boundary stays clean.</h2>
          <p>
            The paid plans are priced publicly while checkout activation stays isolated from the
            learning app, so the product can stay stable as billing evolves.
          </p>
        </article>
      </section>

      <section className="pricing-faq pricing-section" id="pricing-faq">
        <div className="pricing-section__intro">
          <span className="marketing-kicker">Questions</span>
          <h2>Fast answers before you create an account.</h2>
        </div>
        <div className="pricing-faq__list">
          {faqs.map((item) => {
            const isOpen = expandedFaq === item.question;
            return (
              <article className="pricing-faq__item" data-open={isOpen} key={item.question}>
                <button
                  aria-expanded={isOpen}
                  onClick={() => setExpandedFaq(isOpen ? "" : item.question)}
                  type="button"
                >
                  <span>{item.question}</span>
                  <ChevronDown data-icon="inline-end" />
                </button>
                <p>{item.answer}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="pricing-final">
        <div className="pricing-final__content">
          <span className="marketing-kicker marketing-kicker--bright">Ready when you are</span>
          <h2>Start free, then upgrade when BinderNotes becomes your main study desk.</h2>
          <p>
            See the product, compare the plans, and create a real account only when the value is clear.
          </p>
          <Button asChild className="marketing-button marketing-button--primary" size="lg">
            <Link to="/auth">
              Start studying now
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function PricingNav() {
  return (
    <nav className="marketing-nav pricing-nav" aria-label="Pricing navigation">
      <Link className="marketing-nav__brand" to="/">
        <LogoMark />
        <span>
          <strong>BinderNotes</strong>
          <small>Study workspace</small>
        </span>
      </Link>
      <div className="marketing-nav__links">
        <Link to="/">Home</Link>
        <a href="#plans">Plans</a>
        <a href="#pricing-faq">Questions</a>
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

function PricingConstellation() {
  return (
    <div className="pricing-constellation" aria-label="Pricing product preview">
      <article className="pricing-preview pricing-preview--main">
        <div className="pricing-preview__top">
          <span>Studio workspace</span>
          <strong>$20 / mo</strong>
        </div>
        <div className="pricing-preview__body">
          <div className="pricing-preview__module">
            <span>Source lesson</span>
            <strong>Triangle congruence</strong>
          </div>
          <div className="pricing-preview__module pricing-preview__module--accent">
            <span>Private notes</span>
            <strong>My proof map</strong>
          </div>
          <div className="pricing-preview__whiteboard">
            <span />
            <span />
            <span />
          </div>
        </div>
      </article>
      <article className="pricing-preview pricing-preview--graph">
        <div className="pricing-preview__top">
          <span>Desmos Graph</span>
          <strong>Built in</strong>
        </div>
        <div className="mini-graph mini-graph--small">
          <span className="mini-graph__axis mini-graph__axis--x" />
          <span className="mini-graph__axis mini-graph__axis--y" />
          <span className="mini-graph__curve" />
        </div>
      </article>
      <article className="pricing-preview pricing-preview--free">
        <GraduationCap data-icon="inline-start" />
        <span>Free plan</span>
        <strong>Start with notes, highlights, and real sign-in.</strong>
      </article>
    </div>
  );
}
