// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LearningAcceleratorsModule } from "@/components/workspace/learning-accelerators";
import { defaultBetaFeaturesPreference } from "@/lib/beta-features";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";

const lessonContent = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Quadratic structure" }] },
    { type: "paragraph", content: [{ type: "text", text: "Factored form reveals zeros." }] },
  ],
};

function renderModule(featureOverrides: Partial<typeof defaultBetaFeaturesPreference> = {}) {
  const context = {
    ownerId: "user-1",
    binder: {
      id: "binder-1",
      title: "Jacob Math Notes",
      subject: "Math",
    },
    selectedLesson: {
      id: "lesson-1",
      binder_id: "binder-1",
      title: "Polynomials and Trinomials",
      order_index: 1,
      content: lessonContent,
      math_blocks: [
        {
          id: "formula-1",
          type: "latex",
          latex: "(x+2)(x+3)",
          label: "Factoring model",
        },
      ],
      is_preview: false,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    },
    lessons: [],
    noteTitle: "Polynomial notes",
    noteContent: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "I need to connect zeros to graph crossings." }] }],
    },
    noteMath: [],
    highlights: [
      {
        id: "highlight-1",
        owner_id: "user-1",
        binder_id: "binder-1",
        lesson_id: "lesson-1",
        anchor_text: "Factored form reveals zeros.",
        color: "blue",
        note_id: null,
        created_at: "2026-05-24T00:00:00.000Z",
      },
    ],
    conceptNodes: [{ id: "concept-1", binder_id: "binder-1", label: "Zeros", description: null, created_at: "" }],
    conceptEdges: [],
    onOpenWorkspaceTool: () => undefined,
  } as unknown as WorkspaceModuleContext;

  return render(
    <LearningAcceleratorsModule
      context={context}
      featureFlags={{
        ...defaultBetaFeaturesPreference,
        enabled: true,
        ...featureOverrides,
      }}
    />,
  );
}

describe("LearningAcceleratorsModule", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders only the enabled non-AI accelerator cards", () => {
    renderModule({ transferForge: true, evidenceLock: true, oneMinuteLab: true });

    expect(screen.getByText("Learning Accelerators")).toBeTruthy();
    expect(screen.getAllByText("Transfer Forge").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence Lock").length).toBeGreaterThan(0);
    expect(screen.getAllByText("One-Minute Lab").length).toBeGreaterThan(0);
    expect(screen.queryByText("Misstep Museum")).toBeNull();
    expect(screen.queryByText(/OpenAI|API/i)).toBeNull();
  });

  it("shows a calm disabled state when no accelerator flag is enabled", () => {
    renderModule();

    expect(screen.getByText("Turn on one Learning Accelerator beta to start.")).toBeTruthy();
  });

  it("lets students switch cards without mounting every interaction as a separate heavy surface", () => {
    renderModule({ transferForge: true, misstepMuseum: true });

    expect(screen.getByTestId("learning-accelerator-active-card").textContent).toContain("Transfer Forge");

    fireEvent.click(screen.getByRole("button", { name: /open misstep museum/i }));

    expect(screen.getByTestId("learning-accelerator-active-card").textContent).toContain("Misstep Museum");
  });
});
