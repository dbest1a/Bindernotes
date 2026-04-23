// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BinderOverviewData, Profile, SeedHealth } from "@/types";

const mocks = vi.hoisted(() => {
  const learner: Profile = {
    id: "user-1",
    email: "learner@example.com",
    full_name: "Learner",
    role: "learner",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  const admin: Profile = {
    ...learner,
    id: "admin-1",
    email: "admin@example.com",
    role: "admin",
  };

  const seedHealth: SeedHealth = {
    suiteTemplateId: "suite-algebra",
    suiteSlug: "algebra-foundations",
    suiteTitle: "Algebra 1 Foundations",
    status: "healthy",
    expectedVersion: "2026.04.22-history-suite-foundation",
    actualVersion: "2026.04.22-history-suite-foundation",
    message: "Seed is present.",
  };

  const data: BinderOverviewData = {
    binder: {
      id: "binder-algebra-foundations",
      owner_id: "system",
      title: "Algebra 1 Foundations",
      slug: "algebra-1-foundations",
      description: "A clean study binder.",
      subject: "Math",
      level: "Foundations",
      status: "published",
      price_cents: 0,
      cover_url: null,
      pinned: true,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
    lessons: [],
    notes: [],
    folderLinks: [],
    folders: [],
    seedHealth,
  };

  return {
    authState: {
      profile: learner,
    },
    binderState: {
      data,
      isLoading: false,
      error: null as Error | null,
    },
    learner,
    admin,
  };
});

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.authState.profile,
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useBinderOverview: () => mocks.binderState,
}));

import { BinderPage } from "@/pages/binder-page";

describe("BinderPage", () => {
  beforeEach(() => {
    mocks.authState.profile = mocks.learner;
    mocks.binderState.error = null;
    mocks.binderState.isLoading = false;
  });

  it("hides seed status from normal users by default", () => {
    render(
      <MemoryRouter initialEntries={["/binders/binder-algebra-foundations"]}>
        <Routes>
          <Route path="/binders/:binderId" element={<BinderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Algebra 1 Foundations").length).toBeGreaterThan(0);
    expect(screen.queryByText("Seed status")).toBeNull();
    expect(screen.queryByText("Expected version")).toBeNull();
  });

  it("shows seed status only when an admin explicitly opts into system debug mode", () => {
    mocks.authState.profile = mocks.admin;

    render(
      <MemoryRouter initialEntries={["/binders/binder-algebra-foundations?debug=system"]}>
        <Routes>
          <Route path="/binders/:binderId" element={<BinderPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Seed status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Expected version").length).toBeGreaterThan(0);
  });
});
