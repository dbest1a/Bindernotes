import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const runtimeRequire = createRequire("C:/Users/kaich/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json");
const artifactMain = runtimeRequire.resolve("@oai/artifact-tool");
const artifactRoot = path.dirname(path.dirname(artifactMain));
const {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  layers,
  panel,
  text,
  image,
  shape,
  chart,
  rule,
  fill,
  fixed,
  hug,
  grow,
  fr,
  auto,
  wrap,
  drawSlideToCtx,
} = await import(pathToFileURL(artifactMain).href);
const { Canvas, loadImage } = await import(pathToFileURL(path.join(artifactRoot, "node_modules/skia-canvas/lib/index.mjs")).href);

const workspace = process.env.FINDER_NOTES_WORKSPACE
  ?? "C:/Users/kaich/Documents/Codex/2026-04-20-build-web-apps-plugin-build-web";
const outDir = path.join(workspace, "output");
const previewDir = path.join(outDir, "finder-notes-investor-deck-previews");
const deckPath = path.join(outDir, "finder-notes-investor-deck.pptx");
const montagePath = path.join(outDir, "finder-notes-investor-deck-montage.png");
const qaPath = path.join(outDir, "finder-notes-investor-deck-qa.json");

const W = 1920;
const H = 1080;

const P = {
  bg: "#070b14",
  bg2: "#0B1220",
  ink: "#F8FAFC",
  muted: "#A6B3C6",
  dim: "#6B7890",
  panel: "#111827",
  panel2: "#172033",
  line: "#263246",
  teal: "#32d5c8",
  teal2: "#63F1E7",
  violet: "#7c5cff",
  gold: "#F8C15C",
  rose: "#FF6B8A",
  green: "#8DF0B3",
  blue: "#8AB4FF",
  white: "#FFFFFF",
  darkInk: "#0F172A",
  paper: "#F8FAFC",
  paperMuted: "#475569",
};

const font = "Aptos";
const mono = "Aptos Mono";

const screenshots = {
  dashboard: path.join(workspace, "output/playwright/bindernotes-dashboard.png"),
  organize: path.join(workspace, "output/playwright/bn-dashboard-organize.png"),
  pricing: path.join(workspace, "output/playwright/bn-pricing.png"),
  reader: path.join(workspace, "output/playwright/bn-reader-like-terms.png"),
  mathLab: path.join(workspace, "output/playwright/bn-math-lab.png"),
  mathHome: path.join(workspace, "output/playwright/bn-math-home.png"),
  whiteboard: path.join(workspace, "output/playwright/bn-whiteboard-lab.png"),
  mobilePricing: path.join(workspace, "output/playwright/bn-mobile-pricing.png"),
  mobileReader: path.join(workspace, "output/playwright/bn-mobile-reader.png"),
  admin: path.join(workspace, "output/playwright/bn-admin.png"),
};

const currentMonthly = [
  { name: "ChatGPT / AI dev", value: 200 },
  { name: "Desmos API/license", value: 100 },
  { name: "Supabase/Superspace", value: 30 },
  { name: "Google Workspace", value: 8 },
  { name: "Domain", value: 1 },
  { name: "Hosting/reserve", value: 20 },
];
const currentMonthlyTotal = currentMonthly.reduce((sum, item) => sum + item.value, 0);

const planMix = [
  { name: "Plus", price: 8, mix: 70, stripe: 0.53, cloud: 0.35, support: 0.25, ai: 0.00 },
  { name: "Studio", price: 20, mix: 25, stripe: 0.88, cloud: 0.60, support: 0.45, ai: 0.15 },
  { name: "Everything", price: 35, mix: 5, stripe: 1.32, cloud: 0.95, support: 0.70, ai: 0.35 },
];
const paidArpu = planMix.reduce((sum, p) => sum + p.price * p.mix / 100, 0);
const blendedCogs = planMix.reduce((sum, p) => sum + (p.stripe + p.cloud + p.support + p.ai) * p.mix / 100, 0);
const blendedMargin = (paidArpu - blendedCogs) / paidArpu;

const revenueScenarios = [
  { name: "Validation", users: 1000, paid: 150, mrr: paidArpu * 150 },
  { name: "Early pull", users: 10000, paid: 1800, mrr: paidArpu * 1800 },
  { name: "Seed scale", users: 50000, paid: 10000, mrr: paidArpu * 10000 },
  { name: "Category", users: 200000, paid: 50000, mrr: paidArpu * 50000 },
];

const cloudScale = [
  { label: "1k MAU", vercel: 20, supabase: 60, storage: 20, email: 25, obs: 25, ai: 0 },
  { label: "10k MAU", vercel: 120, supabase: 350, storage: 100, email: 120, obs: 150, ai: 400 },
  { label: "50k MAU", vercel: 450, supabase: 1300, storage: 450, email: 450, obs: 700, ai: 1800 },
  { label: "100k MAU", vercel: 900, supabase: 2800, storage: 850, email: 900, obs: 1400, ai: 3600 },
  { label: "500k MAU", vercel: 3600, supabase: 14000, storage: 4300, email: 3600, obs: 6500, ai: 18000 },
];
const cloudTotal = (x) => x.vercel + x.supabase + x.storage + x.email + x.obs + x.ai;

const sources = [
  "BinderNotes repository README and product screenshots, April 30, 2026.",
  "Public pricing pages checked April 30, 2026: Supabase, Vercel, Stripe, Google Workspace, Quizlet, Chegg, Goodnotes, Notability, Notion, Khan Academy, Microsoft OneNote.",
  "Market sizing references checked April 30, 2026: Grand View Research education technology market release, NCES postsecondary enrollment data.",
  "Financials are management estimates. They are not audited results, guidance, or legal/tax advice.",
];

const imageCache = new Map();

function imageDataUrl(filePath) {
  if (!imageCache.has(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : ext === ".webp" ? "image/webp" : "image/png";
    const bytes = fsSync.readFileSync(filePath);
    imageCache.set(filePath, `data:${mime};base64,${bytes.toString("base64")}`);
  }
  return imageCache.get(filePath);
}

function titleStyle(size = 58, color = P.ink) {
  return { fontFace: font, fontSize: size, bold: true, color, margin: 0, breakLine: false };
}

function bodyStyle(size = 24, color = P.muted) {
  return { fontFace: font, fontSize: size, color, margin: 0 };
}

function labelStyle(size = 16, color = P.dim) {
  return { fontFace: font, fontSize: size, bold: true, color, margin: 0 };
}

function smallCaps(value, color = P.teal) {
  return text(value.toUpperCase(), {
    width: fill,
    height: hug,
    style: { ...labelStyle(15, color), letterSpacing: 0 },
  });
}

function paragraph(value, size = 24, color = P.muted, width = fill) {
  return text(value, { width, height: hug, style: bodyStyle(size, color) });
}

function headline(value, size = 58, color = P.ink, width = fill) {
  return text(value, { width, height: hug, style: titleStyle(size, color) });
}

function footer(slideNo, source = "") {
  const left = source ? `Source: ${source}` : "Finder Notes investor deck";
  return row({ width: fill, height: fixed(26), align: "center", justify: "between" }, [
    text(left, { width: wrap(1320), height: hug, style: { ...bodyStyle(12, P.dim) } }),
    text(String(slideNo).padStart(2, "0"), { width: fixed(54), height: hug, style: { ...labelStyle(12, P.dim) } }),
  ]);
}

function frame(slide, slideNo, children, source = "", opts = {}) {
  slide.compose(
    panel(
      {
        name: `slide-${slideNo}-root`,
        width: fill,
        height: fill,
        fill: opts.fill ?? P.bg,
        padding: { x: 72, y: 54 },
      },
      column({ width: fill, height: fill, gap: 24 }, [
        ...children,
        footer(slideNo, source),
      ]),
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

function standardSlide(deck, slideNo, eyebrow, title, subtitle, bodyChildren, source = "") {
  const slide = deck.slides.add();
  frame(slide, slideNo, [
    column({ width: fill, height: hug, gap: 12 }, [
      smallCaps(eyebrow),
      headline(title, 54, P.ink),
      subtitle ? paragraph(subtitle, 22, P.muted, wrap(1320)) : text("", { width: fill, height: fixed(1) }),
    ]),
    row({ width: fill, height: grow(1), gap: 34, align: "stretch" }, bodyChildren),
  ], source);
  return slide;
}

function metric(label, value, note = "", accent = P.teal) {
  return panel(
    {
      width: fill,
      height: fill,
      fill: "#0E1726",
      line: { color: P.line, width: 1 },
      borderRadius: 14,
      padding: { x: 24, y: 22 },
    },
    column({ width: fill, height: fill, gap: 12 }, [
      text(label.toUpperCase(), { width: fill, height: hug, style: labelStyle(13, accent) }),
      text(value, { width: fill, height: hug, style: { ...titleStyle(44, P.ink), fontFace: mono } }),
      note ? paragraph(note, 17, P.muted) : text("", { width: fill, height: fixed(1) }),
    ]),
  );
}

function bullets(items, size = 22, accent = P.teal) {
  return column({ width: fill, height: hug, gap: 15 }, items.map((item) =>
    row({ width: fill, height: hug, gap: 14, align: "start" }, [
      shape({ width: fixed(9), height: fixed(9), fill: accent, borderRadius: 5 }),
      paragraph(item, size, P.muted),
    ]),
  ));
}

function callout(label, body, accent = P.teal) {
  return panel(
    { width: fill, height: hug, fill: "#0E1726", line: { color: P.line, width: 1 }, borderRadius: 14, padding: { x: 24, y: 20 } },
    column({ width: fill, height: hug, gap: 10 }, [
      text(label, { width: fill, height: hug, style: labelStyle(16, accent) }),
      paragraph(body, 20, P.muted),
    ]),
  );
}

function chartPanel(config, chartType = "bar", title = "") {
  return panel(
    { width: fill, height: fill, fill: P.paper, borderRadius: 18, padding: { x: 22, y: 18 } },
    column({ width: fill, height: fill, gap: 6 }, [
      title ? text(title, { width: fill, height: hug, style: labelStyle(18, P.darkInk) }) : text("", { width: fill, height: fixed(1) }),
      chart({
        name: `chart-${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
        chartType,
        width: fill,
        height: grow(1),
        config,
      }),
    ]),
  );
}

function barRows(items, opts = {}) {
  const max = Math.max(...items.map((x) => x.value), 1);
  return column({ width: fill, height: fill, gap: opts.gap ?? 18, justify: "center" }, items.map((item) => {
    const pct = Math.min(98, Math.max(2, Math.round((item.value / max) * 100)));
    return column({ width: fill, height: hug, gap: 7 }, [
      row({ width: fill, height: hug, justify: "between", align: "center" }, [
        text(item.label, { width: wrap(620), height: hug, style: bodyStyle(opts.labelSize ?? 18, opts.labelColor ?? P.ink) }),
        text(item.display ?? formatMoney(item.value), { width: fixed(opts.valueW ?? 160), height: hug, style: { ...labelStyle(opts.valueSize ?? 18, item.color ?? P.teal), fontFace: mono } }),
      ]),
      row({ width: fill, height: fixed(opts.barH ?? 14), gap: 0 }, [
        shape({ width: grow(pct), height: fill, fill: item.color ?? P.teal, borderRadius: opts.barR ?? 7 }),
        shape({ width: grow(100 - pct), height: fill, fill: opts.track ?? "#202A3B", borderRadius: opts.barR ?? 7 }),
      ]),
    ]);
  }));
}

function formatMoney(value) {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`;
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${Math.round(value)}`;
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function authoredTable(columns, rows, opts = {}) {
  const columnTracks = opts.columns ?? columns.map(() => fr(1));
  const header = grid(
    { width: fill, height: hug, columns: columnTracks, columnGap: 0, padding: { x: 16, y: 12 } },
    columns.map((c) => text(c, { width: fill, height: hug, style: labelStyle(opts.headerSize ?? 14, opts.accent ?? P.teal) })),
  );
  const body = rows.map((r, idx) =>
    grid(
      {
        width: fill,
        height: hug,
        columns: columnTracks,
        columnGap: 0,
        padding: { x: 16, y: 12 },
      },
      r.map((c, i) => text(String(c), { width: fill, height: hug, style: bodyStyle(opts.bodySize ?? 16, i === 0 ? P.ink : P.muted) })),
    ),
  );
  return panel(
    { width: fill, height: fill, fill: "#0E1726", line: { color: P.line, width: 1 }, borderRadius: 14, padding: { x: 0, y: 0 } },
    column({ width: fill, height: fill, gap: 0 }, [
      header,
      ...body.flatMap((r, idx) => [rule({ width: fill, weight: 1, stroke: idx === 0 ? P.teal : P.line, opacity: idx === 0 ? 0.65 : 0.55 }), r]).slice(0),
    ]),
  );
}

function screenshotPanel(src, alt, note = "") {
  return panel(
    { width: fill, height: fill, fill: "#0C1220", line: { color: P.line, width: 1 }, borderRadius: 16, padding: { x: 14, y: 14 } },
    column({ width: fill, height: fill, gap: 10 }, [
      image({ name: alt, dataUrl: imageDataUrl(src), width: fill, height: grow(1), fit: "cover", borderRadius: 10, alt }),
      note ? paragraph(note, 15, P.dim) : text("", { width: fill, height: fixed(1) }),
    ]),
  );
}

function addNotes(slide, notes) {
  slide.speakerNotes.setText(notes);
}

function addCover(deck) {
  const slide = deck.slides.add();
  slide.compose(
    layers({ width: fill, height: fill }, [
      shape({ width: fill, height: fill, fill: P.bg }),
      image({ name: "dashboard-product-field", dataUrl: imageDataUrl(screenshots.dashboard), width: fill, height: fill, fit: "cover", alt: "Finder Notes dashboard screenshot" }),
      panel(
        { width: fill, height: fill, fill: "#070b14CC", padding: { x: 86, y: 62 } },
        column({ width: fill, height: fill, justify: "between" }, [
          column({ width: fill, height: hug, gap: 18 }, [
            smallCaps("Investor pitch | April 2026", P.teal2),
            text("Finder Notes", { width: fill, height: hug, style: { ...titleStyle(108, P.ink), fontFace: "Georgia" } }),
            text("The study workspace where source lessons, private notes, graphing, and whiteboards stay connected.", {
              width: wrap(1160),
              height: hug,
              style: bodyStyle(32, "#DCEBFF"),
            }),
          ]),
          row({ width: fill, height: fixed(160), gap: 22 }, [
            metric("Minimum check", "$100k", "Finish paid launch and prove first conversion.", P.gold),
            metric("Target seed", "$1M-$3M", "Build team, growth engine, and reliability.", P.teal),
            metric("Strategic growth", "Up to $10M", "Scale into category leadership.", P.violet),
          ]),
        ]),
      ),
    ]),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
  addNotes(slide, "Open with the simple thesis: students are forced to stitch together notes, PDFs, graphing, whiteboards, flashcards, and AI chats. Finder Notes bundles the real study workflow into one durable workspace.");
}

function buildDeck() {
  const deck = Presentation.create({ slideSize: { width: W, height: H } });
  let n = 1;

  addCover(deck);
  n++;

  let s = standardSlide(deck, n++, "The Ask", "Raise $100k to $10M to turn a working product into a defensible education SaaS company", "The minimum check funds launch readiness. A larger seed builds the team, growth engine, compliance posture, and AI-assisted learning layer.", [
    column({ width: grow(1.05), height: fill, gap: 22 }, [
      metric("Minimum viable financing", "$100k", "Payments, analytics, reliability, and founder-led user acquisition.", P.gold),
      metric("Preferred seed", "$1M-$3M", "Engineering, growth, content ops, mobile/offline, and institutional pilots.", P.teal),
      metric("Strategic growth capacity", "$10M", "Compliance, school partnerships, marketplace, AI tutor, and brand scale.", P.violet),
    ]),
    panel({ width: grow(1), height: fill, fill: P.panel, line: { color: P.line, width: 1 }, borderRadius: 18, padding: { x: 30, y: 28 } },
      column({ width: fill, height: fill, gap: 22 }, [
        headline("Why this is investable", 38),
        bullets([
          "A real product exists today with authentication, pricing pages, math routes, whiteboards, and admin tooling.",
          "Current fixed tooling costs are extremely low before growth spend.",
          "Core gross margins can remain in SaaS territory because the product is mostly text, structured data, graphs, and lightweight storage.",
          "The wedge is integration: source plus private notes plus graphing plus whiteboards, instead of another isolated tool.",
        ], 22),
      ]),
    ),
  ], "Management estimates; repository review.");
  addNotes(s, "Position the ask as a menu of financing paths. The strongest pitch is that the product exists and the next dollars unlock distribution, polish, reliability, and proof.");

  s = standardSlide(deck, n++, "Executive Thesis", "Finder Notes can own the serious-student workspace before the market standardizes around one winner", "The product is built around the student's real context: a source, their thinking, math tools, and a working canvas.", [
    panel({ width: grow(1.1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 28 }, [
        headline("The category gap", 42),
        bullets([
          "Notion is flexible but blank.",
          "Quizlet is study-set first.",
          "Chegg is answer-first.",
          "Khan Academy is content-first.",
          "Goodnotes and Notability are capture-first.",
          "ChatGPT is conversation-first.",
        ], 25, P.rose),
        callout("Finder Notes is workflow-first", "Students do not want another tab. They need a single place where reading, writing, math, practice, and whiteboarding keep their context.", P.teal),
      ]),
    ),
    chartPanel({
      title: "Wedge strength by workflow depth",
      categories: ["Notes", "Graphs", "Whiteboards", "Source context", "Publishing"],
      series: [
        { name: "Generic tools", values: [70, 20, 35, 25, 30] },
        { name: "Finder Notes", values: [85, 85, 80, 90, 70] },
      ],
    }, "bar", "Differentiation map"),
  ], "Competitive assessment from public product pages and local product review.");
  addNotes(s, "Emphasize that we are not claiming to beat every incumbent on every axis today. The wedge is doing the integrated workflow better.");

  s = standardSlide(deck, n++, "Product Proof", "This is not a pitch for a concept. It is a working web product.", "The current build already includes accounts, protected routes, dashboards, folders, binders, lessons, notes, highlights, math learning, whiteboards, and public pricing.", [
    screenshotPanel(screenshots.organize, "Dashboard organize mode", "Actual dashboard/product screenshot from the current web build."),
    column({ width: grow(0.9), height: fill, gap: 18 }, [
      metric("Published math modules", "27+", "Jacob Math Notes coverage through Real Analysis.", P.teal),
      metric("Linked practice questions", "54+", "At least two per Jacob section in seed data.", P.gold),
      metric("Core routes", "20+", "Public, protected, math, admin, tutorial, and pricing routes.", P.violet),
      metric("Current product state", "Post-MVP", "Beyond phase 1, with production hardening already started.", P.green),
    ]),
  ], "README, docs/jacob-math-notes-coverage.md, product screenshots.");
  addNotes(s, "Use this to de-risk the build. Investors should see that funding is not paying to discover if this can be built from scratch.");

  s = standardSlide(deck, n++, "The Problem", "Serious students are forced to study across disconnected tabs", "A real study session jumps from a course source to notes, calculator, graphing, whiteboard, quiz practice, files, and sometimes AI.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 32 } },
      column({ width: fill, height: fill, gap: 22 }, [
        headline("The hidden tax", 42),
        bullets([
          "Context loss: highlights, notes, graph states, and practice live in separate tools.",
          "Workflow friction: students rebuild the same workspace every session.",
          "No durable study object: an AI answer or calculator graph often disappears from the learning record.",
          "Parents and students pay for multiple narrow subscriptions that do not compose.",
        ], 25, P.rose),
      ]),
    ),
    panel({ width: grow(1), height: fill, fill: "#0D1829", borderRadius: 18, padding: { x: 32, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Finder Notes compresses the stack", 42),
        barRows([
          { label: "Source lesson", value: 100, display: "Read", color: P.teal },
          { label: "Private notes", value: 92, display: "Write", color: P.green },
          { label: "Highlights/comments", value: 86, display: "Capture", color: P.gold },
          { label: "Graph/calculator", value: 78, display: "Model", color: P.blue },
          { label: "Whiteboard", value: 74, display: "Think", color: P.violet },
          { label: "Practice/quiz", value: 65, display: "Test", color: P.rose },
        ], { valueW: 110, barH: 16 }),
      ]),
    ),
  ], "Product workflow assessment.");

  s = standardSlide(deck, n++, "Why Now", "AI raises expectations, but students still need a durable workspace", "The winners will combine AI help with organized source material, student-owned notes, and structured study data.", [
    chartPanel({
      title: "Market pull",
      categories: ["Digital content", "Remote workflows", "AI tutors", "Study data", "Creator/tutor tools"],
      series: [{ name: "Urgency index", values: [70, 78, 92, 85, 74] }],
    }, "bar", "Education software pressure points"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 20 }, [
        headline("The timing window", 40),
        bullets([
          "Students already expect digital study tools.",
          "AI creates new demand for explanation, feedback, and generated practice.",
          "Generic AI chat creates a new problem: answers are not organized into the study workflow.",
          "Schools and tutors need better publishing and monitoring surfaces.",
        ], 23),
      ]),
    ),
  ], "Market and product trend analysis.");

  s = standardSlide(deck, n++, "Market", "The opportunity is large enough for venture outcomes if we win a focused beachhead", "We start with individual students, then expand into creators, tutors, cohorts, and schools.", [
    chartPanel({
      title: "TAM to early wedge",
      categories: ["Global edtech", "US postsecondary", "Math/STEM users", "Paid study workspace"],
      series: [{ name: "$B opportunity", values: [180, 35, 12, 2.5] }],
    }, "bar", "Market ladder, estimate"),
    column({ width: grow(0.9), height: fill, gap: 20 }, [
      metric("TAM", "$100B+", "Global education technology market, broad category.", P.teal),
      metric("SAM", "$10B+", "US student productivity, tutoring, and study software.", P.gold),
      metric("SOM target", "$50M ARR", "Less than 0.5M paid users at blended ARPU.", P.violet),
      callout("Beachhead", "Students studying math-heavy subjects where graphing, proof work, source notes, and practice all matter.", P.green),
    ]),
  ], "Grand View Research, NCES, management estimates.");

  s = standardSlide(deck, n++, "Beachhead", "Start where the pain is sharp: math-heavy students and serious note takers", "The current product already over-indexes on graphing, formulas, calculus, whiteboards, and structured notes.", [
    screenshotPanel(screenshots.mathHome, "Math learning home", "Math learning routes and course/module surfaces in current product."),
    panel({ width: grow(0.95), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 28 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Why this audience pays", 40),
        bullets([
          "Math students need visual reasoning, not just text notes.",
          "AP, college, and self-learners repeat study sessions for months.",
          "Parents and tutors already pay for multiple narrow tools.",
          "Creators can publish high-value materials inside a workspace, not just PDFs.",
        ], 23),
        chartPanel({
          title: "Feature fit by study mode",
          categories: ["Read", "Write", "Graph", "Practice", "Publish"],
          series: [{ name: "Fit", values: [90, 86, 88, 72, 65] }],
        }, "bar", "Wedge fit"),
      ]),
    ),
  ], "Product review and management estimates.");

  s = standardSlide(deck, n++, "Product System", "Finder Notes turns learning assets into a connected workspace", "A student's study object is not just a note. It is source content, private thinking, annotations, math states, and whiteboard context.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 30 } },
      column({ width: fill, height: fill, gap: 22 }, [
        headline("Core workflow", 40),
        barRows([
          { label: "Folders and binders", value: 100, display: "Organize", color: P.teal },
          { label: "Source lessons", value: 92, display: "Read", color: P.blue },
          { label: "Private notes", value: 86, display: "Write", color: P.green },
          { label: "Highlights/comments", value: 74, display: "Capture", color: P.gold },
          { label: "Desmos graph states", value: 68, display: "Model", color: P.violet },
          { label: "Whiteboard layers", value: 62, display: "Think", color: P.rose },
        ], { valueW: 120, barH: 18 }),
      ]),
    ),
    screenshotPanel(screenshots.reader, "Reader and notes workspace", "Source lesson and study surface screenshot."),
  ], "Product screenshots and tutorial guide.");

  s = standardSlide(deck, n++, "Backend", "The back end is already organized around real accounts and durable study data", "React/Vite handles the experience. Supabase is the source of truth for auth, roles, binders, notes, summaries, math, and whiteboards.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Current architecture", 40),
        authoredTable(
          ["Layer", "Role"],
          [
            ["React + Vite", "SPA routes, protected app, pricing, admin, math, tutorial"],
            ["Supabase Auth", "Email/password sessions and roles"],
            ["Postgres + RLS", "Profiles, binders, notes, comments, highlights, attempts"],
            ["Storage", "Whiteboards, files, future PDFs and thumbnails"],
            ["Vercel", "Static app, serverless checkout and webhooks next"],
            ["Stripe", "Pricing scaffold today; production checkout next"],
          ],
          { columns: [fr(0.8), fr(2.2)], bodySize: 17 },
        ),
      ]),
    ),
    chartPanel({
      title: "Data maturity by domain",
      categories: ["Auth", "Content", "Notes", "Math", "Whiteboard", "Billing"],
      series: [{ name: "Readiness", values: [82, 78, 74, 72, 65, 38] }],
    }, "bar", "Backend readiness"),
  ], "README and repository review.");

  s = standardSlide(deck, n++, "Data Layer", "The schema creates switching costs because learning work stays structured", "The product already stores normalized study objects instead of dumping everything into one document blob.", [
    chartPanel({
      title: "Structured objects in the product",
      categories: ["Folders", "Binders", "Lessons", "Notes", "Highlights", "Questions", "Attempts", "Boards"],
      series: [{ name: "Product coverage", values: [80, 86, 90, 78, 76, 66, 62, 70] }],
    }, "bar", "Study graph coverage"),
    panel({ width: grow(0.9), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Why it matters", 40),
        bullets([
          "Structured study data enables search, summaries, progress, recommendations, and AI feedback.",
          "Private notes are distinct from published source content, which makes sharing and privacy easier.",
          "Math states and attempts become reusable learning evidence.",
          "Summary tables reduce expensive reads as the dashboard scales.",
        ], 23),
      ]),
    ),
  ], "README, docs/supabase-backend-performance-layer.md.");

  s = standardSlide(deck, n++, "Product Screens", "Investors should see the app surfaces, not just the words", "The current product has a premium education-SaaS look with dark panels, teal/violet accents, math surfaces, and responsive pages.", [
    grid({ width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], rows: [fr(1), fr(1)], columnGap: 20, rowGap: 20 }, [
      screenshotPanel(screenshots.pricing, "Pricing", "Public pricing"),
      screenshotPanel(screenshots.mathLab, "Math lab", "Graphing and math lab"),
      screenshotPanel(screenshots.whiteboard, "Whiteboard", "Whiteboard lab"),
      screenshotPanel(screenshots.mobilePricing, "Mobile pricing", "Responsive pricing"),
      screenshotPanel(screenshots.mobileReader, "Mobile reader", "Mobile reader"),
      screenshotPanel(screenshots.admin, "Admin", "Admin studio"),
    ]),
  ], "Local Playwright screenshots.");

  s = standardSlide(deck, n++, "Pricing", "The product can monetize across student, creator, and power-user use cases", "Current public plans are simple and investor-friendly: Free, Plus, Studio, and Everything.", [
    chartPanel({
      title: "Monthly plan price",
      categories: ["Free", "Plus", "Studio", "Everything"],
      series: [{ name: "Price", values: [0, 8, 20, 35] }],
    }, "bar", "Current public pricing"),
    panel({ width: grow(0.9), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Monetization logic", 40),
        bullets([
          "Free plan creates adoption and shareability.",
          "$8 Plus is the student upgrade for binders, whiteboards, and graphing.",
          "$20 Studio adds creator/tutor publishing and PDF/file workflows.",
          "$35 Everything captures power users without needing enterprise sales.",
        ], 23),
      ]),
    ),
  ], "src/pages/pricing-page.tsx.");

  s = standardSlide(deck, n++, "Revenue Engine", "Self-serve subscription revenue comes first; creators and cohorts expand ARPU", "The first business model should be simple recurring software. The second layer is creator/tutor/institutional expansion.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Paid user mix assumption", 40),
        chartPanel({
          title: "Paid plan mix",
          categories: ["Plus", "Studio", "Everything"],
          series: [{ name: "Share", values: [70, 25, 5] }],
        }, "bar", "Base case paid plan mix"),
      ]),
    ),
    column({ width: grow(0.85), height: fill, gap: 18 }, [
      metric("Paid ARPU", `$${paidArpu.toFixed(2)}`, "Base case weighted monthly subscription revenue.", P.teal),
      metric("Expansion paths", "3", "Creators, tutors/cohorts, and schools.", P.gold),
      metric("Gross margin target", `${pct(blendedMargin)}+`, "Core product before heavy AI tutoring.", P.green),
      callout("Important discipline", "Keep AI features metered or plan-gated so usage does not eat subscription margin.", P.rose),
    ]),
  ], "Management pricing and unit economics estimates.");

  s = standardSlide(deck, n++, "Cost Today", "Current fixed monthly operating costs are tiny relative to the funding ask", "Using management's current assumptions, baseline tools are roughly $359 per month before growth spend and new hires.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 30 } },
      column({ width: fill, height: fill, gap: 20 }, [
        headline(`Current tool run-rate: ~$${Math.round(currentMonthlyTotal)}/mo`, 42),
        barRows(currentMonthly.map((x) => ({ label: x.name, value: x.value, color: x.value >= 100 ? P.teal : P.gold })), { valueW: 120, barH: 18 }),
      ]),
    ),
    chartPanel({
      title: "Current fixed tool cost per month",
      categories: currentMonthly.map((x) => x.name.replace(" / ", " ")),
      series: [{ name: "USD", values: currentMonthly.map((x) => x.value) }],
    }, "bar", "Current run-rate by category"),
  ], "Management assumptions; vendor pricing to confirm.");

  s = standardSlide(deck, n++, "Cloud Scale", "Cloud hosting stays manageable if we keep the architecture mostly static + Supabase", "The model assumes Vercel for the app, Supabase for auth/database/storage, modest observability, email, and optional AI usage.", [
    chartPanel({
      title: "Estimated monthly cloud and AI operating cost",
      categories: cloudScale.map((x) => x.label),
      series: [
        { name: "Core cloud", values: cloudScale.map((x) => x.vercel + x.supabase + x.storage + x.email + x.obs) },
        { name: "Optional AI", values: cloudScale.map((x) => x.ai) },
      ],
    }, "bar", "Scale cost model"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 28, y: 28 } },
      column({ width: fill, height: fill, gap: 16 }, [
        headline("100k MAU base case", 38),
        barRows([
          { label: "Vercel/CDN/serverless", value: 900, color: P.teal },
          { label: "Supabase plan + compute", value: 2800, color: P.violet },
          { label: "Storage + egress", value: 850, color: P.blue },
          { label: "Email + observability", value: 2300, color: P.gold },
          { label: "Optional AI", value: 3600, color: P.rose },
        ], { valueW: 120, barH: 15 }),
      ]),
    ),
  ], "Supabase, Vercel, vendor pricing pages; management estimates.");

  s = standardSlide(deck, n++, "Variable Cost", "The main variable cost is payment processing, then usage, support, and metered AI", "Core product COGS should remain low because notes, graph states, highlights, and quizzes are lightweight data.", [
    chartPanel({
      title: "Estimated COGS per paying user per month",
      categories: planMix.map((p) => p.name),
      series: [
        { name: "Stripe", values: planMix.map((p) => p.stripe) },
        { name: "Cloud", values: planMix.map((p) => p.cloud) },
        { name: "Support", values: planMix.map((p) => p.support) },
        { name: "AI", values: planMix.map((p) => p.ai) },
      ],
    }, "bar", "COGS by plan"),
    column({ width: grow(0.85), height: fill, gap: 18 }, [
      metric("Blended paid ARPU", `$${paidArpu.toFixed(2)}`, "70% Plus, 25% Studio, 5% Everything.", P.teal),
      metric("Blended COGS", `$${blendedCogs.toFixed(2)}`, "Stripe + cloud + support + light AI.", P.gold),
      metric("Gross margin", pct(blendedMargin), "Base case paid-user margin.", P.green),
      callout("Guardrail", "Do not bundle unlimited high-cost AI tutoring into the $8 plan without limits.", P.rose),
    ]),
  ], "Stripe pricing and management cost assumptions.");

  s = standardSlide(deck, n++, "Gross Margin", "The subscription model can sustain SaaS-level gross margins", "Margin remains attractive even if cloud and support costs rise, as long as heavy AI features are plan-gated.", [
    chartPanel({
      title: "Estimated gross margin by plan",
      categories: planMix.map((p) => p.name),
      series: [{ name: "Gross margin %", values: planMix.map((p) => ((p.price - (p.stripe + p.cloud + p.support + p.ai)) / p.price) * 100) }],
    }, "bar", "Plan margin model"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 22 }, [
        headline("Margin story", 40),
        bullets([
          "Plus is high margin if support stays self-serve.",
          "Studio and Everything carry more usage but much higher ARPU.",
          "Payment fees are the largest predictable per-user cost.",
          "AI costs should be usage-capped, credits-based, or reserved for higher plans.",
        ], 23),
      ]),
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Revenue Scenarios", "Small paid-user counts produce meaningful recurring revenue", "The base case assumes 15-25% of registered users become paid over time through clear feature gates and creator/tutor use cases.", [
    chartPanel({
      title: "Monthly recurring revenue by scenario",
      categories: revenueScenarios.map((x) => x.name),
      series: [{ name: "MRR", values: revenueScenarios.map((x) => Math.round(x.mrr)) }],
    }, "bar", "MRR scenarios"),
    panel({ width: grow(0.9), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 16 }, [
        headline("Scenario table", 38),
        authoredTable(
          ["Scenario", "Users", "Paid", "ARR"],
          revenueScenarios.map((x) => [x.name, x.users.toLocaleString(), x.paid.toLocaleString(), formatMoney(x.mrr * 12)]),
          { columns: [fr(1.1), fr(0.8), fr(0.8), fr(0.8)], bodySize: 17 },
        ),
      ]),
    ),
  ], "Management estimates.");

  const months = ["M6", "M12", "M18", "M24", "M30", "M36"];
  const baseArr = [60, 180, 420, 840, 1200, 1800];
  const upsideArr = [90, 360, 900, 1800, 4200, 7400];
  s = standardSlide(deck, n++, "ARR Path", "The investment thesis is a path from launch to $1M-$7M ARR in three years", "This is not guidance. It is the milestone math investors can diligence against user acquisition, conversion, and retention.", [
    chartPanel({
      title: "ARR path, $000s",
      categories: months,
      series: [
        { name: "Base", values: baseArr },
        { name: "Upside", values: upsideArr },
      ],
    }, "line", "36-month ARR model"),
    column({ width: grow(0.85), height: fill, gap: 18 }, [
      metric("M12 goal", "$180k-$360k ARR", "Enough to show willingness to pay.", P.teal),
      metric("M24 goal", "$0.8M-$1.8M ARR", "Proof of repeatable channel and retention.", P.gold),
      metric("M36 goal", "$1.8M-$7.4M ARR", "Seed-to-Series-A story if growth compounds.", P.violet),
      callout("Investor diligence", "The gating metric is paid retention, not just signups.", P.green),
    ]),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Runway", "Different check sizes unlock different levels of proof", "A $100k raise can launch and validate. A $1M-$3M seed gives the company enough runway to build a real growth and product engine.", [
    chartPanel({
      title: "Estimated runway by raise size",
      categories: ["$100k", "$500k", "$1M", "$3M", "$10M"],
      series: [{ name: "Months", values: [7, 12, 18, 24, 30] }],
    }, "bar", "Runway scenarios"),
    panel({ width: grow(0.9), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Spend discipline", 40),
        bullets([
          "$100k: founder-led build, launch, analytics, small paid tests.",
          "$500k: first contractor/engineer, design polish, acquisition tests.",
          "$1M-$3M: engineering, growth, content ops, support, compliance plan.",
          "$10M: category push, school/institutional sales, AI layer, marketplace.",
        ], 22),
      ]),
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Use Of Funds", "$100k: convert the working product into a paid launch", "The small-check plan should be brutally focused on revenue proof and investor-grade analytics.", [
    chartPanel({
      title: "$100k deployment",
      categories: ["Payments", "Reliability", "Growth tests", "Design polish", "Legal/admin", "Reserve"],
      series: [{ name: "Dollars", values: [18000, 22000, 25000, 16000, 9000, 10000] }],
    }, "bar", "Minimum check use of funds"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Milestone unlocked", 40),
        bullets([
          "Production Stripe Checkout and entitlements.",
          "Cohort analytics: activation, conversion, retention, churn.",
          "Pricing A/B tests and onboarding.",
          "Campus/student creator acquisition experiments.",
          "Security and privacy basics documented.",
        ], 23),
      ]),
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Use Of Funds", "$500k-$1M: build the first durable operating machine", "This level funds the product, growth, content, and support work needed for repeatable subscription revenue.", [
    chartPanel({
      title: "$1M deployment",
      categories: ["Engineering", "Growth", "Content ops", "Cloud/tools", "Legal/security", "Founder runway"],
      series: [{ name: "Dollars", values: [360000, 220000, 120000, 90000, 90000, 120000] }],
    }, "bar", "$1M use of funds"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Milestone unlocked", 40),
        bullets([
          "3-5 person execution capacity.",
          "Mobile/offline and PDF workflows.",
          "Creator/tutor publishing loop.",
          "Scalable backend summaries and monitoring.",
          "First serious paid-user retention evidence.",
        ], 23),
      ]),
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Use Of Funds", "$3M-$10M: scale the category play", "Larger capital only makes sense after the paid launch shows conversion and retention. Then the goal becomes speed.", [
    chartPanel({
      title: "$10M deployment",
      categories: ["Product/eng", "Growth/brand", "AI learning", "School sales", "Compliance", "Reserve"],
      series: [{ name: "Dollars", values: [3600000, 2300000, 1500000, 900000, 900000, 800000] }],
    }, "bar", "$10M scale plan"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Milestone unlocked", 40),
        bullets([
          "AI-assisted grading, practice generation, and study guidance.",
          "Creator marketplace and institutional pilots.",
          "Compliance posture for school and family trust.",
          "Acquisition channels beyond founder-led outreach.",
          "Data moat from structured study behavior.",
        ], 23),
      ]),
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Unit Economics", "The first proof point: recover CAC fast enough for self-serve growth", "The model works if paid retention is strong and acquisition is driven by students, creators, tutors, search, and content loops.", [
    chartPanel({
      title: "CAC payback sensitivity, months",
      categories: ["$15 CAC", "$25 CAC", "$40 CAC", "$75 CAC", "$120 CAC"],
      series: [{ name: "Payback months", values: [1.4, 2.4, 3.8, 7.1, 11.4] }],
    }, "bar", "CAC payback at blended contribution"),
    column({ width: grow(0.85), height: fill, gap: 18 }, [
      metric("Contribution/user", `$${(paidArpu - blendedCogs).toFixed(2)}`, "Monthly paid ARPU less estimated COGS.", P.teal),
      metric("12-mo gross LTV", `$${((paidArpu - blendedCogs) * 12).toFixed(0)}`, "Before CAC and operating expenses.", P.gold),
      metric("Target CAC payback", "<6 mo", "Self-serve SaaS benchmark for early scale.", P.green),
      callout("Validation need", "The model depends on retention and referrals. Measure cohorts before scaling ad spend.", P.rose),
    ]),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Go-To-Market", "Use content and study artifacts as distribution, not ads alone", "Students share notes, teachers share materials, tutors build resources, and math modules create search demand.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 32 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Growth loops", 40),
        barRows([
          { label: "Free student workspace", value: 100, display: "Adoption", color: P.teal },
          { label: "Public math modules", value: 84, display: "SEO", color: P.blue },
          { label: "Creator/tutor publishing", value: 72, display: "Supply", color: P.gold },
          { label: "Shared binders and boards", value: 68, display: "Referral", color: P.green },
          { label: "Campus ambassadors", value: 58, display: "Local", color: P.violet },
          { label: "School pilots", value: 46, display: "Expansion", color: P.rose },
        ], { valueW: 105, barH: 16 }),
      ]),
    ),
    chartPanel({
      title: "Expected channel mix after launch",
      categories: ["Organic/search", "Referral", "Creator/tutor", "Campus", "Paid tests"],
      series: [{ name: "Share", values: [35, 25, 20, 12, 8] }],
    }, "bar", "Channel mix target"),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Competitive Landscape", "Most competitors are strong in one lane. Finder Notes wins by integrating the lanes.", "The positioning is not that every feature beats every incumbent today. It is that the study workflow is more coherent.", [
    chartPanel({
      title: "Positioning map, workflow integration vs study specificity",
      categories: ["Notion", "OneNote", "Goodnotes", "Quizlet", "Chegg", "Khan", "ChatGPT", "Finder"],
      series: [
        { name: "Workflow integration", values: [75, 68, 55, 40, 20, 35, 45, 88] },
        { name: "Study specificity", values: [35, 40, 55, 70, 65, 88, 62, 82] },
      ],
    }, "bar", "Competitive map"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 20 }, [
        headline("Our wedge", 40),
        bullets([
          "Better than blank notes apps for source-connected studying.",
          "Better than flashcard tools for deep math and workspace context.",
          "Better than answer tools for durable learning records.",
          "Better than standalone graphing for connected note workflows.",
        ], 23),
      ]),
    ),
  ], "Public product review; management assessment.");

  s = standardSlide(deck, n++, "Competitor Matrix", "Notes and notebook competitors are powerful, but they are not study-workflow native", "These products are hard to beat on awareness and polish. Finder Notes should beat them on connected learning flow.", [
    authoredTable(
      ["Competitor", "Strength", "Weakness", "Finder Notes angle"],
      [
        ["Notion", "Flexible docs, templates, education free plan", "Blank-canvas friction; not math/source native", "Guided study workspace"],
        ["OneNote", "Free, Microsoft ecosystem, school familiarity", "Less modern workflow; weaker graph/practice integration", "Premium student-first UX"],
        ["Goodnotes", "Handwriting and PDF strength", "iPad-first capture; not source-to-graph workflow", "Web workspace plus math tools"],
        ["Notability", "Audio, handwriting, classroom note capture", "Capture-first; limited structured study data", "Connected source, notes, practice"],
      ],
      { columns: [fr(0.75), fr(1.2), fr(1.25), fr(1.25)], bodySize: 16 },
    ),
  ], "Public competitor product pages reviewed April 30, 2026.");

  s = standardSlide(deck, n++, "Competitor Matrix", "Study, tutoring, and AI competitors are strong, but not durable workspaces", "The biggest threat is that one of them moves into connected notes. Our advantage is starting from the workflow itself.", [
    authoredTable(
      ["Competitor", "Strength", "Weakness", "Finder Notes angle"],
      [
        ["Quizlet", "Flashcards, tests, study sets, brand awareness", "Study-set first; less source/whiteboard depth", "Deep workspace around study content"],
        ["Chegg", "Homework help and paid Q&A", "Answer-first; integrity and cost concerns", "Learning record and practice, not just answers"],
        ["Khan Academy", "Trusted free lessons and practice", "Not a personal notebook/publishing system", "Own the student's private workspace"],
        ["Desmos", "Best-in-class graphing", "Graphing tool, not a notes platform", "Use graphing inside the binder"],
        ["ChatGPT", "Flexible explanation and tutoring", "Conversation is not structured study memory", "AI inside durable study objects"],
      ],
      { columns: [fr(0.75), fr(1.2), fr(1.25), fr(1.25)], bodySize: 15 },
    ),
  ], "Public competitor product pages reviewed April 30, 2026.");

  s = standardSlide(deck, n++, "Where We Win", "Finder Notes can be better because it starts with the whole study session", "The differentiators are product architecture, not only feature checkboxes.", [
    chartPanel({
      title: "Feature coverage comparison",
      categories: ["Source + notes", "Graphing", "Whiteboard", "Practice", "Publishing", "AI-ready data"],
      series: [
        { name: "Average competitor", values: [45, 25, 38, 55, 35, 40] },
        { name: "Finder Notes", values: [90, 85, 80, 72, 70, 78] },
      ],
    }, "bar", "Integrated feature coverage"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Investor proof points", 40),
        bullets([
          "Existing product depth across notes, math, whiteboard, and admin.",
          "Structured data model for future AI and recommendations.",
          "Clear subscription plans mapped to user intensity.",
          "Low current fixed cost means capital can target growth and polish.",
        ], 23),
      ]),
    ),
  ], "Management assessment.");

  s = standardSlide(deck, n++, "Where We Are Worse", "The honest gap: incumbents beat us on brand, polish, scale, and trust today", "This is exactly what the financing is meant to change.", [
    chartPanel({
      title: "Current gap against mature competitors",
      categories: ["Brand awareness", "Mobile/offline", "Polish", "Compliance", "Institutional sales", "AI depth"],
      series: [
        { name: "Incumbent strength", values: [95, 88, 90, 82, 80, 75] },
        { name: "Finder today", values: [12, 35, 55, 30, 10, 25] },
      ],
    }, "bar", "Gap analysis"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Key weaknesses", 40),
        bullets([
          "Stripe Checkout and entitlement updates are scaffolded, not production complete.",
          "No proof yet of paid conversion, retention, or CAC.",
          "No native mobile/offline handwriting product today.",
          "Compliance and institutional trust work must be built before school scale.",
          "Brand name/domain consistency needs a decision before fundraising.",
        ], 22, P.rose),
      ]),
    ),
  ], "Repository review and management assessment.");

  s = standardSlide(deck, n++, "Moats", "The moat can grow from integrated workflow data, creator supply, and product habit", "The product starts as a tool, but the defensibility comes from repeated study sessions and reusable learning objects.", [
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 32 } },
      column({ width: fill, height: fill, gap: 20 }, [
        headline("Defensibility ladder", 40),
        barRows([
          { label: "Workflow habit", value: 80, display: "daily/weekly use", color: P.teal },
          { label: "Private study graph", value: 72, display: "notes + attempts", color: P.blue },
          { label: "Creator content supply", value: 64, display: "publishers/tutors", color: P.gold },
          { label: "AI personalization", value: 58, display: "future", color: P.violet },
          { label: "Institutional trust", value: 50, display: "future", color: P.green },
        ], { valueW: 150, barH: 18 }),
      ]),
    ),
    chartPanel({
      title: "Moat maturity over time",
      categories: ["Now", "6 mo", "12 mo", "24 mo", "36 mo"],
      series: [{ name: "Moat index", values: [20, 35, 52, 70, 82] }],
    }, "line", "Moat-building timeline"),
  ], "Management assessment.");

  s = standardSlide(deck, n++, "Roadmap", "Funding closes the obvious gaps in the right order", "Do payments and analytics first, then retention, mobile/offline, AI, creator supply, and compliance.", [
    chartPanel({
      title: "Roadmap investment intensity",
      categories: ["Paid launch", "Analytics", "Mobile/offline", "AI assist", "Creator tools", "Compliance", "School pilots"],
      series: [
        { name: "0-6 mo", values: [90, 85, 35, 25, 40, 35, 10] },
        { name: "6-18 mo", values: [40, 60, 75, 70, 80, 70, 50] },
      ],
    }, "bar", "Product roadmap"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Sequence", 40),
        bullets([
          "0-3 months: paid launch, entitlement logic, product analytics.",
          "3-6 months: onboarding, retention loops, bug/performance hardening.",
          "6-12 months: mobile/offline, PDFs, creator workflows.",
          "12-18 months: AI study assistant, cohort/admin views, compliance posture.",
        ], 22),
      ]),
    ),
  ], "Management roadmap.");

  s = standardSlide(deck, n++, "Milestones", "The business should be managed through proof gates", "Do not scale spending until the prior gate is clear.", [
    authoredTable(
      ["Phase", "Milestone", "Investor signal"],
      [
        ["Launch", "Stripe live, entitlements live, dashboards instrumented", "Can charge and measure"],
        ["Activation", "40%+ of signups create first binder/note", "Product habit begins"],
        ["Conversion", "5-10% free-to-paid early cohorts", "Willingness to pay"],
        ["Retention", "60%+ M3 paid logo retention", "Real subscription value"],
        ["Growth", "CAC payback under 6 months", "Scaleable channel"],
        ["Expansion", "Creators/tutors drive paid cohorts", "Nonlinear distribution"],
      ],
      { columns: [fr(0.65), fr(1.8), fr(1.25)], bodySize: 18 },
    ),
  ], "Management target framework.");

  s = standardSlide(deck, n++, "Team Plan", "Hire slowly until retention is proven, then add growth and platform depth", "The company does not need a large team to validate. It needs the right sequence of skill sets.", [
    chartPanel({
      title: "Suggested headcount by stage",
      categories: ["Now", "$100k", "$500k", "$1M", "$3M", "$10M"],
      series: [
        { name: "Product/eng", values: [1, 1.5, 2.5, 4, 8, 18] },
        { name: "Growth/content", values: [0, 0.5, 1.5, 3, 6, 14] },
        { name: "Ops/support", values: [0, 0, 0.5, 1, 3, 8] },
      ],
    }, "bar", "Headcount plan"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("First hires", 40),
        bullets([
          "Full-stack product engineer for payments, analytics, reliability.",
          "Product designer/front-end engineer for polished workflows.",
          "Growth/content lead for student and creator acquisition.",
          "Support/community once paid cohorts need help.",
        ], 23),
      ]),
    ),
  ], "Management hiring model.");

  s = standardSlide(deck, n++, "Security And Trust", "Trust is a product feature in education", "Avoid overclaiming. Build the privacy, compliance, security, and data controls needed for families and schools.", [
    chartPanel({
      title: "Trust readiness work",
      categories: ["RLS/audits", "Privacy policy", "Billing security", "Backups", "FERPA posture", "SOC2 path", "School admin"],
      series: [{ name: "Readiness", values: [65, 35, 30, 45, 20, 10, 25] }],
    }, "bar", "Security/compliance roadmap"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Funding priorities", 40),
        bullets([
          "Document data flows and access controls.",
          "Add server-side checkout, webhooks, and entitlement updates.",
          "Backups, logging, abuse controls, and incident response.",
          "School/family compliance review before K-12 expansion.",
        ], 23),
      ]),
    ),
  ], "Repository review and management roadmap.");

  s = standardSlide(deck, n++, "Risk Register", "The risks are real, but they are measurable", "The best investor story is not risk-free. It is a plan to turn risk into milestones.", [
    authoredTable(
      ["Risk", "Why it matters", "Mitigation"],
      [
        ["Paid conversion", "Product may be loved but not paid for", "Launch paid gates and track cohorts"],
        ["Incumbent response", "Notion, Quizlet, Microsoft, or AI tools can copy features", "Move fast on integrated workflow and data"],
        ["AI cost creep", "Unlimited AI can destroy margin", "Credits, plan gates, and caching"],
        ["Compliance", "School trust requires process", "Privacy/security roadmap before school scale"],
        ["Brand/domain", "Finder Notes vs BinderNotes mismatch", "Decide investor brand and domain before pitch"],
      ],
      { columns: [fr(0.75), fr(1.35), fr(1.25)], bodySize: 17 },
    ),
  ], "Management assessment.");

  s = standardSlide(deck, n++, "Venture Logic", "The upside is becoming the operating system for serious studying", "If Finder Notes becomes the place where study work happens, the business expands from subscriptions into creators, tutoring, cohorts, and data-driven learning.", [
    chartPanel({
      title: "Revenue expansion layers",
      categories: ["Student subs", "Creator tools", "Tutor cohorts", "School pilots", "Marketplace", "AI add-ons"],
      series: [
        { name: "Year 1", values: [80, 10, 5, 0, 0, 5] },
        { name: "Year 3", values: [55, 15, 12, 8, 5, 5] },
      ],
    }, "bar", "Revenue mix evolution"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Why investors can win", 40),
        bullets([
          "Massive market with fragmented workflows.",
          "Working product with a credible wedge.",
          "Low current fixed cost and high target gross margin.",
          "Multiple expansion paths after the student beachhead.",
        ], 23),
      ]),
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Closing", "Invest now while the product exists, costs are low, and the category is still unsettled", "The next capital turns BinderNotes/Finder Notes from a strong build into a company with revenue proof and growth evidence.", [
    column({ width: grow(1), height: fill, gap: 24 }, [
      metric("Invest", "$100k-$10M", "Minimum check to strategic growth capital.", P.gold),
      metric("Near-term goal", "Paid launch", "Stripe, analytics, retention, conversion.", P.teal),
      metric("Long-term goal", "Study OS", "The integrated workspace for serious students.", P.violet),
    ]),
    panel({ width: grow(1), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 32 } },
      column({ width: fill, height: fill, gap: 24 }, [
        headline("Investor fit", 42),
        bullets([
          "Pre-seed/seed investors who like product-led education SaaS.",
          "Strategic angels in education, tutoring, creator tools, or AI learning.",
          "Operators who can help with growth, compliance, payments, or schools.",
          "Capital that understands milestones, not vanity headcount.",
        ], 24),
        callout("Simple final line", "We are raising to prove that students will pay for a better way to study, then scale the workspace before a generic incumbent owns it.", P.green),
      ]),
    ),
  ], "Management ask.");

  s = standardSlide(deck, n++, "Appendix", "Financial assumptions used in the deck", "These are working estimates. They should be validated with live cohorts and current vendor contracts before investor distribution.", [
    authoredTable(
      ["Assumption", "Base case"],
      [
        ["Paid plan mix", "70% Plus, 25% Studio, 5% Everything"],
        ["Paid ARPU", `$${paidArpu.toFixed(2)} per month`],
        ["Stripe fees", "2.9% + $0.30 per card payment"],
        ["Current fixed tools", `~$${Math.round(currentMonthlyTotal)} per month from management assumptions`],
        ["100k MAU cloud", "$6.8k core cloud + $3.6k optional AI per month"],
        ["AI cost control", "Metered, plan-gated, cached, or credit-based"],
        ["Gross margin target", `${pct(blendedMargin)} base case paid-user gross margin`],
      ],
      { columns: [fr(1.2), fr(2.2)], bodySize: 20 },
    ),
  ], "Management estimates.");

  s = standardSlide(deck, n++, "Appendix", "Competitor diligence summary", "The pitch should be candid: we can beat competitors on integrated workflow, but we are behind on brand, scale, and some surfaces today.", [
    chartPanel({
      title: "Relative position today",
      categories: ["Workflow", "Math depth", "Brand", "Mobile", "Scale", "Trust"],
      series: [
        { name: "Finder Notes", values: [85, 78, 12, 35, 10, 30] },
        { name: "Mature incumbents", values: [55, 55, 90, 82, 95, 85] },
      ],
    }, "bar", "Competitive gap summary"),
    panel({ width: grow(0.85), height: fill, fill: P.panel, borderRadius: 18, padding: { x: 30, y: 30 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Investor takeaway", 40),
        bullets([
          "This is a wedge bet, not a claim of full incumbent parity.",
          "The core workflow is differentiated enough to test paid demand.",
          "Funding should close the obvious trust, polish, and go-to-market gaps.",
        ], 24),
      ]),
    ),
  ], "Public competitor pages and management assessment.");

  s = standardSlide(deck, n++, "Appendix", "Cost model detail by scale", "The company should update this model monthly as real usage data arrives.", [
    authoredTable(
      ["Scale", "Core cloud", "Optional AI", "Total/mo"],
      cloudScale.map((x) => [x.label, formatMoney(x.vercel + x.supabase + x.storage + x.email + x.obs), formatMoney(x.ai), formatMoney(cloudTotal(x))]),
      { columns: [fr(0.85), fr(1), fr(1), fr(1)], bodySize: 22 },
    ),
  ], "Vendor pricing pages and management estimates.");

  s = standardSlide(deck, n++, "Appendix", "Sources and caveats", "Use this deck as an investor pitch draft, not as audited financials.", [
    panel({ width: fill, height: fill, fill: P.panel, borderRadius: 18, padding: { x: 34, y: 32 } },
      column({ width: fill, height: fill, gap: 18 }, [
        headline("Source basis", 42),
        bullets(sources, 22, P.teal),
        callout("Brand caveat", "The current repository and screenshots use BinderNotes/bindernotes.com. This deck follows the requested investor-facing Finder Notes name while preserving product evidence from the current build.", P.gold),
      ]),
    ),
  ], "Repository, public pages, and management estimates.");

  return deck;
}

async function renderPreviews(deck) {
  await fs.rm(previewDir, { recursive: true, force: true });
  await fs.mkdir(previewDir, { recursive: true });
  const checks = [];
  for (const slide of deck.slides.items) {
    const index = slide.index + 1;
    const canvas = new Canvas(W, H);
    const ctx = canvas.getContext("2d");
    await drawSlideToCtx(slide, deck, ctx, undefined, undefined, undefined, undefined, undefined, undefined, undefined, { clearBeforeDraw: true });
    const file = path.join(previewDir, `slide-${String(index).padStart(2, "0")}.png`);
    await canvas.toFile(file);
    const stats = await fs.stat(file);
    checks.push({ slide: index, path: file, bytes: stats.size, status: stats.size > 50000 ? "ok" : "check" });
  }
  return checks;
}

async function makeMontage(slideCount) {
  const thumbW = 320;
  const thumbH = 180;
  const cols = 6;
  const rowsCount = Math.ceil(slideCount / cols);
  const gap = 14;
  const margin = 24;
  const canvas = new Canvas(cols * thumbW + (cols - 1) * gap + margin * 2, rowsCount * thumbH + (rowsCount - 1) * gap + margin * 2);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < slideCount; i++) {
    const imgPath = path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`);
    const img = await loadImage(imgPath);
    const x = margin + (i % cols) * (thumbW + gap);
    const y = margin + Math.floor(i / cols) * (thumbH + gap);
    ctx.drawImage(img, x, y, thumbW, thumbH);
    ctx.fillStyle = "#32d5c8";
    ctx.font = "16px Aptos";
    ctx.fillText(String(i + 1).padStart(2, "0"), x + 8, y + 22);
  }
  await canvas.toFile(montagePath);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const deck = buildDeck();
  const pptx = await PresentationFile.exportPptx(deck);
  await pptx.save(deckPath);
  const checks = await renderPreviews(deck);
  await makeMontage(deck.slides.items.length);
  const qa = {
    generatedAt: new Date().toISOString(),
    deckPath,
    montagePath,
    previewDir,
    slideCount: deck.slides.items.length,
    previewChecks: checks,
    issues: checks.filter((x) => x.status !== "ok"),
  };
  await fs.writeFile(qaPath, `${JSON.stringify(qa, null, 2)}\n`);
  console.log(JSON.stringify(qa, null, 2));
}

await main();
