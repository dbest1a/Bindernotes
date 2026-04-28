// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TutorialEntry } from "@/lib/tutorials/tutorial-registry";

const uploadedDashboardTutorial: TutorialEntry = {
  id: "uploaded-dashboard",
  title: "Uploaded Dashboard Tutorial",
  audience: "all",
  category: "Dashboard",
  routePatterns: ["/dashboard"],
  promptRoutePatterns: ["/dashboard"],
  tags: ["dashboard", "uploaded", "folders"],
  summary: "A real uploaded dashboard tutorial.",
  duration: "1:05",
  durationSeconds: 65,
  videoSrc: "https://example.com/tutorials/dashboard.mp4",
  posterSrc: "/tutorials/posters/bindernotes-tutorial-poster.svg",
  status: "published",
  steps: ["Open Dashboard", "Pick a folder"],
  transcript: "This real uploaded dashboard walkthrough explains folders and recent work.",
  relatedFeatureLink: "/dashboard",
};

const mocks = vi.hoisted(() => ({
  profile: {
    id: "admin-1",
    email: "admin@example.com",
    full_name: "Admin",
    role: "admin",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  },
  uploadedTutorials: [] as TutorialEntry[],
  createUploadedTutorial: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/services/tutorial-service", () => ({
  createUploadedTutorial: mocks.createUploadedTutorial,
  listUploadedTutorials: vi.fn(() => Promise.resolve(mocks.uploadedTutorials)),
  sanitizeTutorialId: (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80),
}));

import { TutorialPage } from "@/pages/tutorial-page";

function renderTutorialPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TutorialPage", () => {
  beforeEach(() => {
    mocks.profile.role = "admin";
    mocks.uploadedTutorials = [];
    mocks.createUploadedTutorial.mockReset();
  });

  afterEach(() => cleanup());

  it("keeps the tutorial library structure but does not show fake generated videos", async () => {
    renderTutorialPage();

    expect(screen.getByText("Learn BinderNotes with quick video walkthroughs")).toBeTruthy();
    expect(screen.getByLabelText("Search tutorials")).toBeTruthy();
    expect(screen.getByTestId("admin-tutorial-creator")).toBeTruthy();
    expect(screen.getByTestId("admin-tutorial-draft-shells")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /upload video/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Featured walkthroughs")).toBeNull();
    expect(screen.queryByText("0:54")).toBeNull();
    expect(screen.queryByRole("button", { name: /open tutorial/i })).toBeNull();
    expect(await screen.findByText("No tutorial videos have been published yet.")).toBeTruthy();
  });

  it("normal users see only published uploaded tutorials and no admin upload controls", async () => {
    mocks.profile.role = "learner";
    renderTutorialPage();

    expect(await screen.findByText("No tutorial videos have been published yet.")).toBeTruthy();
    expect(screen.queryByTestId("admin-tutorial-creator")).toBeNull();
    expect(screen.queryByRole("button", { name: /upload video/i })).toBeNull();
  });

  it("searches draft shells by title, tag, route, and transcript for admins", () => {
    renderTutorialPage();

    fireEvent.change(screen.getByLabelText("Search tutorials"), {
      target: { value: "first click is usually" },
    });

    expect(screen.getByText("Learner Dashboard")).toBeTruthy();
    expect(screen.queryByText("Admin Content Editing")).toBeNull();
  });

  it("filters draft shells by category for admins", () => {
    renderTutorialPage();

    fireEvent.click(screen.getByRole("button", { name: "Math" }));

    expect(screen.getByText("Math Labs Overview")).toBeTruthy();
    expect(screen.queryByText("Admin Studio Overview")).toBeNull();
  });

  it("prefills the upload form from a draft shell", () => {
    renderTutorialPage();

    fireEvent.click(screen.getAllByRole("button", { name: /upload video/i })[1]);

    expect((screen.getByLabelText("Tutorial title") as HTMLInputElement).value).toBe("Learner Dashboard");
    expect((screen.getByLabelText("Tutorial ID") as HTMLInputElement).value).toBe("learner-dashboard");
    expect(screen.getByRole("button", { name: /upload and publish/i })).toBeTruthy();
  });

  it("shows uploaded tutorial durations only when real uploaded media exists", async () => {
    mocks.uploadedTutorials = [uploadedDashboardTutorial];
    renderTutorialPage();

    expect((await screen.findAllByText("Uploaded Dashboard Tutorial")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("1:05").length).toBeGreaterThan(0);
    expect(screen.queryByText("0:54")).toBeNull();
  });

  it("opens a tutorial player modal for a real uploaded tutorial", async () => {
    mocks.uploadedTutorials = [uploadedDashboardTutorial];
    renderTutorialPage();

    await screen.findAllByText("Uploaded Dashboard Tutorial");
    fireEvent.click(screen.getAllByRole("button", { name: /open tutorial/i })[0]);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Transcript")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: /open this feature/i })).toBeTruthy();
  });

  it("searches uploaded tutorials by transcript and feature names", async () => {
    mocks.uploadedTutorials = [uploadedDashboardTutorial];
    renderTutorialPage();

    await screen.findAllByText("Uploaded Dashboard Tutorial");
    fireEvent.change(screen.getByLabelText("Search tutorials"), {
      target: { value: "recent work" },
    });

    await waitFor(() => {
      expect(screen.getAllByText("Uploaded Dashboard Tutorial").length).toBeGreaterThan(0);
    });
  });

  it("keeps tutorials linked to feature routes without demo account language", () => {
    renderTutorialPage();

    expect(screen.getAllByRole("link", { name: /open this feature/i }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/learner demo/i)).toBeNull();
    expect(screen.queryByText(/demo account/i)).toBeNull();
  });
});
