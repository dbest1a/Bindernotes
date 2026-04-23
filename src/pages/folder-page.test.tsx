// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
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
    suiteTitle: "History Suite Demo",
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
    binders: [],
    folderBinders: [],
    notes: [],
    lessons: [],
    seedHealth,
  };

  return {
    profile,
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
  useFolderWorkspace: () => mocks.state,
}));

import { FolderPage } from "@/pages/folder-page";

describe("FolderPage", () => {
  beforeEach(() => {
    mocks.state.error = null;
    mocks.state.isLoading = false;
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
});

