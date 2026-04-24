// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SimplePresentationShell } from "@/components/workspace/simple-presentation-shell";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";
import { emptyDoc } from "@/lib/utils";
import type { WorkspaceModuleContext } from "@/components/workspace/workspace-modules";
import type {
  Binder,
  BinderLesson,
  HistoryEventTemplate,
  HistoryMythCheckTemplate,
  HistorySourceTemplate,
  SaveStatusSnapshot,
} from "@/types";

const idleStatus: SaveStatusSnapshot = {
  state: "idle",
  detail: "",
  lastSavedAt: null,
  error: null,
};

afterEach(() => {
  cleanup();
});

const binder: Binder = {
  id: "binder-1",
  owner_id: "admin-1",
  suite_template_id: null,
  title: "Algebra Foundations",
  slug: "algebra-foundations",
  description: "Study algebra.",
  subject: "Math",
  level: "Algebra 1",
  status: "published",
  price_cents: 0,
  cover_url: null,
  pinned: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

const lesson: BinderLesson = {
  id: "lesson-1",
  binder_id: "binder-1",
  title: "Linear Equations",
  order_index: 0,
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Solve equations by keeping both sides balanced." }],
      },
    ],
  },
  math_blocks: [
    {
      id: "formula-1",
      type: "latex",
      label: "Slope formula",
      latex: "m=\\frac{y_2-y_1}{x_2-x_1}",
    },
  ],
  is_preview: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

describe("SimplePresentationShell", () => {
  it("renders a fullscreen-style simple module without canvas controls", () => {
    const preferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      simple: {
        ...createDefaultWorkspacePreferences("user-1", "binder-1").simple,
        showSideNotes: false,
      },
    };

    const { container } = render(
      <MemoryRouter>
        <SimplePresentationShell
          context={createContext()}
          onChange={vi.fn()}
          onOpenSettings={vi.fn()}
          preferences={preferences}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("simple-presentation-shell")).toBeTruthy();
    expect(screen.getByTestId("simple-primary-module")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Workspace home" }).getAttribute("href")).toBe(
      "/dashboard",
    );
    expect(container.querySelector(".workspace-canvas")).toBeNull();
    expect(screen.queryByText(/Drag windows/i)).toBeNull();
  });

  it("renders a history binder in simple presentation mode", () => {
    const context = createContext({
      binder: { ...binder, subject: "History", title: "Rise of Rome" },
      historyEnabled: true,
    });
    const preferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      simple: {
        ...createDefaultWorkspacePreferences("user-1", "binder-1").simple,
        showSideNotes: false,
      },
    };

    render(
      <MemoryRouter>
        <SimplePresentationShell
          context={context}
          onChange={vi.fn()}
          onOpenSettings={vi.fn()}
          preferences={preferences}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Timeline, evidence, interpretation")).toBeTruthy();
    expect(screen.getAllByText("Augustus receives title").length).toBeGreaterThan(0);
  });

  it("renders a math binder in simple presentation mode", () => {
    const preferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      simple: {
        ...createDefaultWorkspacePreferences("user-1", "binder-1").simple,
        showSideNotes: false,
      },
    };

    render(
      <MemoryRouter>
        <SimplePresentationShell
          context={createContext()}
          onChange={vi.fn()}
          onOpenSettings={vi.fn()}
          preferences={preferences}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Formula, graph, notes")).toBeTruthy();
    expect(screen.getAllByText("Slope formula").length).toBeGreaterThan(0);
  });

  it("lets simple view change the study color without opening the settings drawer", () => {
    const onChange = vi.fn();
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");

    render(
      <MemoryRouter>
        <SimplePresentationShell
          context={createContext()}
          onChange={onChange}
          onOpenSettings={vi.fn()}
          preferences={preferences}
        />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Study color theme" }), {
      target: { value: "night-study" },
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        simple: expect.objectContaining({
          theme: "night-study",
        }),
      }),
    );
  });
});

function createContext(options?: {
  binder?: Binder;
  historyEnabled?: boolean;
}): WorkspaceModuleContext {
  const historyEvent: HistoryEventTemplate = {
    id: "event-1",
    suite_template_id: "suite-history",
    binder_id: "binder-1",
    lesson_id: "lesson-1",
    title: "Augustus receives title",
    summary: "Octavian receives the title Augustus.",
    significance: "Rome keeps republican language while power concentrates in one ruler.",
    location_label: "Rome",
    location_lat: null,
    location_lng: null,
    date_label: "27 BC",
    sort_year: -27,
    sort_month: null,
    sort_day: null,
    era: "bce",
    precision: "year",
    approximate: false,
    themes: ["empire"],
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
  const source: HistorySourceTemplate = {
    id: "source-1",
    suite_template_id: "suite-history",
    binder_id: "binder-1",
    lesson_id: "lesson-1",
    title: "Roman political memory",
    source_type: "secondary",
    author: "Historian",
    date_label: "Modern",
    audience: "students",
    purpose: "explain",
    point_of_view: "historical interpretation",
    context_note: "Rome's political forms mattered even as power changed.",
    reliability_note: "Useful synthesis.",
    citation_url: null,
    quote_text: null,
    claim_supports: "Augustus preserved republican forms while holding supreme power.",
    claim_challenges: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
  const myth: HistoryMythCheckTemplate = {
    id: "myth-1",
    suite_template_id: "suite-history",
    binder_id: "binder-1",
    lesson_id: "lesson-1",
    myth_text: "The Republic naturally became the Empire.",
    corrected_claim: "The transition came through conflict, reform crises, and civil war.",
    status: "oversimplification",
    explanation: "Political conflict drove the change.",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };

  return {
    binder: options?.binder ?? binder,
    lessons: [lesson],
    selectedLesson: lesson,
    filteredLessons: [lesson],
    binderNotebookEntries: [],
    binderNotebookSections: [],
    currentNotebookSection: null,
    query: "",
    noteTitle: "",
    noteContent: emptyDoc(),
    noteMath: [],
    commentDraft: "",
    commentAnchor: null,
    comments: [],
    highlights: [],
    defaultHighlightColor: "yellow",
    conceptNodes: [],
    conceptEdges: [],
    stickyLayouts: {},
    mathSuggestions: [],
    isSetupMode: false,
    workspaceStyle: "guided",
    autosaveStatus: "saved",
    highlightStatus: idleStatus,
    noteSaveLabel: "Saved",
    noteSaveDetail: "Saved",
    noteSaveError: null,
    canRetryNoteSave: false,
    noteInsertRequest: null,
    stickyManagerVisible: false,
    hasUnsavedNoteChanges: false,
    history: {
      enabled: Boolean(options?.historyEnabled),
      seedHealthMessage: null,
      templateEvents: options?.historyEnabled ? [historyEvent] : [],
      events: [],
      templateSources: options?.historyEnabled ? [source] : [],
      sources: [],
      evidenceCards: [],
      argumentChains: [],
      argumentNodes: [],
      argumentEdges: [],
      templateMythChecks: options?.historyEnabled ? [myth] : [],
      mythChecks: [],
      activeEventId: "event-1",
      activeSourceId: "source-1",
      status: {
        timeline: idleStatus,
        evidence: idleStatus,
        argument: idleStatus,
        myth: idleStatus,
      },
    },
    onApplyPreset: vi.fn(),
    onEnterNotebookFocus: vi.fn(),
    onSelectLesson: vi.fn(),
    onQueryChange: vi.fn(),
    onNoteTitleChange: vi.fn(),
    onNoteContentChange: vi.fn(),
    onNoteMathChange: vi.fn(),
    onCommentDraftChange: vi.fn(),
    onSaveNoteNow: vi.fn(),
    onRetryNoteSave: vi.fn(),
    onPrepareComment: vi.fn(),
    onClearPreparedComment: vi.fn(),
    onAddComment: vi.fn(),
    onCreateLooseSticky: vi.fn(),
    onToggleStickyManager: vi.fn(),
    onDeleteComment: vi.fn(),
    onUpdateComment: vi.fn(),
    onAddHighlight: vi.fn(),
    onRemoveHighlight: vi.fn(),
    onSaveSelectionAsEvidence: vi.fn(),
    onStickyMove: vi.fn(),
    onSendStickyToNotes: vi.fn(),
    onAcceptMathSuggestion: vi.fn(),
    onGraphMathSuggestion: vi.fn(),
    onDismissMathSuggestion: vi.fn(),
    onSendSelectionToNotes: vi.fn(),
    onCreateQuoteExcerpt: vi.fn(),
    onInsertCallout: vi.fn(),
    onInsertChecklist: vi.fn(),
    onInsertDefinition: vi.fn(),
    onInsertTheorem: vi.fn(),
    onInsertProof: vi.fn(),
    onInsertFormulaReference: vi.fn(),
    onInsertGraphNote: vi.fn(),
    onInsertWorkedExample: vi.fn(),
    onInsertMathBlock: vi.fn(),
    onInsertGraphBlock: vi.fn(),
    onNoteInsertApplied: vi.fn(),
    onJumpToHighlight: vi.fn(),
    onJumpToMathSource: vi.fn(),
    onOpenGraphBlock: vi.fn(),
    onSelectHistoryEvent: vi.fn(),
    onSelectHistorySource: vi.fn(),
    onReplayHistoryTimeline: vi.fn(),
    onCreateHistoryStarterEvent: vi.fn(),
    onCreateHistoryEvidenceFromSource: vi.fn(),
    onUseHistorySourceInArgument: vi.fn(),
    onCreateHistoryStarterChain: vi.fn(),
    onUpdateHistoryArgumentChain: vi.fn(),
    onUseHistoryEvidencePrompt: vi.fn(),
    onCreateHistoryMythCheck: vi.fn(),
  };
}
