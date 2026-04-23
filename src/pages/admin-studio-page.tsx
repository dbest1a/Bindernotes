import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDown, ArrowUp, DatabaseZap, Eye, FilePlus2, Save, Trash2 } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { MathBlocks } from "@/components/math/math-blocks";
import { useAuth } from "@/hooks/use-auth";
import { useAdminMutations, useBinderBundle, useDashboard } from "@/hooks/use-binders";
import { isMissingSeedError } from "@/lib/seed-health";
import { classifyRuntimeError } from "@/lib/workspace-diagnostics";
import { emptyDoc, slugify } from "@/lib/utils";
import type { Binder, BinderLesson, MathBlock, PublishStatus } from "@/types";

export function AdminStudioPage() {
  const { profile } = useAuth();
  const { data: dashboard, error: dashboardError } = useDashboard(profile);
  const [selectedBinderId, setSelectedBinderId] = useState<string | undefined>();
  const selectedBinder =
    dashboard?.binders.find((binder) => binder.id === selectedBinderId) ?? dashboard?.binders[0];
  const { data: bundle } = useBinderBundle(selectedBinder?.id, profile);
  const mutations = useAdminMutations(profile);
  const [seedSummary, setSeedSummary] = useState<string | null>(null);
  const runtimeDiagnostics = dashboardError ? classifyRuntimeError("workspace", dashboardError) : [];

  if (profile?.role !== "admin") {
    return <Navigate replace to="/dashboard" />;
  }

  const createBinder = async () => {
    const binder = await mutations.binder.mutateAsync({
      ownerId: profile.id,
      title: `Binder draft ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
      slug: `binder-draft-${Date.now()}`,
      description: "",
      subject: "Mathematics",
      level: "Foundations",
      status: "draft",
      price_cents: 0,
      cover_url: null,
      pinned: false,
    });
    setSelectedBinderId(binder.id);
  };

  const seedSystemContent = async () => {
    const result = await mutations.seedSystemSuites.mutateAsync();
    setSeedSummary(
      `Seeded ${result.suiteCount} suites, ${result.binderCount} binders, ${result.lessonCount} lessons, and ${result.presetCount} preset layouts.`,
    );
  };

  return (
    <main className="app-page max-w-[1540px]">
      <section className="hero-grid">
        <div className="page-shell p-6 sm:p-8">
          <Badge variant="outline">Admin studio</Badge>
          <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
            Publish binders with the same clarity students feel when they open them.
          </h1>
          <p className="mt-4 max-w-2xl page-copy">
            Shape the public lesson layer, order the sequence cleanly, and preview the learner
            workspace before anything goes live.
          </p>
        </div>
        <aside className="hero-aside">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Studio rhythm
          </p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>Create one sharp binder promise.</p>
            <p>Keep lessons ordered around understanding, not storage.</p>
            <p>Preview the reader before you publish anything public.</p>
          </div>
          <Button
            className="mt-6 w-full"
            disabled={mutations.seedSystemSuites.isPending}
            onClick={seedSystemContent}
            type="button"
            variant="outline"
          >
            <DatabaseZap data-icon="inline-start" />
            {mutations.seedSystemSuites.isPending ? "Seeding system suites..." : "Seed system suites"}
          </Button>
          <Button className="mt-6 w-full" onClick={createBinder} type="button">
            <FilePlus2 data-icon="inline-start" />
            New binder
          </Button>
          {seedSummary ? (
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{seedSummary}</p>
          ) : null}
          {mutations.seedSystemSuites.error instanceof Error ? (
            <p className="mt-3 text-xs leading-5 text-destructive">
              {mutations.seedSystemSuites.error.message}
            </p>
          ) : null}
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        {dashboard?.diagnostics?.length || runtimeDiagnostics.length ? (
          <div className="xl:col-span-2">
            <WorkspaceDiagnosticsPanel diagnostics={[...(dashboard?.diagnostics ?? []), ...runtimeDiagnostics]} />
          </div>
        ) : null}
        {isMissingSeedError(dashboardError) ? (
          <div className="xl:col-span-2">
            <Card className="border-border/75 bg-card/88 shadow-sm">
              <CardHeader>
                <CardTitle>System suite seed is missing</CardTitle>
                <CardDescription>{dashboardError.message}</CardDescription>
              </CardHeader>
            </Card>
          </div>
        ) : null}
        <aside className="page-shell h-fit p-3 lg:sticky lg:top-24">
          <div className="p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Binders
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">Publishing queue</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose a binder to refine the public lesson set and learner preview.
            </p>
          </div>
          <nav className="mt-3 flex flex-col gap-2">
            {(dashboard?.binders ?? []).map((binder) => (
              <button
                className={`rounded-lg border px-3 py-3 text-left text-sm transition hover:bg-secondary ${
                  binder.id === selectedBinder?.id
                    ? "border-primary bg-accent/55 text-foreground shadow-sm"
                    : "border-border/70 bg-background/65 text-muted-foreground"
                }`}
                key={binder.id}
                onClick={() => setSelectedBinderId(binder.id)}
                type="button"
              >
                <span className="font-medium">{binder.title}</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.14em]">{binder.status}</span>
              </button>
            ))}
          </nav>
        </aside>

        {selectedBinder ? (
          <StudioEditor binder={selectedBinder} bundleLessons={bundle?.lessons ?? []} />
        ) : (
          <EmptyState
            action={<Button onClick={createBinder}>Create binder</Button>}
            description="Start with one polished binder. Lessons, math blocks, and preview mode come next."
            title="No binders yet"
          />
        )}
      </section>
    </main>
  );
}

function StudioEditor({
  binder,
  bundleLessons,
}: {
  binder: Binder;
  bundleLessons: BinderLesson[];
}) {
  const { profile } = useAuth();
  const mutations = useAdminMutations(profile);
  const [title, setTitle] = useState(binder.title);
  const [description, setDescription] = useState(binder.description);
  const [subject, setSubject] = useState(binder.subject);
  const [level, setLevel] = useState(binder.level);
  const [status, setStatus] = useState<PublishStatus>(binder.status);
  const [price, setPrice] = useState(String(binder.price_cents / 100));
  const lessons = useMemo(
    () => [...bundleLessons].sort((a, b) => a.order_index - b.order_index),
    [bundleLessons],
  );
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>();
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];

  useEffect(() => {
    setTitle(binder.title);
    setDescription(binder.description);
    setSubject(binder.subject);
    setLevel(binder.level);
    setStatus(binder.status);
    setPrice(String(binder.price_cents / 100));
  }, [binder]);

  const saveBinder = () => {
    mutations.binder.mutate({
      id: binder.id,
      ownerId: binder.owner_id,
      title,
      slug: slugify(title),
      description,
      subject,
      level,
      status,
      price_cents: Math.max(0, Math.round(Number(price || 0) * 100)),
      cover_url: binder.cover_url,
      pinned: binder.pinned,
    });
  };

  const createLesson = async () => {
    const lesson = await mutations.lesson.mutateAsync({
      binder_id: binder.id,
      title: `Lesson draft ${lessons.length + 1}`,
      order_index: lessons.length + 1,
      content: emptyDoc("Write a focused lesson. Students will study beside this."),
      math_blocks: [],
      is_preview: lessons.length === 0,
    });
    setSelectedLessonId(lesson.id);
  };

  const updateLesson = (patch: {
    title?: string;
    content?: JSONContent;
    math_blocks?: MathBlock[];
    order_index?: number;
    is_preview?: boolean;
  }) => {
    if (!selectedLesson) {
      return;
    }

    mutations.lesson.mutate({
      id: selectedLesson.id,
      binder_id: selectedLesson.binder_id,
      title: selectedLesson.title,
      order_index: selectedLesson.order_index,
      content: selectedLesson.content,
      math_blocks: selectedLesson.math_blocks,
      is_preview: selectedLesson.is_preview,
      ...patch,
    });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Binder settings</CardTitle>
            <CardDescription>Keep the public promise precise and easy to scan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Title
              <Input onChange={(event) => setTitle(event.target.value)} value={title} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Description
              <Textarea onChange={(event) => setDescription(event.target.value)} value={description} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Subject
                <Input onChange={(event) => setSubject(event.target.value)} value={subject} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Level
                <Input onChange={(event) => setLevel(event.target.value)} value={level} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Price
                <Input onChange={(event) => setPrice(event.target.value)} value={price} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Status
                <select
                  className="h-11 rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition focus:border-ring focus:ring-4 focus:ring-ring/10"
                  onChange={(event) => setStatus(event.target.value as PublishStatus)}
                  value={status}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>
            <Button onClick={saveBinder} type="button">
              <Save data-icon="inline-start" />
              Save binder
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lessons</CardTitle>
            <CardDescription>Order the path learners will follow.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lessons.map((lesson) => (
              <button
                className={`rounded-lg border border-border/75 px-3 py-3 text-left text-sm transition hover:bg-secondary ${
                  lesson.id === selectedLesson?.id ? "bg-secondary shadow-sm" : "bg-background"
                }`}
                key={lesson.id}
                onClick={() => setSelectedLessonId(lesson.id)}
                type="button"
              >
                <span className="font-medium">{lesson.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Order {lesson.order_index}</span>
              </button>
            ))}
            <Button onClick={createLesson} type="button" variant="outline">
              <FilePlus2 data-icon="inline-start" />
              Add lesson
            </Button>
          </CardContent>
        </Card>
      </div>

      {selectedLesson ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <CardTitle>Lesson editor</CardTitle>
                <CardDescription>Write clear source material. Learner notes stay private.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild type="button" variant="outline">
                  <Link to={`/binders/${binder.id}/documents/${selectedLesson.id}`}>
                    <Eye data-icon="inline-start" />
                    Preview
                  </Link>
                </Button>
                <Button
                  onClick={() => updateLesson({ order_index: Math.max(1, selectedLesson.order_index - 1) })}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ArrowUp data-icon="inline-start" />
                </Button>
                <Button
                  onClick={() => updateLesson({ order_index: selectedLesson.order_index + 1 })}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown data-icon="inline-start" />
                </Button>
                <Button
                  onClick={() => mutations.deleteLesson.mutate(selectedLesson.id)}
                  size="icon"
                  type="button"
                  variant="destructive"
                >
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              className="h-12 text-lg font-semibold"
              defaultValue={selectedLesson.title}
              onBlur={(event) => updateLesson({ title: event.target.value })}
            />
            <RichTextEditor
              key={selectedLesson.id}
              onChange={(content) => updateLesson({ content })}
              placeholder="Explain the idea like a great professor would..."
              value={selectedLesson.content}
            />
            <MathBlocks
              blocks={selectedLesson.math_blocks}
              editable
              onChange={(blocks) => updateLesson({ math_blocks: blocks })}
            />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          action={<Button onClick={createLesson}>Add lesson</Button>}
          description="Lessons are the published source layer learners read beside their own notes."
          title="No lesson selected"
        />
      )}
    </section>
  );
}
