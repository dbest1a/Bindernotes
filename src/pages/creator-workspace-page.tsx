import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useCreatorAccess } from "@/hooks/use-creator-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { saveQueue } from "@/lib/save-queue";
import {
  clearCreatorDraft,
  listCreatorDrafts,
  saveCreatorDraft,
  type CreatorDraft,
} from "@/lib/creator-drafts";
import { emptyDoc, slugify } from "@/lib/utils";
import {
  listCreatorBinders,
  listCreatorLessons,
  readCreatorBinder,
  readCreatorLesson,
  saveCreatorBinder,
  saveCreatorLesson,
  creatorBinderInputSchema,
  creatorLessonInputSchema,
  type CreatorLessonSummary,
} from "@/services/creator-workspace-service";
import type { Binder, Profile } from "@/types";
const RichTextEditor = lazy(() =>
  import("@/components/editor/rich-text-editor").then((module) => ({ default: module.RichTextEditor })),
);
const MathBlocks = lazy(() =>
  import("@/components/math/math-blocks").then((module) => ({ default: module.MathBlocks })),
);

export function CreatorWorkspacePage() {
  const { profile } = useAuth();
  if (!profile)
    return (
      <EmptyState title="Sign in to create" description="Your creator workspace belongs to your account." />
    );
  return <CreatorAccountWorkspace key={profile.id} profile={profile} />;
}
function CreatorAccountWorkspace({ profile }: { profile: Profile }) {
  const access = useCreatorAccess(profile);
  const [binders, setBinders] = useState<Binder[]>([]);
  const [lessons, setLessons] = useState<CreatorLessonSummary[]>([]);
  const [selectedBinder, setSelectedBinder] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreatorDraft | null>(null);
  const [deviceDrafts, setDeviceDrafts] = useState<CreatorDraft[]>([]);
  const [unreadable, setUnreadable] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);
  const alive = useRef(true),
    running = useRef(false),
    request = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      request.current++;
    };
  }, []);
  function current() {
    return alive.current && saveQueue.getAccount() === profile.id;
  }
  function refreshDrafts() {
    try {
      const saved = listCreatorDrafts(profile.id);
      setDeviceDrafts(saved.drafts);
      setUnreadable(saved.unreadable);
    } catch {
      setError("Device drafts could not be read. Keep this page open until saving is confirmed.");
    }
  }
  useEffect(() => {
    if (!access.access?.allowed) return;
    let live = true;
    setLoading(true);
    refreshDrafts();
    void listCreatorBinders(profile)
      .then((rows) => {
        if (live && current()) setBinders(rows);
      })
      .catch((error) => {
        if (live && current()) setError(message(error));
      })
      .finally(() => {
        if (live && current()) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [access.access?.allowed, reload, profile.id]);
  useEffect(() => {
    if (!selectedBinder || !access.access?.allowed) {
      setLessons([]);
      return;
    }
    let live = true;
    setLessons([]);
    void listCreatorLessons(profile, selectedBinder)
      .then((rows) => {
        if (live && current()) setLessons(rows);
      })
      .catch((error) => {
        if (live && current()) setError(message(error));
      });
    return () => {
      live = false;
    };
  }, [selectedBinder, reload, access.access?.allowed, profile.id]);
  function retain(next: CreatorDraft) {
    if (!current() || running.current) return;
    setDraft(next);
    setNotice("");
    setError("");
    try {
      saveCreatorDraft(next);
      refreshDrafts();
    } catch {
      setError(
        "This edit is only in memory because device backup failed. Keep the page open and retry saving.",
      );
    }
  }
  function openDraft(next: CreatorDraft) {
    request.current++;
    try {
      if (draft) saveCreatorDraft(draft);
      const existing = listCreatorDrafts(profile.id).drafts.find(
        (item) => item.kind === next.kind && item.input.id === next.input.id,
      );
      retain(existing ?? next);
    } catch {
      setError("Your current draft could not be backed up. Save it before opening another item.");
    }
  }
  function newBinder() {
    openDraft({
      version: 1,
      kind: "binder",
      ownerId: profile.id,
      expectedUpdatedAt: null,
      input: {
        id: crypto.randomUUID(),
        title: "",
        slug: "",
        description: "",
        subject: "General",
        level: "Foundations",
        status: "draft",
        price_cents: 0,
        cover_url: null,
        pinned: false,
      },
    });
  }
  function openBinder(binder: Binder) {
    openDraft({
      version: 1,
      kind: "binder",
      ownerId: profile.id,
      expectedUpdatedAt: binder.updated_at,
      input: creatorBinderInputSchema.parse({
        id: binder.id,
        title: binder.title,
        slug: binder.slug,
        description: binder.description,
        subject: binder.subject,
        level: binder.level,
        status: binder.status,
        price_cents: binder.price_cents,
        cover_url: binder.cover_url,
        pinned: binder.pinned,
      }),
    });
    setSelectedBinder(binder.id);
  }
  async function openLesson(id: string) {
    if (!selectedBinder || running.current) return;
    const token = ++request.current;
    setError("");
    try {
      if (draft) saveCreatorDraft(draft);
      const lesson = await readCreatorLesson(profile, selectedBinder, id);
      if (!current() || request.current !== token) return;
      openDraft({
        version: 1,
        kind: "lesson",
        ownerId: profile.id,
        expectedUpdatedAt: lesson.updated_at,
        input: creatorLessonInputSchema.parse({
          id: lesson.id,
          binder_id: lesson.binder_id,
          title: lesson.title,
          content: lesson.content,
          math_blocks: lesson.math_blocks,
          order_index: lesson.order_index,
          is_preview: lesson.is_preview,
        }),
      });
    } catch (error) {
      if (current() && request.current === token) setError(message(error));
    }
  }
  function newLesson() {
    if (!selectedBinder) return;
    openDraft({
      version: 1,
      kind: "lesson",
      ownerId: profile.id,
      expectedUpdatedAt: null,
      input: {
        id: crypto.randomUUID(),
        binder_id: selectedBinder,
        title: "",
        content: emptyDoc(""),
        math_blocks: [],
        order_index: Math.max(0, ...lessons.map((lesson) => lesson.order_index)) + 1,
        is_preview: false,
      },
    });
  }
  async function save(status?: Binder["status"]) {
    if (!draft || running.current || !current()) return;
    let operation = draft;
    if (operation.kind === "binder")
      operation = {
        ...operation,
        input: {
          ...operation.input,
          slug:
            operation.input.slug ||
            `${slugify(operation.input.title) || "binder"}-${operation.input.id.slice(0, 8)}`,
          status: status ?? operation.input.status,
        },
      };
    running.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      saveCreatorDraft(operation);
      setDraft(operation);
      if (operation.kind === "binder") {
        const binder = await saveCreatorBinder(profile, operation.input, operation.expectedUpdatedAt);
        if (!current()) return;
        clearCreatorDraft(operation);
        setDraft(null);
        setSelectedBinder(binder.id);
        setNotice(`Saved “${binder.title}” as ${binder.status}.`);
      } else {
        const lesson = await saveCreatorLesson(profile, operation.input, operation.expectedUpdatedAt);
        if (!current()) return;
        clearCreatorDraft(operation);
        setDraft(null);
        setNotice(`Saved “${lesson.title}”.`);
      }
      refreshDrafts();
      setReload((value) => value + 1);
    } catch (error) {
      if (current()) {
        setError(message(error));
        refreshDrafts();
      }
    } finally {
      if (current()) {
        running.current = false;
        setPending(false);
      }
    }
  }
  async function reloadKeepingCopy() {
    if (!draft?.expectedUpdatedAt || running.current || !current()) return;
    const original = draft;
    running.current = true;
    setPending(true);
    setError("");
    try {
      const copy = {
        ...original,
        expectedUpdatedAt: null,
        input: {
          ...original.input,
          id: crypto.randomUUID(),
          title: `${original.input.title.slice(0, 480)} (recovered)`,
        },
      } as CreatorDraft;
      if (copy.kind === "binder") {
        copy.input.status = "draft";
        copy.input.slug = "";
      }
      saveCreatorDraft(copy);
      const saved =
        original.kind === "binder"
          ? await readCreatorBinder(profile, original.input.id)
          : await readCreatorLesson(profile, original.input.binder_id, original.input.id);
      if (!current()) return;
      clearCreatorDraft(original);
      const input = {
        ...original.input,
        ...Object.fromEntries(
          Object.keys(original.input).map((key) => [key, saved[key as keyof typeof saved]]),
        ),
      };
      const refreshed = { ...original, expectedUpdatedAt: saved.updated_at, input } as CreatorDraft;
      saveCreatorDraft(refreshed);
      setDraft(refreshed);
      refreshDrafts();
      setNotice("Your device edits are kept in a recovered draft. The editor now shows the account version.");
    } catch (error) {
      if (current()) {
        setError(message(error));
        refreshDrafts();
      }
    } finally {
      if (current()) {
        running.current = false;
        setPending(false);
      }
    }
  }
  if (access.loading) return <p role="status">Checking creator access…</p>;
  if (access.error)
    return (
      <EmptyState
        title="Creator access unavailable"
        description={access.error}
        action={<Button onClick={access.retry}>Retry access check</Button>}
      />
    );
  if (!access.access?.allowed)
    return (
      <EmptyState
        title="Creator access required"
        description="Creating and publishing binders requires an active creator entitlement. Your study workspace remains available."
        action={<Link to="/dashboard">Return to study workspace</Link>}
      />
    );
  return (
    <main className="grid gap-5" data-testid="creator-workspace">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Creator workspace</h1>
          <p className="text-sm text-muted-foreground">Write and publish your own binders and lessons.</p>
        </div>
        <Button disabled={pending} onClick={newBinder}>
          New creator binder
        </Button>
      </header>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {loading && <p role="status">Loading your binders…</p>}
      {unreadable > 0 && (
        <p role="alert">{unreadable} device drafts could not be read. Their original data has been kept.</p>
      )}
      {deviceDrafts.length > 0 && (
        <section aria-label="Device drafts" className="rounded-lg border p-3">
          <h2 className="font-semibold">Unsaved device drafts</h2>
          <p className="text-sm text-muted-foreground">
            These drafts stay on this device until account saving is confirmed.
          </p>
          <div className="flex flex-wrap gap-2">
            {deviceDrafts.map((item) => (
              <Button
                disabled={pending}
                key={`${item.kind}:${item.input.id}`}
                variant="outline"
                onClick={() => {
                  openDraft(item);
                  if (item.kind === "lesson") setSelectedBinder(item.input.binder_id);
                }}
              >
                Resume {item.input.title || `untitled ${item.kind}`}
              </Button>
            ))}
          </div>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,300px)_1fr]">
        <aside className="grid content-start gap-3 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Your binders</h2>
          {!loading && binders.length === 0 && <p>No creator binders yet. Create a draft to begin.</p>}
          {binders.map((binder) => (
            <Button
              disabled={pending}
              key={binder.id}
              variant={selectedBinder === binder.id ? "secondary" : "outline"}
              onClick={() => openBinder(binder)}
            >
              {binder.title} · {binder.status}
            </Button>
          ))}
          {selectedBinder && (
            <>
              <h2 className="mt-3 text-lg font-semibold">Lessons</h2>
              <Button disabled={pending} variant="outline" onClick={newLesson}>
                New lesson
              </Button>
              {lessons.map((lesson) => (
                <Button
                  disabled={pending}
                  key={lesson.id}
                  variant="ghost"
                  onClick={() => void openLesson(lesson.id)}
                >
                  {lesson.order_index}. {lesson.title}
                </Button>
              ))}
            </>
          )}
        </aside>
        <section className="grid content-start gap-4 rounded-lg border p-4" aria-label="Creator editor">
          {!draft ? (
            <p>Select a binder or lesson to edit. Saved work reopens from your account.</p>
          ) : (
            <>
              <p role="status">
                {pending ? "Saving to your account…" : "Device draft — save to confirm account storage."}
              </p>
              {draft.kind === "binder" ? (
                <>
                  <label>
                    Binder title
                    <Input
                      disabled={pending}
                      value={draft.input.title}
                      onChange={(event) =>
                        retain({ ...draft, input: { ...draft.input, title: event.target.value } })
                      }
                    />
                  </label>
                  <label>
                    Subject
                    <Input
                      disabled={pending}
                      value={draft.input.subject}
                      onChange={(event) =>
                        retain({ ...draft, input: { ...draft.input, subject: event.target.value } })
                      }
                    />
                  </label>
                  <label>
                    Level
                    <Input
                      disabled={pending}
                      value={draft.input.level}
                      onChange={(event) =>
                        retain({ ...draft, input: { ...draft.input, level: event.target.value } })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <Textarea
                      disabled={pending}
                      value={draft.input.description}
                      onChange={(event) =>
                        retain({ ...draft, input: { ...draft.input, description: event.target.value } })
                      }
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Publishing makes this binder available in the published catalog. Archiving removes it from
                    the published catalog and keeps your lessons.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={pending} onClick={() => void save("draft")}>
                      Save as draft
                    </Button>
                    <Button disabled={pending} onClick={() => void save("published")}>
                      Publish binder
                    </Button>
                    {draft.expectedUpdatedAt && (
                      <Button disabled={pending} variant="outline" onClick={() => void save("archived")}>
                        Archive binder
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label>
                    Lesson title
                    <Input
                      disabled={pending}
                      value={draft.input.title}
                      onChange={(event) =>
                        retain({ ...draft, input: { ...draft.input, title: event.target.value } })
                      }
                    />
                  </label>
                  <label>
                    Lesson order
                    <Input
                      disabled={pending}
                      type="number"
                      min={0}
                      max={100000}
                      value={draft.input.order_index}
                      onChange={(event) => {
                        const value = event.target.valueAsNumber;
                        if (Number.isSafeInteger(value) && value >= 0 && value <= 100000)
                          retain({ ...draft, input: { ...draft.input, order_index: value } });
                      }}
                    />
                  </label>
                  <label>
                    <input
                      disabled={pending}
                      type="checkbox"
                      checked={draft.input.is_preview}
                      onChange={(event) =>
                        retain({ ...draft, input: { ...draft.input, is_preview: event.target.checked } })
                      }
                    />{" "}
                    Allow this lesson as a preview
                  </label>
                  <Suspense fallback={<p>Loading lesson editor…</p>}>
                    <RichTextEditor
                      value={draft.input.content}
                      editable={!pending}
                      onChange={(content) => retain({ ...draft, input: { ...draft.input, content } })}
                    />
                    <MathBlocks
                      blocks={draft.input.math_blocks}
                      editable={!pending}
                      onChange={(math_blocks) => retain({ ...draft, input: { ...draft.input, math_blocks } })}
                    />
                  </Suspense>
                  <p className="text-sm text-muted-foreground">
                    Lesson saves update the current binder, including a published binder.
                  </p>
                  <Button disabled={pending} onClick={() => void save()}>
                    Save lesson
                  </Button>
                </>
              )}
              {draft.expectedUpdatedAt && (
                <Link
                  to={
                    draft.kind === "binder"
                      ? `/binders/${draft.input.id}`
                      : `/binders/${draft.input.binder_id}/documents/${draft.input.id}`
                  }
                >
                  Open saved reader
                </Link>
              )}
              {draft.expectedUpdatedAt && (
                <Button disabled={pending} variant="outline" onClick={() => void reloadKeepingCopy()}>
                  Reload account version and keep a draft copy
                </Button>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "This action could not be completed. Your draft has been kept.";
}
