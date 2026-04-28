export type TutorialCategory =
  | "Getting Started"
  | "Dashboard"
  | "Workspace"
  | "Notes"
  | "Whiteboard"
  | "Math"
  | "History"
  | "Admin"
  | "Settings";

export type TutorialStatus = "draft" | "published" | "archived";

export type TutorialEntry = {
  id: string;
  title: string;
  audience?: "admin" | "learner" | "all";
  category: TutorialCategory;
  routePatterns: string[];
  promptRoutePatterns?: string[];
  tags: string[];
  summary: string;
  duration: string;
  durationSeconds?: number;
  videoSrc: string;
  posterSrc: string;
  status?: TutorialStatus;
  steps: string[];
  transcript: string;
  relatedFeatureLink: string;
};

export const tutorialCategories: TutorialCategory[] = [
  "Getting Started",
  "Dashboard",
  "Workspace",
  "Notes",
  "Whiteboard",
  "Math",
  "History",
  "Admin",
  "Settings",
];

const posterSrc = "/tutorials/posters/bindernotes-tutorial-poster.svg";

function videoSrc(_id: string) {
  return "";
}

export const tutorialSeenStorageKey = (tutorialId: string) =>
  `bindernotes:tutorial-seen:v1:${tutorialId}`;

export const tutorials: TutorialEntry[] = [
  {
    id: "welcome-overview",
    title: "Welcome to BinderNotes",
    category: "Getting Started",
    routePatterns: ["/dashboard", "/tutorial"],
    tags: ["overview", "start", "workspace", "study flow"],
    summary: "A quick tour of how BinderNotes keeps lessons, notes, tools, and tutorials together.",
    duration: "",
    videoSrc: videoSrc("welcome-overview"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Start at the dashboard.", "Open a binder or recent lesson.", "Use tutorials whenever a page feels new."],
    transcript:
      "BinderNotes keeps your source lesson, private thinking, and study tools in one calm workspace. Start at the dashboard, open a binder, choose the view that fits the task, and use tutorials any time you want a quick reset.",
  },
  {
    id: "learner-dashboard",
    title: "Learner Dashboard",
    audience: "learner",
    category: "Dashboard",
    routePatterns: ["/dashboard"],
    promptRoutePatterns: ["/dashboard"],
    tags: ["dashboard", "folders", "binders", "recent work", "continue studying"],
    summary: "Find folders, binders, recent work, and the fastest path back into studying.",
    duration: "",
    videoSrc: videoSrc("learner-dashboard"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Use folders to group binders.", "Open recent work to continue.", "Use Tutorial when a page is unfamiliar."],
    transcript:
      "The dashboard is home base. Open folders, jump into binders, continue recent work, and return to tutorials when you need help. The first click is usually the binder or lesson you were already studying.",
  },
  {
    id: "admin-dashboard",
    title: "Admin Dashboard",
    audience: "admin",
    category: "Dashboard",
    routePatterns: ["/dashboard"],
    promptRoutePatterns: ["/dashboard"],
    tags: ["admin dashboard", "admin ui", "dashboard makeover", "folders", "binder management"],
    summary: "Understand the admin version of the dashboard, including admin-only controls and management views.",
    duration: "",
    videoSrc: videoSrc("admin-dashboard"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Open Dashboard as an admin.", "Use the admin-specific dashboard controls.", "Jump into Admin Studio when content needs editing."],
    transcript:
      "Admins see a different dashboard experience from learners. Use the admin dashboard to review binder organization, management signals, and admin-only shortcuts before moving into Admin Studio for content work.",
  },
  {
    id: "binder-folders",
    title: "Binder Folders",
    category: "Dashboard",
    routePatterns: ["/folders/:folderId", "/dashboard"],
    promptRoutePatterns: ["/folders/:folderId"],
    tags: ["folder", "binder folders", "organization", "courses"],
    summary: "Use folder pages to keep courses and study sets organized.",
    duration: "",
    videoSrc: videoSrc("binder-folders"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Open a folder from Dashboard.", "Pick the binder you need.", "Return to Dashboard when switching subjects."],
    transcript:
      "Folders collect related binders so subjects stay clean. Open a folder, choose a binder, and move into the lesson workspace when you are ready to study.",
  },
  {
    id: "binder-reader-workspace",
    title: "Binder Reader And Lesson Workspace",
    category: "Workspace",
    routePatterns: ["/binders/:binderId/documents/:lessonId", "/binders/:binderId"],
    promptRoutePatterns: ["/binders/:binderId/documents/:lessonId", "/binders/:binderId"],
    tags: ["lesson", "reader", "workspace", "source lesson", "study panels"],
    summary: "Understand the lesson reader, workspace modes, and how the main study surface is organized.",
    duration: "",
    videoSrc: videoSrc("binder-reader-workspace"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Read the source lesson first.", "Choose Simple, Split Study, or Canvas.", "Open tools only when they help."],
    transcript:
      "The binder reader puts the source lesson at the center. Choose a calmer reading mode, Split Study for notes beside the source, or Canvas when you need movable tools.",
  },
  {
    id: "split-study",
    title: "Split Study",
    category: "Workspace",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["split study", "source lesson", "private notes", "two pane"],
    summary: "Read on one side and write private notes on the other.",
    duration: "",
    videoSrc: videoSrc("split-study"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose Split Study.", "Read the source on the left.", "Write your explanation on the notes side."],
    transcript:
      "Split Study is the clean two-panel view. Keep the lesson on one side, type your private explanation on the other, and let notes autosave while you work.",
  },
  {
    id: "canvas-workspace-presets",
    title: "Canvas And Workspace Presets",
    category: "Workspace",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["canvas", "presets", "fit", "tidy", "workspace"],
    summary: "Use presets to switch between reading, math, history, and full canvas layouts.",
    duration: "",
    videoSrc: videoSrc("canvas-workspace-presets"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Open workspace settings.", "Choose a preset.", "Use Fit or Tidy only when you want the layout rebuilt."],
    transcript:
      "Presets are starting points. Canvas gives movable modules, Fit brings the current layout into view, and Tidy rebuilds a clean preset only when you ask for it.",
  },
  {
    id: "edit-layout",
    title: "Edit Layout Mode",
    category: "Workspace",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["edit layout", "drag", "resize", "save layout", "cancel", "reset"],
    summary: "Drag, resize, save, cancel, and reset modules without losing your layout.",
    duration: "",
    videoSrc: videoSrc("edit-layout"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Click Edit Layout.", "Drag or resize one module.", "Save, Cancel, or Reset to preset intentionally."],
    transcript:
      "Edit Layout unlocks the workspace. Move one module at a time, resize it until it fits, then save. Cancel restores the old layout. Reset to preset only runs when you click it.",
  },
  {
    id: "private-notes",
    title: "Private Notes",
    category: "Notes",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["notes", "private notes", "autosave", "writing"],
    summary: "Write lesson-specific notes that stay tied to your account and lesson.",
    duration: "",
    videoSrc: videoSrc("private-notes"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Click into Private Notes.", "Write the idea in your own words.", "Use Save now if you want an immediate save."],
    transcript:
      "Private Notes are yours. Type your explanation, let autosave work in the background, and come back later to the same note for the same lesson.",
  },
  {
    id: "notebook-focus",
    title: "Notebook Focus",
    category: "Notes",
    routePatterns: ["/binders/:binderId/documents/:lessonId", "/binders/:binderId"],
    tags: ["notebook", "binder notebook", "notes review", "focus"],
    summary: "Use the binder notebook module to review notes across a binder.",
    duration: "",
    videoSrc: videoSrc("notebook-focus"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Open the binder notebook module.", "Scan lesson notes together.", "Jump back to the lesson that needs work."],
    transcript:
      "Notebook focus collects your thinking across the binder. Use it to review what you wrote, find gaps, and return to a lesson when a note needs more work.",
  },
  {
    id: "settings-search",
    title: "Settings And Settings Search",
    category: "Settings",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["settings", "search", "snap", "safe edge", "theme", "mobile"],
    summary: "Find workspace settings quickly without hunting through every folder.",
    duration: "",
    videoSrc: videoSrc("settings-search"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Open Settings.", "Search words like snap, graph, header, mobile, or color.", "Expand only the folder you need."],
    transcript:
      "Settings search is the fastest path. Search for snap, graph, header, mobile, color, or fit, then adjust the exact control without scanning the whole menu.",
  },
  {
    id: "maximize-module-space",
    title: "Maximize Module Space",
    category: "Settings",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["maximize module space", "compact headers", "module display", "space"],
    summary: "Give lesson modules more room by reducing extra chrome and header space.",
    duration: "",
    videoSrc: videoSrc("maximize-module-space"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Open Settings.", "Search maximize or compact.", "Toggle Maximize Module Space on or off."],
    transcript:
      "Maximize Module Space keeps the same tools but gives the working area more room. Turn it on for focused work or off when you prefer larger headers and detail panels.",
  },
  {
    id: "whiteboard-board-mode",
    title: "Whiteboard And Board Mode",
    category: "Whiteboard",
    routePatterns: ["/math/lab/whiteboard", "/binders/:binderId/documents/:lessonId"],
    promptRoutePatterns: ["/math/lab/whiteboard"],
    tags: ["whiteboard", "board mode", "drawing", "pan", "zoom", "save"],
    summary: "Draw, pan, zoom, place modules, and keep board work saved.",
    duration: "",
    videoSrc: videoSrc("whiteboard-board-mode"),
    posterSrc,
    relatedFeatureLink: "/math/lab/whiteboard",
    steps: ["Open Whiteboard Lab.", "Draw or pan around the board.", "Add study modules only when needed."],
    transcript:
      "The whiteboard is a free drawing and thinking space. Use tools to sketch, pan and zoom the board, pin modules when useful, and return to the binder when you are done.",
  },
  {
    id: "desmos-graph",
    title: "Desmos Graph Module",
    category: "Math",
    routePatterns: ["/math/lab", "/math/modules/:moduleSlug", "/binders/:binderId/documents/:lessonId", "/math/lab/whiteboard"],
    tags: ["desmos", "graph", "2d", "3d", "math graph lab"],
    summary: "Use the live graph module for expressions, graph states, and math exploration.",
    duration: "",
    videoSrc: videoSrc("desmos-graph"),
    posterSrc,
    relatedFeatureLink: "/math/lab",
    steps: ["Mount the graph.", "Switch 2D or 3D when available.", "Save graph states when you need them later."],
    transcript:
      "The Desmos graph module is live when opened. Mount it, switch graph mode if needed, send expressions from math tools, and save graph states for later review.",
  },
  {
    id: "scientific-calculator",
    title: "Scientific Calculator",
    category: "Math",
    routePatterns: ["/math/lab", "/binders/:binderId/documents/:lessonId"],
    tags: ["calculator", "scientific calculator", "functions", "send to graph"],
    summary: "Calculate, reuse expressions, and send graphable expressions into Desmos.",
    duration: "",
    videoSrc: videoSrc("scientific-calculator"),
    posterSrc,
    relatedFeatureLink: "/math/lab",
    steps: ["Enter an expression.", "Evaluate or reuse history.", "Send graphable expressions to Desmos."],
    transcript:
      "The scientific calculator handles quick numeric work. Use history to reuse steps, save functions, and send graphable expressions into the graph when you need a visual.",
  },
  {
    id: "formula-sheet",
    title: "Formula Sheet",
    category: "Math",
    routePatterns: ["/binders/:binderId/documents/:lessonId", "/math/lab"],
    tags: ["formula", "formula sheet", "reference", "math"],
    summary: "Keep important formulas visible without crowding the lesson.",
    duration: "",
    videoSrc: videoSrc("formula-sheet"),
    posterSrc,
    relatedFeatureLink: "/math/lab",
    steps: ["Open a math preset.", "Keep formulas near the graph or lesson.", "Collapse the sheet when it is not needed."],
    transcript:
      "Formula Sheet is a reference surface. Keep important equations close to the lesson or graph, then collapse it when you want more writing room.",
  },
  {
    id: "saved-graphs",
    title: "Saved Graphs",
    category: "Math",
    routePatterns: ["/math/lab", "/binders/:binderId/documents/:lessonId"],
    tags: ["saved graphs", "graph state", "snapshots", "desmos"],
    summary: "Name graph snapshots and reload them during later study sessions.",
    duration: "",
    videoSrc: videoSrc("saved-graphs"),
    posterSrc,
    relatedFeatureLink: "/math/lab",
    steps: ["Create a graph.", "Name the snapshot.", "Reload or delete saved states as your work changes."],
    transcript:
      "Saved Graphs lets you keep named graph states. Save a useful setup, reload it later, and keep lesson graph references close while studying.",
  },
  {
    id: "math-labs-overview",
    title: "Math Labs Overview",
    category: "Math",
    routePatterns: ["/math", "/math/lab"],
    promptRoutePatterns: ["/math", "/math/lab"],
    tags: ["math lab", "math labs", "modules", "questions", "quizzes", "whiteboard"],
    summary: "Tour the math hub, graph lab, modules, questions, quizzes, and whiteboard lab.",
    duration: "",
    videoSrc: videoSrc("math-labs-overview"),
    posterSrc,
    relatedFeatureLink: "/math/lab",
    steps: ["Open Math lab.", "Choose graphing, modules, questions, or whiteboard.", "Use the tool that matches the work."],
    transcript:
      "Math Labs collects graphing, calculator work, guided modules, question banks, quizzes, and the whiteboard lab. Start with the tool that matches the problem in front of you.",
  },
  {
    id: "math-courses-modules-quizzes",
    title: "Math Courses, Modules, Questions, And Quizzes",
    category: "Math",
    routePatterns: [
      "/math",
      "/math/courses/:courseSlug",
      "/math/modules",
      "/math/modules/:moduleSlug",
      "/math/questions",
      "/math/quizzes/:quizId",
      "/math/quizzes/:quizId/attempt",
      "/math/quizzes/:quizId/results/:attemptId",
    ],
    promptRoutePatterns: ["/math/courses/:courseSlug", "/math/modules", "/math/modules/:moduleSlug", "/math/questions", "/math/quizzes/:quizId"],
    tags: ["courses", "modules", "questions", "quizzes", "practice"],
    summary: "Navigate the structured math learning flow from modules to practice.",
    duration: "",
    videoSrc: videoSrc("math-courses-modules-quizzes"),
    posterSrc,
    relatedFeatureLink: "/math/modules",
    steps: ["Open a math course or module.", "Use questions for practice.", "Review quiz results to choose what to study next."],
    transcript:
      "The structured math area moves from courses to modules, questions, quizzes, and results. Use modules to learn, questions to practice, and results to decide what needs another pass.",
  },
  {
    id: "math-graph-lab",
    title: "Math Graph Lab",
    category: "Math",
    routePatterns: ["/binders/:binderId/documents/:lessonId", "/math/lab"],
    tags: ["math graph lab", "desmos", "formula sheet", "graph dominant"],
    summary: "Use Desmos as the main work surface with formulas and notes nearby.",
    duration: "",
    videoSrc: videoSrc("math-graph-lab"),
    posterSrc,
    relatedFeatureLink: "/math/lab",
    steps: ["Choose Math Graph Lab.", "Keep the graph dominant.", "Use formulas and notes as support panels."],
    transcript:
      "Math Graph Lab makes the graph the main surface. Keep formulas and notes close, then use the graph to test behavior while the lesson stays nearby.",
  },
  {
    id: "math-guided-study",
    title: "Math Guided Study",
    category: "Math",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["math guided study", "math blocks", "lesson", "notes"],
    summary: "Study math with the lesson, notes, worked blocks, and graph support arranged by priority.",
    duration: "",
    videoSrc: videoSrc("math-guided-study"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose Math Guided Study.", "Read the lesson and worked blocks.", "Use graph support only when it clarifies the concept."],
    transcript:
      "Math Guided Study keeps the lesson, notes, worked math blocks, and graph support in a calmer learning order so you can understand before you explore.",
  },
  {
    id: "math-practice-mode",
    title: "Math Practice Mode",
    category: "Math",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["math practice mode", "whiteboard", "scratch work", "formula sheet"],
    summary: "Use a large whiteboard and math references for solving problems.",
    duration: "",
    videoSrc: videoSrc("math-practice-mode"),
    posterSrc,
    relatedFeatureLink: "/math/lab/whiteboard",
    steps: ["Choose Math Practice Mode.", "Use the whiteboard for scratch work.", "Keep formulas and notes nearby."],
    transcript:
      "Math Practice Mode gives scratch work real space. Use the whiteboard to solve, keep formulas nearby, and bring graph or calculator tools in only when the problem calls for them.",
  },
  {
    id: "history-guided",
    title: "History Guided",
    category: "History",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["history guided", "source", "timeline", "evidence", "notes"],
    summary: "Study history through source reading, chronology, evidence, and notes.",
    duration: "",
    videoSrc: videoSrc("history-guided"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose History Guided.", "Read the source.", "Connect timeline events and evidence to your notes."],
    transcript:
      "History Guided keeps source, timeline, evidence, and notes in a calm loop. Read the source, anchor the moment in time, and collect evidence before writing an argument.",
  },
  {
    id: "history-timeline-focus",
    title: "History Timeline Focus",
    category: "History",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["history timeline focus", "timeline", "chronology"],
    summary: "Make chronology the central object while source and notes explain what happened.",
    duration: "",
    videoSrc: videoSrc("history-timeline-focus"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose Timeline Focus.", "Replay or scan events.", "Open source and notes for explanation."],
    transcript:
      "Timeline Focus puts chronology first. Use it when order matters, then open source and notes to explain why each event changed the argument.",
  },
  {
    id: "history-source-evidence",
    title: "History Source Evidence",
    category: "History",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["source evidence", "history evidence", "primary source", "quote"],
    summary: "Collect evidence from sources before building a historical claim.",
    duration: "",
    videoSrc: videoSrc("history-source-evidence"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose Source Evidence.", "Read the source closely.", "Capture useful evidence cards."],
    transcript:
      "Source Evidence is for close reading. Pull evidence from the source, keep context with the card, and use it later when you build the argument.",
  },
  {
    id: "history-argument-builder",
    title: "History Argument Builder",
    category: "History",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["argument builder", "thesis", "evidence", "counterargument"],
    summary: "Turn evidence into a thesis, context, counterargument, and conclusion.",
    duration: "",
    videoSrc: videoSrc("history-argument-builder"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose Argument Builder.", "Draft the thesis.", "Attach evidence before polishing the conclusion."],
    transcript:
      "Argument Builder turns historical evidence into writing. Start with a thesis, add context and counterargument, cite evidence, and finish with a conclusion that answers the prompt.",
  },
  {
    id: "history-full-studio",
    title: "History Full Studio",
    category: "History",
    routePatterns: ["/binders/:binderId/documents/:lessonId"],
    tags: ["history full studio", "timeline", "evidence", "argument", "source"],
    summary: "Use the advanced history workspace with source, timeline, evidence, and argument together.",
    duration: "",
    videoSrc: videoSrc("history-full-studio"),
    posterSrc,
    relatedFeatureLink: "/dashboard",
    steps: ["Choose History Full Studio.", "Keep source and timeline visible.", "Use evidence and argument panels together."],
    transcript:
      "History Full Studio is the advanced layout. Source, timeline, evidence, and argument stay visible so you can move from reading to proof to writing without losing context.",
  },
  {
    id: "admin-studio-overview",
    title: "Admin Studio Overview",
    category: "Admin",
    routePatterns: ["/admin"],
    promptRoutePatterns: ["/admin"],
    tags: ["admin", "admin studio", "binders", "filters", "overview"],
    summary: "Understand Admin Studio navigation, binder search, filters, and tab layout.",
    duration: "",
    videoSrc: videoSrc("admin-studio-overview"),
    posterSrc,
    relatedFeatureLink: "/admin",
    steps: ["Open Admin Studio.", "Search or filter binders.", "Select a binder and move through the tabs."],
    transcript:
      "Admin Studio is where admin users manage binders. Search, filter, select a binder, then use overview, lessons, content, preview, publish, and diagnostics tools.",
  },
  {
    id: "admin-content-editing",
    title: "Admin Content Editing",
    category: "Admin",
    routePatterns: ["/admin"],
    tags: ["admin content", "editor", "lessons", "math blocks"],
    summary: "Edit lesson content and math blocks safely from the Content tab.",
    duration: "",
    videoSrc: videoSrc("admin-content-editing"),
    posterSrc,
    relatedFeatureLink: "/admin",
    steps: ["Select a binder.", "Open Content.", "Edit lesson text and math blocks, then save carefully."],
    transcript:
      "Admin content editing happens after a binder is selected. Open the Content tab, edit the lesson body or math blocks, and save only when the change is intentional.",
  },
  {
    id: "admin-preview-publish-diagnostics",
    title: "Admin Preview, Publish, And Diagnostics",
    category: "Admin",
    routePatterns: ["/admin"],
    tags: ["preview", "publish", "diagnostics", "admin"],
    summary: "Preview learner-facing content, manage publish status, and inspect diagnostics.",
    duration: "",
    videoSrc: videoSrc("admin-preview-publish-diagnostics"),
    posterSrc,
    relatedFeatureLink: "/admin",
    steps: ["Use Preview before publishing.", "Check Publish status.", "Open Diagnostics when a binder needs cleanup."],
    transcript:
      "Preview shows how content will feel to learners. Publish controls release state. Diagnostics surfaces content or workspace problems before students hit them.",
  },
  {
    id: "tutorials-page",
    title: "Tutorials Page",
    category: "Getting Started",
    routePatterns: ["/tutorial"],
    tags: ["tutorial", "tutorials page", "search", "help"],
    summary: "Search every tutorial, filter by category, and jump back to the feature.",
    duration: "",
    videoSrc: videoSrc("tutorials-page"),
    posterSrc,
    relatedFeatureLink: "/tutorial",
    steps: ["Open Tutorial.", "Search a feature name.", "Open the video or jump to the feature."],
    transcript:
      "The Tutorials page is the library. Search by feature, route, tag, or transcript, open the video, then jump straight back to the matching BinderNotes feature.",
  },
];

export function normalizeTutorialSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatTutorialDuration(durationSeconds: number | null | undefined) {
  if (!Number.isFinite(durationSeconds) || !durationSeconds || durationSeconds <= 0) {
    return "";
  }

  const rounded = Math.round(durationSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getTutorialSearchText(tutorial: TutorialEntry) {
  return normalizeTutorialSearch(
    [
      tutorial.title,
      tutorial.category,
      tutorial.summary,
      tutorial.transcript,
      tutorial.relatedFeatureLink,
      ...tutorial.routePatterns,
      ...tutorial.tags,
      ...tutorial.steps,
    ].join(" "),
  );
}

export function searchTutorials(
  query: string,
  category: TutorialCategory | "All" = "All",
  source: TutorialEntry[] = tutorials,
) {
  const normalizedQuery = normalizeTutorialSearch(query);
  return source.filter((tutorial) => {
    const matchesCategory = category === "All" || tutorial.category === category;
    if (!matchesCategory) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return getTutorialSearchText(tutorial).includes(normalizedQuery);
  });
}

export function mergeTutorialLibraries(
  baseTutorials: TutorialEntry[],
  uploadedTutorials: TutorialEntry[],
) {
  const byId = new Map<string, TutorialEntry>();
  baseTutorials.forEach((tutorial) => byId.set(tutorial.id, tutorial));
  uploadedTutorials.forEach((tutorial) => byId.set(tutorial.id, tutorial));
  return [...byId.values()];
}

export function findTutorialForPathname(
  pathname: string,
  source: TutorialEntry[] = tutorials,
  audience: TutorialEntry["audience"] = "all",
) {
  const normalizedPathname = stripTrailingSlash(pathname);
  const candidates = source.filter((tutorial) =>
    (tutorial.promptRoutePatterns ?? []).some((pattern) =>
      routePatternMatchesPathname(pattern, normalizedPathname),
    ),
  );

  return (
    candidates.find((tutorial) => tutorial.audience === audience) ??
    candidates.find((tutorial) => tutorial.audience === "all" || !tutorial.audience)
  );
}

export function routePatternMatchesPathname(pattern: string, pathname: string) {
  const normalizedPattern = stripTrailingSlash(pattern);
  const normalizedPathname = stripTrailingSlash(pathname);
  if (normalizedPattern === normalizedPathname) {
    return true;
  }

  const patternSegments = normalizedPattern.split("/").filter(Boolean);
  const pathSegments = normalizedPathname.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

function stripTrailingSlash(value: string) {
  if (value.length > 1 && value.endsWith("/")) {
    return value.slice(0, -1);
  }
  return value || "/";
}
