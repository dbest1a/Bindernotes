import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  Highlighter,
  LayoutDashboard,
  NotebookPen,
  PenTool,
  ScrollText,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

type TutorialStep = {
  id: string;
  title: string;
  detail: string;
  ctaLabel?: string;
  ctaTo?: string;
};

type FeatureGuide = {
  id: string;
  title: string;
  icon: typeof Highlighter;
  whenToUse: string;
  workflow: string[];
  successCheck: string;
};

const quickStartSteps: TutorialStep[] = [
  {
    id: "workspace",
    title: "Open Workspace",
    detail: "Start from the dashboard and open a folder, then a binder, then a document.",
    ctaLabel: "Open workspace",
    ctaTo: "/dashboard",
  },
  {
    id: "layout",
    title: "Choose a workspace style",
    detail:
      "Inside a document, use workspace settings to pick Guided, Flexible, or Full Studio based on how much control you want.",
  },
  {
    id: "highlight",
    title: "Highlight source text",
    detail:
      "Select text in the source panel, create a highlight, and keep reading. Highlights should reload after refresh.",
  },
  {
    id: "notes",
    title: "Capture your own notes",
    detail:
      "Move key source quotes into Private Notes, add your own explanation, then save before leaving the lesson.",
  },
  {
    id: "history",
    title: "Use history modules where available",
    detail:
      "In history-enabled binders, combine Timeline, Source Evidence, Argument Builder, and Myth vs History as one study flow.",
  },
  {
    id: "math",
    title: "Use Math Lab for calculations and graphing",
    detail: "Open Math Lab when you want quick graph + calculator work outside a lesson.",
    ctaLabel: "Open Math lab",
    ctaTo: "/math",
  },
];

const featureGuides: FeatureGuide[] = [
  {
    id: "highlights",
    title: "Highlights",
    icon: Highlighter,
    whenToUse: "Use highlights when you need fast capture from source text without breaking reading flow.",
    workflow: [
      "Select text in a lesson.",
      "Choose a highlight color.",
      "Recolor or remove from the same lesson view.",
      "Refresh once to confirm persistence.",
    ],
    successCheck: "Your highlights stay in the same binder and document after reload.",
  },
  {
    id: "private-notes",
    title: "Private Notes",
    icon: NotebookPen,
    whenToUse: "Use private notes to convert source text into your own explanation and study language.",
    workflow: [
      "Open or create a note for the lesson.",
      "Add quote, summary, and your own takeaway.",
      "Save and reopen to confirm the note persisted.",
    ],
    successCheck: "Notes reopen with your edits and remain linked to the lesson.",
  },
  {
    id: "history-suite",
    title: "History Suite",
    icon: Workflow,
    whenToUse:
      "Use Timeline, Evidence, Argument Builder, and Myth vs History together when building historical reasoning.",
    workflow: [
      "Pick a timeline event.",
      "Attach source evidence.",
      "Connect evidence to an argument chain.",
      "Validate claims in Myth vs History.",
    ],
    successCheck: "Event, evidence, and argument links persist after refresh.",
  },
];

export function TutorialPage() {
  const { profile } = useAuth();

  return (
    <main className="app-page gap-6">
      <section className="page-shell p-6 sm:p-8">
        <Badge variant="outline">Tutorial</Badge>
        <h1 className="mt-4 page-heading max-w-3xl text-4xl sm:text-5xl">Learn Binder Notes fast</h1>
        <p className="mt-4 max-w-3xl page-copy">
          This walkthrough is the current production workflow for learners and admins. It covers
          real features only and stays away from legacy debug paths.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild type="button">
            <Link to="/dashboard">
              <LayoutDashboard data-icon="inline-start" />
              Start in workspace
            </Link>
          </Button>
          <Button asChild type="button" variant="outline">
            <Link to="/math">
              <Calculator data-icon="inline-start" />
              Open Math lab
            </Link>
          </Button>
          {profile?.role === "admin" ? (
            <Button asChild type="button" variant="outline">
              <Link to="/admin">
                <PenTool data-icon="inline-start" />
                Open Admin studio
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Quick start</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">10-minute walkthrough</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickStartSteps.map((step, index) => (
            <Card key={step.id}>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <BookOpenCheck className="size-4" />
                  Step {index + 1}
                </div>
                <CardTitle className="text-xl">{step.title}</CardTitle>
                <CardDescription>{step.detail}</CardDescription>
              </CardHeader>
              {step.ctaLabel && step.ctaTo ? (
                <CardContent className="pt-0">
                  <Button asChild size="sm" type="button" variant="outline">
                    <Link to={step.ctaTo}>
                      {step.ctaLabel}
                      <ArrowRight data-icon="inline-start" />
                    </Link>
                  </Button>
                </CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Feature playbook</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">How each core feature works</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {featureGuides.map((guide) => (
            <Card className="h-full" key={guide.id}>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <guide.icon className="size-4" />
                  {guide.title}
                </div>
                <CardDescription>{guide.whenToUse}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Workflow
                  </p>
                  <ol className="mt-2 space-y-2 text-sm text-foreground/90">
                    {guide.workflow.map((step, index) => (
                      <li key={`${guide.id}-${index}`}>
                        {index + 1}. {step}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/75 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Success check
                  </p>
                  <p className="mt-2 text-sm">{guide.successCheck}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-1 size-5 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Review checklist before we deploy</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Verify highlight create/reload/recolor/delete, confirm binder navigation feels clean,
              and confirm the workflow text matches what users actually see in production.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
