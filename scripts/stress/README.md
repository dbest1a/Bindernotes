# Whiteboard stress-test boards

One BinderNotes whiteboard per question of the [whiteboard stress test](../../docs/WHITEBOARD_STRESS_TEST.md), plus a runner that opens each board in the isolated lab fixture, checks that every card renders, runs the Worked Solution checker, and saves screenshots and a JSON summary.

The boards use only real app features: Worked Solution cards (`solution-steps`), Desmos 2D/3D cards (`desmos-graph`), Molecule cards (`chem-molecule`), and a few Excalidraw labels and arrows (Q12 cell diagram, Q15 Newman projection and curved arrows, Q16 splitting tree).

## Files

- `boards/qNN.json`: the board for question NN. Each file holds `title`, `subject`, `modules` (whiteboard module elements in the stored shape), optional `elements` (Excalidraw), and `appState` (the opening camera). The runner fills in the owner, binder, lesson and timestamps.
- `run-stress-boards.mjs`: the runner.

Every number in a solution step was computed from the question's data and agrees with [answer-key.md](../../docs/whiteboard-mission/stress/answer-key.md). No step carries a stored `check`; the card computes its checks when the runner presses **Check all steps**.

## Run

Prerequisites:

- The lab fixture is running: `npx vite --config e2e/fixtures/lab.vite.config.ts` (serves `http://127.0.0.1:5198/e2e/fixtures/lab.html`).
- Chrome and `@playwright/test` are installed.
- For Desmos cards, a Desmos key is available through `E2E_DESMOS_API_KEY`, `VITE_DESMOS_API_KEY`, the client env files, or `PERF_DESMOS_ENV_FILE` (see `scripts/perf/desmos-key.mjs`). The runner injects it into loopback pages only and redacts it from every output.

```
PERF_DESMOS_ENV_FILE="<path to a local client .env file>" node scripts/stress/run-stress-boards.mjs
node scripts/stress/run-stress-boards.mjs --only 3,10,15 --out .tmp/stress-boards --headed
```

Options: `--only` (comma-separated question numbers), `--out` (default `.tmp/stress-boards`), `--headed`. `PERF_LAB_URL` overrides the fixture URL.

## What the runner does, per question

1. Opens the fixture once to warm the dev server, then validates the board with the app's own `sanitizeWhiteboardForStorage` and `validateWhiteboardForStorage` (imported from the dev server). It fails if the sanitizer would change or drop a card's `solution`, `molecule` or `graphWorkspace`. It writes the sanitized board to the fixture's localStorage key `bindernotes:whiteboards:fixture-learner:math-lab:math-lab-whiteboard`, and marks the first-run hint as seen.
2. Opens the whiteboard at 1440×900 and folds the board-controls panel into its chip (the app's **Minimize whiteboard controls** button), so the right-hand cards are not covered.
3. Waits until every card is ready: Desmos surfaces report `ready` with a canvas, molecule drawings contain RDKit bond paths, and every solution step is typeset by KaTeX. KaTeX errors fail the board. **Open time** is measured from this navigation to all cards ready, on a warm dev server.
4. Reads every Desmos calculator (2D and 3D, recorded through a `window.Desmos` proxy): expression errors, nothing plotted, or visible expressions Desmos will not draw each fail the board.
5. Screenshots the board (`qNN-board.png`), then on each Worked Solution card presses **Edit → Check all steps**, waits for "Check complete", returns to **Present** (all steps shown), and screenshots again (`qNN-checked.png`), plus one screenshot per card (`qNN-<card id>.png`).
6. Writes `qNN.json` (open time, per-card render status, Desmos analysis, check counts and per-step check results, page and console errors, failed requests) and `summary.json`.

The process exits non-zero if any board fails to render or logs a page error.

## Layout

Boards open at scroll (20, 76), zoom 1, so the board origin sits just below the Excalidraw toolbar. Cards occupy board x 0–1355, y 0–764 without overlapping, which fits a 1440×900 window with the controls panel minimized. With the panel open it covers part of the right-hand column.

## Notes for editing boards

- The checker verifies numeric equalities (`=`, or `\approx` to about 4 significant figures), identities in free variables (including `\frac{d}{dt}` and integrals), `±` solution chains, and one linear system per card by substitution. It leaves prose, inequalities, matrices and `\ce{}` unchecked. Multi-letter subscripts such as `p_{HT}` read as prose; use numbered unknowns.
- Desmos: a state containing a slider definition (`slider` key) makes the app open the expression list on mount, which squeezes the graph. These boards therefore use draggable points for interaction and plain number definitions. Every one-variable function definition (`f(t)=…`) is plotted by Desmos, so helper definitions are stored with `hidden: true`. 2D states set `squareAxes: false` so the stored viewport is kept. The board's dark theme inverts Desmos colours, so labels never name a colour.
- Excalidraw elements use the light-theme palette (`#1e1e1e`, `#1971c2`, …), because the dark theme inverts canvas colours.

## Regenerating the boards

The board JSON is generated from `scripts/stress/generator/` (`gen-math.mjs`, `gen-chem.mjs`, shared helpers in `lib.mjs`). Every number is computed from the question data and asserted against the answer key before a board is written:

```
node scripts/stress/generator/gen.mjs
```

Regeneration is deterministic: it reproduces `scripts/stress/boards/q01.json` … `q16.json` byte for byte.
