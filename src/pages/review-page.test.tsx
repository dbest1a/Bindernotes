// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { createStudyItem, listStudyReviewEvents } from "@/services/study-items-service";
import type { Profile } from "@/types";

const profile: Profile = {
  id: "user-1",
  email: "student@example.com",
  full_name: "Student One",
  role: "learner",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  mathStudyLoopEnabled: false,
  reviewQueueEnabled: false,
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ profile }),
}));

vi.mock("@/hooks/use-beta-features", () => ({
  useBetaFeatures: () => ({
    isFeatureEnabled: (key: string) =>
      (key === "betaRevampReviewQueue" && mocks.reviewQueueEnabled) ||
      (key === "betaRevampMathStudyLoop" && mocks.mathStudyLoopEnabled),
  }),
}));

import { ReviewPage } from "@/pages/review-page";

describe("ReviewPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.mathStudyLoopEnabled = false;
    mocks.reviewQueueEnabled = false;
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("hides the Review Queue UI while the beta flag is off", () => {
    renderReviewPage();

    expect(screen.getByText("Review Queue is in beta")).toBeTruthy();
    expect(screen.queryByText("Study Session")).toBeNull();
  });

  it("shows due, upcoming, difficult, mastered, and binder filters when beta is on", () => {
    mocks.reviewQueueEnabled = true;
    seedReviewItems();

    renderReviewPage();

    expect(screen.getByTestId("review-page").getAttribute("data-beta-revamp-review-queue")).toBe("true");
    for (const label of ["Due today", "Upcoming", "Difficult", "Mastered", "By binder/course"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText("Filter by binder or course"), { target: { value: "binder-calc" } });
    const itemList = within(screen.getByTestId("review-items-list"));
    expect(itemList.getByText("Derivative formula")).toBeTruthy();
    expect(itemList.queryByText("History highlight")).toBeNull();
  });

  it("renders mobile review mode as one card at a time", () => {
    mocks.reviewQueueEnabled = true;
    seedReviewItems();

    renderReviewPage();

    expect(screen.getByTestId("review-session").getAttribute("data-mobile-review-mode")).toBe("one-card");
    expect(screen.getAllByTestId("review-session-card")).toHaveLength(1);
  });

  it("records ratings and renders a session summary", () => {
    mocks.reviewQueueEnabled = true;
    seedReviewItems();

    renderReviewPage();

    const session = within(screen.getByTestId("review-session"));
    fireEvent.change(session.getByLabelText("Student response"), {
      target: { value: "A derivative is a local rate of change." },
    });
    fireEvent.click(session.getByRole("button", { name: "Reveal / check" }));
    fireEvent.click(session.getByRole("button", { name: "Hard" }));

    expect(screen.getAllByText("Session summary")).toHaveLength(1);
    expect(screen.getByText("Items reviewed")).toBeTruthy();
    expect(listStudyReviewEvents("user-1")).toHaveLength(1);
    expect(JSON.stringify(listStudyReviewEvents("user-1"))).not.toContain("local rate of change");
  });

  it("adds a math-specific Review mistakes filter when Math Study Loop is enabled", () => {
    mocks.reviewQueueEnabled = true;
    mocks.mathStudyLoopEnabled = true;
    seedReviewItems();
    createStudyItem({
      answer: "Check the sign before simplifying.",
      betaEnabled: true,
      binderId: "binder-calc",
      binderTitle: "Calculus",
      ownerId: "user-1",
      prompt: "Derivative sign mistake",
      sourceKind: "mistake",
      type: "mistake_review",
    });

    renderReviewPage();

    fireEvent.click(screen.getByRole("button", { name: "Review mistakes" }));
    const itemList = within(screen.getByTestId("review-items-list"));
    expect(itemList.getByText("Derivative sign mistake")).toBeTruthy();
    expect(itemList.queryByText("Derivative formula")).toBeNull();
    expect(itemList.queryByText("History highlight")).toBeNull();
  });
});

function renderReviewPage() {
  return render(
    <MemoryRouter>
      <ReviewPage />
    </MemoryRouter>,
  );
}

function seedReviewItems() {
  createStudyItem({
    answer: "Use f prime for instantaneous rate of change.",
    betaEnabled: true,
    binderId: "binder-calc",
    binderTitle: "Calculus",
    ownerId: "user-1",
    prompt: "Derivative formula",
    sourceKind: "formula",
    type: "formula_card",
  });
  createStudyItem({
    answer: "The highlighted claim supports the cause.",
    betaEnabled: true,
    binderId: "binder-history",
    binderTitle: "History",
    ownerId: "user-1",
    prompt: "History highlight",
    sourceKind: "highlight",
    type: "highlight_recall",
  });
}
