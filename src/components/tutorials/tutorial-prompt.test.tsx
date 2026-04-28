// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TutorialPromptHost } from "@/components/tutorials/tutorial-prompt";
import { tutorialPromptPreferenceStorageKey } from "@/lib/tutorials/tutorial-preferences";
import { tutorialSeenStorageKey, type TutorialEntry } from "@/lib/tutorials/tutorial-registry";

function uploadedTutorial(overrides: Partial<TutorialEntry>): TutorialEntry {
  return {
    id: "learner-dashboard",
    title: "Learner Dashboard",
    audience: "learner",
    category: "Dashboard",
    routePatterns: ["/dashboard"],
    promptRoutePatterns: ["/dashboard"],
    tags: ["dashboard"],
    summary: "Real uploaded tutorial.",
    duration: "0:31",
    durationSeconds: 31,
    videoSrc: "https://example.com/tutorial.mp4",
    posterSrc: "/tutorials/posters/bindernotes-tutorial-poster.svg",
    status: "published",
    steps: ["Open Dashboard"],
    transcript: "Uploaded tutorial.",
    relatedFeatureLink: "/dashboard",
    ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  profile: {
    id: "user-1",
    email: "learner@example.com",
    full_name: "Learner",
    role: "learner" as "admin" | "learner",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  uploadedTutorials: [] as TutorialEntry[],
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: mocks.profile,
  }),
}));

vi.mock("@/services/tutorial-service", () => ({
  listUploadedTutorials: vi.fn(() => Promise.resolve(mocks.uploadedTutorials)),
}));

function renderPrompt(pathname: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[pathname]}>
        <TutorialPromptHost delayMs={0} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TutorialPromptHost", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.profile.role = "learner";
    mocks.profile.created_at = new Date().toISOString();
    mocks.uploadedTutorials = [
      uploadedTutorial({}),
      uploadedTutorial({
        id: "admin-dashboard",
        title: "Admin Dashboard",
        audience: "admin",
        promptRoutePatterns: ["/dashboard"],
      }),
      uploadedTutorial({
        id: "whiteboard-board-mode",
        title: "Whiteboard And Board Mode",
        audience: "all",
        promptRoutePatterns: ["/math/lab/whiteboard"],
      }),
      uploadedTutorial({
        id: "math-labs-overview",
        title: "Math Labs Overview",
        audience: "all",
        promptRoutePatterns: ["/math/lab"],
      }),
    ];
  });

  afterEach(() => cleanup());

  it("shows a published uploaded learner dashboard tutorial on first dashboard visit", async () => {
    renderPrompt("/dashboard");

    expect(await screen.findByTestId("tutorial-prompt")).toBeTruthy();
    expect(screen.getByText("Learner Dashboard")).toBeTruthy();
  });

  it("does not show a prompt when no matching uploaded tutorial exists", async () => {
    mocks.uploadedTutorials = [];
    renderPrompt("/dashboard");

    await waitFor(() => {
      expect(screen.queryByTestId("tutorial-prompt")).toBeNull();
    });
  });

  it("shows the admin dashboard tutorial for admin users", async () => {
    mocks.profile.role = "admin";
    renderPrompt("/dashboard");

    expect(await screen.findByTestId("tutorial-prompt")).toBeTruthy();
    expect(screen.getByText("Admin Dashboard")).toBeTruthy();
  });

  it("does not show a prompt after a tutorial is marked seen", async () => {
    window.localStorage.setItem(tutorialSeenStorageKey("learner-dashboard"), "true");
    renderPrompt("/dashboard");

    await waitFor(() => {
      expect(screen.queryByTestId("tutorial-prompt")).toBeNull();
    });
  });

  it("keeps tutorial prompts off by default for established accounts", async () => {
    mocks.profile.created_at = "2020-01-01T00:00:00.000Z";

    renderPrompt("/dashboard");

    await waitFor(() => {
      expect(screen.queryByTestId("tutorial-prompt")).toBeNull();
    });
  });

  it("shows prompts for established accounts when the user turns tutorials on", async () => {
    mocks.profile.created_at = "2020-01-01T00:00:00.000Z";
    window.localStorage.setItem(
      tutorialPromptPreferenceStorageKey("user-1"),
      JSON.stringify({ promptsEnabled: true }),
    );

    renderPrompt("/dashboard");

    expect(await screen.findByTestId("tutorial-prompt")).toBeTruthy();
  });

  it("does not show a prompt on the Tutorials page", async () => {
    renderPrompt("/tutorial");

    await waitFor(() => {
      expect(screen.queryByTestId("tutorial-prompt")).toBeNull();
    });
  });

  it("opens the video modal and marks the tutorial seen when Watch tutorial is clicked", async () => {
    renderPrompt("/math/lab/whiteboard");

    expect(await screen.findByText("Whiteboard And Board Mode")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /watch tutorial/i }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(window.localStorage.getItem(tutorialSeenStorageKey("whiteboard-board-mode"))).toBe("true");
  });

  it("links to the full Tutorials page from the prompt", async () => {
    renderPrompt("/math/lab");

    expect(await screen.findByTestId("tutorial-prompt")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View all tutorials" }).getAttribute("href")).toBe("/tutorial");
  });
});
