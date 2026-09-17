// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { buildStudyItem } from "@/services/study-items-service";
import { canonicalFromStudy } from "@/lib/canonical-review";
import { saveQueue } from "@/lib/save-queue";
import { reviewCloudFixture, reviewOwnerA } from "@/test/review-cloud-fixture";
import type { Profile } from "@/types";

const profile: Profile = {
  id: reviewOwnerA,
  email: "student@example.com",
  full_name: "Student One",
  role: "learner",
  created_at: "2026-05-14T12:00:00.000Z",
  updated_at: "2026-05-14T12:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(),
  mathStudyLoopEnabled: false,
  reviewQueueEnabled: false,
}));
vi.mock("@/lib/supabase", () => ({ supabase: mocks }));
let database: ReturnType<typeof reviewCloudFixture>;
function createStudyItem(input: Parameters<typeof buildStudyItem>[0]) {
  const item = buildStudyItem({ ...input, ownerId: reviewOwnerA });
  database.tables.review_items.push({ id: item.id, owner_id: reviewOwnerA, payload: canonicalFromStudy(item), revision: 1 });
  return item;
}

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
    database = reviewCloudFixture(); saveQueue.setAccount(reviewOwnerA);
    mocks.from.mockImplementation(database.from); mocks.rpc.mockImplementation(database.rpc);
    mocks.mathStudyLoopEnabled = false;
    mocks.reviewQueueEnabled = false;
  });

  afterEach(() => {
    cleanup();
    saveQueue.setAccount(null);
    window.localStorage.clear();
  });

  it("hides the Review Queue UI while the beta flag is off", () => {
    renderReviewPage();

    expect(screen.getByText("Review Queue is in beta")).toBeTruthy();
    expect(screen.queryByText("Study Session")).toBeNull();
  });

  it("shows due, upcoming, difficult, mastered, and binder filters when beta is on", async () => {
    mocks.reviewQueueEnabled = true;
    seedReviewItems();

    renderReviewPage();
    await waitFor(() => expect(screen.getAllByText("Derivative formula").length).toBeGreaterThan(0));
    expect(screen.getByTestId("review-page").getAttribute("data-beta-revamp-review-queue")).toBe("true");
    for (const label of ["Due today", "Upcoming", "Difficult", "Mastered", "By binder/course"]) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
    fireEvent.change(screen.getByLabelText("Filter by binder or course"), { target: { value: "binder-calc" } });
    const itemList = within(screen.getByTestId("review-items-list"));
    expect(itemList.getByText("Derivative formula")).toBeTruthy();
    expect(itemList.queryByText("History highlight")).toBeNull();
  });

  it("renders mobile review mode as one card at a time", async () => {
    mocks.reviewQueueEnabled = true;
    seedReviewItems();

    renderReviewPage();
    await screen.findByTestId("review-session-card");
    expect(screen.getByTestId("review-session").getAttribute("data-mobile-review-mode")).toBe("one-card");
    expect(screen.getAllByTestId("review-session-card")).toHaveLength(1);
  });

  it("records ratings and renders a session summary", async () => {
    mocks.reviewQueueEnabled = true;
    seedReviewItems();

    renderReviewPage();
    await screen.findByTestId("review-session-card");
    const session = within(screen.getByTestId("review-session"));
    fireEvent.change(session.getByLabelText("Student response"), {
      target: { value: "A derivative is a local rate of change." },
    });
    fireEvent.click(session.getByRole("button", { name: "Reveal / check" }));
    fireEvent.click(session.getByRole("button", { name: "Hard" }));

    await screen.findByText("Session summary");
    expect(screen.getAllByText("Session summary")).toHaveLength(1);
    expect(screen.getByText("Items reviewed")).toBeTruthy();
    expect(database.tables.review_events).toHaveLength(1);
    expect(JSON.stringify(database.tables.review_events)).not.toContain("local rate of change");
  });

  it("adds a math-specific Review mistakes filter when Math Study Loop is enabled", async () => {
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
    await waitFor(() => expect(screen.getAllByText("Derivative sign mistake").length).toBeGreaterThan(0));
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
