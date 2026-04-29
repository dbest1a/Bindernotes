// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Binder, BinderLesson, DashboardData, Folder, FolderBinderLink, LearnerNote, Profile, WorkspaceDiagnostic } from "@/types";

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

  const learnerNote: LearnerNote = {
    id: "learner-note-1",
    owner_id: profile.id,
    binder_id: realBinder.id,
    lesson_id: lessons[0].id,
    folder_id: null,
    title: "Private Rome notes",
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Senate and republic" }] }],
    },
    math_blocks: [],
    pinned: false,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

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
    notes: [learnerNote],
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

vi.mock("@/hooks/use-personal-notes", () => ({
  usePersonalNotes: () => ({ data: null }),
}));

import { DashboardPage } from "@/pages/dashboard-page";

describe("DashboardPage", () => {
  beforeEach(() => {
    mocks.dashboardState.error = null;
    mocks.dashboardState.isLoading = false;
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

  it("adds a Personal Notes entry point with binder-linked note counts", () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Personal Notes").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Your notes, binder private notes, and custom notebooks in one place.").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("1 binder-linked").length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: /Open notes/i })
        .some((link) => link.getAttribute("href") === "/notes"),
    ).toBe(true);
  });
});
