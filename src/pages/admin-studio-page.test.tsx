// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Binder,
  BinderBundle,
  BinderLesson,
  DashboardData,
  Folder,
  Profile,
  SeedHealth,
  WorkspaceDiagnostic,
} from "@/types";

const mocks = vi.hoisted(() => {
  const profile: Profile = {
    id: "admin-1",
    email: "admin@bindernotes.com",
    full_name: "Admin User",
    role: "admin",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const binder: Binder = {
    id: "binder-rome",
    owner_id: profile.id,
    title: "Rise of Rome",
    slug: "rise-of-rome",
    description: "A focused history binder.",
    subject: "History",
    level: "Foundations",
    status: "draft",
    price_cents: 0,
    cover_url: null,
    pinned: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const lessonA: BinderLesson = {
    id: "lesson-a",
    binder_id: binder.id,
    title: "Founding myths",
    order_index: 1,
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Rome started with stories." }] }],
    },
    math_blocks: [],
    is_preview: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const lessonB: BinderLesson = {
    ...lessonA,
    id: "lesson-b",
    order_index: 2,
    title: "Republic structure",
  };

  const folder: Folder = {
    id: "folder-history",
    owner_id: profile.id,
    name: "History",
    color: "blue",
    source: "user",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const diagnostics: WorkspaceDiagnostic[] = [
    {
      code: "missing_workspace_preset",
      scope: "suite-history",
      severity: "warning",
      title: "Preset warning",
      message: "History preset missing.",
    },
  ];

  const seedHealth: SeedHealth[] = [
    {
      suiteTemplateId: "suite-history",
      suiteSlug: "history-suite",
      suiteTitle: "History Suite",
      status: "stale",
      expectedVersion: "2026.04.22-history-suite-foundation",
      actualVersion: "2026.04.22-history-suite-foundation",
      message: "Seed needs attention.",
    },
  ];

  const dashboardBase: DashboardData = {
    binders: [binder],
    folders: [folder],
    folderBinders: [],
    notes: [],
    lessons: [lessonA, lessonB],
    recentLessons: [lessonA, lessonB],
    seedHealth: [],
    diagnostics: [],
  };

  const dashboardDiagnostics: DashboardData = {
    ...dashboardBase,
    seedHealth,
    diagnostics,
  };

  const bundle: BinderBundle = {
    binder,
    lessons: [lessonA, lessonB],
    notes: [],
    comments: [],
    highlights: [],
    folders: [folder],
    folderLinks: [],
    conceptNodes: [],
    conceptEdges: [],
    seedHealth: null,
  };

  const binderMutateAsync = vi.fn(async (input: Partial<Binder>) => ({
    ...binder,
    ...input,
    status: (input.status as Binder["status"]) ?? binder.status,
    title: (input.title as string) ?? binder.title,
  }));
  const lessonMutateAsync = vi.fn(async (input: Partial<BinderLesson>) => ({
    ...lessonA,
    ...input,
    id: (input.id as string) ?? "lesson-new",
    binder_id: (input.binder_id as string) ?? binder.id,
    title: (input.title as string) ?? "Lesson 3",
    order_index: (input.order_index as number) ?? 3,
    content: (input.content as BinderLesson["content"]) ?? lessonA.content,
    math_blocks: (input.math_blocks as BinderLesson["math_blocks"]) ?? [],
    is_preview: (input.is_preview as boolean) ?? false,
  }));
  const deleteLessonMutateAsync = vi.fn(async () => undefined);
  const seedSuitesMutateAsync = vi.fn(async () => ({
    suiteCount: 3,
    binderCount: 3,
    lessonCount: 12,
    presetCount: 9,
  }));

  return {
    profile,
    dashboardBaseState: {
      data: dashboardBase,
      isLoading: false,
      error: null as Error | null,
      isFetching: false,
    },
    dashboardDiagnosticsState: {
      data: dashboardDiagnostics,
      isLoading: false,
      error: null as Error | null,
      isFetching: false,
    },
    bundleState: {
      data: bundle,
    },
    mutations: {
      binder: {
        mutateAsync: binderMutateAsync,
        mutate: vi.fn(),
        isPending: false,
      },
      lesson: {
        mutateAsync: lessonMutateAsync,
        mutate: vi.fn(),
        isPending: false,
      },
      deleteLesson: {
        mutateAsync: deleteLessonMutateAsync,
        mutate: vi.fn(),
        isPending: false,
      },
      seedSystemSuites: {
        mutateAsync: seedSuitesMutateAsync,
        isPending: false,
        error: null,
      },
    },
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useDashboard: (_profile: Profile | null, options?: { includeSystemStatus?: boolean; enabled?: boolean }) =>
    options?.includeSystemStatus ? mocks.dashboardDiagnosticsState : mocks.dashboardBaseState,
  useBinderBundle: () => mocks.bundleState,
  useAdminMutations: () => mocks.mutations,
}));

vi.mock("@/components/editor/rich-text-editor", () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: BinderLesson["content"];
    onChange?: (value: BinderLesson["content"]) => void;
  }) => (
    <textarea
      aria-label="Rich editor"
      onChange={() => onChange?.(value)}
      value={JSON.stringify(value)}
    />
  ),
}));

vi.mock("@/components/math/math-blocks", () => ({
  MathBlocks: () => <div>Math blocks</div>,
}));

import { AdminStudioPage } from "@/pages/admin-studio-page";

describe("AdminStudioPage", () => {
  beforeEach(() => {
    mocks.mutations.binder.mutateAsync.mockClear();
    mocks.mutations.lesson.mutateAsync.mockClear();
    mocks.mutations.deleteLesson.mutateAsync.mockClear();
    mocks.mutations.seedSystemSuites.mutateAsync.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("hides diagnostics by default and keeps the studio workflow primary", () => {
    render(
      <MemoryRouter>
        <AdminStudioPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Publishing queue")).toBeTruthy();
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.queryByText("Workspace diagnostics")).toBeNull();
  });

  it("shows diagnostics when opened manually", () => {
    render(
      <MemoryRouter>
        <AdminStudioPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Toggle system diagnostics drawer"));
    expect(screen.getByText("Workspace diagnostics")).toBeTruthy();
    expect(screen.getByText("Preset warning")).toBeTruthy();
  });

  it("saves binder metadata from the Overview tab", async () => {
    render(
      <MemoryRouter>
        <AdminStudioPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Binder title"), {
      target: { value: "Roman Republic Essentials" },
    });
    fireEvent.click(screen.getByText("Save binder"));

    expect(mocks.mutations.binder.mutateAsync).toHaveBeenCalled();
    const call = mocks.mutations.binder.mutateAsync.mock.calls.at(-1)?.[0];
    expect(call?.title).toBe("Roman Republic Essentials");
  });

  it("reorders lessons from the Content tab and can trigger publish", () => {
    render(
      <MemoryRouter>
        <AdminStudioPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Open Content tab"));
    fireEvent.click(screen.getByText("Move down"));
    expect(mocks.mutations.lesson.mutateAsync).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Open Publish tab"));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByText("Publish binder"));
    expect(mocks.mutations.binder.mutateAsync).toHaveBeenCalled();
  });
});
