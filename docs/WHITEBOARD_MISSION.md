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

Raw reports: `docs/whiteboard-mission/perf/baseline-2026-10-31T15-27-25-334Z.md` (draw, pan, tools, open) and `baseline-desmos-labs-2026-10-31T15-38-53-349Z.md` (slider, memory, labs).

- **Machine:** RTX 5090 through ANGLE/D3D11, 32 cores, Chrome headless, 1440×900.
- **Synthetic data:** a 320-element board (freedraw, shapes, text, arrows) and three live Desmos graphs using the real API.

| Scenario | 1× CPU | 4× CPU (a typical student laptop) | Budget |
| --- | --- | --- | --- |
| Draw 200 strokes | 0 dropped frames, pointer→frame p95 4.3 ms | **219 long animation frames (max 134 ms), 316 frames over 33 ms**, 2.25% dropped; pointer→frame p95 4 ms | 60 fps, no frame over 33 ms, no long frame over 50 ms |
| Pan/zoom, 320 elements + 3 Desmos | 0.26% dropped, **1 frame of 33.4 ms** | **9.8% dropped, 15 frames over 33 ms, 11 long frames (max 296 ms), worst interaction 304 ms** | same |
| Desmos slider drag | 0 dropped, p95 4.3 ms | 2.6% dropped, 1 frame of 41.6 ms | same |
| Tool switches and clicks | worst 40 ms | **worst 256 ms** | ≤ 100 ms (INP) |
| Warm open: empty / 320-element / 3-Desmos board | 193 / 163 / 339 ms | 879 / **1,140** / **2,233** ms | ≤ 1 s |
| Warm open: Math Whiteboard Lab (picker → New Whiteboard → canvas) | 252 ms | **1,346 ms** | ≤ 1 s |
| Warm open: Math Lab / chemistry modules | 115 ms / 383–446 ms | 495 ms / 587–759 ms, **periodic table 1,198 ms** | ≤ 1 s |
| Ten Desmos open/close cycles (collapse/expand) | **heap +3.14 MB**, nodes +13, listeners +7; calculators 11 created, 10 destroyed (1 live) | **heap +2.56 MB**, nodes +9 | no growth |

What this shows:
- **Ink stays glued.** Pointer→frame p95 is about 4 ms even at 4×.
- **The cost lands at stroke end and pan settle.** Long Animation Frame attribution at 4× while drawing is mostly `dispatchDiscreteEvent` (8.5 s) and Excalidraw's `onpointerup` (7.1 s). That is the stroke-end flush, which is consistent with Astra's serialization hypothesis. CPU profiles are running to split our code from Excalidraw's.
- **Desmos `destroy()` works.** No calculators leak, but the heap still grows per open/close cycle.

## Step 1: audit, the 15 worst friction points (ranked)

Screenshots are in `docs/whiteboard-mission/screens/`. They were captured on the isolated fixtures with Playwright (Chrome), because the T3 browser's snapshot tool timed out on this page three times; `preview_evaluate` still worked.

| # | Friction point | Evidence |
| --- | --- | --- |
| 1 | **Every finished stroke stalls slower laptops.** One long frame per stroke end at 4× (up to 134 ms), worsening as the board grows. | Baseline draw at 4×; LoAF attribution to `onpointerup` and the stroke-end flush, which runs `JSON.stringify` on both whole scenes at `whiteboard-serialization.ts:175` plus a recovery write. |
| 2 | **Panning a real board (Desmos plus ink) drops frames.** 9.8% at 4×, one 296 ms freeze, worst input 304 ms. | Baseline pan at 4× and pan at 1× (a 33 ms frame). |
| 3 | **Clicks and tool switches exceed 100 ms** on a busy board (256 ms at 4×). | Baseline tools at 4×. |
| 4 | **Large or graph-heavy boards open slowly:** 1.1–2.2 s warm at 4×. The lab needs an extra picker click: 1.35 s. | Baseline open and labs; screenshot `01-lab-first-run-picker`. |
| 5 | **Desmos cards are bright white on the dark board and start empty.** The headline feature looks bolted on. | `04-lab-desmos-card` |
| 6 | **New cards land on top of existing ones.** A calculator covered the graph. | `05-lab-second-module-placement`; `findOpenWhiteboardModuleFrameNearViewport` ignores `_existingModules` (`whiteboard-layout.ts:113`). |
| 7 | **Graph work is not part of the board save.** Desmos state lives in device-local storage, so a board reopened elsewhere can lose its expressions. | Astra's code read: `whiteboard-pinned-object-layer.tsx:564`, `use-math-workspace.ts:318`, `whiteboard-export.ts:55`. To be confirmed by a test in Phase A. |
| 8 | **Overlays cover the canvas.** A persistent "Whiteboard focus is on…" toast over the top center, plus a permanent pan hint. | `02-lab-new-board` and the user's own screenshot. |
| 9 | **A dense, always-open side panel** (12 controls, about 300 px over the board). No minimalist mode; duplicate Home / Back-to-workspace navigation. | `02-lab-new-board` |
| 10 | **On a phone the lab panel and toast cover the board.** | `06-lab-mobile-board` (390×844) |
| 11 | **Two separate undo systems** ("Undo card" vs. drawing undo). After removing a card from the board view there is no reachable "Undo card". | `02`, and the probe log: the removed card cannot be restored with the panel absent. |
| 12 | **Heap grows about 0.3 MB per graph open/close cycle** (+2.6–3.1 MB over 10), with DOM nodes +9–13. | Baseline memory. |
| 13 | **The chemistry Lewis builder draws the wrong molecule.** H₂O is shown as one large H bonded to one O. | `09-chem-chem-molecule-builder`; `chemistry-workspace-modules.tsx:937` |
| 14 | **A fake "Desmos" titration curve.** A static, chemically wrong SVG with developer copy ("Desmos key detected…"). | `09-chem-chem-desmos-titration-curve`; `chemistry-workspace-modules.tsx:1140` |
| 15 | **Internal jargon and dishonest status shown to students:** "Create a Supabase-saved board", FIXED/SCREEN/BOARD badges, "MVP Lewis builder", "Desmos key detected". Note cards always claim "Saved with board". Math Lab reads like a marketing page and is light while the Whiteboard Lab is dark. | `01`, `04`, `05`, `07`, `09`; `whiteboard-pinned-object-layer.tsx:381` |

Also noted, outside the top 15:
- SVG export turns graphs into text cards.
- The three-board cap: the user's real account shows "3 / 3 saved".
- The periodic table opens slowly.
- Card header actions are icon-only.

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
