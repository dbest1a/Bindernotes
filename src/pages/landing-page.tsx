import { Link } from "react-router-dom";
import {
  ArrowRight,
  FunctionSquare,
  MessageSquareText,
  PanelsLeftRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogoMark } from "@/components/ui/logo-mark";

const proofPoints = [
  {
    icon: <PanelsLeftRight data-icon="inline-start" />,
    title: "Published on the left. Yours on the right.",
    body: "Students can read course notes beside private explanations without corrupting the source.",
  },
  {
    icon: <FunctionSquare data-icon="inline-start" />,
    title: "Math is first-class.",
    body: "LaTeX and function graphs live inside the study flow instead of being screenshots pasted later.",
  },
  {
    icon: <MessageSquareText data-icon="inline-start" />,
    title: "Highlights become understanding.",
    body: "Comments, anchors, and notes are structured around lessons and concepts.",
  },
];

const workflowPoints = [
  "Open a binder and start studying in under 30 seconds.",
  "Keep published lessons, private notes, formulas, and highlights in one clear hierarchy.",
  "Stay in flow with presets and defaults that already feel organized.",
];

export function LandingPage() {
  return (
    <main>
      <section className="relative min-h-[92svh] overflow-hidden bg-foreground text-background">
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=2200&q=86"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/35 via-foreground/60 to-foreground" />
        <div className="relative mx-auto flex min-h-[92svh] max-w-[1540px] flex-col px-4 py-6 sm:px-6 lg:px-8">
          <nav className="flex items-center justify-between">
            <Link className="flex items-center gap-3 font-semibold tracking-tight" to="/">
              <LogoMark className="bg-background text-foreground" />
              <div className="leading-none">
                <span className="block text-sm font-semibold tracking-tight">Binder Notes</span>
                <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-background/65 sm:block">
                  Structured study
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild variant="secondary">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </nav>

          <div className="hero-grid flex-1 items-end py-10">
            <div className="flex flex-col justify-end">
              <Badge className="mb-5 w-fit bg-background text-foreground">For math-heavy students</Badge>
              <h1 className="max-w-5xl text-5xl font-semibold leading-[0.93] tracking-tight sm:text-7xl lg:text-[5.7rem]">
                The study workspace that keeps thinking structured.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-background/78 sm:text-lg">
                Published lessons, private notes, formulas, comments, and highlights all live in one
                calm academic surface that feels ready on day one.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" variant="secondary">
                  <Link to="/auth">
                    Open workspace
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button
                  asChild
                  className="border-background/35 bg-background/10 text-background hover:bg-background/18"
                  size="lg"
                  variant="outline"
                >
                  <Link to="/pricing">View plans</Link>
                </Button>
              </div>
            </div>

            <aside className="hero-aside hidden bg-background/10 text-background lg:block">
              <div className="mb-6 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-background/60">
                  Calm intelligence
                </span>
                <Sparkles className="text-background/70" data-icon="inline-start" />
              </div>
              <div className="space-y-4">
                {workflowPoints.map((point, index) => (
                  <div className="border-b border-background/12 pb-4 last:border-b-0 last:pb-0" key={point}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-background/55">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-background/82">{point}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="app-page py-14">
        <div className="max-w-3xl">
          <span className="page-kicker">Why it works</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            More structure than NotebookLM. Less overhead than Notion.
          </h2>
          <p className="mt-3 page-copy">
            Binder Notes is built for students who want hierarchy, fast capture, and a workspace
            that stays visually composed while they study.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {proofPoints.map((point) => (
            <article className="page-shell p-6" key={point.title}>
              <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-accent text-primary">
                {point.icon}
              </div>
              <h3 className="text-xl font-semibold tracking-tight">{point.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{point.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
