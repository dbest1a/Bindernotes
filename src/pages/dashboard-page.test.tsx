// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  useDashboardWorkspaceMutations: () => ({
    createBinder: { mutateAsync: vi.fn(), isPending: false },
    createFolder: { mutateAsync: vi.fn(), isPending: false },
  }),
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
    vi.useRealTimers();
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

  it("renders Admin Makeover with the premium workspace file controls", async () => {
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
    expect(screen.getByTestId("admin-dashboard-command-bar")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-filebar")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-new-button")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View" })).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-open-next").getAttribute("href")).toBe(
      "/binders/binder-real/documents/lesson-real",
    );
  });

  it("lets Admin Makeover View menu persist full width and toggle Recent Documents", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-dashboard-recent-section")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /full width/i }));

    expect(screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-width")).toBe(
      "full",
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /hide recent documents/i }));

    expect(
      screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-recent-documents"),
    ).toBe("hidden");
    expect(screen.queryByTestId("admin-dashboard-recent-section")).toBeNull();

    unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-dashboard-makeover")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-width")).toBe(
      "full",
    );
    expect(
      screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-recent-documents"),
    ).toBe("hidden");
  });

  it("defaults Admin Makeover to full width for existing admin users until they choose focused width", async () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );
    window.localStorage.setItem(
      "binder-notes:dashboard-workspace-view:user-1",
      JSON.stringify({ width: "focused" }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-dashboard-makeover")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-width")).toBe(
      "full",
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /focused width/i }));

    expect(screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-width")).toBe(
      "focused",
    );
    expect(window.localStorage.getItem("binder-notes:admin-dashboard-width:user-1")).toBe("focused");

    unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("admin-dashboard-makeover")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-makeover").getAttribute("data-admin-dashboard-width")).toBe(
      "focused",
    );
  });

  it("auto-dismisses Admin Makeover notices after ten seconds", async () => {
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
    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /focused width/i }));

    expect(screen.getByTestId("admin-dashboard-notice").textContent).toContain("Focused width");

    act(() => {
      vi.advanceTimersByTime(9999);
    });
    expect(screen.getByTestId("admin-dashboard-notice")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId("admin-dashboard-notice")).toBeNull();
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
    expect(screen.getByTestId("minimal-dashboard-filebar")).toBeTruthy();
    expect(screen.getByTestId("minimal-dashboard-new-button")).toBeTruthy();
    expect(screen.getByText("Browse")).toBeTruthy();
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("View")).toBeTruthy();
    expect(screen.getByTestId("minimal-dashboard-open-next").getAttribute("href")).toBe(
      "/binders/binder-real/documents/lesson-real",
    );
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

  it("lets the Minimal Browse menu change the visible workspace scope", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /binders/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-scope")).toBe("binders");
    expect(screen.getByText(/showing binders/i)).toBeTruthy();
    expect(screen.queryByTestId("minimal-folder-grid")).toBeNull();
    expect(screen.getByTestId("minimal-binder-grid")).toBeTruthy();
    expect(screen.queryByTestId("minimal-document-list")).toBeNull();
  });

  it("makes the Minimal View menu change density and sort order", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /compact rows/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-density")).toBe("compact");
    expect(screen.getByTestId("minimal-dashboard-notice").textContent).toContain("Compact rows");

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sort by name/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-sort")).toBe("name");
    expect(screen.getByTestId("minimal-dashboard-notice").textContent).toContain("Sorted by name");
  });

  it("lets the Minimal View menu use the full browser width", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /full width/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-width")).toBe("full");
    expect(screen.getByTestId("minimal-dashboard-notice").textContent).toContain("Full width");

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /focused width/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-width")).toBe("focused");
    expect(screen.getByTestId("minimal-dashboard-notice").textContent).toContain("Focused width");
  });

  it("auto-dismisses Minimal dashboard notices after ten seconds", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    vi.useFakeTimers();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /compact rows/i }));

    expect(screen.getByTestId("minimal-dashboard-notice").textContent).toContain("Compact rows");

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.queryByTestId("minimal-dashboard-notice")).toBeNull();
  });

  it("keeps the Minimal full-width View setting after the dashboard remounts", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /full width/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-width")).toBe("full");

    unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-width")).toBe("full");
  });

  it("lets the Minimal View menu hide and restore Recent Documents", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("minimal-document-list")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /hide recent documents/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-recent-documents")).toBe("hidden");
    expect(screen.queryByTestId("minimal-document-list")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /show recent documents/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-recent-documents")).toBe("visible");
    expect(screen.getByTestId("minimal-document-list")).toBeTruthy();
  });

  it("uses the Minimal Open menu as a quick-open launcher", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /show recent documents/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-minimal-scope")).toBe("documents");
    expect(document.activeElement).toBe(screen.getByTestId("minimal-dashboard-search"));
    expect(screen.getByTestId("minimal-dashboard-notice").textContent).toContain("Recent documents");
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
    expect(screen.getByTestId("normal-dashboard-filebar")).toBeTruthy();
    expect(screen.queryByText("A real study hierarchy: folders, binders, then documents.")).toBeNull();
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

  it("renders Normal as a workspace dashboard with Browse, Open, and View controls", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-appearance")).toBe(
      "normal",
    );
    expect(screen.getByTestId("normal-dashboard-command-bar")).toBeTruthy();
    expect(screen.getByTestId("normal-dashboard-filebar")).toBeTruthy();
    expect(screen.getByTestId("normal-dashboard-search")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View" })).toBeTruthy();
    expect(screen.queryByText("A real study hierarchy: folders, binders, then documents.")).toBeNull();
  });

  it("lets the Normal Browse menu change the visible workspace scope", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /binders/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-scope")).toBe("binders");
    expect(screen.getByText(/showing binders/i)).toBeTruthy();
    expect(screen.queryByTestId("normal-folder-grid")).toBeNull();
    expect(screen.getByTestId("normal-binder-grid")).toBeTruthy();
    expect(screen.queryByTestId("normal-document-list")).toBeNull();
  });

  it("lets the Normal View menu persist full width and toggle Recent Documents", () => {
    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /full width/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-width")).toBe("full");

    fireEvent.click(screen.getByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /hide recent documents/i }));

    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-recent-documents")).toBe("hidden");
    expect(screen.queryByTestId("normal-document-list")).toBeNull();

    unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-width")).toBe("full");
    expect(screen.getByTestId("dashboard-page").getAttribute("data-dashboard-recent-documents")).toBe("hidden");
  });

  it("keeps folders visible when searching by lesson title inside the folder", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText("Search folders, binders, documents, lessons"), {
      target: { value: "founding" },
    });

    await waitFor(() => {
      expect(screen.getByTestId("normal-folder-card")).toBeTruthy();
    });
    expect(screen.getByText("Founding Myth and Alba Longa")).toBeTruthy();
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

    fireEvent.change(screen.getByPlaceholderText("Search folders, binders, documents, lessons"), {
      target: { value: "founding" },
    });

    expect(stringifySpy).not.toHaveBeenCalledWith(mocks.dashboardState.data.lessons[0].content);
    stringifySpy.mockRestore();
  });
});
