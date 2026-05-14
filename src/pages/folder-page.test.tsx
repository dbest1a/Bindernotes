// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderWorkspaceData, Profile, SeedHealth } from "@/types";

const mocks = vi.hoisted(() => {
  const profile: Profile = {
    id: "admin-1",
    email: "admin@bindernotes.com",
    full_name: "Admin",
    role: "admin",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const seedHealth: SeedHealth = {
    suiteTemplateId: "suite-history",
    suiteSlug: "history-suite-demo",
    suiteTitle: "History Source Studio",
    status: "stale",
    expectedVersion: "2026.04.22-history-suite-foundation",
    actualVersion: null,
    message: "Seed rows are missing for one binder.",
    missingBinders: ["binder-french-revolution-history-suite"],
  };

  const data: FolderWorkspaceData = {
    folder: {
      id: "folder-history",
      owner_id: "admin-1",
      name: "History",
      color: "blue",
      source: "system",
      suite_template_id: "suite-history",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    binders: [
      {
        id: "binder-chemistry",
        owner_id: "admin-1",
        title: "Chemistry",
        slug: "chemistry",
        description: "Chemistry test binder.",
        subject: "Chemistry",
        level: "Personal",
        status: "draft",
        price_cents: 0,
        cover_url: null,
        pinned: false,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      },
    ],
    folderBinders: [],
    notes: [],
    lessons: [],
    seedHealth,
  };

  return {
    profile,
    createBinderMutation: vi.fn(),
    createDocumentMutation: vi.fn(),
    state: {
      data,
      isLoading: false,
      error: null as Error | null,
    },
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useDashboardWorkspaceMutations: () => ({
    createBinder: { mutateAsync: mocks.createBinderMutation, isPending: false },
    createDocument: { mutateAsync: mocks.createDocumentMutation, isPending: false },
    createFolder: { mutateAsync: vi.fn(), isPending: false },
  }),
  useFolderWorkspace: () => mocks.state,
}));

import { FolderPage } from "@/pages/folder-page";
import { CHEMISTRY_SHOWCASE_BINDER_ID, chemistryShowcaseLessons } from "@/lib/chemistry/chemistry-showcase-content";

describe("FolderPage", () => {
  beforeEach(() => {
    mocks.state.error = null;
    mocks.state.isLoading = false;
    mocks.profile.role = "admin";
    mocks.createBinderMutation.mockReset();
    mocks.createBinderMutation.mockResolvedValue({
      ...mocks.state.data.binders[0],
      id: "binder-new",
      title: "New Chemistry Binder",
    });
    mocks.createDocumentMutation.mockReset();
    mocks.createDocumentMutation.mockResolvedValue({
      id: "lesson-new",
      binder_id: "binder-chemistry",
      title: "Titration Practice",
      order_index: 1,
      content: { type: "doc", content: [] },
      math_blocks: [],
      is_preview: false,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    });
  });

  it("keeps seed status hidden by default", () => {
    render(
      <MemoryRouter initialEntries={["/folders/folder-history"]}>
        <Routes>
          <Route path="/folders/:folderId" element={<FolderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("Seed status")).toBeNull();
    expect(screen.queryByText("Expected version")).toBeNull();
  });

  it("shows seed status details only in explicit system debug mode", () => {
    render(
      <MemoryRouter initialEntries={["/folders/folder-history?debug=system"]}>
        <Routes>
          <Route path="/folders/:folderId" element={<FolderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Seed status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expected version").length).toBeGreaterThan(0);
  });

  it("lets admins create a new document inside a binder from the folder page", async () => {
    render(
      <MemoryRouter initialEntries={["/folders/folder-history"]}>
        <Routes>
          <Route path="/folders/:folderId" element={<FolderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "New document" })[0]);
    fireEvent.change(screen.getByLabelText("Document title"), {
      target: { value: "Titration Practice" },
    });
    fireEvent.change(screen.getByLabelText("Binder"), {
      target: { value: "binder-chemistry" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create document" }));

    await waitFor(() => {
      expect(mocks.createDocumentMutation).toHaveBeenCalledWith({
        binderId: "binder-chemistry",
        orderIndex: 1,
        title: "Titration Practice",
      });
    });
    expect(await screen.findByText('Created document "Titration Practice".')).toBeTruthy();
  });

  it("renders the bundled Chemistry course beside personal Chemistry binders", () => {
    mocks.state.data = {
      ...mocks.state.data,
      folder: {
        ...mocks.state.data.folder,
        id: "folder-chemistry",
        name: "Chemistry",
        suite_template_id: null,
      },
      binders: [
        {
          ...mocks.state.data.binders[0],
          id: CHEMISTRY_SHOWCASE_BINDER_ID,
          title: "Chemistry 101 + AP Chemistry",
          description: "Complete student course binder.",
          subject: "Chemistry",
        },
        {
          ...mocks.state.data.binders[0],
          id: "binder-user-chemistry",
          title: "Chemistry binder",
          description: "Personal workspace binder.",
          subject: "Chemistry",
        },
      ],
      lessons: chemistryShowcaseLessons,
      notes: [],
      seedHealth: null,
    };

    render(
      <MemoryRouter initialEntries={["/folders/folder-chemistry"]}>
        <Routes>
          <Route path="/folders/:folderId" element={<FolderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Chemistry 101 + AP Chemistry" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Chemistry binder" })).toBeTruthy();
    expect(screen.getAllByText(/77 documents/i).length).toBeGreaterThan(0);
  });
});
