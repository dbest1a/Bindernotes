import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  Columns2,
  FileSearch,
  Highlighter,
  History,
  LayoutDashboard,
  Maximize2,
  NotebookPen,
  PanelTop,
  PenTool,
  Search,
  Settings2,
  Smartphone,
  Sparkles,
  StickyNote,
  WandSparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

type StartStep = {
  id: string;
  title: string;
  detail: string;
  click: string;
};

type FeatureGuide = {
  id: string;
  title: string;
  icon: typeof Highlighter;
  use: string;
  click: string;
  know: string;
};

type ButtonGuide = {
  id: string;
  title: string;
  icon: typeof Settings2;
  simple: string;
};

const startSteps: StartStep[] = [
  {
    id: "dashboard",
    title: "1. Start at your dashboard",
    detail: "Your dashboard is home base. It shows folders, binders, and the lessons inside them.",
    click: "Click Dashboard, then Click a folder, then Click a binder, then Click a lesson.",
  },
  {
    id: "view",
    title: "2. Pick the view that feels easiest",
    detail: "Simple View is best for reading. Study Panels gives a few boxes. Canvas gives the big movable workspace.",
    click: "Click Simple View for the easiest path, or Click Canvas when you want the full workspace.",
  },
  {
    id: "split",
    title: "3. Read on one side and write on the other",
    detail: "Split Study puts the lesson on the left and private notes on the right.",
    click: "Click Split Study when you want two clean halves that meet in the middle.",
  },
  {
    id: "settings",
    title: "4. Search settings instead of hunting",
    detail: "The settings search finds layout, graph, mobile, header, snap, and theme controls.",
    click: "Click Settings. Type a word like snap, graph, header, or mobile.",
  },
  {
    id: "save",
    title: "5. Save your own work",
    detail: "Your account saves your notes, highlights, stickies, and workspace choices.",
    click: "Write a note, then click Save now if you want to save right away.",
  },
];

const buttonGuides: ButtonGuide[] = [
  {
    id: "settings-search",
    title: "Settings search",
    icon: Search,
    simple: "Use this when you cannot find a setting. Search words like safe, fit, graph, mobile, header, or space.",
  },
  {
    id: "maximize",
    title: "Maximize module space",
    icon: Maximize2,
    simple: "Leave it on for more room. Turn it off if you want the bigger old headers, progress cards, and lesson details.",
  },
  {
    id: "focus",
    title: "Focus canvas",
    icon: PanelTop,
    simple: "Use this when you want the workspace to fill the screen and hide extra page clutter.",
  },
  {
    id: "fit-tidy",
    title: "Fit and Tidy",
    icon: WandSparkles,
    simple: "Fit pulls the layout into view. Tidy rebuilds a clean preset layout when things feel messy.",
  },
  {
    id: "edit",
    title: "Edit layout",
    icon: Columns2,
    simple: "Use this to drag and resize modules. Save keeps your changes. Cancel puts the old layout back.",
  },
  {
    id: "phone",
    title: "Phone view",
    icon: Smartphone,
    simple: "On a phone, use the tabs. Do one thing at a time: Lesson, Notes, Graph, Timeline, or Evidence.",
  },
];

const featureGuides: FeatureGuide[] = [
  {
    id: "simple",
    title: "Simple View",
    icon: BookOpenCheck,
    use: "Use this when you just want to read and learn without moving boxes around.",
    click: "Click Simple View. Read the lesson. Use the side notes or drawer when you need them.",
    know: "You should see one main lesson area and simple controls like Workspace, Study surface, Settings, and Focus.",
  },
  {
    id: "notes",
    title: "Private notes",
    icon: NotebookPen,
    use: "Use this when you want to put the lesson into your own words.",
    click: "Click in the notes area. Type your idea. Click Save now, or wait for autosave.",
    know: "The note stays tied to the lesson and comes back when you reopen it.",
  },
  {
    id: "highlights",
    title: "Highlights",
    icon: Highlighter,
    use: "Use these when a sentence matters and you want to find it again.",
    click: "Select lesson text. Pick a highlight color. Keep reading.",
    know: "The colored text should still be there after you refresh.",
  },
  {
    id: "stickies",
    title: "Sticky notes",
    icon: StickyNote,
    use: "Use these for tiny thoughts that should float near the lesson.",
    click: "Click New sticky, or send selected text to a sticky.",
    know: "You can move the sticky and hide the sticky manager when you do not need it.",
  },
  {
    id: "math",
    title: "Math tools",
    icon: Calculator,
    use: "Use these for formulas, graphs, calculators, and saved graph work.",
    click: "Open a math preset like Math Graph Lab, Math Guided Study, or Math Practice Mode.",
    know: "Graph presets should give the graph real room. Formula and calculator tools should not be tiny boxes.",
  },
  {
    id: "history",
    title: "History tools",
    icon: History,
    use: "Use these for timelines, evidence, arguments, and myth checks.",
    click: "Open a history preset like Timeline Focus, Source Evidence, or Argument Builder.",
    know: "The most important history tool should be biggest, and extra tools should stay out of the way.",
  },
];

const safeRules = [
  "If the screen looks crowded, click Fit.",
  "If the layout feels messy, click Tidy.",
  "If you want more room, keep Maximize module space on.",
  "If you want the larger old header view, turn Maximize module space off.",
  "If you are on a phone, use tabs instead of trying to drag windows.",
];

export function TutorialPage() {
  const { profile } = useAuth();

  return (
    <main className="app-page gap-6">
      <section className="page-shell overflow-hidden p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
          <div>
            <Badge variant="outline">Tutorial</Badge>
            <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
              Learn Binder Notes one small step at a time
            </h1>
            <p className="mt-4 max-w-3xl page-copy">
              This guide is written for anyone. If you can click a button, read a sentence,
              and type a note, you can use Binder Notes.
            </p>
            <p className="mt-3 max-w-2xl text-sm font-medium text-primary">
              Scroll down for more tips after the first buttons.
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
          </div>
          <div className="rounded-lg border border-border/70 bg-background/72 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Sparkles className="size-4" />
              Remember this
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Binder Notes has three jobs: read the source, keep your thinking, and open tools
              only when they help.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Start here</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">The first five clicks</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {startSteps.map((step) => (
            <Card key={step.id}>
              <CardHeader>
                <CardTitle className="text-lg">{step.title}</CardTitle>
                <CardDescription>{step.detail}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="rounded-lg border border-border/70 bg-background/75 p-3 text-sm leading-6">
                  {step.click}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">What each button is for</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Use the right button at the right time</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buttonGuides.map((guide) => (
            <Card key={guide.id}>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <guide.icon className="size-4" />
                  {guide.title}
                </div>
                <CardDescription>{guide.simple}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div>
          <span className="page-kicker">Feature guide</span>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">What to use and when</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {featureGuides.map((guide) => (
            <Card className="h-full" key={guide.id}>
              <CardHeader>
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <guide.icon className="size-4" />
                  {guide.title}
                </div>
                <CardDescription>{guide.use}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="rounded-lg border border-border/70 bg-background/75 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    What to click
                  </p>
                  <p className="mt-2 text-sm leading-6">{guide.click}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-background/75 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    How you know it worked
                  </p>
                  <p className="mt-2 text-sm leading-6">{guide.know}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="page-shell p-6 sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(260px,0.38fr)]">
          <div className="flex items-start gap-3">
            <FileSearch className="mt-1 size-5 text-primary" />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">If you feel lost</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Nothing is permanent unless you save a layout or write account data. You can switch
                presets, search settings, click Fit, or go back to Simple View.
              </p>
            </div>
          </div>
          <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
            {safeRules.map((rule) => (
              <li className="rounded-lg border border-border/70 bg-background/72 px-3 py-2" key={rule}>
                {rule}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">
          <Button asChild size="sm" type="button" variant="outline">
            <Link to="/dashboard">
              Open your dashboard
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
