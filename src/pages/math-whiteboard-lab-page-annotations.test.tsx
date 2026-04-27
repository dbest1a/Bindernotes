// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MathWhiteboardLabPage } from "@/pages/math-whiteboard-lab-page";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: {
      id: "user-1",
      email: "learner@example.com",
      full_name: "Learner",
      role: "learner",
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    },
  }),
}));

vi.mock("@/hooks/use-binders", () => ({
  useDashboard: () => ({
    data: {
      folders: [],
      folderBinders: [],
      binders: [],
      lessons: [],
    },
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-math-workspace", () => ({
  useMathWorkspace: () => ({
    state: {
      graphVisible: true,
      graphExpanded: false,
      graphMode: "2d",
      calculatorExpression: "",
      calculatorResult: null,
      calculatorError: null,
      angleMode: "rad",
      history: [],
      savedGraphs: [],
      savedFunctions: [],
      currentGraphState: null,
    },
    setGraphExpanded: vi.fn(),
    setGraphVisible: vi.fn(),
    setGraphMode: vi.fn(),
    savedFunctionMap: {},
    clearCurrentGraph: vi.fn(),
    setCurrentGraphState: vi.fn(),
    setExpression: vi.fn(),
    appendToken: vi.fn(),
    backspace: vi.fn(),
    clearExpression: vi.fn(),
    clearHistory: vi.fn(),
    deleteHistoryItem: vi.fn(),
    evaluate: vi.fn(),
    reuseHistoryExpression: vi.fn(),
    reuseSavedFunction: vi.fn(),
    setAngleMode: vi.fn(),
    deleteSavedFunction: vi.fn(),
    deleteGraphSnapshot: vi.fn(),
    loadGraphSnapshot: vi.fn(),
    saveGraphSnapshot: vi.fn(),
  }),
}));

vi.mock("@/components/whiteboard/whiteboard-module", () => ({
  WhiteboardModule: ({ context }: { context: any }) => (
    <div>
      <span data-testid="highlight-count">{context.highlights.length}</span>
      <span data-testid="comment-count">{context.comments.length}</span>
      <span data-testid="comment-anchor">{context.commentAnchor ?? ""}</span>
      <span data-testid="note-json">{JSON.stringify(context.noteContent)}</span>
      <button
        onClick={() =>
          context.onAddHighlight(
            {
              text: "Derivative definition",
              startOffset: 3,
              endOffset: 24,
              binderId: "binder-jacob-math-notes",
              lessonId: "lesson-jacob-calculus-limits",
            },
            "blue",
          )
        }
        type="button"
      >
        Create highlight
      </button>
      <button onClick={() => context.onPrepareComment("Derivative definition")} type="button">
        Create comment
      </button>
      <button onClick={() => context.onSendSelectionToNotes("Derivative quote")} type="button">
        Send quote to notes
      </button>
    </div>
  ),
}));

function renderLab() {
  return render(
    <MemoryRouter>
      <MathWhiteboardLabPage />
    </MemoryRouter>,
  );
}

describe("MathWhiteboardLabPage annotation handlers", () => {
  afterEach(() => {
    cleanup();
  });

  it("creates highlight records instead of leaving highlight actions as no-ops", async () => {
    renderLab();

    fireEvent.click(screen.getByRole("button", { name: /create highlight/i }));

    await waitFor(() => expect(screen.getByTestId("highlight-count").textContent).toBe("1"));
  });

  it("creates anchored comments instead of leaving comment actions as no-ops", async () => {
    renderLab();

    fireEvent.click(screen.getByRole("button", { name: /create comment/i }));

    await waitFor(() => expect(screen.getByTestId("comment-count").textContent).toBe("1"));
    expect(screen.getByTestId("comment-anchor").textContent).toBe("Derivative definition");
  });

  it("inserts selected source text into whiteboard lab notes", async () => {
    renderLab();

    fireEvent.click(screen.getByRole("button", { name: /send quote to notes/i }));

    await waitFor(() => expect(screen.getByTestId("note-json").textContent).toContain("Derivative quote"));
  });
});
