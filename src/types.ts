import type { JSONContent } from "@tiptap/react";

export type Role = "admin" | "learner";
export type PublishStatus = "draft" | "published" | "archived";
export type PurchaseStatus = "pending" | "paid" | "refunded" | "comped";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
  updated_at: string;
};

export type Binder = {
  id: string;
  owner_id: string;
  suite_template_id?: string | null;
  title: string;
  slug: string;
  description: string;
  subject: string;
  level: string;
  status: PublishStatus;
  price_cents: number;
  cover_url: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type FolderBinderLink = {
  id: string;
  owner_id: string;
  folder_id: string;
  binder_id: string;
  created_at: string;
  updated_at: string;
};

export type BinderLesson = {
  id: string;
  binder_id: string;
  title: string;
  order_index: number;
  content: JSONContent;
  math_blocks: MathBlock[];
  is_preview: boolean;
  created_at: string;
  updated_at: string;
};

export type Folder = {
  id: string;
  owner_id: string;
  name: string;
  color: string;
  source?: "user" | "system";
  suite_template_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type LearnerNote = {
  id: string;
  owner_id: string;
  binder_id: string;
  lesson_id: string;
  folder_id: string | null;
  title: string;
  content: JSONContent;
  math_blocks: MathBlock[];
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  owner_id: string;
  binder_id: string;
  lesson_id: string;
  anchor_text: string | null;
  body: string;
  parent_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HighlightColor = "yellow" | "blue" | "green" | "pink" | "orange";

export type Highlight = {
  id: string;
  owner_id: string;
  binder_id: string;
  lesson_id: string;
  document_id?: string | null;
  source_version_id?: string | null;
  anchor_text: string;
  selected_text?: string | null;
  prefix_text?: string | null;
  suffix_text?: string | null;
  selector_json?: HighlightSelectorJson | null;
  color: HighlightColor;
  note_id: string | null;
  start_offset?: number | null;
  end_offset?: number | null;
  status?: HighlightStatus;
  reanchor_confidence?: number | null;
  created_at: string;
  updated_at?: string;
};

export type LessonTextSelection = {
  text: string;
  startOffset: number;
  endOffset: number;
  prefixText?: string;
  suffixText?: string;
  blockId?: string | null;
};

export type Enrollment = {
  id: string;
  user_id: string;
  binder_id: string;
  created_at: string;
};

export type Purchase = {
  id: string;
  user_id: string;
  binder_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  amount_cents: number;
  status: PurchaseStatus;
  created_at: string;
};

export type ConceptNode = {
  id: string;
  binder_id: string;
  label: string;
  description: string | null;
  created_at: string;
};

export type ConceptEdge = {
  id: string;
  binder_id: string;
  source_id: string;
  target_id: string;
  label: string | null;
  created_at: string;
};

export type MathBlockMetadata = {
  label?: string;
  description?: string | null;
  sourceHeading?: string | null;
  sourceAnchorId?: string | null;
  topic?: string | null;
};

export type MathBlock =
  | (MathBlockMetadata & {
      id: string;
      type: "latex";
      latex: string;
    })
  | (MathBlockMetadata & {
      id: string;
      type: "graph";
      expressions: string[];
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
    });

export type BinderBundle = {
  binder: Binder;
  lessons: BinderLesson[];
  notes: LearnerNote[];
  comments: Comment[];
  highlights: Highlight[];
  folders: Folder[];
  folderLinks: FolderBinderLink[];
  conceptNodes: ConceptNode[];
  conceptEdges: ConceptEdge[];
  seedHealth?: SeedHealth | null;
};

export type DashboardData = {
  binders: Binder[];
  folders: Folder[];
  folderBinders: FolderBinderLink[];
  notes: LearnerNote[];
  lessons: BinderLesson[];
  recentLessons: BinderLesson[];
  seedHealth: SeedHealth[];
  diagnostics?: WorkspaceDiagnostic[];
};

export type FolderWorkspaceData = {
  folder: Folder;
  binders: Binder[];
  folderBinders: FolderBinderLink[];
  notes: LearnerNote[];
  lessons: BinderLesson[];
  seedHealth?: SeedHealth | null;
};

export type BinderOverviewData = {
  binder: Binder;
  lessons: BinderLesson[];
  notes: LearnerNote[];
  folderLinks: FolderBinderLink[];
  folders: Folder[];
  seedHealth?: SeedHealth | null;
};

export type BinderNotebookEntry = {
  lesson: BinderLesson;
  note: LearnerNote | null;
  excerpt: string;
  wordCount: number;
  mathBlockCount: number;
  updatedAt: string | null;
};

export type BinderNotebookLessonEntry = BinderNotebookEntry & {
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  sectionOrderIndex: number;
};

export type BinderNotebookSection = {
  id: string;
  title: string;
  description: string;
  orderIndex: number;
  excerpt: string;
  noteCount: number;
  totalWords: number;
  totalMathBlocks: number;
  updatedAt: string | null;
  lessons: BinderNotebookLessonEntry[];
};

export type UpsertLessonInput = Pick<
  BinderLesson,
  "id" | "binder_id" | "title" | "order_index" | "content" | "math_blocks" | "is_preview"
>;

export type UpsertBinderInput = Pick<
  Binder,
  | "id"
  | "title"
  | "slug"
  | "description"
  | "subject"
  | "level"
  | "status"
  | "price_cents"
  | "cover_url"
  | "pinned"
>;

export type WorkspaceModuleId =
  | "lesson"
  | "private-notes"
  | "binder-notebook"
  | "history-timeline"
  | "history-evidence"
  | "history-argument"
  | "history-myth-checks"
  | "comments"
  | "lesson-outline"
  | "search"
  | "formula-sheet"
  | "math-blocks"
  | "graph-panel"
  | "desmos-graph"
  | "scientific-calculator"
  | "saved-graphs"
  | "recent-highlights"
  | "tasks"
  | "related-concepts"
  | "flashcards"
  | "mini-tools";

export type WorkspaceZone = "left-rail" | "center-left" | "center-right" | "right-rail" | "bottom";
export type WorkspaceModuleSpan = "auto" | "narrow" | "medium" | "wide" | "full";
export type WorkspaceWindowFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
};

export type StickyNoteTint = "amber" | "mint" | "sky" | "rose" | "violet";
export type StickyNoteLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized?: boolean;
  color: StickyNoteTint;
};

export type WorkspacePresetId =
  | "focused-reading"
  | "notes-focus"
  | "split-study"
  | "math-study"
  | "annotation-mode"
  | "history-guided"
  | "history-timeline-focus"
  | "history-source-evidence"
  | "history-argument-builder"
  | "history-full-studio";

export type WorkspaceStyle = "guided" | "flexible" | "full-studio";
export type WorkspaceMode = "simple" | "modular" | "canvas";
export type WorkspaceBreakpoint = "desktop" | "tablet" | "mobile";
export type WorkspacePresetLockMode = "locked" | "flexible";

export type WorkspaceGridItem = {
  panelId: WorkspaceModuleId;
  panelType: WorkspaceModuleId;
  x: number;
  y: number;
  w: number;
  h: number;
  minW: number;
  minH: number;
  collapsed?: boolean;
};

export type WorkspaceGridLayout = {
  columns: number;
  rowHeight: number;
  gap: number;
  items: WorkspaceGridItem[];
};

export type WorkspacePresetDefinition = {
  id: WorkspacePresetId;
  suiteTemplateId?: string | null;
  title: string;
  description: string;
  style: WorkspaceStyle;
  lockMode: WorkspacePresetLockMode;
  breakpoints: Partial<Record<WorkspaceBreakpoint, WorkspaceGridLayout>>;
  requiredPanels: WorkspaceModuleId[];
};

export type WorkspaceThemeId =
  | "space"
  | "midnight-scholar"
  | "paper-studio"
  | "ocean"
  | "monochrome-pro"
  | "aurora";

export type WorkspaceDensity = "compact" | "cozy";
export type WorkspaceRoundness = "soft" | "round" | "pill";
export type WorkspaceShadow = "quiet" | "lifted" | "glow";
export type WorkspaceFont = "system" | "humanist" | "serif" | "editorial" | "mono";
export type WorkspaceBackgroundStyle = "none" | "subtle-grid" | "graph-paper" | "dot-grid";
export type WorkspaceAnimationLevel = "none" | "subtle" | "full";
export type WorkspaceGraphAppearance = "sync" | "light" | "dark";
export type WorkspaceGraphChrome = "standard" | "focused";
export type WorkspaceVerticalSpace = "fit" | "balanced" | "extended" | "infinite";

export type SimplePresentationTheme =
  | "classic-light"
  | "warm-paper"
  | "night-study"
  | "history-gold"
  | "math-blue"
  | "high-contrast";
export type SimplePresentationFontSize = "small" | "medium" | "large";
export type SimplePresentationReadingWidth = "focused" | "comfortable" | "wide";
export type SimplePresentationMotion = "reduced" | "standard";

export type SimplePresentationSettings = {
  theme: SimplePresentationTheme;
  fontSize: SimplePresentationFontSize;
  readingWidth: SimplePresentationReadingWidth;
  showSideNotes: boolean;
  showProgressBar: boolean;
  showStudyDrawer: boolean;
  accentColor: "history-gold" | "math-blue" | "teal" | "rose";
  motion: SimplePresentationMotion;
  focusMode: boolean;
  highContrast: boolean;
};

export type ModularPanelDensity = "comfortable" | "compact";
export type ModularSidePanelPosition = "left" | "right";

export type ModularStudySettings = {
  selectedPreset: WorkspacePresetId;
  panelDensity: ModularPanelDensity;
  moduleVisibility: Partial<Record<WorkspaceModuleId, boolean>>;
  sidePanelPosition: ModularSidePanelPosition;
  motionLevel: WorkspaceAnimationLevel;
  colorPreset: WorkspaceThemeId;
  saveLayoutPerBinder: boolean;
};

export type FullCanvasSnapBehavior = "off" | "edges" | "modules";

export type FullCanvasSettings = {
  gridSize: number;
  snapBehavior: FullCanvasSnapBehavior;
  panelPositions: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  customModules: WorkspaceModuleId[];
  showDiagnostics: boolean;
};

export type WorkspaceThemeSettings = {
  id: WorkspaceThemeId;
  accent: string;
  density: WorkspaceDensity;
  roundness: WorkspaceRoundness;
  shadow: WorkspaceShadow;
  font: WorkspaceFont;
  backgroundStyle: WorkspaceBackgroundStyle;
  hoverMotion: boolean;
  snapMode: boolean;
  focusMode: boolean;
  compactMode: boolean;
  animationLevel: WorkspaceAnimationLevel;
  graphAppearance: WorkspaceGraphAppearance;
  graphChrome: WorkspaceGraphChrome;
  verticalSpace: WorkspaceVerticalSpace;
  defaultHighlightColor: HighlightColor;
  reducedChrome: boolean;
  showUtilityUi: boolean;
};

export type WorkspacePreferences = {
  version: 1;
  userId: string;
  binderId: string;
  suiteTemplateId?: string | null;
  activeMode: WorkspaceMode;
  simple: SimplePresentationSettings;
  modular: ModularStudySettings;
  canvas: FullCanvasSettings;
  locked: boolean;
  workspaceStyle: WorkspaceStyle;
  styleChoiceCompleted: boolean;
  preset: WorkspacePresetId;
  enabledModules: WorkspaceModuleId[];
  zones: Record<WorkspaceZone, WorkspaceModuleId[]>;
  paneLayout: {
    leftRail: number;
    centerLeft: number;
    centerRight: number;
    rightRail: number;
  };
  moduleLayout: Partial<
    Record<
      WorkspaceModuleId,
      {
        span: WorkspaceModuleSpan;
        collapsed?: boolean;
        pinned?: boolean;
      }
    >
  >;
  windowLayout: Partial<Record<WorkspaceModuleId, WorkspaceWindowFrame>>;
  stickyNotes: Record<string, StickyNoteLayout>;
  viewportFit?: {
    width: number;
    height: number;
    updatedAt: string;
  };
  theme: WorkspaceThemeSettings;
  updatedAt: string;
};

export type SeedHealthStatus = "healthy" | "missing" | "stale";

export type SeedHealth = {
  suiteTemplateId: string;
  suiteSlug: string;
  suiteTitle: string;
  status: SeedHealthStatus;
  expectedVersion: string;
  actualVersion: string | null;
  message: string;
  missingBinders?: string[];
};

export type WorkspaceDiagnosticSeverity = "info" | "warning" | "error";

export type WorkspaceDiagnosticCode =
  | "missing_table"
  | "missing_column"
  | "missing_suite_template"
  | "missing_seed_version"
  | "missing_workspace_preset"
  | "missing_public_binder"
  | "missing_folder"
  | "missing_lessons"
  | "rls_denied"
  | "env_mismatch"
  | "query_failed";

export type WorkspaceDiagnostic = {
  code: WorkspaceDiagnosticCode;
  scope: string;
  severity: WorkspaceDiagnosticSeverity;
  title: string;
  message: string;
  detail?: string | null;
  hint?: string | null;
};

export type SuiteTemplateStatus = "draft" | "published" | "archived";

export type SuiteTemplate = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  description: string;
  folder_title: string;
  history_mode: boolean;
  default_preset_id: WorkspacePresetId;
  status: SuiteTemplateStatus;
  created_at: string;
  updated_at: string;
};

export type SeedVersion = {
  id: string;
  suite_template_id: string;
  version: string;
  checksum: string;
  seeded_at: string;
  created_by: string | null;
  status: "pending" | "current" | "failed";
};

export type HighlightSelectorTextQuote = {
  type: "TextQuoteSelector";
  exact: string;
  prefix?: string;
  suffix?: string;
};

export type HighlightSelectorTextPosition = {
  type: "TextPositionSelector";
  start: number;
  end: number;
};

export type HighlightSelectorBlock = {
  type: "BlockSelector";
  blockId: string;
  start?: number;
  end?: number;
};

export type HighlightSelectorJson =
  | HighlightSelectorTextQuote
  | HighlightSelectorTextPosition
  | HighlightSelectorBlock
  | {
      selectors: Array<HighlightSelectorTextQuote | HighlightSelectorTextPosition | HighlightSelectorBlock>;
    };

export type HighlightStatus = "active" | "needs_review" | "deleted";

export type SaveEntityType =
  | "highlight"
  | "workspace_layout"
  | "history_event"
  | "history_source"
  | "history_evidence"
  | "history_argument"
  | "myth_check";

export type SaveStatusState =
  | "idle"
  | "saving"
  | "saved"
  | "offline"
  | "retrying"
  | "failed"
  | "conflict";

export type SaveStatusSnapshot = {
  state: SaveStatusState;
  detail: string;
  lastSavedAt: string | null;
  error: string | null;
};

export type HistoryDateEra = "bce" | "ce";
export type HistoryDatePrecision = "year" | "month" | "day" | "season" | "approximate";
export type HistoryEvidenceStrength = "emerging" | "supported" | "strong";
export type HistorySourceType = "primary" | "secondary";
export type MythHistoryStatus =
  | "myth"
  | "oversimplification"
  | "contested"
  | "evidence_supported";
export type HistoryArgumentRelationType =
  | "caused"
  | "triggered"
  | "contributed_to"
  | "responded_to"
  | "contradicted"
  | "supported"
  | "weakened"
  | "strengthened"
  | "continued"
  | "changed";

export type HistoryEventTemplate = {
  id: string;
  suite_template_id: string;
  binder_id: string;
  lesson_id: string | null;
  title: string;
  summary: string;
  significance: string;
  location_label: string | null;
  location_lat: number | null;
  location_lng: number | null;
  date_label: string;
  sort_year: number;
  sort_month: number | null;
  sort_day: number | null;
  era: HistoryDateEra;
  precision: HistoryDatePrecision;
  approximate: boolean;
  themes: string[];
  created_at: string;
  updated_at: string;
};

export type HistorySourceTemplate = {
  id: string;
  suite_template_id: string;
  binder_id: string;
  lesson_id: string | null;
  title: string;
  source_type: HistorySourceType;
  author: string | null;
  date_label: string;
  audience: string | null;
  purpose: string | null;
  point_of_view: string | null;
  context_note: string | null;
  reliability_note: string | null;
  citation_url: string | null;
  quote_text: string | null;
  claim_supports: string | null;
  claim_challenges: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoryMythCheckTemplate = {
  id: string;
  suite_template_id: string;
  binder_id: string;
  lesson_id: string | null;
  myth_text: string;
  corrected_claim: string;
  status: MythHistoryStatus;
  explanation: string;
  created_at: string;
  updated_at: string;
};

export type HistoryEvent = Omit<HistoryEventTemplate, "suite_template_id"> & {
  owner_id: string;
  template_event_id: string | null;
  status: "active" | "archived";
};

export type HistorySource = Omit<HistorySourceTemplate, "suite_template_id"> & {
  owner_id: string;
  template_source_id: string | null;
};

export type HistoryEvidenceCard = {
  id: string;
  owner_id: string;
  binder_id: string;
  lesson_id: string | null;
  source_id: string | null;
  highlight_id: string | null;
  quote_text: string | null;
  paraphrase: string | null;
  claim_supports: string | null;
  claim_challenges: string | null;
  evidence_strength: HistoryEvidenceStrength;
  source_snapshot_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type HistoryArgumentChain = {
  id: string;
  owner_id: string;
  binder_id: string;
  lesson_id: string | null;
  prompt: string;
  thesis: string;
  context: string;
  counterargument: string;
  conclusion: string;
  created_at: string;
  updated_at: string;
};

export type HistoryArgumentNode = {
  id: string;
  chain_id: string;
  owner_id: string;
  node_type: "prompt" | "thesis" | "context" | "cause" | "effect" | "counterargument" | "conclusion" | "evidence";
  title: string;
  body: string;
  sort_order: number;
  event_id: string | null;
  source_id: string | null;
  evidence_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoryArgumentEdge = {
  id: string;
  chain_id: string;
  owner_id: string;
  from_node_id: string;
  to_node_id: string;
  relation_type: HistoryArgumentRelationType;
  strength: number;
  explanation: string;
  source_id: string | null;
  evidence_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoryMythCheck = Omit<HistoryMythCheckTemplate, "suite_template_id"> & {
  owner_id: string;
  template_myth_check_id: string | null;
};

export type HistoryTimelineEvent = HistoryEventTemplate & {
  evidenceCount: number;
  sourceCount: number;
  causes: string[];
  effects: string[];
};

export type HistorySuiteData = {
  suite: SuiteTemplate | null;
  seedHealth: SeedHealth | null;
  templateEvents: HistoryEventTemplate[];
  templateSources: HistorySourceTemplate[];
  templateMythChecks: HistoryMythCheckTemplate[];
  events: HistoryEvent[];
  sources: HistorySource[];
  evidenceCards: HistoryEvidenceCard[];
  argumentChains: HistoryArgumentChain[];
  argumentNodes: HistoryArgumentNode[];
  argumentEdges: HistoryArgumentEdge[];
  mythChecks: HistoryMythCheck[];
};
