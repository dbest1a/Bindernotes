import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Clock,
  ExternalLink,
  Filter,
  Play,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TutorialVideoModal } from "@/components/tutorials/tutorial-video-modal";
import { useAuth } from "@/hooks/use-auth";
import {
  formatTutorialDuration,
  searchTutorials,
  tutorialCategories,
  tutorials,
  type TutorialCategory,
  type TutorialEntry,
  type TutorialStatus,
} from "@/lib/tutorials/tutorial-registry";
import { cn } from "@/lib/utils";
import {
  createUploadedTutorial,
  listUploadedTutorials,
  sanitizeTutorialId,
} from "@/services/tutorial-service";
import { markDevPerformance } from "@/lib/performance-marks";

type TutorialCategoryFilter = TutorialCategory | "All";
const initialTutorialCardLimit = 12;
const tutorialCardLimitStep = 12;
const initialAdminShellLimit = 12;
const adminShellLimitStep = 12;
const initialUploadedTutorialLimit = 8;
const uploadedTutorialLimitStep = 8;

export function TutorialPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TutorialCategoryFilter>("All");
  const [activeTutorial, setActiveTutorial] = useState<TutorialEntry | null>(null);
  const [visibleTutorialCount, setVisibleTutorialCount] = useState(initialTutorialCardLimit);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    markDevPerformance("tutorial-page-render");
  });

  const uploadedTutorialsQuery = useQuery({
    queryKey: ["tutorial-entries", isAdmin ? "admin" : "published"],
    queryFn: () => listUploadedTutorials(isAdmin),
    staleTime: 60_000,
  });

  const tutorialLibrary = useMemo(
    () => (uploadedTutorialsQuery.data ?? []).filter((tutorial) => tutorial.videoSrc),
    [uploadedTutorialsQuery.data],
  );
  const filteredTutorials = useMemo(
    () => searchTutorials(query, category, tutorialLibrary),
    [category, query, tutorialLibrary],
  );
  const draftShells = useMemo(() => searchTutorials(query, category, tutorials), [category, query]);
  const featuredTutorials = useMemo(
    () => tutorialLibrary.filter((tutorial) => tutorial.videoSrc).slice(0, 4),
    [tutorialLibrary],
  );
  const visibleFilteredTutorials = useMemo(
    () => filteredTutorials.slice(0, visibleTutorialCount),
    [filteredTutorials, visibleTutorialCount],
  );
  const hasMoreTutorials = filteredTutorials.length > visibleTutorialCount;
  const visibleCategories: TutorialCategoryFilter[] = useMemo(() => ["All", ...tutorialCategories], []);

  useEffect(() => {
    setVisibleTutorialCount(initialTutorialCardLimit);
  }, [category, query]);

  return (
    <main className="app-page gap-6">
      <section className="page-shell overflow-hidden p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
          <div>
            <Badge variant="outline">Tutorial library</Badge>
            <h1 className="mt-4 page-heading max-w-4xl text-4xl sm:text-5xl">
              Learn BinderNotes with quick video walkthroughs
            </h1>
            <p className="mt-4 max-w-3xl page-copy">
              Search every page and major tool, watch the tutorial, then jump straight back to the matching feature.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild type="button">
                <Link to="/dashboard">
                  <BookOpenCheck data-icon="inline-start" />
                  Start in workspace
                </Link>
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/math/lab">
                  <Sparkles data-icon="inline-start" />
                  Open Math lab
                </Link>
              </Button>
              {profile?.role === "admin" ? (
                <Button asChild type="button" variant="outline">
                  <Link to="/admin">
                    <ExternalLink data-icon="inline-start" />
                    Open Admin studio
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <aside className="rounded-lg border border-border/70 bg-background/72 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Play className="size-4" />
              First-time help
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              BinderNotes can prompt a new user once per page. Skipping a tutorial stores that choice on this browser only.
            </p>
          </aside>
        </div>
      </section>

      {isAdmin ? (
        <AdminTutorialCreator draftShells={draftShells} uploadedTutorials={tutorialLibrary} />
      ) : null}

      <section className="page-shell p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="grid gap-2 text-sm font-medium">
            Search tutorials
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search tutorials"
                className="pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search graph, notes, admin, transcript, route..."
                value={query}
              />
            </span>
          </label>
          <div className="flex flex-wrap gap-2" role="list" aria-label="Tutorial categories">
            {visibleCategories.map((categoryOption) => (
              <button
                aria-pressed={category === categoryOption}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition",
                  category === categoryOption
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background/75 text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                key={categoryOption}
                onClick={() => setCategory(categoryOption)}
                type="button"
              >
                <Filter className="size-3.5" />
                {categoryOption}
              </button>
            ))}
          </div>
        </div>
      </section>

      {!query && category === "All" && featuredTutorials.length ? (
        <section className="grid gap-4">
          <div>
            <span className="page-kicker">Start here</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Featured walkthroughs</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredTutorials.map((tutorial) => (
              <TutorialCard
                key={tutorial.id}
                onOpen={() => setActiveTutorial(tutorial)}
                tutorial={tutorial}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="page-kicker">All tutorials</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              {filteredTutorials.length} tutorial{filteredTutorials.length === 1 ? "" : "s"}
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            Search matches title, category, tags, route, summary, steps, and transcript text.
          </p>
        </div>

        {filteredTutorials.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleFilteredTutorials.map((tutorial) => (
              <TutorialCard
                key={tutorial.id}
                onOpen={() => setActiveTutorial(tutorial)}
                tutorial={tutorial}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {query || category !== "All"
                  ? "No tutorials found"
                  : "No tutorial videos have been published yet."}
              </CardTitle>
              <CardDescription>
                {query || category !== "All"
                  ? "Try a page name, tool name, route, or transcript word like graph, notes, admin, whiteboard, or publish."
                  : isAdmin
                    ? "Use a draft shell above to upload the first real tutorial video and publish it."
                    : "The library is ready. Published admin uploads will appear here as soon as real tutorial videos are added."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        {hasMoreTutorials ? (
          <div className="flex justify-center">
            <Button
              onClick={() => setVisibleTutorialCount((count) => count + tutorialCardLimitStep)}
              type="button"
              variant="outline"
            >
              Load more tutorials
            </Button>
          </div>
        ) : null}
      </section>

      <TutorialVideoModal
        onClose={() => setActiveTutorial(null)}
        open={Boolean(activeTutorial)}
        tutorial={activeTutorial}
      />
    </main>
  );
}

type TutorialCreatorForm = {
  audience: NonNullable<TutorialEntry["audience"]>;
  category: TutorialCategory;
  id: string;
  promptRoutePatterns: string;
  relatedFeatureLink: string;
  routePatterns: string;
  status: TutorialStatus;
  steps: string;
  summary: string;
  tags: string;
  title: string;
  transcript: string;
};

const defaultCreatorForm: TutorialCreatorForm = {
  audience: "all",
  category: "Getting Started",
  id: "",
  promptRoutePatterns: "",
  relatedFeatureLink: "/dashboard",
  routePatterns: "/dashboard",
  status: "published",
  steps: "",
  summary: "",
  tags: "",
  title: "",
  transcript: "",
};

type AdminTutorialCreatorProps = {
  draftShells: TutorialEntry[];
  uploadedTutorials: TutorialEntry[];
};

function AdminTutorialCreator({ draftShells, uploadedTutorials }: AdminTutorialCreatorProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const studioFormRef = useRef<HTMLFormElement | null>(null);
  const [form, setForm] = useState<TutorialCreatorForm>(defaultCreatorForm);
  const [editingTutorial, setEditingTutorial] = useState<TutorialEntry | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [videoDurationSeconds, setVideoDurationSeconds] = useState(0);
  const [metadataError, setMetadataError] = useState("");
  const [visibleShellCount, setVisibleShellCount] = useState(initialAdminShellLimit);
  const [visibleUploadedCount, setVisibleUploadedCount] = useState(initialUploadedTutorialLimit);
  const detectedDuration = formatTutorialDuration(videoDurationSeconds);
  const availableDraftShells = useMemo(() => {
    const uploadedIds = new Set(uploadedTutorials.map((tutorial) => tutorial.id));
    return draftShells.filter((shell) => !uploadedIds.has(shell.id));
  }, [draftShells, uploadedTutorials]);
  const visibleDraftShells = useMemo(
    () => availableDraftShells.slice(0, visibleShellCount),
    [availableDraftShells, visibleShellCount],
  );
  const visibleUploadedTutorials = useMemo(
    () => uploadedTutorials.slice(0, visibleUploadedCount),
    [uploadedTutorials, visibleUploadedCount],
  );
  const hasMoreDraftShells = availableDraftShells.length > visibleShellCount;
  const hasMoreUploadedTutorials = uploadedTutorials.length > visibleUploadedCount;

  useEffect(() => {
    setVisibleShellCount(initialAdminShellLimit);
  }, [draftShells]);

  useEffect(() => {
    setVisibleUploadedCount(initialUploadedTutorialLimit);
  }, [uploadedTutorials]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id) {
        throw new Error("You must be signed in as an admin to create tutorials.");
      }
      if (!videoFile && !editingTutorial?.videoSrc) {
        throw new Error("Choose a tutorial video before creating the tutorial.");
      }

      const title = form.title.trim();
      const tutorialId = sanitizeTutorialId(form.id || title);
      if (!tutorialId) {
        throw new Error("Add a tutorial title or ID.");
      }

      const durationSeconds =
        videoFile && videoDurationSeconds <= 0
          ? await readVideoDuration(videoFile).catch(() => 0)
          : videoDurationSeconds;

      return createUploadedTutorial(
        {
          id: tutorialId,
          title,
          audience: form.audience,
          category: form.category,
          routePatterns: splitList(form.routePatterns),
          promptRoutePatterns: splitList(form.promptRoutePatterns),
          tags: splitList(form.tags),
          summary: form.summary,
          durationSeconds,
          steps: splitList(form.steps),
          transcript: form.transcript,
          relatedFeatureLink: form.relatedFeatureLink,
          status: form.status,
        },
        videoFile,
        posterFile,
        profile.id,
        editingTutorial,
      );
    },
    onSuccess: async () => {
      setForm(defaultCreatorForm);
      setEditingTutorial(null);
      setVideoFile(null);
      setPosterFile(null);
      setVideoDurationSeconds(0);
      setMetadataError("");
      await queryClient.invalidateQueries({ queryKey: ["tutorial-entries"] });
    },
  });
  const submitLabel =
    createMutation.isPending
      ? "Uploading..."
      : form.status === "published"
        ? editingTutorial
          ? "Save and publish"
          : "Upload and publish"
        : editingTutorial
          ? "Save draft"
          : "Upload as draft";

  const updateField =
    <Key extends keyof TutorialCreatorForm>(field: Key) =>
    (value: TutorialCreatorForm[Key]) => {
      setForm((current) => ({ ...current, [field]: value }));
    };

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setVideoFile(file);
    setVideoDurationSeconds(0);
    setMetadataError("");

    if (!file) {
      return;
    }

    readVideoDuration(file)
      .then(setVideoDurationSeconds)
      .catch(() => {
        setMetadataError("Duration will be empty until the video metadata can be read.");
      });
  };

  const loadShell = (shell: TutorialEntry) => {
    setEditingTutorial(null);
    setVideoFile(null);
    setPosterFile(null);
    setVideoDurationSeconds(0);
    setMetadataError("");
    setForm({
      audience: shell.audience ?? "all",
      category: shell.category,
      id: shell.id,
      promptRoutePatterns: (shell.promptRoutePatterns ?? []).join("\n"),
      relatedFeatureLink: shell.relatedFeatureLink,
      routePatterns: shell.routePatterns.join("\n"),
      status: "published",
      steps: shell.steps.join("\n"),
      summary: shell.summary,
      tags: shell.tags.join(", "),
      title: shell.title,
      transcript: shell.transcript,
    });
    window.requestAnimationFrame(() => {
      studioFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const loadUploadedTutorial = (tutorial: TutorialEntry) => {
    setEditingTutorial(tutorial);
    setVideoFile(null);
    setPosterFile(null);
    setVideoDurationSeconds(tutorial.durationSeconds ?? 0);
    setMetadataError("");
    setForm({
      audience: tutorial.audience ?? "all",
      category: tutorial.category,
      id: tutorial.id,
      promptRoutePatterns: (tutorial.promptRoutePatterns ?? []).join("\n"),
      relatedFeatureLink: tutorial.relatedFeatureLink,
      routePatterns: tutorial.routePatterns.join("\n"),
      status: tutorial.status ?? "published",
      steps: tutorial.steps.join("\n"),
      summary: tutorial.summary,
      tags: tutorial.tags.join(", "),
      title: tutorial.title,
      transcript: tutorial.transcript,
    });
  };

  const clearForm = () => {
    setForm(defaultCreatorForm);
    setEditingTutorial(null);
    setVideoFile(null);
    setPosterFile(null);
    setVideoDurationSeconds(0);
    setMetadataError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate();
  };

  return (
    <section className="page-shell p-4 sm:p-5" data-testid="admin-tutorial-creator">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="page-kicker">Admin tutorial studio</span>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">
            {editingTutorial ? "Edit tutorial video" : "Upload a tutorial video"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Create tutorials from the live site. Draft shells stay private until a real video is uploaded and the entry is published.
          </p>
        </div>
        <Badge variant="outline">Admin only</Badge>
      </div>

      <div className="mt-5 grid gap-4">
        <Card data-testid="admin-tutorial-draft-shells">
          <CardHeader>
            <CardTitle>Draft upload shells</CardTitle>
            <CardDescription>
              These are templates only. Pick one, upload the real video, then publish it into the global tutorial library.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableDraftShells.length ? (
              visibleDraftShells.map((shell) => (
                <DraftShellCard key={shell.id} onUpload={() => loadShell(shell)} shell={shell} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No draft shells match this search.</p>
            )}
            {hasMoreDraftShells ? (
              <div className="md:col-span-2 xl:col-span-3">
                <Button
                  onClick={() => setVisibleShellCount((count) => count + adminShellLimitStep)}
                  type="button"
                  variant="outline"
                >
                  Load more draft shells
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded tutorials</CardTitle>
            <CardDescription>
              Edit details, publish, unpublish, or test entries that already have real uploaded media.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {uploadedTutorials.length ? (
              visibleUploadedTutorials.map((tutorial) => (
                <button
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/72 px-3 py-2 text-left transition hover:bg-secondary"
                  key={tutorial.id}
                  onClick={() => loadUploadedTutorial(tutorial)}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold">{tutorial.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {tutorial.duration || "No duration"} - {tutorial.category}
                    </span>
                  </span>
                  <Badge variant={tutorial.status === "published" ? "secondary" : "outline"}>
                    {tutorial.status ?? "published"}
                  </Badge>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No real tutorial videos have been uploaded yet.
              </p>
            )}
            {hasMoreUploadedTutorials ? (
              <Button
                className="justify-self-start"
                onClick={() => setVisibleUploadedCount((count) => count + uploadedTutorialLimitStep)}
                type="button"
                variant="outline"
              >
                Load more uploaded tutorials
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <form className="mt-5 grid gap-4" onSubmit={submit} ref={studioFormRef}>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Tutorial title
            <Input
              onChange={(event) => updateField("title")(event.target.value)}
              placeholder="Dashboard basics"
              required
              value={form.title}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tutorial ID
            <Input
              onChange={(event) => updateField("id")(event.target.value)}
              placeholder={sanitizeTutorialId(form.title) || "dashboard-basics"}
              value={form.id}
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">
            Category
            <select
              className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3.5 text-sm font-semibold outline-none"
              onChange={(event) => updateField("category")(event.target.value as TutorialCategory)}
              value={form.category}
            >
              {tutorialCategories.map((categoryOption) => (
                <option key={categoryOption} value={categoryOption}>
                  {categoryOption}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Audience
            <select
              className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3.5 text-sm font-semibold outline-none"
              onChange={(event) =>
                updateField("audience")(event.target.value as TutorialCreatorForm["audience"])
              }
              value={form.audience}
            >
              <option value="all">All users</option>
              <option value="learner">Learners</option>
              <option value="admin">Admins</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              className="appearance-select h-11 rounded-lg border border-input/85 bg-background/92 px-3.5 text-sm font-semibold outline-none"
              onChange={(event) => updateField("status")(event.target.value as TutorialStatus)}
              value={form.status}
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Feature link
            <Input
              onChange={(event) => updateField("relatedFeatureLink")(event.target.value)}
              placeholder="/dashboard"
              value={form.relatedFeatureLink}
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Video file
            <Input
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleVideoChange}
              required={!editingTutorial?.videoSrc}
              type="file"
            />
            <span className="text-xs text-muted-foreground">
              {detectedDuration
                ? `Detected duration: ${detectedDuration}`
                : metadataError || "The card time appears only after a real video duration is detected."}
            </span>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Poster image
            <Input accept="image/jpeg,image/png,image/webp" onChange={(event) => setPosterFile(event.target.files?.[0] ?? null)} type="file" />
            <span className="text-xs text-muted-foreground">
              Optional. BinderNotes uses the default tutorial poster if this is empty.
            </span>
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Summary
          <Textarea
            onChange={(event) => updateField("summary")(event.target.value)}
            placeholder="What this tutorial teaches in one or two lines."
            required
            value={form.summary}
          />
        </label>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            Tags
            <Textarea
              onChange={(event) => updateField("tags")(event.target.value)}
              placeholder="dashboard, folders, getting started"
              value={form.tags}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Routes
            <Textarea
              onChange={(event) => updateField("routePatterns")(event.target.value)}
              placeholder="/dashboard, /admin, /math/lab"
              value={form.routePatterns}
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            First-time prompt routes
            <Textarea
              onChange={(event) => updateField("promptRoutePatterns")(event.target.value)}
              placeholder="/dashboard"
              value={form.promptRoutePatterns}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Steps
            <Textarea
              onChange={(event) => updateField("steps")(event.target.value)}
              placeholder="Open Dashboard&#10;Choose a folder&#10;Open a binder"
              value={form.steps}
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Transcript
          <Textarea
            onChange={(event) => updateField("transcript")(event.target.value)}
            placeholder="Paste the caption/script text for search and accessibility."
            value={form.transcript}
          />
        </label>

        {createMutation.error ? (
          <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {createMutation.error instanceof Error ? createMutation.error.message : "Could not create tutorial."}
          </p>
        ) : null}
        {createMutation.isSuccess ? (
          <p className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
            Tutorial uploaded. It is now available in the tutorial library.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={createMutation.isPending} type="submit">
            <Upload data-icon="inline-start" />
            {submitLabel}
          </Button>
          <Button
            onClick={clearForm}
            type="button"
            variant="outline"
          >
            <Plus data-icon="inline-start" />
            Clear form
          </Button>
        </div>
      </form>
    </section>
  );
}

const DraftShellCard = memo(function DraftShellCard({
  onUpload,
  shell,
}: {
  onUpload: () => void;
  shell: TutorialEntry;
}) {
  return (
    <Card className="tutorial-card tutorial-card--draft overflow-hidden border-dashed">
      <div className="relative border-b border-border/70 bg-background">
        <img
          alt={`${shell.title} draft poster`}
          className="aspect-video w-full object-cover opacity-70"
          loading="lazy"
          src={shell.posterSrc}
        />
        <span className="absolute bottom-3 left-3 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-xs font-semibold shadow-sm">
          Draft shell
        </span>
      </div>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{shell.category}</Badge>
          {shell.tags.slice(0, 2).map((tag) => (
            <span className="text-xs font-medium text-muted-foreground" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <CardTitle className="text-xl">{shell.title}</CardTitle>
        <CardDescription>{shell.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Button onClick={onUpload} type="button">
          <Upload data-icon="inline-start" />
          Upload video
        </Button>
        <Button asChild type="button" variant="outline">
          <Link to={shell.relatedFeatureLink}>
            Open this feature
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});

const TutorialCard = memo(function TutorialCard({
  onOpen,
  tutorial,
}: {
  onOpen: () => void;
  tutorial: TutorialEntry;
}) {
  const hasRealDuration = Boolean(tutorial.videoSrc && tutorial.duration);

  return (
    <Card className="tutorial-card overflow-hidden">
      <div className="relative border-b border-border/70 bg-background">
        <img
          alt={`${tutorial.title} poster`}
          className="aspect-video w-full object-cover"
          loading="lazy"
          src={tutorial.posterSrc}
        />
        {hasRealDuration ? (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-xs font-semibold shadow-sm">
            <Clock className="size-3.5 text-primary" />
            {tutorial.duration}
          </span>
        ) : null}
      </div>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{tutorial.category}</Badge>
          {tutorial.status && tutorial.status !== "published" ? (
            <Badge variant="outline">{tutorial.status}</Badge>
          ) : null}
          {tutorial.tags.slice(0, 2).map((tag) => (
            <span className="text-xs font-medium text-muted-foreground" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <CardTitle className="text-xl">{tutorial.title}</CardTitle>
        <CardDescription>{tutorial.summary}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Button onClick={onOpen} type="button">
          <Play data-icon="inline-start" />
          Open tutorial
        </Button>
        <Button asChild type="button" variant="outline">
          <Link to={tutorial.relatedFeatureLink}>
            Open this feature
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
});

function splitList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function readVideoDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(video.duration) ? video.duration : 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read video metadata."));
    };
    video.src = objectUrl;
  });
}
