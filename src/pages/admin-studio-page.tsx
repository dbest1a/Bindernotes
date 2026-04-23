import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  FilePlus2,
  GripVertical,
  MoreHorizontal,
  PanelBottom,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SeedHealthPanel } from "@/components/ui/seed-health-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { MathBlocks } from "@/components/math/math-blocks";
import { useAuth } from "@/hooks/use-auth";
import { useAdminMutations, useBinderBundle, useDashboard } from "@/hooks/use-binders";
import { classifyRuntimeError } from "@/lib/workspace-diagnostics";
import {
  deriveLessonTitle,
  extractPlainText,
  filterActionableDiagnostics,
  getDisplayTitle,
  isPlaceholderTitle,
  lessonHasMeaningfulContent,
} from "@/lib/workspace-records";
import { emptyDoc, slugify } from "@/lib/utils";
import type {
  Binder,
  BinderLesson,
  MathBlock,
  Profile,
  PublishStatus,
  SeedHealth,
  WorkspaceDiagnostic,
} from "@/types";

type StudioTab = "overview" | "lessons" | "content" | "preview" | "publish";
type BinderFilter = "all" | PublishStatus;

const TAB_LABELS: Array<{ id: StudioTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "lessons", label: "Lessons" },
  { id: "content", label: "Content" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

export function AdminStudioPage() {
  const { profile } = useAuth();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [selectedBinderId, setSelectedBinderId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BinderFilter>("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [recentOnly, setRecentOnly] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const { data: dashboard, isLoading, error } = useDashboard(profile, {
    includeSystemStatus: false,
  });
  const diagnosticsQuery = useDashboard(profile, {
    includeSystemStatus: true,
    enabled: diagnosticsOpen,
  });
  const mutations = useAdminMutations(profile);

  if (profile?.role !== "admin") {
    return <Navigate replace to="/dashboard" />;
  }

  const binders = dashboard?.binders ?? [];
  const subjects = useMemo(
    () =>
      ["all", ...new Set(binders.map((binder) => binder.subject).filter((subject) => subject.trim().length > 0))],
    [binders],
  );

  const filteredBinders = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const recencyCutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
    return binders
      .filter((binder) => {
        if (statusFilter !== "all" && binder.status !== statusFilter) {
          return false;
        }
        if (subjectFilter !== "all" && binder.subject !== subjectFilter) {
          return false;
        }
        if (recentOnly && Date.parse(binder.updated_at) < recencyCutoff) {
          return false;
        }
        if (!normalized) {
          return true;
        }
        return `${binder.title} ${binder.description} ${binder.subject}`
          .toLowerCase()
          .includes(normalized);
      })
      .sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
  }, [binders, recentOnly, search, statusFilter, subjectFilter]);

  useEffect(() => {
    if (!filteredBinders.length) {
      setSelectedBinderId(undefined);
      return;
    }
    if (!selectedBinderId || !filteredBinders.some((binder) => binder.id === selectedBinderId)) {
      setSelectedBinderId(filteredBinders[0].id);
    }
  }, [filteredBinders, selectedBinderId]);

  const selectedBinder =
    filteredBinders.find((binder) => binder.id === selectedBinderId) ??
    binders.find((binder) => binder.id === selectedBinderId) ??
    filteredBinders[0] ??
    binders[0] ??
    null;
  const { data: bundle } = useBinderBundle(selectedBinder?.id, profile);

  const saveStatus = mutations.binder.isPending || mutations.lesson.isPending || mutations.deleteLesson.isPending
    ? "Saving..."
    : lastSavedAt
      ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "All changes saved";

  const createBinder = async () => {
    if (!profile) {
      return;
    }
    const title = `Binder ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    const binder = await mutations.binder.mutateAsync({
      ownerId: profile.id,
      title,
      slug: slugify(title),
      description: "",
      subject: "General",
      level: "Foundations",
      status: "draft",
      price_cents: 0,
      cover_url: null,
      pinned: false,
    });
    setSelectedBinderId(binder.id);
    setLastSavedAt(new Date().toISOString());
  };

  const diagnostics = filterActionableDiagnostics(diagnosticsQuery.data?.diagnostics ?? []);
  const runtimeDiagnostics = diagnosticsQuery.error
    ? classifyRuntimeError("workspace", diagnosticsQuery.error)
    : [];
  const seedHealth = diagnosticsQuery.data?.seedHealth ?? [];
  const hasSystemWarnings = diagnostics.length > 0 || runtimeDiagnostics.length > 0;

  if (isLoading) {
    return (
      <main className="app-page max-w-[1540px]">
        <Skeleton className="h-20" />
        <Skeleton className="h-[720px]" />
      </main>
    );
  }

  if (error || !dashboard) {
    return (
      <main className="app-page max-w-[960px]">
        <EmptyState
          description={error instanceof Error ? error.message : "The studio is unavailable right now."}
          title="Admin studio unavailable"
        />
      </main>
    );
  }

  return (
    <main className="app-page max-w-[1540px] gap-5">
      <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="page-shell h-fit p-3 lg:sticky lg:top-24">
          <div className="p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Admin Studio
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Publishing queue</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose a binder, shape lesson flow, then publish with confidence.
            </p>
          </div>

          <Button className="mt-3 w-full" onClick={createBinder} type="button">
            <FilePlus2 data-icon="inline-start" />
            New binder
          </Button>

          <div className="mt-4 space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search binders"
                value={search}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {(["all", "draft", "published", "archived"] as BinderFilter[]).map((filter) => (
                <Button
                  className="h-8 px-3 text-xs"
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  type="button"
                  variant={statusFilter === filter ? "secondary" : "outline"}
                >
                  {filter}
                </Button>
              ))}
            </div>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/88 px-3 py-2 text-sm">
              Subject
              <select
                className="min-w-[130px] rounded-md border border-input/80 bg-background px-2.5 py-1.5 text-sm"
                onChange={(event) => setSubjectFilter(event.target.value)}
                value={subjectFilter}
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </label>

            <Button
              className="w-full"
              onClick={() => setRecentOnly((value) => !value)}
              type="button"
              variant={recentOnly ? "secondary" : "outline"}
            >
              Recently edited
            </Button>
          </div>

          <nav className="mt-4 flex max-h-[56vh] flex-col gap-2 overflow-auto pr-1">
            {filteredBinders.map((binder) => (
              <button
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  binder.id === selectedBinder?.id
                    ? "border-primary bg-accent/55 text-foreground shadow-sm"
                    : "border-border/70 bg-background/65 text-muted-foreground hover:bg-secondary"
                }`}
                key={binder.id}
                onClick={() => setSelectedBinderId(binder.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{getDisplayTitle(binder.title, "Recovered Binder")}</span>
                  <Badge variant={binder.status === "published" ? "secondary" : "outline"}>{binder.status}</Badge>
                </div>
                <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {binder.subject}
                </span>
              </button>
            ))}
            {filteredBinders.length === 0 ? (
              <EmptyState
                description="Try another filter or create a binder to start your publishing queue."
                title="No binders match"
              />
            ) : null}
          </nav>
        </aside>

        {selectedBinder ? (
          <StudioWorkspace
            binder={selectedBinder}
            diagnostics={diagnostics}
            diagnosticsOpen={diagnosticsOpen}
            diagnosticsRuntime={runtimeDiagnostics}
            diagnosticsLoading={diagnosticsQuery.isFetching}
            hasSystemWarnings={hasSystemWarnings}
            lessons={bundle?.lessons ?? []}
            mutations={mutations}
            onSaved={(timestamp) => setLastSavedAt(timestamp)}
            seedHealth={seedHealth}
            setDiagnosticsOpen={setDiagnosticsOpen}
            setSelectedBinderId={setSelectedBinderId}
            statusLabel={saveStatus}
          />
        ) : (
          <EmptyState
            action={<Button onClick={createBinder}>Create binder</Button>}
            description="Create your first binder to start sequencing lessons and publishing content."
            title="No binders yet"
          />
        )}
      </section>
    </main>
  );
}

function StudioWorkspace({
  binder,
  lessons,
  mutations,
  statusLabel,
  diagnosticsOpen,
  setDiagnosticsOpen,
  diagnostics,
  diagnosticsRuntime,
  diagnosticsLoading,
  seedHealth,
  hasSystemWarnings,
  onSaved,
  setSelectedBinderId,
}: {
  binder: Binder;
  lessons: BinderLesson[];
  mutations: ReturnType<typeof useAdminMutations>;
  statusLabel: string;
  diagnosticsOpen: boolean;
  setDiagnosticsOpen: (next: boolean) => void;
  diagnostics: WorkspaceDiagnostic[];
  diagnosticsRuntime: WorkspaceDiagnostic[];
  diagnosticsLoading: boolean;
  seedHealth: SeedHealth[];
  hasSystemWarnings: boolean;
  onSaved: (timestamp: string) => void;
  setSelectedBinderId: (binderId: string | undefined) => void;
}) {
  const [activeTab, setActiveTab] = useState<StudioTab>("overview");
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>();
  const [previewReviewed, setPreviewReviewed] = useState(false);
  const orderedLessons = useMemo(
    () => [...lessons].sort((left, right) => left.order_index - right.order_index),
    [lessons],
  );
  const selectedLesson =
    orderedLessons.find((lesson) => lesson.id === selectedLessonId) ?? orderedLessons[0] ?? null;
  const previewLesson = orderedLessons.find((lesson) => lesson.is_preview) ?? orderedLessons[0] ?? null;

  const [title, setTitle] = useState(binder.title);
  const [description, setDescription] = useState(binder.description);
  const [subject, setSubject] = useState(binder.subject);
  const [level, setLevel] = useState(binder.level);
  const [coverUrl, setCoverUrl] = useState(binder.cover_url ?? "");
  const [status, setStatus] = useState<PublishStatus>(binder.status);
  const [price, setPrice] = useState(String((binder.price_cents ?? 0) / 100));
  const [lessonTitle, setLessonTitle] = useState(selectedLesson?.title ?? "");
  const [lessonContent, setLessonContent] = useState<JSONContent>(selectedLesson?.content ?? emptyDoc(""));
  const [lessonMathBlocks, setLessonMathBlocks] = useState<MathBlock[]>(selectedLesson?.math_blocks ?? []);

  useEffect(() => {
    setTitle(binder.title);
    setDescription(binder.description);
    setSubject(binder.subject);
    setLevel(binder.level);
    setCoverUrl(binder.cover_url ?? "");
    setStatus(binder.status);
    setPrice(String((binder.price_cents ?? 0) / 100));
  }, [binder]);

  useEffect(() => {
    if (!orderedLessons.length) {
      setSelectedLessonId(undefined);
      return;
    }
    if (!selectedLessonId || !orderedLessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(orderedLessons[0].id);
    }
  }, [orderedLessons, selectedLessonId]);

  useEffect(() => {
    if (!selectedLesson) {
      setLessonTitle("");
      setLessonContent(emptyDoc(""));
      setLessonMathBlocks([]);
      return;
    }
    setLessonTitle(selectedLesson.title);
    setLessonContent(selectedLesson.content);
    setLessonMathBlocks(selectedLesson.math_blocks);
  }, [selectedLesson?.id, selectedLesson]);

  const overviewSummary = useMemo(() => {
    const lessonCount = orderedLessons.length;
    const words = orderedLessons.reduce((total, lesson) => {
      const wordCount = extractPlainText(lesson.content)
        .split(/\s+/)
        .filter(Boolean).length;
      return total + wordCount;
    }, 0);
    const avgMinutes = lessonCount === 0 ? 0 : Math.max(1, Math.round(words / 220));
    return { lessonCount, words, avgMinutes };
  }, [orderedLessons]);

  const readiness = useMemo(() => {
    const ordered = orderedLessons.every((lesson, index) => lesson.order_index === index + 1);
    const hasTitle = title.trim().length > 0 && !isPlaceholderTitle(title);
    const hasLessons = orderedLessons.length > 0;
    const hasContent = orderedLessons.every((lesson) => lessonHasMeaningfulContent(lesson));
    return [
      { id: "title", label: "Binder title is complete", done: hasTitle },
      { id: "lessons", label: "Lessons are ordered", done: ordered && hasLessons },
      { id: "content", label: "No empty lesson blocks", done: hasContent && hasLessons },
      { id: "preview", label: "Preview reviewed", done: previewReviewed },
    ];
  }, [orderedLessons, previewReviewed, title]);

  const saveBinder = async (nextStatus?: PublishStatus) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    const saved = await mutations.binder.mutateAsync({
      id: binder.id,
      ownerId: binder.owner_id,
      title: trimmedTitle,
      slug: slugify(trimmedTitle),
      description: description.trim(),
      subject: subject.trim() || "General",
      level: level.trim() || "Foundations",
      status: nextStatus ?? status,
      price_cents: Math.max(0, Math.round(Number(price || 0) * 100)),
      cover_url: coverUrl.trim() || null,
      pinned: binder.pinned,
    });
    setStatus(saved.status);
    onSaved(new Date().toISOString());
  };

  const createLesson = async () => {
    const lesson = await mutations.lesson.mutateAsync({
      binder_id: binder.id,
      title: `Lesson ${orderedLessons.length + 1}`,
      order_index: orderedLessons.length + 1,
      content: emptyDoc("Write the lesson content here."),
      math_blocks: [],
      is_preview: orderedLessons.length === 0,
    });
    setSelectedLessonId(lesson.id);
    setActiveTab("content");
    onSaved(new Date().toISOString());
  };

  const duplicateLesson = async () => {
    if (!selectedLesson) {
      return;
    }
    const lesson = await mutations.lesson.mutateAsync({
      binder_id: binder.id,
      title: `${selectedLesson.title} copy`,
      order_index: orderedLessons.length + 1,
      content: selectedLesson.content,
      math_blocks: selectedLesson.math_blocks,
      is_preview: false,
    });
    setSelectedLessonId(lesson.id);
    setActiveTab("content");
    onSaved(new Date().toISOString());
  };

  const archiveLesson = async () => {
    if (!selectedLesson) {
      return;
    }
    const archivedTitle = selectedLesson.title.startsWith("Archived: ")
      ? selectedLesson.title
      : `Archived: ${selectedLesson.title}`;
    await mutations.lesson.mutateAsync({
      id: selectedLesson.id,
      binder_id: selectedLesson.binder_id,
      title: archivedTitle,
      order_index: selectedLesson.order_index,
      content: selectedLesson.content,
      math_blocks: selectedLesson.math_blocks,
      is_preview: false,
    });
    onSaved(new Date().toISOString());
  };

  const moveLesson = async (direction: -1 | 1) => {
    if (!selectedLesson) {
      return;
    }
    const currentIndex = orderedLessons.findIndex((lesson) => lesson.id === selectedLesson.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedLessons.length) {
      return;
    }

    const current = orderedLessons[currentIndex];
    const target = orderedLessons[targetIndex];
    await Promise.all([
      mutations.lesson.mutateAsync({
        id: current.id,
        binder_id: current.binder_id,
        title: current.title,
        order_index: target.order_index,
        content: current.content,
        math_blocks: current.math_blocks,
        is_preview: current.is_preview,
      }),
      mutations.lesson.mutateAsync({
        id: target.id,
        binder_id: target.binder_id,
        title: target.title,
        order_index: current.order_index,
        content: target.content,
        math_blocks: target.math_blocks,
        is_preview: target.is_preview,
      }),
    ]);
    setSelectedLessonId(current.id);
    onSaved(new Date().toISOString());
  };

  const saveLessonContent = async () => {
    if (!selectedLesson) {
      return;
    }
    const nextTitle = lessonTitle.trim() || deriveLessonTitle({
      ...selectedLesson,
      title: lessonTitle,
      content: lessonContent,
      math_blocks: lessonMathBlocks,
    });
    await mutations.lesson.mutateAsync({
      id: selectedLesson.id,
      binder_id: selectedLesson.binder_id,
      title: nextTitle,
      order_index: selectedLesson.order_index,
      content: lessonContent,
      math_blocks: lessonMathBlocks,
      is_preview: selectedLesson.is_preview,
    });
    onSaved(new Date().toISOString());
  };

  const setLessonPreviewIncluded = async (include: boolean) => {
    if (!selectedLesson) {
      return;
    }
    await mutations.lesson.mutateAsync({
      id: selectedLesson.id,
      binder_id: selectedLesson.binder_id,
      title: selectedLesson.title,
      order_index: selectedLesson.order_index,
      content: selectedLesson.content,
      math_blocks: selectedLesson.math_blocks,
      is_preview: include,
    });
    onSaved(new Date().toISOString());
  };

  const removeSelectedLesson = async () => {
    if (!selectedLesson) {
      return;
    }
    await mutations.deleteLesson.mutateAsync(selectedLesson.id);
    setSelectedLessonId(undefined);
    onSaved(new Date().toISOString());
  };

  return (
    <section className="grid gap-4">
      <header className="page-shell p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Admin Studio
            </p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {getDisplayTitle(binder.title, "Recovered Binder")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{statusLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setActiveTab("preview")} type="button" variant="outline">
              <Eye data-icon="inline-start" />
              Preview
            </Button>
            <Button onClick={() => setActiveTab("publish")} type="button">
              <Upload data-icon="inline-start" />
              Publish
            </Button>
            <Button
              aria-label="Open studio menu"
              onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
              size="icon"
              type="button"
              variant="outline"
            >
              <MoreHorizontal data-icon="inline-start" />
            </Button>
          </div>
        </div>

        {hasSystemWarnings && !diagnosticsOpen ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/55 bg-amber-100/70 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
            <p>Some system content is unavailable. Publishing may be limited.</p>
            <Button onClick={() => setDiagnosticsOpen(true)} size="sm" type="button" variant="outline">
              View diagnostics
            </Button>
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="page-shell p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap gap-2 border-b border-border/70 pb-4">
            {TAB_LABELS.map((tab) => (
              <Button
                aria-label={`Open ${tab.label} tab`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                variant={activeTab === tab.id ? "secondary" : "ghost"}
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {activeTab === "overview" ? (
            <section className="grid gap-4">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Title
                <Input aria-label="Binder title" onChange={(event) => setTitle(event.target.value)} value={title} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Description
                <Textarea
                  aria-label="Binder description"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Subject
                  <Input aria-label="Binder subject" onChange={(event) => setSubject(event.target.value)} value={subject} />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Level
                  <Input aria-label="Binder level" onChange={(event) => setLevel(event.target.value)} value={level} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Cover image URL
                  <Input
                    aria-label="Binder cover image URL"
                    onChange={(event) => setCoverUrl(event.target.value)}
                    placeholder="https://..."
                    value={coverUrl}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Access tier
                  <Input
                    aria-label="Binder access tier"
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="0.00"
                    value={price}
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Visibility
                  <select
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                    onChange={(event) => setStatus(event.target.value as PublishStatus)}
                    value={status}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Binder slug
                  <Input disabled value={slugify(title) || "binder-slug"} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveBinder()} type="button">
                  <Save data-icon="inline-start" />
                  Save binder
                </Button>
                <Button
                  onClick={() => {
                    setSelectedBinderId(undefined);
                  }}
                  type="button"
                  variant="outline"
                >
                  Change binder
                </Button>
              </div>
            </section>
          ) : null}

          {activeTab === "lessons" ? (
            <section className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void createLesson()} type="button">
                  <FilePlus2 data-icon="inline-start" />
                  Add lesson
                </Button>
                <Button disabled={!selectedLesson} onClick={() => void duplicateLesson()} type="button" variant="outline">
                  Duplicate lesson
                </Button>
                <Button disabled={!selectedLesson} onClick={() => void archiveLesson()} type="button" variant="outline">
                  Archive lesson
                </Button>
              </div>

              <div className="grid gap-2">
                {orderedLessons.map((lesson) => (
                  <div
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
                      lesson.id === selectedLesson?.id
                        ? "border-primary bg-accent/50"
                        : "border-border/70 bg-background/70"
                    }`}
                    key={lesson.id}
                  >
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedLessonId(lesson.id)}
                      type="button"
                    >
                      <GripVertical className="size-4" />
                    </button>
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setSelectedLessonId(lesson.id);
                        setActiveTab("content");
                      }}
                      type="button"
                    >
                      <p className="truncate font-medium">{deriveLessonTitle(lesson)}</p>
                      <p className="text-xs text-muted-foreground">
                        Order {lesson.order_index} · {estimateReadingMinutes(lesson)} min read
                      </p>
                    </button>
                    <Badge variant={lesson.is_preview ? "secondary" : "outline"}>
                      {lesson.is_preview ? "Preview on" : "Preview off"}
                    </Badge>
                  </div>
                ))}
                {orderedLessons.length === 0 ? (
                  <EmptyState
                    action={<Button onClick={() => void createLesson()}>Add lesson</Button>}
                    description="Start sequencing lessons for this binder."
                    title="No lessons yet"
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {activeTab === "content" ? (
            <section className="grid gap-4">
              {selectedLesson ? (
                <>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_190px]">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Lesson title
                  <Input
                    aria-label="Lesson title"
                    onChange={(event) => setLessonTitle(event.target.value)}
                    value={lessonTitle}
                  />
                </label>
                    <Button
                      onClick={() => void setLessonPreviewIncluded(!selectedLesson.is_preview)}
                      type="button"
                      variant="outline"
                    >
                      {selectedLesson.is_preview ? "Remove from preview" : "Include in preview"}
                    </Button>
                    <Button asChild type="button" variant="outline">
                      <Link to={`/binders/${binder.id}/documents/${selectedLesson.id}`}>
                        <Eye data-icon="inline-start" />
                        Reader preview
                      </Link>
                    </Button>
                  </div>

                  <RichTextEditor onChange={setLessonContent} value={lessonContent} />
                  <MathBlocks blocks={lessonMathBlocks} editable onChange={setLessonMathBlocks} />

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void saveLessonContent()} type="button">
                      <Save data-icon="inline-start" />
                      Save lesson content
                    </Button>
                    <Button onClick={() => void moveLesson(-1)} type="button" variant="outline">
                      <ArrowUp data-icon="inline-start" />
                      Move up
                    </Button>
                    <Button onClick={() => void moveLesson(1)} type="button" variant="outline">
                      <ArrowDown data-icon="inline-start" />
                      Move down
                    </Button>
                    <Button onClick={() => void removeSelectedLesson()} type="button" variant="destructive">
                      <Trash2 data-icon="inline-start" />
                      Delete lesson
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState
                  action={<Button onClick={() => void createLesson()}>Add lesson</Button>}
                  description="Choose a lesson from the Lessons tab to start writing."
                  title="No lesson selected"
                />
              )}
            </section>
          ) : null}

          {activeTab === "preview" ? (
            <section className="grid gap-4">
              <article className="rounded-lg border border-border/70 bg-card/88 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Binder card preview
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">
                  {getDisplayTitle(title, "Recovered Binder")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {description || "Add a short binder description to explain the learner promise."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{subject || "General"}</Badge>
                  <Badge variant="outline">{level || "Foundations"}</Badge>
                  <Badge variant={status === "published" ? "secondary" : "outline"}>{status}</Badge>
                </div>
              </article>

              <article className="rounded-lg border border-border/70 bg-card/88 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Lesson navigation preview
                </p>
                <div className="mt-3 grid gap-2">
                  {orderedLessons.map((lesson, index) => (
                    <div
                      className="flex items-center justify-between rounded-md border border-border/65 bg-background/80 px-3 py-2 text-sm"
                      key={lesson.id}
                    >
                      <span className="truncate">
                        {index + 1}. {deriveLessonTitle(lesson)}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </article>

              {previewLesson ? (
                <Button asChild className="w-fit" type="button">
                  <Link to={`/binders/${binder.id}/documents/${previewLesson.id}`}>
                    <Eye data-icon="inline-start" />
                    Open learner preview
                  </Link>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add at least one lesson to open the learner preview.
                </p>
              )}
            </section>
          ) : null}

          {activeTab === "publish" ? (
            <section className="grid gap-4">
              <article className="rounded-lg border border-border/70 bg-card/88 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Publish checklist
                </p>
                <div className="mt-3 grid gap-2">
                  {readiness.map((item) => (
                    <div
                      className="flex items-center gap-2 rounded-md border border-border/65 bg-background/80 px-3 py-2 text-sm"
                      key={item.id}
                    >
                      {item.done ? (
                        <CheckCircle2 className="size-4 text-primary" />
                      ) : (
                        <Circle className="size-4 text-muted-foreground" />
                      )}
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </article>

              <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/85 px-3 py-2 text-sm">
                <input
                  checked={previewReviewed}
                  className="size-4"
                  onChange={(event) => setPreviewReviewed(event.target.checked)}
                  type="checkbox"
                />
                I reviewed the learner preview before publishing.
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!readiness.every((item) => item.done)}
                  onClick={() => void saveBinder("published")}
                  type="button"
                >
                  <Upload data-icon="inline-start" />
                  Publish binder
                </Button>
                <Button onClick={() => void saveBinder("draft")} type="button" variant="outline">
                  Move to draft
                </Button>
                <Button onClick={() => void saveBinder("archived")} type="button" variant="outline">
                  Archive binder
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="page-shell h-fit p-4">
          {activeTab === "overview" ? (
            <ContextFacts
              entries={[
                { label: "Lessons", value: String(overviewSummary.lessonCount) },
                { label: "Approx words", value: overviewSummary.words.toLocaleString() },
                { label: "Read time", value: `${overviewSummary.avgMinutes} min` },
                { label: "Status", value: status },
              ]}
              title="Binder metadata"
            />
          ) : null}

          {activeTab === "lessons" ? (
            <ContextFacts
              entries={[
                { label: "Selected lesson", value: selectedLesson ? deriveLessonTitle(selectedLesson) : "None" },
                { label: "Order", value: selectedLesson ? String(selectedLesson.order_index) : "-" },
                { label: "Preview", value: selectedLesson?.is_preview ? "Included" : "Not included" },
                { label: "Est. read", value: selectedLesson ? `${estimateReadingMinutes(selectedLesson)} min` : "-" },
              ]}
              title="Lesson metadata"
            />
          ) : null}

          {activeTab === "content" ? (
            <ContextFacts
              entries={[
                {
                  label: "Word count",
                  value: extractPlainText(lessonContent).split(/\s+/).filter(Boolean).length.toLocaleString(),
                },
                { label: "Math blocks", value: String(lessonMathBlocks.length) },
                { label: "Lesson title", value: lessonTitle.trim() || "Untitled lesson draft" },
              ]}
              title="Writing context"
            />
          ) : null}

          {activeTab === "preview" ? (
            <ContextFacts
              entries={[
                { label: "Public title", value: getDisplayTitle(title, "Recovered Binder") },
                { label: "Preview lesson", value: previewLesson ? deriveLessonTitle(previewLesson) : "None" },
                { label: "Lessons", value: String(orderedLessons.length) },
              ]}
              title="Preview info"
            />
          ) : null}

          {activeTab === "publish" ? (
            <ContextFacts
              entries={[
                { label: "Last status", value: status },
                {
                  label: "Checklist complete",
                  value: readiness.every((item) => item.done) ? "Yes" : "Not yet",
                },
                { label: "Last updated", value: new Date(binder.updated_at).toLocaleString() },
              ]}
              title="Publishing info"
            />
          ) : null}
        </aside>
      </div>

      <section className="page-shell overflow-hidden">
        <button
          aria-label="Toggle system diagnostics drawer"
          className="flex w-full items-center justify-between gap-3 border-b border-border/70 px-4 py-3 text-left"
          onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
          type="button"
        >
          <div className="flex items-center gap-2">
            <PanelBottom className="size-4 text-primary" />
            <span className="font-medium">System diagnostics</span>
            {diagnostics.length ? <Badge variant="outline">{diagnostics.length}</Badge> : null}
          </div>
          <ChevronRight
            className={`size-4 text-muted-foreground transition ${diagnosticsOpen ? "rotate-90" : ""}`}
          />
        </button>

        {diagnosticsOpen ? (
          <div className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={mutations.seedSystemSuites.isPending}
                onClick={() => void mutations.seedSystemSuites.mutateAsync()}
                type="button"
                variant="outline"
              >
                <Sparkles data-icon="inline-start" />
                {mutations.seedSystemSuites.isPending ? "Seeding..." : "Run system seed"}
              </Button>
              {diagnosticsLoading ? <span className="text-sm text-muted-foreground">Loading diagnostics…</span> : null}
            </div>

            {diagnostics.length ? <WorkspaceDiagnosticsPanel diagnostics={diagnostics} /> : null}
            {diagnosticsRuntime.length ? (
              <WorkspaceDiagnosticsPanel diagnostics={diagnosticsRuntime} />
            ) : null}
            {seedHealth.length ? (
              <SeedHealthPanel
                description="Backend-native system content status for this environment."
                items={seedHealth}
                title="Seed status"
              />
            ) : null}
            {!diagnostics.length && !diagnosticsRuntime.length && !seedHealth.length && !diagnosticsLoading ? (
              <p className="text-sm text-muted-foreground">No diagnostics to report right now.</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function ContextFacts({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ label: string; value: string }>;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <div className="mt-3 grid gap-2">
        {entries.map((entry) => (
          <div className="rounded-md border border-border/65 bg-background/82 px-3 py-2" key={entry.label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {entry.label}
            </p>
            <p className="mt-1 text-sm">{entry.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function estimateReadingMinutes(lesson: Pick<BinderLesson, "content">) {
  const words = extractPlainText(lesson.content).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
