// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Binder, BinderLesson, DashboardData, Folder, FolderBinderLink, Profile, WorkspaceDiagnostic } from "@/types";

const mocks = vi.hoisted(() => {
  const profile: Profile = {
    id: "user-1",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const realBinder: Binder = {
    id: "binder-real",
    owner_id: profile.id,
    title: "Rise of Rome",
    slug: "rise-of-rome",
    description: "Real history binder.",
    subject: "History",
    level: "Foundations",
    status: "published",
    price_cents: 0,
    cover_url: null,
    pinned: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const placeholderBinder: Binder = {
    ...realBinder,
    id: "binder-placeholder",
    title: "Untitled binder",
    slug: "untitled-binder",
    description: "Write a clear promise for this binder.",
    status: "draft",
    pinned: false,
  };

  const lessons: BinderLesson[] = [
    {
      id: "lesson-real",
      binder_id: realBinder.id,
      title: "Founding Myth and Alba Longa",
      order_index: 1,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Real lesson body" }] }],
      },
      math_blocks: [],
      is_preview: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  ];

  const folders: Folder[] = [
    {
      id: "folder-real",
      owner_id: profile.id,
      name: "History",
      color: "blue",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  ];

  const folderBinders: FolderBinderLink[] = [
    {
      id: "link-real",
      owner_id: profile.id,
      folder_id: "folder-real",
      binder_id: realBinder.id,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  ];

  const diagnostics: WorkspaceDiagnostic[] = [
    {
      code: "missing_folder",
      scope: "suite-rise-of-rome",
      severity: "warning",
      title: "Folder warning",
      message: "One warning.",
    },
    {
      code: "env_mismatch",
      scope: "supabase",
      severity: "warning",
      title: "Environment warning",
      message: "Another warning.",
    },
  ];

  const data: DashboardData = {
    binders: [realBinder, placeholderBinder],
    folders,
    folderBinders,
    notes: [],
    lessons,
    recentLessons: lessons,
    seedHealth: [],
    diagnostics,
  };

  return {
    profile,
    dashboardState: {
      data,
      isLoading: false,
      error: null as Error | null,
    },
  };
});

const dndMocks = vi.hoisted(() => ({
  dndContextRender: vi.fn(),
  lastDndContextProps: null as null | {
    onDragStart?: (event: unknown) => void;
  },
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  })),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useDashboard: () => mocks.dashboardState,
}));

vi.mock("@dnd-kit/core", () => ({
  closestCenter: vi.fn(),
  DndContext: (props: { children: ReactNode; onDragStart?: (event: unknown) => void }) => {
    dndMocks.dndContextRender();
    dndMocks.lastDndContextProps = props;
    return <div data-testid="admin-dnd-context">{props.children}</div>;
  },
  DragOverlay: ({ children }: { children: ReactNode }) => <div data-testid="admin-drag-overlay">{children}</div>,
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useDroppable: dndMocks.useDroppable,
  useSensor: dndMocks.useSensor,
  useSensors: dndMocks.useSensors,
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <div data-testid="admin-sortable-context">{children}</div>,
  rectSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: dndMocks.useSortable,
  verticalListSortingStrategy: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => undefined),
    },
  },
}));

import { DashboardPage } from "@/pages/dashboard-page";

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.dashboardState.error = null;
    mocks.dashboardState.isLoading = false;
    mocks.profile.role = "admin";
    dndMocks.dndContextRender.mockClear();
    dndMocks.lastDndContextProps = null;
    dndMocks.useDroppable.mockClear();
    dndMocks.useSensor.mockClear();
    dndMocks.useSensors.mockClear();
    dndMocks.useSortable.mockClear();
    window.localStorage.clear();
  });

  it("renders real binders near the top and hides untitled placeholder binders", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Rise of Rome").length).toBeGreaterThan(0);
    expect(screen.getByText("Real history binder.")).toBeTruthy();
    expect(screen.queryByText("Untitled binder")).toBeNull();
    expect(screen.getByText("Founding Myth and Alba Longa")).toBeTruthy();
  });

  it("keeps diagnostics off the main workspace when real content still loads", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Workspace diagnostics")).toBeNull();
    expect(screen.queryByText("Folder warning")).toBeNull();
    expect(screen.queryByText("Environment warning")).toBeNull();
  });

  it("renders the admin makeover dashboard only when an admin chooses it", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Your BinderNotes Workspace")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-makeover")).toBeTruthy();
    expect(screen.getByRole("button", { name: /organize/i })).toBeTruthy();
  });

  it("renders Minimal as a compact workspace view with core student actions still visible", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-appearance")).toBe(
      "minimal",
    );
    expect(screen.queryByText("A real study hierarchy: folders, binders, then documents.")).toBeNull();
    expect(screen.getByTestId("minimal-dashboard-command-bar")).toBeTruthy();
    expect(screen.getByTestId("minimal-dashboard-search")).toBeTruthy();
    expect(screen.getAllByTestId("minimal-dashboard-stat")).toHaveLength(3);
    expect(screen.getByTestId("dashboard-primary-action")).toBeTruthy();
    expect(screen.getByTestId("minimal-folder-grid")).toBeTruthy();
    expect(screen.getAllByTestId("minimal-folder-card").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("minimal-binder-card")).toHaveLength(1);
    expect(screen.queryByText("Recovered Binder")).toBeNull();
    expect(screen.queryByText("Write a clear promise for this binder.")).toBeNull();
    expect(screen.getAllByTestId("minimal-document-row").length).toBeGreaterThan(0);
  });

  it("keeps Minimal folder, binder, and document links usable", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("minimal-folder-card").getAttribute("href")).toBe("/folders/folder-real");
    expect(screen.getByTestId("minimal-binder-card").getAttribute("href")).toBe("/binders/binder-real");
    expect(screen.getByTestId("minimal-document-row").getAttribute("href")).toBe(
      "/binders/binder-real/documents/lesson-real",
    );
  });

  it("switches from Admin Makeover to Minimal using the makeover dashboard toggle", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-dashboard-makeover")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Minimal" }));

    expect(await screen.findByTestId("dashboard-page")).toBeTruthy();
    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-appearance")).toBe(
      "minimal",
    );
  });

  it("keeps learners on the normal dashboard even if makeover preference exists", () => {
    mocks.profile.role = "learner";
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("admin-dashboard-makeover")).toBeNull();
    expect(screen.getByText("A real study hierarchy: folders, binders, then documents.")).toBeTruthy();
  });

  it("keeps learners on the normal dashboard even if Minimal preference exists", () => {
    mocks.profile.role = "learner";
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("admin-dashboard-makeover")).toBeNull();
    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-appearance")).toBe(
      "normal",
    );
  });

  it("shows admin-only organization controls and drag handles in makeover edit mode", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /organize/i }));

    expect(screen.getAllByText("Organizing workspace").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /save order/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
    expect(screen.getAllByLabelText(/drag .* to reorder/i).length).toBeGreaterThan(0);
  });

  it("does not mount admin drag infrastructure until Organize is clicked", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-dashboard-makeover")).toBeTruthy();
    expect(screen.queryByTestId("admin-dnd-context")).toBeNull();
    expect(dndMocks.dndContextRender).not.toHaveBeenCalled();
    expect(dndMocks.useSortable).not.toHaveBeenCalled();
    expect(dndMocks.useDroppable).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /organize/i }));

    expect(await screen.findByTestId("admin-dnd-context")).toBeTruthy();
    expect(dndMocks.dndContextRender).toHaveBeenCalled();
    expect(dndMocks.useSortable).toHaveBeenCalled();
    expect(dndMocks.useDroppable).toHaveBeenCalled();
  });

  it("renders the full folder card as the drag overlay at the active card size", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /organize/i }));

    act(() => {
      dndMocks.lastDndContextProps?.onDragStart?.({
        active: {
          id: "folder:folder-real",
          rect: {
            current: {
              initial: {
                height: 272,
                width: 480,
              },
            },
          },
        },
      });
    });

    const overlay = screen.getByTestId("admin-drag-overlay-card");
    expect(overlay.getAttribute("style")).toContain("--admin-drag-preview-height: 272px");
    expect(overlay.getAttribute("style")).toContain("--admin-drag-preview-width: 480px");
    expect(screen.getByTestId("admin-folder-drag-preview")).toBeTruthy();
    expect(screen.getAllByText("History").length).toBeGreaterThan(1);
  });

  it("does not stringify full lesson content during dashboard search", () => {
    const stringifySpy = vi.spyOn(JSON, "stringify");

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Search folders, binders, documents"), {
      target: { value: "founding" },
    });

    expect(stringifySpy).not.toHaveBeenCalledWith(mocks.dashboardState.data.lessons[0].content);
    stringifySpy.mockRestore();
  });
});
