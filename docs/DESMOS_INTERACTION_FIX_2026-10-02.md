# Desmos interaction follow-up

The first report-repair browser checks used note cards. This follow-up exercises an actual Desmos calculator inside the production whiteboard components, in fixed-size board, scaled board and screen-pinned modes.

## Repairs

- Desmos cards use translation for their movement instead of changing layout position on every pointer/camera frame. Native graph dimensions stay stable while moving the card.
- Graph wrappers no longer retain decorative filters/animations or an unnecessary outer scrollbar.
- A queued calculator resize is cancelled when movement starts. Its callback also rechecks movement; observer and setting changes combine into one resize after release. Desmos automatic resize is disabled where ResizeObserver owns that lifecycle, with a fallback for browsers without it.
- The current graph state is read before the calculator is destroyed. Its originating account, graph card and 2D/3D mode are preserved, and the state is persisted synchronously before collapse or pin-layer remount can discard it.
- Collapsed cards have a keyboard-accessible Expand button.

No blanket wheel or pointer blocking was added. Desmos owns gestures inside the graph; the card header owns card movement; the surrounding drawing surface owns board movement.

## Verification

Three real-API Chrome cases cover every pin mode: graph drag and wheel zoom, continuous header dragging, board zoom, deferred graph resize, immediate collapse/expand, immediate pin-layer changes and reload. They assert exact saved viewport state and ensure ordinary card dragging neither reconstructs the calculator nor replays graph state. Twenty-one existing browser checks cover editor layouts, public pages, notes and whiteboard recovery.

All **1,203 unit/regression tests in 163 files** and **24 browser cases** passed locally. The live signed-out auth rendering smoke also passed; it does not establish signed-in cloud persistence or deployment of this patch.

A local Chrome diagnostic using the same 60 pointer moves measured **63 layout passes before the compositor change and 3 afterward**. This is evidence about that interaction and machine, not a universal frame-rate benchmark.

Run the normal suite with `npm run test:e2e`. Live Desmos cases explicitly skip when no API key is supplied. To require the real calculator, run:

```sh
npm run test:e2e:desmos
```

The launcher uses `E2E_DESMOS_API_KEY`, `VITE_DESMOS_API_KEY`, or the project's existing local client configuration. It fails when none is available and never substitutes a mock graph. It passes only the selected Desmos key from local configuration to the test process. Traces are disabled for these cases to avoid retaining that key; the fixture does not authenticate to Supabase or write cloud account data.

This patch is a source change on `codex/report-fixes-2026-10-02`. A Git push alone does not establish production deployment. No production account, schema or stored note/board data was changed while verifying these interactions.
