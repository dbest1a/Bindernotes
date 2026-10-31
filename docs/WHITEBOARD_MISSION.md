# Whiteboard mission: make BinderNotes' whiteboard the best on the internet

Running log. Updated after every step, so the work survives context compaction. Newest entries go at the end of each section.

- **Branch:** `whiteboard/best-on-internet`, created from `b6c5519` (tip of `free-will/2026-10-31-study-continuity`).
- **Workspace:** `C:\Users\User\Documents\ChatGPT\Bindernotes`, explicitly authorized by the user.
- **Lead:** Claude Opus 5.5 (`claude-opus-5-5`, max effort) in T3 thread `a09c42d4`.

## Ground rules (from AGENTS.md and the mission brief)

- No pushes or force-pushes. Never touch production Supabase, Stripe or Vercel. Never delete data. No migrations, reseeds or schema changes without explicit approval.
- No secrets in output. Real Supabase auth only; no demo auth or demo binders in real accounts.
- Lag is a product bug. Respect `prefers-reduced-motion`. No faked data, no test special-casing, no claims without evidence.
- **Checkpoint (step 4):** stop and show the top 10 ideas and the architecture decision if any item replaces Excalidraw or Desmos, adds a paid service or API key, or changes the database schema or migrations.

### Production safety decision for this mission

When signed in, whiteboards save to the production `whiteboards` table (`src/lib/whiteboards/whiteboard-storage.ts`, `storageMode: "supabase"`). The local dev server on `127.0.0.1:5173` is connected to that production backend. Scripted drawing on a signed-in board would therefore write production data, which this mission forbids.

So all scripted audits and performance measurements run on the **isolated component fixtures** instead. `e2e/fixtures/index.html?board=1` mounts the real `WhiteboardModule` (`variant="lab"`, the same variant the Math Whiteboard Lab uses) with `localStorage` persistence and a stubbed Supabase client. Real Desmos is loaded with the project's existing client key, injected into the page at runtime via `window.__BINDER_NOTES_DESMOS_API_KEY__`. It is never written to a new file or printed. Signed-in surfaces are only observed, never edited.

## Model roster

Each assignment is based on what the model actually did earlier in this session.

| Model | How it runs here | Evidence from this session | Best suited for | Role in this mission |
| --- | --- | --- | --- | --- |
| **Claude Opus 5.5, max** (lead) | This T3 thread | Took over as lead mid-pass. Implemented eight review fixes with mutation-checked tests, split every slice into its own commit while keeping each untouched line's original line ending, connected the local backend without exposing values, and rehearsed rollback. | Integration, UX and design judgment, browser-driven testing, careful multi-file implementation | Browser audit, performance harness, design, integration, final checks |
| **GPT-6 Astra, ultra** | Bundled CLI, `codex.exe exec -m gpt-6-astra -c model_reasoning_effort="ultra" -s read-only` | As the earlier root lead, built and verified the save/recovery slices (1,218 tests, 18 browser checks, rollback). Precise cross-review of search focus trapping. Its in-thread native subagent spawn failed under ChatGPT sharing, but the CLI route works (sessions `01a19289-…`). Follows AGENTS.md literally: it paused to confirm the workspace. | Deep independent analysis | Independent brainstorm, performance deep dives, blind-solving the stress test, diff review before the checkpoint |
| **GPT-6.1 Sol, high** | T3 `delegate_task` (Codex provider) | Its independent review found a real high-severity silent-overwrite regression with an exact reproducer, then reviewed read-only as instructed. Thorough but slow (about 80 minutes per review). | Adversarial correctness review, races, data loss | Review of risky diffs (persistence, sync, pointer and camera code) |
| **Claude Opus 5.5, high** | T3 `delegate_task` (Claude provider) | Same model at lower effort. Its search workstream (run at max) showed it handles exclusive-ownership feature work well. | Fast, bounded research and implementation | Market, design and library research now. Later, bounded feature workstreams with exclusive file ownership. |

## Step 0: context

- Read: `AGENTS.md`, `DESIGN.md`, `PROJECT_MEMORY.md`, `CURRENT_WORK.md`, `RUN_THIS_NEXT.md`, `CODEX_RUN_THIS.md`, `docs/WHITEBOARD_RELEASE_2026-09-24.md`, `docs/DESMOS_INTERACTION_FIX_2026-10-02.md`.
- `RUN_THIS_NEXT.md` and `CODEX_RUN_THIS.md` describe production migrations, seeding and deployment. Those are out of scope and were not run.
- Already in place:
  - Persistence hardening: stale-save protection, recovery tokens and an archive flow. There is a three-saved-board beta limit.
  - Desmos cards move by transform instead of layout (63 → 3 layout passes over 60 pointer moves), with deferred resize, state kept across collapse, minimap, bookmarks, templates and a search manager.
- Explicitly not built yet: handwriting to editable math, an AI tutor that understands the board, step validation, reasoning playback, collaboration, snapping/alignment guides, pen presets.
- Signed-out `/math/lab/whiteboard` redirects to `/auth`. The fixture harness renders the same `WhiteboardModule`.
- `skills-lock.json` contains only `vibe-security`.

## Step 2: baseline (before any fixes)

### Official baseline: production build (the budget reference)

Report: `docs/whiteboard-mission/perf/baseline-prod-2026-10-31T15-55-02-448Z.md` (and `.json`).

- **How it was run:** the hardened harness (`40f4ed4`) against production builds of the isolated fixtures (ports 5199 and 5200). Every scenario produced a valid measurement.
- **Budget rules r2:**
  - The pointer proxy is only judged where a pointer is pressed. Wheel zoom and scroll have no ink to keep glued.
  - Memory is judged after a warm-up batch of 10 cycles.
  - Tool switches also face the frame budgets, not only the INP check.
  - The saved measurements were re-scored with `--rebudget`; no numbers changed.
- **Result:** 109 checks pass and **19 fail. All 19 are real product problems.**
- **Machine:** RTX 5090 through ANGLE/D3D11, 32 cores, headless Chrome, 1440×900. The 4× CPU throttle stands in for a typical student laptop.
- **Synthetic data:** a 320-element board (freedraw, shapes, text, arrows) and three live Desmos graphs on the real API.
- **Notation:** "N >16.7 ms" counts frames that missed 60 fps. "LoAF" is a Long Animation Frame over 50 ms. "Ptr→rAF" is a scheduling proxy, not visible-ink latency.

| Scenario | 1× CPU | 4× CPU | Budget | Result |
| --- | --- | --- | --- | --- |
| Draw 200 strokes | clean: longest frame 12.5 ms; ptr→rAF p95 4.3 ms | **225 >16.7 ms, 30 >33 ms, longest 45.9 ms**; 0 LoAF; ptr→rAF p95 5 ms | 60 fps, nothing >33 ms, no LoAF | ❌ 4× |
| Hand pan, 320 elements + 3 Desmos | **2 >16.7 ms (longest 25 ms)** | **132 >16.7 ms, 5 >33 ms, longest 179 ms; 1 LoAF of 172 ms** (a `setTimeout` handler in our bundle); ptr→rAF p95 15.5 ms | same | ❌ both |
| Ctrl-wheel zoom, same board | **1 frame of 46 ms** | **23 >16.7 ms, 1 >33 ms, stall 210 ms/s; a 53 ms LoAF while settling** | same | ❌ both |
| Wheel scroll, same board | clean | **1 frame of 20.8 ms** | same | ❌ 4× |
| Desmos slider drag | clean: longest 12.5 ms | **118 >16.7 ms, 4 >33 ms, longest 37.6 ms** | same | ❌ 4× |
| Tool switches and clicks | clean; worst interaction 24 ms | **11 >16.7 ms, 4 >33 ms, 2 LoAF (max 108 ms)**; worst interaction 64 ms | same, plus INP ≤ 100 ms | ❌ 4× frames; INP ✅ |
| Warm open: empty / 320-element / 3-Desmos board / study workspace | 172 / 210 / 343 / 101 ms | 464 / 756 / **1,516** / 327 ms | ≤ 1 s warm | ❌ 3-Desmos at 4× |
| Warm open: Math Whiteboard Lab / Math Lab | 151 / 253 ms | 664 / **1,165** ms | ≤ 1 s warm | ❌ Math Lab at 4× |
| Warm open: all 29 chemistry modules | 366–420 ms | 425–714 ms (periodic table slowest) | ≤ 1 s warm | ✅ |
| 3 × 10 Desmos collapse/expand cycles | +1.42 MB warm-up, then +0.34 / +0.18 MB; 1 live and 1 retained calculator of 33; DOM nodes −4 | +1.31 MB warm-up, then +0.32 / +0.21 MB; same counts | no growth after 10 cycles | ✅ |

Cold opens at 4× are slower: 927 / 1,145 / 2,050 / 846 ms for the four boards. The budget is the warm open, but cold numbers will be reported after fixes too.

What this shows:
- **Everything passes at 1× except pan and zoom.** At 4× the board misses 60 fps while drawing, panning, zooming, dragging a Desmos slider and switching tools.
- **The worst single stall is the pan settle.** A 172 ms long frame comes from a timer handler in our own bundle, which matches the profile below: a camera-only change prepares a full-board save.
- **The 3-Desmos board and the Math Lab miss the 1 s warm open** at 4×. Chemistry modules pass.
- **No memory leak.** Destroyed calculators are released, and growth flattens after the first batch.

### Dev-server stress reference (first run, superseded for budgets)

Raw reports: `docs/whiteboard-mission/perf/baseline-2026-10-31T15-27-25-334Z.md` (draw, pan, tools, open) and `baseline-desmos-labs-2026-10-31T15-38-53-349Z.md` (slider, memory, labs).

These ran on the Vite dev server, before the harness fixes listed below. React's development-mode overhead inflates them, so they are kept only as a stress reference.

| Scenario | 1× CPU | 4× CPU | Budget |
| --- | --- | --- | --- |
| Draw 200 strokes | 0 dropped frames, ptr→rAF proxy p95 4.3 ms | **219 long animation frames (max 134 ms), 316 frames over 33 ms**, 2.25% dropped; ptr→rAF proxy p95 4 ms | 60 fps, no frame over 33 ms, no long frame over 50 ms |
| Pan/zoom, 320 elements + 3 Desmos | 0.26% dropped, **1 frame of 33.4 ms** | **9.8% dropped, 15 frames over 33 ms, 11 long frames (max 296 ms), worst interaction 304 ms** | same |
| Desmos slider drag | 0 dropped, p95 4.3 ms | 2.6% dropped, 1 frame of 41.6 ms | same |
| Tool switches and clicks | worst 40 ms | **worst 256 ms** | ≤ 100 ms (INP) |
| Warm open: empty / 320-element / 3-Desmos board | 193 / 163 / 339 ms | 879 / **1,140** / **2,233** ms | ≤ 1 s |
| Warm open: Math Whiteboard Lab (picker → New Whiteboard → canvas) | 252 ms | **1,346 ms** | ≤ 1 s |
| Warm open: Math Lab / chemistry modules | 115 ms / 383–446 ms | 495 ms / 587–759 ms, **periodic table 1,198 ms** | ≤ 1 s |
| Ten Desmos open/close cycles (collapse/expand) | heap +3.14 MB (test artifact, withdrawn; see the review below) | heap +2.56 MB (same) | no growth |

What the first run suggested, and what held up:
- **The pointer→rAF proxy stays near 4 ms, even at 4×.** This is a scheduling proxy, not measured visible-ink latency.
- **The cost lands at stroke end and pan settle.** Long Animation Frame attribution at 4× while drawing is mostly `dispatchDiscreteEvent` (8.5 s) and Excalidraw's `onpointerup` (7.1 s). That is the stroke-end flush, which is consistent with Astra's serialization hypothesis. The CPU profiles below split our code from Excalidraw's.
- **Desmos `destroy()` works.** The apparent heap growth came from the test loader holding destroyed calculators.

### CPU-profile attribution (4×, dev server, `--profile`; `perf/profile-4x-*.json`)

Absolute times include profiler overhead; the relative attribution is what matters.

- **Pan:** top self time is `getBoundingClientRect` (**899 ms**), then `querySelectorAll` (151 ms).
  - App-inclusive leaders are `syncWhiteboardPinnedModuleLayerToViewport` (260 ms), the module's rAF and viewport handlers, and `saveWhiteboard` → `sanitizeWhiteboardForStorage` → `estimateJsonSizeBytes` (114 ms).
  - A camera-only change triggers a full-board save preparation.
  - **Confirmed:** layout reads during camera sync, per-frame card rediscovery, and saves on camera change.
- **Draw:** the stroke-end path is our canvas flush (`whiteboard-canvas.tsx:145/164`, about 366 ms over 60 strokes), plus the module scene handler (`whiteboard-module.tsx:790/818`, about 250 ms), `hasPersistentWhiteboardSceneChange` (186 ms) and `writeWhiteboardRecoveryDraft` (157 ms). The closed `WhiteboardStudyTools` panel still computes (78 ms).
  - **Confirmed:** serialization at stroke end, and closed tools doing work.
- **Tool switches** reach `saveWhiteboard`, `hasPersistentWhiteboardSceneChange` and `estimateJsonSizeBytes` through an `appState`-only change.
- **Methodology correction.** The largest self-time items are React development-mode helpers (`jsx`, `logComponentRender`, `addObjectDiffToProperties`), because the fixtures run on the Vite dev server.
  - Budget numbers therefore come from **production builds** of the same fixtures: `e2e/fixtures/perf-board.vite.config.ts` on port 5199 and `perf-lab.vite.config.ts` on port 5200.
  - The dev-server baseline above is kept as a stress reference.
  - **Ruled out as a primary cause:** unstable Excalidraw props. Excalidraw's memo comparator handles them.

### Independent review of the harness (Astra, pre-checkpoint) and the corrections it forced

Astra reviewed the harness and fixture diff (`astra/03-diff-review-output.md`, 13 findings, five of them high) and verified fixture isolation and that nothing leaks into the production build. Its findings changed what this log may claim:

- **The memory "leak" (friction point 12) is withdrawn.**
  - The fixture Desmos loader kept every destroyed calculator in `window.__desmosChecks`, so the +2.6–3.1 MB was partly the test itself.
  - With the loader fixed (destroyed instances are released, and only completed disposal is counted), the growth per 10 cycles was +1.32 / +0.33 / +0.19 MB in three batches.
  - DOM nodes changed by −4, and only the live calculator was retained. That points to warm-up caches, not a product leak.
- **"Ink stays glued (about 4 ms)" was overclaimed.** That figure is a pointer→`requestAnimationFrame` *scheduling proxy*, not measured visible-ink latency. It is now labelled that way, and no visible-latency claim is made until ink presentation is instrumented.
- **The dropped-frame "share" was diluted** by uncapped ~230 Hz callbacks. Budgets now use frames over 16.7 ms and over 33 ms, stall ms/s, and the longest frame.
- **The harness itself was fixed** in `40f4ed4`:
  - exact per-navigation seeding with board-identity checks;
  - explicit validity states, so failures fail the budgets;
  - observers drained and entries classified by their own timestamps;
  - a 1.8 s settle window covering autosave;
  - warm opens taken as the median of three reloads;
  - pan, ctrl-wheel zoom and scroll reported separately;
  - continuous slider sweeps;
  - loopback-only origins and redacted reports.
- **Key incident (disclosed).**
  - **What happened:** before the fix, a run of the old harness wrote the Desmos client key into an uncommitted preliminary report, via a Long Animation Frame invoker URL. The key's first seven characters also appeared once in a terminal summary.
  - **Scope:** this is the public client key that the production site already ships in its JavaScript. Nothing committed contained it (checked with `git grep` on `HEAD`).
  - **Cleanup:** all six occurrences in three local files were redacted. The harness now strips invoker query strings in the page and redacts the key from every output.
- **Budget numbers come only from production builds** of the fixtures. The dev-server figures above remain a stress reference, and the earliest production run (made before the harness fixes) is archived under `.tmp/whiteboard-mission/perf/preliminary/`.

## Step 1: audit, the 15 worst friction points (ranked)

Screenshots are in `docs/whiteboard-mission/screens/`. They were captured on the isolated fixtures with Playwright (Chrome), because the T3 browser's snapshot tool timed out on this page three times; `preview_evaluate` still worked.

| # | Friction point | Evidence |
| --- | --- | --- |
| 1 | **Drawing misses 60 fps on slower laptops.** At 4×, 200 strokes produce 225 frames over 16.7 ms and 30 over 33 ms (longest 46 ms). Drawing is the most frequent action on the board. | Production baseline, draw at 4×. The dev profiles attribute the stroke-end cost to `onpointerup` and our flush, which runs `JSON.stringify` on both whole scenes at `whiteboard-serialization.ts:175` plus a recovery write. |
| 2 | **Panning and zooming a real board (Desmos plus ink) stutters, even at full speed.** At 4×, a hand pan has 132 frames over 16.7 ms and one 179 ms freeze, and zooming stalls 210 ms of every second. At 1×, a pan still drops 2 frames and a zoom has a 46 ms frame. | Production baseline, pan at 1× and 4×. The 172 ms long frame is a timer handler in our bundle. Profiles: `getBoundingClientRect`, per-frame `querySelectorAll`, and a full save prepared on camera-only changes. |
| 3 | **Tool switches drop frames on a busy board.** At 4×: 11 frames over 16.7 ms, 4 over 33 ms, and 2 long frames up to 108 ms. Input response stays within budget (worst 64 ms). | Production baseline, tools at 4×. The dev run's 256 ms worst interaction was development-mode overhead and did not reproduce. |
| 4 | **The graph board and the Math Lab open slowly.** Warm opens at 4×: 1.52 s for the board with three graphs (2.05 s cold) and 1.17 s for the Math Lab. The Whiteboard Lab also needs an extra picker click before any canvas. | Production baseline, open and labs; screenshot `01-lab-first-run-picker`. |
| 5 | **Desmos cards are bright white on the dark board and start empty.** The headline feature looks bolted on. | `04-lab-desmos-card` |
| 6 | **New cards land on top of existing ones.** A calculator covered the graph. | `05-lab-second-module-placement`; `findOpenWhiteboardModuleFrameNearViewport` ignores `_existingModules` (`whiteboard-layout.ts:113`). |
| 7 | **Graph work is not part of the board save.** Desmos state lives in device-local storage, so a board reopened elsewhere can lose its expressions. | Astra's code read: `whiteboard-pinned-object-layer.tsx:564`, `use-math-workspace.ts:318`, `whiteboard-export.ts:55`. To be confirmed by a test in Phase A. |
| 8 | **Overlays cover the canvas.** A persistent "Whiteboard focus is on…" toast over the top center, plus a permanent pan hint. | `02-lab-new-board` and the user's own screenshot. |
| 9 | **A dense, always-open side panel** (12 controls, about 300 px over the board). No minimalist mode; duplicate Home / Back-to-workspace navigation. | `02-lab-new-board` |
| 10 | **On a phone the lab panel and toast cover the board.** | `06-lab-mobile-board` (390×844) |
| 11 | **Two separate undo systems** ("Undo card" vs. drawing undo). After removing a card from the board view there is no reachable "Undo card". | `02`, and the probe log: the removed card cannot be restored with the panel absent. |
| 12 | ~~Heap grows about 0.3 MB per graph open/close cycle.~~ **Withdrawn after independent review.** The test harness was retaining the calculators; with the loader fixed, growth flattens to +0.19 MB per batch. Replaced by: **SVG export turns graphs into text cards**, so a student's annotated graph loses its plotted evidence. | `whiteboard-export.ts:34` (Astra weakness 10). |
| 13 | **The chemistry Lewis builder draws the wrong molecule.** H₂O is shown as one large H bonded to one O. | `09-chem-chem-molecule-builder`; `chemistry-workspace-modules.tsx:937` |
| 14 | **A fake "Desmos" titration curve.** A static, chemically wrong SVG with developer copy ("Desmos key detected…"). | `09-chem-chem-desmos-titration-curve`; `chemistry-workspace-modules.tsx:1140` |
| 15 | **Internal jargon and dishonest status shown to students:** "Create a Supabase-saved board", FIXED/SCREEN/BOARD badges, "MVP Lewis builder", "Desmos key detected". Note cards always claim "Saved with board". Math Lab reads like a marketing page and is light while the Whiteboard Lab is dark. | `01`, `04`, `05`, `07`, `09`; `whiteboard-pinned-object-layer.tsx:381` |

Also noted, outside the top 15:
- SVG export turns graphs into text cards.
- The three-board cap: the user's real account shows "3 / 3 saved".
- The periodic table is the slowest chemistry module: 714 ms warm at 4×, within budget.
- Card header actions are icon-only.

## Step 3: research (Claude Opus 5.5 high, read-only, cited)

The full report with sources is the final message of the [research thread](<t3-thread://v2/4b80b5ec-8fc9-41a1-8053-c079d147a486/thread:delegated-task:command%3Amcp%3Affd98327-083e-421c-baae-00aa939acc6e%3Adelegate-task%3Acc8a8385-3510-405b-b958-58e8d142e6ac>). Key findings:

- **Licensing (decision-relevant)**
  - **Desmos.** The API terms v1.0 (11 July 2025, [api-terms.md](https://raw.githubusercontent.com/desmosinc/policies/main/api-terms.md)) limit the free tier to "personal, non-commercial use or a 90 day trial". Commercial use is "any use of the API in an Application that is accessed by End Users in production" and needs a paid plan or a Commercial Addendum (contact partnerships@desmos.com). Desmos branding may not be hidden.
    - BinderNotes already uses Desmos in production, and this plan makes Desmos the highlight. **The owner needs to confirm the Desmos plan.**
  - **tldraw** needs a paid production license, reportedly about $6k/yr ([pricing](https://tldraw.dev/pricing), [FAQ](https://tldraw.dev/faq)). **Stay on Excalidraw (MIT)** and copy tldraw's patterns instead: perfect-freehand ink, streamed agent actions, and its approach to describing the board to a model.
  - **GeoGebra** is non-commercial only ([license](https://geogebra.org/license)). Avoid it.
- **Competitors**
  - Apple Math Notes sets the bar for magic: an answer written in the student's own handwriting, plus live sliders. It has no steps, is weak beyond basic algebra, and runs only on Apple devices.
  - Goodnotes flags wrong equations. Miro recognizes shapes on pen-up.
  - The interactive visuals in ChatGPT, Gemini and Claude (March 2026) are ephemeral, chat-bound and drawn from fixed concept sets.
- **What nobody does well yet**
  - One persistent board where handwriting, live math, graphs and molecules all stay editable.
  - CAS-verified, scrubbable step-by-step work written onto the student's own board.
  - Chemistry as a first-class object.
  - A Socratic AI that points at a specific line of the student's own work.
  - Linked formula, slider and graph objects on a saved board.
- **Building blocks** (license / size)
  - **Math:** MathLive (MIT, 216 KB gz, lazy). KaTeX (MIT, 75 KB gz), plus `mhchem` for `\ce{}`. Compute Engine (MIT, 1.5 MB gz, run in a Web Worker); it is the local, keyless way to verify each step.
  - **Chemistry:** RDKit.js (BSD-3, 7 MB WASM, lazy, SMILES → SVG). Ketcher (Apache-2.0, 20 MB, an on-demand editor only). 3Dmol.js (BSD-3, 159 KB gz). Mol* (MIT; heavy, for proteins).
  - **Board objects** store the source data (LaTeX, MathJSON, SMILES, KET, Desmos state) plus a cached SVG preview. The heavy engine mounts only on focus.
- **Handwriting**
  - Mathpix strokes cost $0.002 per request (paid key). MyScript has a commercial quote.
  - Open models: TAMER and PosFormer for math, DECIMER for chemistry; self-hosted later.
  - **All recognition options are [APPROVAL] or deferred.**
- **AI step-by-step architecture**
  - Board context: a region image plus structured card data.
  - Structured, streamed `{latex, justification, highlightTargets}` steps.
  - Compute Engine verification of each step.
  - Rendering with KaTeX or ink.
  - A single rAF-driven 0–1 reveal per step: no React state per frame, and reduced motion shows whole steps.
  - Saved in board JSON for offline replay.
  - **The LLM call needs a paid API key, so it is [APPROVAL].**
- **Design skills**
  - Installed today: only `vibe-security`.
  - Recommended: **Impeccable** ([pbakaus/impeccable](https://github.com/pbakaus/impeccable), Apache-2.0, `audit/critique/polish/quieter/harden`) and **Emil Kowalski skills** ([emilkowalski/skills](https://github.com/emilkowalski/skills), MIT, animation craft and motion performance).
  - Taste Skill fits marketing pages only: its stock-image approach conflicts with DESIGN.md inside the workspace.
  - The Medium article (members only) and the Short's exact list could not be fully verified.

## Step 4: checkpoint — top 10, architecture decision, approvals

### Top 10 (merged from both lists, ranked)

Ranked by measured friction, impact on "best whiteboard", and the user's stated priorities.

| # | Idea | Why it ranks here | Approval? |
| --- | --- | --- | --- |
| 1 | **Edit-proportional saves (A1).** Version-signature change detection; no full-board save for camera-only or tool-only changes; recovery prep moved off the stroke-end frame; debounced, coalesced card saves. | Friction 1 and 3. Profiles put our own serialization on every stroke end and tool switch. | No |
| 2 | **One efficient camera path (A2).** Cached host geometry, card refs registered once, transforms for every card type. | Friction 2. Profiles: `getBoundingClientRect` and `querySelectorAll` dominate panning. | No |
| 3 | **Desmos that belongs on the board (B1 + A3 + A4).** A dark graph theme matched to the board; starter expressions; a clean header and a "graph only" toggle; graph state saved with the board; new cards placed in open space. | The highlight feature. Friction 5–7. | No; but see the Desmos commercial plan below |
| 4 | **A clear canvas and minimalist mode (A5 + B2).** Chrome fades, a floating auto-hiding tool pill, a mobile bottom sheet; toasts and hints dismiss themselves. | Friction 8–10, and the user's explicit request. | No |
| 5 | **Plain language, truthful status, and a design-skills pass (A6).** Impeccable `audit/critique/polish/quieter` and Emil Kowalski motion review, applied within DESIGN.md. | Friction 15, and the user's request to use the design skills. | No (free, open-source skills) |
| 6 | **Magnetic snapping, alignment guides and smooth tool transitions (B5).** | Visual pop and tidiness; screen-pixel tolerances. | No |
| 7 | **Ink presets, perfect-freehand tuning and hold-to-shape recognition (B6).** Undo restores the original ink. | Visual pop at Miro or Goodnotes level. | No |
| 8 | **Equations as live, linked objects (B3).** KaTeX formula tiles ↔ sliders ↔ graph; MathLive input; `$…$` math text. | Research gap: linked objects on a saved board. | No (MIT libraries) |
| 9 | **Real chemistry objects (B4).** RDKit.js molecule cards (SMILES → SVG); 3Dmol.js 3D on demand; `mhchem` equations; live Desmos titration and kinetics replacing the fake SVG; a corrected Lewis builder. | Friction 13–14; the research gap of chemistry as a first-class object. | No (BSD/MIT/Apache libraries) |
| 10 | **Scrubbable step-by-step solutions on the board (B8).** A rAF-driven reveal timeline, Compute Engine step verification, and deterministic chemistry solvers (pH, titration, Nernst, van 't Hoff, kinetics). Then the **LLM explainer** that writes steps for arbitrary problems. | The user's headline request; nobody does CAS-verified steps on the student's own board. | **Renderer and engines: no. LLM explainer: yes (paid API key).** |

Next after the top 10: springy inertial pan and zoom (once camera alignment is proven), graph-coordinate annotations, export of real graphs, navigation map, retrieval practice from solved boards, and a first-wrong-step checker.

### Architecture decision

- **Keep Excalidraw (MIT) as the canvas and Desmos as the graph engine.** No replacement: profiles show the main costs are in our own save and camera code, and tldraw needs a paid production license.
- **No database schema change or migration.**
  - New objects (formula tiles, molecule cards, step timelines, graph state) live in the existing board JSON (`scene` and `modules`).
  - Each stores its source data (LaTeX, MathJSON, SMILES, Desmos state) plus a cached SVG preview. Heavy engines (Compute Engine in a worker, RDKit WASM, 3Dmol, MathLive) load lazily on focus.
- **New dependencies, all permissive:** MathLive (MIT), Compute Engine (MIT), RDKit.js (BSD-3), 3Dmol.js (BSD-3). KaTeX is already installed. Ketcher (20 MB) is deferred.
- **Performance architecture**
  - Version-signature change detection.
  - Content saves separated from camera metadata.
  - One rAF loop per gesture, with refs and transforms instead of React state per pointer move.
  - Budgets enforced by the hardened harness against production builds.
- **AI, if approved**
  - A server-side function holds the key; the browser never sees it. Calls are authenticated with the Supabase session JWT, with per-user rate and cost caps.
  - Output is a structured step list, verified by Compute Engine in a worker. Uncertain steps are labelled, never presented as checked.

### Needs a decision from the owner

1. **AI explainer:** may BinderNotes add a paid LLM API (provider, key, monthly cap)? Without it, item 10 ships with the renderer and the deterministic engines only.
2. **Desmos commercial plan (business, not code):** production use needs a paid plan or a Commercial Addendum under the API terms.
3. **Handwriting recognition** (Mathpix strokes, $0.002 per request): deferred unless approved.

## Merged scoring detail

**Sources:** `whiteboard-mission/lead-ideas.md` (Claude, 28 ideas, written first) and `astra/01-brainstorm-output.md` (Astra, 34 ideas, independent). Duplicates are merged. In the source column, **L** is the lead list and **A** is Astra's list.

**Scoring:** impact (I), effort (E) and risk (R), each 1–5. Score = 2I − E − R. Friction numbers refer to the step 1 audit. **[APPROVAL]** marks items that add a paid service or API key, change the database schema, or replace Excalidraw or Desmos.

### Phase A: performance and seamlessness

| ID | Idea (merged) | Source | I/E/R | Score | Fixes friction |
| --- | --- | --- | --- | --- | --- |
| A1 | **Edit-proportional saves.** Version-signature change detection instead of full-scene `JSON.stringify`; no full-board save prep for camera-only or tool-only `appState` changes; recovery serialization off the stroke-end frame (synchronous flush on `pagehide` kept); debounce card saves and coalesce the queue. | L1, L3, A5, Astra deep dive | 5/3/3 | 4 | 1, 3 |
| A2 | **One efficient camera path.** Cache host geometry (no `getBoundingClientRect` per callback), register card refs once (no per-frame `querySelectorAll`), and move every card type by transform. | L2, L5, A2 | 5/3/2 | 5 | 2 |
| A3 | **Board-owned graph state.** Desmos state written into the board revision and restored on another device. | A4 | 5/3/3 | 4 | 7 |
| A4 | **Open placement for new cards.** Use the existing collision helpers; never stack a card on another. | A (weakness 9), B2 | 4/2/1 | 5 | 6 |
| A5 | **Clear the canvas.** The focus toast dismisses itself and the pan hint shows once; mobile gets a bottom-sheet panel. | Audit | 4/1/1 | 6 | 8, 10 |
| A6 | **Truthful save status and plain language.** Cards reflect the board's real state; remove "Supabase", FIXED/SCREEN, "MVP" and "Desmos key detected" from student UI. | A10, audit | 4/2/1 | 5 | 15 |
| A7 | **Closed controls cost nothing.** Mount study-tools contents only when open; lazy KaTeX on the whiteboard route; memoize source text. | L6, L7, A7 | 3/2/1 | 3 | 1, 4 |
| A8 | **Bounded live-graph lifecycle.** Defer offscreen initialization; park distant graphs with a snapshot preview. | L4, A3 | 4/4/4 | 0 | 4 (Desmos open) |
| A9 | **Undo as intentions, not module-array snapshots.** Fixes heap growth; later, one chronology with drawing undo. | A6 | 4/4/4 | 0 | 11, 12 |
| A10 | **Desmos lifecycle polish:** bounded layout wait, a retry action, one durable write per change. | A9 | 3/3/2 | 1 | 5, 12 |
| A11 | **Export the real graph** (with its annotations) to SVG/PNG. | A12 | 4/3/3 | 2 | Noted |
| A12 | **Gesture ownership matrix:** pen, touch, trackpad and pinch tests. | A8 | 4/3/3 | 2 | n/a |

### Phase B: visual pop

| ID | Idea (merged) | Source | I/E/R | Score |
| --- | --- | --- | --- | --- |
| B1 | **Desmos that belongs on the board.** Dark graph theme matching the board, starter expressions, a clean card header, and a "graph only" toggle. | L8, L19, audit 5 | 5/2/1 | 7 |
| B2 | **Minimalist mode.** All chrome fades; a floating, auto-hiding tool pill; keyboard access; a calm "sheet of paper". | L18, user request | 5/3/2 | 5 |
| B3 | **Equations as live objects.** Lesson formula → KaTeX tile → plot in a chosen graph; `$…$` math text on the board; MathLive input. | L20, A6 (B6) | 5/3/2 | 5 |
| B4 | **Real chemistry objects.** Live Desmos titration and kinetics from data instead of the fake SVG; correct molecules from SMILES via RDKit.js (2D), with an optional 3D viewer. | L16, A9, A10 (B9/B10), audit 13–14 | 5/4/3 | 3 |
| B5 | **Magnetic snapping and alignment guides,** plus smooth tool transitions. | L11, L14, A (B2, B4) | 4/3/2 | 3 |
| B6 | **Ink presets and smoothing, plus hold-to-shape recognition** (undo restores the ink). | L12, L13, A (B3) | 4/4/3 | 1 |
| B7 | **Annotations pinned to graph coordinates.** | L15, A (B7) | 5/4/4 | 2 |
| B8 | **Scrubbable step-by-step solutions on the board.** The renderer and deterministic engines (Compute Engine algebra/calculus; exact chemistry solvers) need no key. The **LLM explainer is [APPROVAL].** | L17, A (C1) | 5/5/4 | 1 (user priority) |
| B9 | **Springy inertial pan and zoom,** after A2, with reduced-motion respected. | L10, A (B1) | 3/4/4 | −2 |
| B10 | Shared sliders across graphs; first-class graph selection and grouping; navigation map; visual checkpoints; presentation laser. | A (B5, B8, B11, B12), L21 | 3–5/3–5/2–4 | ≤2 |

### Phase C: bigger bets

- Board → retrieval practice (A C8).
- A deterministic first-wrong-step checker (A C2).
- A unit-cancellation and stoichiometry workbench (A C5).
- Reasoning replay (L24, A C7).
- Reaction storyboards with electron accounting (A C6).
- A spatial math notebook (L27).
- Handwriting → math **[APPROVAL: recognition service]** (L22, A C3).
- Collaborative tutoring **[APPROVAL: schema and realtime]** (L25, A C10).
- Offline IndexedDB revision vault: a local schema only, no Supabase change (A C9).
- Replace Excalidraw with tldraw **[APPROVAL; not recommended]** (L26).

## Owner decisions at the checkpoint (17:20)

- **Budget $0.** No paid AI APIs, Mathpix, subscriptions or licences. Step-by-step solutions use free local engines (Compute Engine, deterministic solvers); anything that costs money is deferred.
- **Keep free Desmos.** The owner is not selling BinderNotes. Desmos API Terms v1.0 (11 July 2025), §2.a: free use must be "personal, non-commercial use or a 90 day trial", and "Commercial use includes any use of the API in an Application that is accessed by End Users in production". By Desmos's own definition, a deployed site that other students use counts as commercial even when it is free. The owner's own use and local testing are covered. §5.b forbids hiding Desmos branding, which stays visible on every graph. Zero-cost options if Desmos ever objects are listed in the final report.
- **Later in the session:** the owner allowed pushing live to Vercel and Supabase "if you want", and asked to make sure Desmos works.

## Step 5: build

### AI roster for the build (cost-efficient, existing subscriptions only)

| Work | Model | Why this model |
| --- | --- | --- |
| Performance, UX, integration, browser checks, final verification | Claude Opus 5.5, max (lead) | Integration judgment and measurement discipline |
| Worked Solutions board object (headline feature) | Claude Fable 5.1, high (worktree) | The premier model for the premier feature |
| Exact chemistry engines and module fixes | GPT-6.1 Sol, high (worktree, Codex) | Numerical correctness; spreads load across both subscriptions |
| Molecule and reaction card (RDKit.js) | Claude Sonnet 5.5, high (worktree) | Well-bounded integration, cheaper model |
| Stress-test questions and verified answer keys | Claude Opus 5.5, high (worktree) | Deep math and chemistry reasoning without max cost |
| Blind solve of the stress test | GPT-6 Astra, ultra (CLI, read-only) | As specified in the brief |

### Free engines added (`fda96a7`)

- `@cortex-js/compute-engine` 0.175 (MIT), `mathlive` 0.111 (MIT), `@rdkit/rdkit` 2026.9.1 (BSD-3-Clause).
- Installed with npm 11 through the bundled pnpm, because npm is not on this machine; the lockfile diff is additive only.
- All three load lazily.

### Performance: measured, kept only where it helped

Interleaved A/B: the previous build (port 5201) against the candidate (5199), alternating runs, so both sides share the same machine load. Background workstreams were compiling at the same time, which made single runs misleading (an early run looked like a regression).

| Change | Scenario at 4× CPU | Before | After |
| --- | --- | --- | --- |
| Save path off strokes, pans and tool switches (`6cc888a`) | Draw: frames >16.7 ms / >33 ms, stall | 207 / 25, 24.1 ms/s | **19 / 0, 0.7 ms/s** |
| | Hand pan | 140 / 9, 124 ms/s | **39 / 3, 50 ms/s** |
| | Ctrl-wheel zoom | 25 / 2, 238 ms/s | **2 / 1, 37 ms/s** |
| | Desmos slider drag | 151 / 3, 56 ms/s | **7 / 0, 4 ms/s** |
| | Tool switches | 15 / 6, 91 ms/s | **11 / 3, 71 ms/s** |
| Graph-first Desmos cards (`9cff6b8`) | Desmos layout reads: one idle second / one hand pan | 2,150 / 15,012 | **2 / 54** |
| Realistic seeds in the harness (`064e6d4`) | Hand pan long animation frames | one ~130 ms | **none** (it was a one-time normalization save of unindexed seed elements) |

What the profiles and probes found:
- **Our save path ran on every stroke and pan.** Five full-scene serializations per stroke end; a full board re-render whenever the camera paused; a layout read on every Excalidraw change. Fixed with version signatures, idle-time recovery drafts, a settled-camera store and cached geometry.
- **A latent data-safety bug.** The old change check compared two live Excalidraw scenes, and Excalidraw mutates elements in place while dragging, so a pure move could compare equal to itself. The signature is recorded when a scene is handed on, which closes that gap; a unit test covers it.
- **Desmos's expression list reads layout every frame, on its own.** Three idle calculators on a bare page with no BinderNotes code: about 2,900 reads per second; with the list collapsed: 0. Board graphs therefore open graph-first (dark, list one click away). Graphs whose saved state has sliders open with the list, because that is where sliders live.
- **A Desmos pointer filter was tried and reverted.** Desmos listens for pointer moves on `document`, but blocking moves away from graphs changed nothing measurable, and a global patch is not worth carrying without a benefit.
- **Opening a board must not write it.** Desmos announces a change while normalizing a loaded state; that is no longer treated as an edit, and identical or no-op workspace updates no longer get a new timestamp.

### Seamlessness and design

- **Graphs are saved with the board** (`8e70755`). A graph card writes its workspace into the board save 800 ms after edits pause (and at once on unmount), outside card undo. Each workspace carries a `savedAt` stamp, and the newer of the board copy and this device's cache wins, so a stale device cannot overwrite newer work.
- **New cards no longer land on existing ones** (`640ebed`, `ea62a11`), for board-pinned and screen-pinned cards alike.
- **Minimal mode** (`d879cfc`): the board, its cards and one pill (save state, Add module, the way back), mirrored to Excalidraw's Zen mode (Alt+Z) and remembered per device. The pill fades while a pen is down.
- **Honest copy:** notes cards report the board's real save state; no "Supabase-saved", no eyebrow label, no SCREEN / FIXED / BOARD chips; the full-screen hint shows once per device; on phones the control panel starts as a chip.
- **Design skills installed and used** (`d52692c`): Impeccable (audit, craft floor, Operate mode), Emil Kowalski's design engineering and animation performance. Applied: restrained color with accent only for state, opacity-only motion at 180 ms with a strong ease-out, no animation on frequent actions, reduced motion respected, controls that name their action.
- Screenshots after these changes: `docs/whiteboard-mission/screens-after/`.

### Verification so far

- Typecheck clean; 363 unit tests across the whiteboard, math, hooks and reader suites pass.
- Real Desmos end-to-end (`e2e/desmos.spec.ts` through `scripts/verify-desmos-interactions.mjs`): 3/3. Whiteboard end-to-end (`e2e/whiteboard.spec.ts`): 4/4.
- Desmos now works in the local preview too: the existing client key was copied into the gitignored `.env.development.local` (never printed).
- This project has no linter configured; strict TypeScript checking stands in for "lint".

## Log

- **16:15.** Created the branch and this log. Started Astra's independent brainstorm and performance deep dive (prompts and outputs in `docs/whiteboard-mission/astra/`). Started a Claude Opus high research delegate.
- **16:20.** Both Astra runs stopped before reading code to confirm the workspace, because AGENTS.md names an older path. Added an explicit workspace-authorization line to both prompts and re-ran them. The first attempts' logs are kept under `.tmp/whiteboard-mission/astra/*-attempt1.log`.
- **16:30.** Astra's performance deep dive completed (`astra/02-perf-deep-dive-output.md`, about 97k tokens). Its verdicts are hypotheses, confirmed or ruled out by the harness below.
  - **Likely:** stroke-end flush serializes the full payload about seven times (two `JSON.stringify` scene comparisons and three recovery-write serializations); note-card edits save the whole board immediately and clone all modules into undo history per keystroke; a `getBoundingClientRect` read on every Excalidraw callback; offscreen Desmos graphs forced live; non-Desmos fixed-size cards still moved with `left`/`top`; KaTeX imported eagerly on the whiteboard route; closed study tools still compute the minimap and source text.
  - **Unlikely:** unstable Excalidraw props (its memo comparator ignores `initialData` and deep-compares `UIOptions`); pointer-layer fighting.
- **16:35.** Built the performance harness, `scripts/perf/whiteboard-perf.mjs` (Playwright + CDP, Chrome).
  - **What it measures:** `requestAnimationFrame` frame intervals, Long Animation Frames with script attribution and script vs. render split, Event Timing interactions (an INP proxy), pointermove → next-frame latency (an ink-lag proxy), and CDP heap and DOM counters with a live/destroyed Desmos calculator count.
  - **Scenarios:** draw 200 strokes; pan and zoom a 320-element board with three live Desmos graphs; drag a Desmos slider; switch tools and click; open demos warm; open and close a Desmos card ten times. Each runs at 1× and 4× CPU throttle.
  - **Methodology note:** headless GPU Chrome on this machine (RTX 5090 through ANGLE, 32 cores) does not cap `requestAnimationFrame` at 60 Hz; idle frames run at about 230 fps. So the 60 fps budget is measured as the share of frames slower than 16.7 ms (a dropped frame at 60 Hz). Average fps is not used.
- **16:40.** Lead idea list written (`whiteboard-mission/lead-ideas.md`) before reading Astra's brainstorm.
- **16:45.** Astra's independent brainstorm completed (`astra/01-brainstorm-output.md`, about 128k tokens, 34 ideas). It also found real defects in existing code, two of which I confirmed:
  - Graph state is not written back into the saved board; it lives in device-local storage.
  - Private-note cards hard-code a "saved" status (confirmed: `whiteboard-pinned-object-layer.tsx:381`).
  - "Find open space" ignores existing cards (confirmed: `whiteboard-layout.ts:113` ignores `_existingModules`).
  - Graphs are lost in SVG export.
  - The Lewis-structure illustration does not match the selected molecule.
  - Chemistry modules are absent from the whiteboard registry.
- **16:50.** Added an isolated **lab fixture**: the real Math Lab, the Math Whiteboard Lab page, and every chemistry module.
  - **Files:** `e2e/fixtures/lab.html`, `lab.tsx`, `auth.tsx`, `lab.vite.config.ts`.
  - **Setup:** a synthetic local learner profile with a stubbed Supabase client, running on port 5198. The existing e2e fixture config is untouched.
  - **Why:** signed-in production pages would write data even when only observed. The lesson reader records activity on open, and boards save to Supabase.
- **16:40–16:41.** Committed the harness (`dede3b9`), the lab fixture (`7e4bb24`), and the first baseline, audit, screenshots and idea lists (`4aeeb1f`).
- **16:41–16:55.** Astra's independent review of the harness diff (`astra/03-diff-review-output.md`, 13 findings) withdrew the memory finding and the ink-latency claim and surfaced the key incident (disclosed in Step 2). Hardened the harness and fixture loader and added production fixture builds (`40f4ed4`).
- **16:55.** Ran the production-build baseline. Every scenario was valid. The report file names carry the UTC start time (`15-55-02`).
- **16:58–16:59.** Cherry-picked the record of the second Codex review from the study-continuity work (`0e617f3`). Committed the harness review, profiles, research and checkpoint plan (`c553317`).
- **17:10.** Budget rules r2 in the harness:
  - The pointer proxy is no longer judged on wheel gestures.
  - Memory is judged after a warm-up batch.
  - Tool switches face the frame budgets.
  - A new `--rebudget` mode re-scores a saved report without a browser.
  - **Result:** the production baseline re-scored to 109 passes and 19 real failures, with the measurements unchanged. It replaces the dev run as the official baseline, and friction points 1–4 now cite it.
  - A scan of 27,333 files under `docs`, `scripts`, `e2e`, `src` and the mission's `.tmp` logs found no Desmos key.
  - **Stopped at the checkpoint for owner decisions.** The AI explainer needs a paid API key.
- **17:20.** The owner approved going ahead with a $0 budget, kept free Desmos and gave creative control. Desmos terms checked (see Owner decisions).
- **17:35.** Installed the free engines (`fda96a7`); started four background workstreams in worktrees (Worked Solutions, chemistry engines, molecule card, stress test).
- **18:05–18:35.** Save-path, camera and study-panel performance work; an interleaved A/B confirmed it (`6cc888a`); placement, graph sync and harness profiling commits.
- **18:40.** Owner: keep working, make sure Desmos works, pushing live to Vercel and Supabase allowed. Local Desmos key added (gitignored); Desmos probes, graph-first cards and the load-is-not-an-edit fix (`9cff6b8`, `064e6d4`).
- **19:10.** Minimal mode, dark graph cards, honest notes status, phone layout and copy fixes (`d879cfc`); screen-pinned placement (`ea62a11`). Real-Desmos and whiteboard end-to-end suites pass.
