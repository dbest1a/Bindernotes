The strongest candidates are **whole-board saves during note editing, repeated serialization at stroke completion, and layout work around camera updates**. Several original suspects already have substantial protections.

This was a code-only audit of the authorized workspace. Nothing was written or executed; no app, network, or `.env*` files were accessed. Verdicts below are hypotheses for browser verification, not measured performance results.

1. **Heavy work in Excalidraw’s `onChange` — unlikely on every move; likely at flush boundaries.**

   **Evidence:** [whiteboard-canvas.tsx:444](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-canvas.tsx:444) stores scene references and resets a timer. Full-scene comparison happens in `flushPendingSceneChange` at line 158, reached after 1500 ms of inactivity or synchronously on pointer release at line 206. However, every callback calls `emitViewportChange`, which reads `getBoundingClientRect()` at line 78 **before** checking camera equality.

   **Why it could hurt:** The ordinary callback avoids full serialization, but its geometry read can force layout when preceding work invalidated layout. Flushes serialize both complete scenes through [whiteboard-serialization.ts:175](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-serialization.ts:175), including files. Even a camera-only interaction can incur that comparison before being rejected as nonpersistent.

   **Measure:** Separately record continuous drawing, many short strokes, and background panning. Count `onChange`, host bounds reads, flushes, and parent scene notifications. Attribute forced Layout to `getViewportSize`; measure serialization and input delay around pointerup.

   **Smallest fix:** Cache host geometry and invalidate it on actual layout changes. Consolidate the duplicate scene comparison described in item 7. **Risk:** Cached offsets must remain correct during scrolling, sidebar resizing, fullscreen changes, and workspace movement.

2. **Unstable Excalidraw props causing rerenders — unlikely in this checkout.**

   **Evidence:** `initialData` is memoized; callbacks use `useCallback`; the parent’s registrations are stabilized at [whiteboard-module.tsx:979](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:979). `UIOptions` is inline at [whiteboard-canvas.tsx:483](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-canvas.tsx:483), but the installed library’s [memo comparator](C:/Users/User/Documents/ChatGPT/Bindernotes/node_modules/@excalidraw/excalidraw/dist/dev/index.js:33038) explicitly excludes `initialData` and compares the supplied canvas-action values, including `export.saveFileToDisk`. No `renderTopRightUI` prop is supplied.

   **Why it probably does not hurt:** A new options-object identity alone does not defeat this comparator. `WhiteboardCanvas` can render while Excalidraw’s wrapper bails out. Excalidraw’s own drawing-state renders are a separate matter.

   **Measure:** Use React Profiler during toolbar changes, saving, note typing, and camera settling. Distinguish parent renders, Excalidraw wrapper renders, internal drawing updates, and actual remounts.

   **Smallest fix:** Hoist constant `UIOptions` for clarity, but expect little benefit by itself. **Risk:** Low. Avoid redesigning initialization or memoization without profiler evidence.

3. **Too many live Desmos calculators or missing destruction — likely residency cost; unlikely ordinary cleanup leak.**

   **Evidence:** [whiteboard-pinned-object-layer.tsx:1022](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:1022) forces always-live modules to be “visible,” including offscreen graphs. The normal add flow caps graphs at three, but this is not a runtime instance budget; import/storage validation does not enforce that graph count.

   Cleanup at [desmos-embed.tsx:333](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/desmos-embed.tsx:333) cancels scheduled work, disconnects observers, unregisters changes, captures final state, and calls `destroy()`. Its lifetime effect depends only on `kind`. [Collapse removes children](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module-card.tsx:1079); removal and ordinary board changes unmount outgoing cards. Only one 2D/3D surface is rendered per graph. The whiteboard scientific calculator uses the local calculator implementation.

   **Why it could hurt:** Offscreen calculators retain DOM and graph resources; expensive or animated expressions may keep working. Residency alone does not prove continuous CPU use. There is also a narrow exception-path risk: final `getState()` or its callback could throw before `destroy()` because cleanup lacks `try/finally`.

   **Measure:** Count successful constructor returns and completed destruction, then inspect live instances after ten open/close, collapse/expand, board-switch, and pin-mode cycles. Compare idle CPU, frame times, heap, and detached DOM with zero, one, and three graphs, both onscreen and offscreen.

   **Smallest fix:** Gate initial activation of offscreen graphs and apply a live-instance budget to loaded boards. **Risk:** Aggressive visibility-based unmounting causes reconstruction during pans and loses transient UI/undo state. Use generous visibility margins and delayed suspension; preserve final-state flushing.

4. **Camera synchronization firing per event instead of per frame — unlikely as stated; residual layout cost is credible.**

   **Evidence:** [whiteboard-module.tsx:486](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:486) retains the newest transform and permits only one pending animation frame. DOM synchronization occurs at line 525. React camera state updates after a 100 ms settling delay.

   Both Excalidraw callbacks still reach the bounds read discussed above. The installed library invokes `onScrollChange` and then `onChange` during a camera-changing update. Within the layer, scaled cards and fixed-size Desmos cards use transforms, but [other fixed-size cards still receive `left`/`top` writes](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:257).

   **Why it could hurt:** Batching controls frequency, not the cost of each frame. Layout-coordinate writes can trigger layout/paint across rich cards. The synchronizer also scans every board card, including offscreen cards, each camera frame.

   **Measure:** Count both callbacks, bounds reads, layer-sync calls, Layout, and Paint per frame. Repeat a controlled 60-move pan with Desmos-only and mixed boards containing 1, 10, and 30 cards.

   **Smallest fix:** Extend the existing transform positioning to other fixed-size cards; retain the current batching. **Risk:** Transforms change containing-block/stacking behavior. Verify menus, selection, all anchor modes, and coordinate conversion.

5. **Layers fighting over pointer, touch, or wheel events — unlikely in the application wrappers.**

   **Evidence:** Canvas and card layers are siblings. The [floating wrapper](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-floating-ui-layer.tsx:73) and pinned wrapper use `pointer-events:none`; cards opt in. [Movement handlers](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module-card.tsx:472) capture only header/resize gestures, filter pointer IDs, and clean up listeners. Graph-content pointerdown avoids selection/bring-to-front work at line 883. [Touch suppression and temporary content hit-test suppression](C:/Users/User/Documents/ChatGPT/Bindernotes/src/whiteboard-release.css:248) are confined to card movement. No application wheel handlers were found in these whiteboard/math wrappers.

   **Why it probably does not hurt:** There is no demonstrated mechanism making ordinary graph gestures drive both cameras. Browser/library listeners still need verification.

   **Measure:** During graph drag/wheel, header drag, and background pan, record graph viewport, board camera, card coordinates, event paths, and pointer-capture owner. Repeat with touch and interrupted capture. Each gesture should update its intended target only.

   **Smallest fix:** None without a reproduced crossover; guard the specific offending listener if found. **Risk:** Blanket pointer/wheel blocking would damage graph zoom, touch behavior, or drawing.

6. **Expensive full-screen CSS/compositing — uncertain; stronger concern for non-Desmos cards.**

   **Evidence:** The earlier Desmos corrections remain in [whiteboard-release.css:29](C:/Users/User/Documents/ChatGPT/Bindernotes/src/whiteboard-release.css:29): no card animation/filter, no decorative pseudo-elements, and no outer scrolling. Card backdrop blur is disabled at [styles.css:2573](C:/Users/User/Documents/ChatGPT/Bindernotes/src/styles.css:2573). The inspected fullscreen wrappers do not establish a fullscreen blur problem.

   Other cards retain an entrance animation whose [final filter is `blur(0) saturate(1)`](C:/Users/User/Documents/ChatGPT/Bindernotes/src/styles.css:2774), plus [two 3.8-second shadow-animation cycles](C:/Users/User/Documents/ChatGPT/Bindernotes/src/styles.css:3001). Drag CSS removes shadows/transitions but does not generally remove those filters/animations. `will-change:transform,left,top` is temporary; naming `left` and `top` does not eliminate layout cost.

   **Why it could hurt:** Animated shadows require painting; retained filters can affect compositing and layer allocation. Actual GPU/raster cost depends on card dimensions, content, and browser decisions.

   **Measure:** Inspect computed styles and DevTools Layers/Paint Flashing. Compare immediate interaction after opening versus interaction after ten seconds, Desmos-only versus mixed cards, and performance mode. Record Paint/Raster/Composite time and layer sizes.

   **Smallest fix:** Remove retained filters and decorative shadow animations from interactive non-Desmos cards. **Risk:** Mainly appearance, with stacking/containing-block behavior requiring verification.

   The documented [63 → 3 layout-pass result](C:/Users/User/Documents/ChatGPT/Bindernotes/docs/DESMOS_INTERACTION_FIX_2026-10-02.md:21) supports the existing Desmos fix for that historical interaction; it is not a current benchmark.

7. **Autosave/serialization on every change — likely, especially for card-note editing.**

   **Evidence:** Drawing cloud saves have a real 1500 ms trailing debounce. But [scene handling](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:949) repeats the full-scene comparison already performed by the canvas, then writes recovery synchronously before scheduling that save.

   One [recovery write](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-recovery.ts:14) performs three payload JSON serializations, one JSON parse, UTF-8 size encoding, and synchronous `localStorage.setItem`. With the canvas and parent comparisons, an ordinary changed-scene flush entails seven payload serializations before the later cloud save.

   More seriously, [module updates](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:991) compare both module arrays, clone the previous array into history, update React state, and call `persistBoard` immediately. [Private-note callbacks](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:388) feed editor/title changes directly into this path. Storage then creates another full snapshot and recovery draft. Its [pending-save chain](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-storage.ts:728) preserves ordering but does **not coalesce** superseded saves.

   **Why it could hurt:** Whole-board traversal, allocation, and synchronous storage block typing and stroke completion. With slow network completion, queued snapshots retain memory and continue generating requests after editing stops. This is not evidence of cloud writes on every drawing pointermove.

   **Measure:** Compare 60 continuous drawing moves, 60 short strokes, and 60 note keystrokes. Count scene notifications, recovery writes, `persistBoard`, and remote requests. Profile JSON/encoding/storage duration on empty, 1000-element, and image-bearing boards. Throttle network completion while typing for 20 seconds; inspect request backlog and retained snapshots.

   **Smallest fix:** Route automatic module saves through the existing debounce while keeping in-memory edits immediate. Reuse a prepared snapshot and avoid repeated recovery preparation. **Risk:** Preserve synchronous transition/exit recovery, immutable snapshots, generation/token checks, archive ordering, and explicit saves. Moving all recovery behind a timer would introduce a crash-loss window.

8. **Heavy bundles loaded eagerly — likely for KaTeX on workspace entry; mostly unlikely for the other named runtimes.**

   **Evidence:** Excalidraw is [dynamically imported on canvas mount](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-canvas.tsx:350). Desmos loads only during surface initialization and [shares its loader promise](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/desmos-loader.ts:132). Chemistry workspace modules use lazy imports.

   There is an eager KaTeX path: the whiteboard route imports `workspace-modules`; its [static study-core import](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/workspace/workspace-modules.tsx:6) reaches [the static `MathBlocks` import](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/workspace/study-core-modules.tsx:18), which [imports KaTeX and CSS](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/math-blocks.tsx:2). A separate lazy `MathBlocks` declaration does not undo this path.

   **Why it could hurt:** Transfer and JS evaluation can delay entering an otherwise empty board. This chiefly explains startup/first-interaction latency, not sustained dragging.

   **Measure:** In a fresh browser context, record resource initiators, evaluation tasks, coverage, and first usable canvas time for an empty board. Then add graph and math cards separately. Verify whether KaTeX arrives before needed and Desmos waits for a surface.

   **Smallest fix:** Put the static `MathBlocks` uses behind a shared lazy boundary. **Risk:** First-use placeholders/layout shifts; verify formula rendering in lessons and notes.

Additional hot paths, ranked by expected impact for their triggering workloads:

| Rank | Hot path and evidence | Confirmation and smallest improvement |
|---|---|---|
| 1 | **Undo-history allocation during typing.** [module:1008](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1008) clones all modules for each edit, retaining up to 50 snapshots. | Inspect allocation/retained heap while editing large notes. Group text edits into history transactions; preserve expected undo granularity. |
| 2 | **Duplicate Desmos-state storage.** After the [250 ms graph debounce](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/desmos-embed.tsx:271), [the controller writes synchronously](C:/Users/User/Documents/ChatGPT/Bindernotes/src/hooks/use-math-workspace.ts:318), then its state-dependent effect writes again at lines 142–148. | Count storage writes and bytes after one settled graph pan. Deduplicate ordinary persistence while retaining the final unmount checkpoint. |
| 3 | **Closed StudyTools still compute the scene/minimap.** [study-tools:48](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-study-tools.tsx:48) traverses scene geometry and renders an SVG rect per frame despite closed `<details>`. The expanded controls mount it regardless of drawer state. [module:1579](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1579) also rebuilds source text every render. | Profile a large board with details closed, then controls minimized. Mount expensive contents only when opened; memoize by content revision. |
| 4 | **Sidebar resize repeatedly changes layout.** [module:405](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:405) writes grid width on every raw pointermove without movement deferral. Cleanup lacks pointercancel/blur/unmount handling. | Record ResizeObserver/Excalidraw refresh counts; interrupt a resize and move again. Use rAF batching and the card drag lifecycle, with final refresh on release. |
| 5 | **Hidden Desmos initialization can poll indefinitely.** [desmos-embed:686](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/desmos-embed.tsx:686) combines ResizeObserver with a repeating rAF bounds check until dimensions are positive. | Mount a zero-size surface and count callbacks/layout reads. Prefer observer-driven waiting with a cancellable fallback. |
| 6 | **Repeated render-time work.** [module-card:386](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module-card.tsx:386) reapplies geometry after every render; [math-blocks:190](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/math-blocks.tsx:190) rerenders LaTeX to HTML each render. | Attribute commit/KaTeX time during unrelated saves. Memoize formula output and guard unchanged geometry while preserving active-drag restoration. |

Ordinary card dragging already uses refs and one pending rAF, with module state committed on release. I found no per-move React-state loop there, nor layout reads inside the coordinate-conversion/card-sync loop. Diagnostics are opt-in marks/logs, so use them for lifecycle correlation and collect baseline timings with logging disabled.

My top five recommended fixes, ordered for interaction responsiveness:

1. **Debounce automatic module saves**, then coalesce superseded pending autosaves.
2. **Remove duplicate full-scene comparisons and snapshot/recovery serialization**, preserving recovery guarantees.
3. **Cache canvas host geometry** so drawing/camera callbacks avoid repeated bounds reads.
4. **Extend transform-based movement to all fixed-size cards**, preserving the Desmos correction.
5. **Mount StudyTools’ expensive contents only when opened**, and cache source-text/minimap derivations.