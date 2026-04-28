// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useDashboard: () => mocks.dashboardState,
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

  it("renders the admin makeover dashboard only when an admin chooses it", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Your BinderNotes Workspace")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-makeover")).toBeTruthy();
    expect(screen.getByRole("button", { name: /organize/i })).toBeTruthy();
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

  it("shows admin-only organization controls and drag handles in makeover edit mode", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "admin-makeover" }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /organize/i }));

    expect(screen.getAllByText("Organizing workspace").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /save order/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
    expect(screen.getAllByLabelText(/drag .* to reorder/i).length).toBeGreaterThan(0);
  });
});
