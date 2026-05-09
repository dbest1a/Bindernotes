// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecallLab } from "@/components/workspace/recall-lab";
import type { Binder, BinderLesson, Highlight } from "@/types";

const binder = {
  id: "binder-1",
  title: "Jacob Math Notes",
  subject: "Math",
} as Binder;

const lesson = {
  id: "lesson-1",
  title: "Geometry Language",
} as BinderLesson;

const highlight: Highlight = {
  id: "highlight-1",
  owner_id: "user-1",
  binder_id: "binder-1",
  lesson_id: "lesson-1",
  anchor_text: "A ray has one endpoint and extends in one direction.",
  selected_text: "A ray has one endpoint and extends in one direction.",
  color: "blue",
  note_id: null,
  created_at: "2026-05-09T00:00:00.000Z",
};

const noteContent = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Parallel lines never meet in the same plane." }],
    },
  ],
};

function renderRecallLab(betaEnabled = true) {
  return render(
    <RecallLab
      betaEnabled={betaEnabled}
      binder={binder}
      comments={[{ id: "comment-1", body: "Remember perpendicular means 90 degrees." } as never]}
      highlights={[highlight]}
      lesson={lesson}
      lessons={[lesson]}
      noteContent={noteContent}
      noteTitle="Geometry note"
      onOpenSource={vi.fn()}
      subject="math"
      userId="user-1"
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("RecallLab", () => {
  it("stays unavailable until the beta flag enables it", () => {
    const { container } = renderRecallLab(false);

    expect(screen.getByText("Recall Lab is in beta")).toBeTruthy();
    expect(container.textContent).not.toContain("Generate with AI");
    expect(container.textContent).not.toContain("Ask AI");
  });

  it("starts with a real empty state and no fake cards", () => {
    const { container } = renderRecallLab(true);

    expect(screen.getByText("No recall cards yet")).toBeTruthy();
    expect(container.textContent).toContain(
      "Turn this lesson's highlights, notes, or source passages into cards.",
    );
    expect(container.textContent).not.toContain("Quizlet");
    expect(container.textContent).not.toContain("demo card");
  });

  it("creates a manual draft, requires review, and saves a final card", () => {
    renderRecallLab(true);

    fireEvent.change(screen.getByLabelText(/^Front$/i), { target: { value: "What is a ray?" } });
    fireEvent.change(screen.getByLabelText(/^Back$/i), {
      target: { value: "A line part with one endpoint." },
    });
    fireEvent.click(screen.getByRole("button", { name: /create manual draft/i }));

    const draft = screen.getByText("Draft card").closest("article");
    expect(draft).toBeTruthy();
    expect(within(draft!).getByDisplayValue("What is a ray?")).toBeTruthy();

    fireEvent.click(within(draft!).getByRole("button", { name: /save final card/i }));

    expect(screen.getByText("Card saved to this lesson's source deck.")).toBeTruthy();
    expect(screen.getAllByText("Due today").length).toBeGreaterThan(0);
  });

  it("creates source-linked drafts from selected text, highlights, notes, and sticky notes", () => {
    renderRecallLab(true);

    fireEvent.change(screen.getByLabelText(/selected source text/i), {
      target: { value: "A midpoint divides a segment into two congruent parts." },
    });
    fireEvent.click(screen.getByRole("button", { name: /create from selected text/i }));
    expect(screen.getAllByText("selected text").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /create from highlights/i }));
    expect(screen.getAllByText("highlight").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText(/note excerpt/i), {
      target: { value: "Vertical angles are congruent." },
    });
    fireEvent.click(screen.getByRole("button", { name: /create from private notes/i }));
    expect(screen.getAllByText("note").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /create from sticky notes/i }));
    expect(screen.getAllByText("sticky").length).toBeGreaterThan(0);
  });

  it("updates due counts through ratings and records mistake reasons without automatic deletion", () => {
    renderRecallLab(true);

    fireEvent.change(screen.getByLabelText(/^Front$/i), { target: { value: "What are parallel lines?" } });
    fireEvent.change(screen.getByLabelText(/^Back$/i), {
      target: { value: "Lines in a plane that never meet." },
    });
    fireEvent.click(screen.getByRole("button", { name: /create manual draft/i }));
    fireEvent.click(screen.getByRole("button", { name: /save final card/i }));

    fireEvent.click(screen.getByRole("button", { name: "Again" }));
    expect(screen.getByText("Again recorded. Next due state updated.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mistake review" }));
    fireEvent.change(screen.getByLabelText(/why did you miss this/i), {
      target: { value: "Did not understand source" },
    });
    fireEvent.change(screen.getByLabelText(/short note/i), { target: { value: "Need the diagram." } });
    fireEvent.click(screen.getByRole("button", { name: /record miss/i }));

    expect(screen.getByText("Miss recorded in the Mistake Notebook.")).toBeTruthy();
    expect(screen.getByText("Source gaps").closest(".recall-lab__metric")?.textContent).toContain("1");
  });

  it("shows useful states for practice modes that need more cards", () => {
    renderRecallLab(true);

    fireEvent.change(screen.getByLabelText(/^Front$/i), { target: { value: "Define segment." } });
    fireEvent.change(screen.getByLabelText(/^Back$/i), { target: { value: "Two endpoints and all points between." } });
    fireEvent.click(screen.getByRole("button", { name: /create manual draft/i }));
    fireEvent.click(screen.getByRole("button", { name: /save final card/i }));

    fireEvent.click(screen.getByRole("button", { name: "Multiple choice" }));
    expect(screen.getByText("Add more cards to use this mode.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pair Builder" }));
    expect(screen.getByText("Add more cards to use Pair Builder.")).toBeTruthy();
  });
});
