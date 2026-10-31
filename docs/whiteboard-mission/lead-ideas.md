# Lead idea list (Claude Opus 5.5), written before reading Astra's brainstorm

Written at 16:40 on 31 October, from the code read, the earlier release records, and the mission brief. Astra's independent list is in `astra/01-brainstorm-output.md`. Both lists are merged and scored in `docs/WHITEBOARD_MISSION.md` (step 4).

**[NEEDS APPROVAL]** marks ideas that replace Excalidraw or Desmos, add a paid service or API key, or change the database schema or migrations.

## Phase A: performance and seamlessness
1. **Cheap stroke-end change detection.** Replace the full-scene `JSON.stringify` comparisons (canvas and parent) with an element version signature: count plus `version`/`versionNonce`, plus file IDs. Move recovery serialization off the stroke-end frame (idle callback or microtask batch), but keep the synchronous flush on `pagehide`.
2. **Cache host geometry.** Use a ResizeObserver-maintained rect instead of `getBoundingClientRect()` on every Excalidraw change.
3. **Debounce card saves.** Note typing inside cards should not save the whole board per keystroke. Coalesce queued saves, and group typing into one undo step.
4. **Live-when-visible Desmos.** Offscreen calculators become a static snapshot (Desmos `asyncScreenshot`) and come back live with the same state when they scroll into view. There is no visual pop, and memory and CPU stay bounded with many graphs.
5. **Move every card type with transforms during camera motion,** not `left`/`top`.
6. **Lazy KaTeX and math blocks** on the whiteboard route.
7. **Mount the study-tools minimap only when opened;** memoize source text.
8. **Dark Desmos that matches the board.** Use the calculator's inverted-colors or color options, plus card chrome tokens, so a graph doesn't flash white inside a dark board.
9. **Ink latency.** Verify the use of coalesced and predicted pointer events. Keep only changes that improve pointer-to-frame latency.

## Phase B: visual pop
10. **Inertial pan and zoom.** Critically damped spring momentum after a pan release, and an animated zoom to the cursor. Off under `prefers-reduced-motion`; one rAF loop driving the Excalidraw camera.
11. **Snapping and alignment guides.** Cards snap to other cards' edges and centers and to an optional grid, with thin teal guide lines while dragging.
12. **Pen presets and ink smoothing.** Fine pen, math pen and highlighter, with tuned perfect-freehand thinning, smoothing and streamline, plus pressure handling.
13. **Shape recognition.** Hold at the end of a stroke to snap a rough circle, rectangle, line, arrow or triangle into a clean shape, with a subtle morph animation. Undo returns the ink.
14. **Smooth tool transitions.** An animated selection indicator in the toolbar, contextual property pill, and spring-animated card open and close.
15. **Graphs as first-class objects.** Ink drawn over a graph stays pinned in graph coordinates, so it moves and zooms with the graph. Points and sliders can be dragged on the board, and a selection can be sent to Desmos as points.
16. **Molecules as first-class objects.** A molecule card that renders SMILES with RDKit.js (MinimalLib) as a crisp 2D depiction, edits structures in Ketcher, and opens a 3D view on demand (3Dmol.js or Mol*). All lazy-loaded.
17. **Scrubbable step-by-step solutions on the board,** with steps revealed along a timeline slider. Two engines:
    - A **deterministic engine** (Compute Engine for algebra and calculus steps, plus exact chemistry calculators for pH, equilibrium, Nernst and kinetics) needs no key.
    - An **LLM explainer** is **[NEEDS APPROVAL]**.
18. **Minimalist mode.** All chrome fades away: a floating, auto-hiding tool pill and a hidden board manager, with smooth fades and keyboard access. It should feel like a sheet of paper.
19. **Premium board identity.** Dot-grid and graph-paper backgrounds, crisp card chrome, consistent teal and violet accents, and refined empty states (DESIGN.md palette).
20. **Math text on the board.** Typing `$…$` in a text object renders KaTeX, and LaTeX can be pasted in. MathLive provides an inline editor.
21. **Presentation and laser pointer** with a smooth trail, for explaining to a study group.

## Phase C: bigger bets
22. **Handwriting to editable math.** MathLive as the editor; recognition by MyScript or Mathpix is **[NEEDS APPROVAL]**, or an on-device model.
23. **A board-aware tutor:** hints and the first wrong step from the selection. **[NEEDS APPROVAL]** for an LLM key.
24. **Reasoning replay.** Record board events and scrub through the solving process. No external service, but storage size needs limits.
25. **Real-time study-group collaboration.** **[NEEDS APPROVAL]** (realtime service and schema).
26. **Replace Excalidraw with tldraw.** **[NEEDS APPROVAL]** (license fee for production use without a watermark, plus a rewrite).
27. **A spatial math notebook.** Cells for text, LaTeX, graphs and CAS, laid out on the board.
28. **Export a solution reveal as a short video or GIF** to share with classmates.
