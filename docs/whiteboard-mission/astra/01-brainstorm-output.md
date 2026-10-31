**My recommendation: make Desmos feel physically attached to the board, then connect equations, graphs, molecules, evidence, and explanations into one study workflow.** That combination is a stronger destination than a larger collection of floating tools.

This is an independent static-code brainstorm. I read the requested implementation and permitted release records; I did not read the mission document or other brainstorms, run the app, access the network, open environment files, or change files. Performance figures below are proposed acceptance targets, not measured results.

**1. Read of the current whiteboard**

There is substantial work worth preserving: ref-based dragging, animation-frame style updates, delayed React reconciliation during camera movement, deferred Desmos resizing, final graph-state capture before destruction, recovery tokens, and revision-aware account saves. Current code also includes conflict recovery and archive restoration beyond the September release record.

These are the twelve weaknesses I would address:

| # | Code-observed weakness | Evidence and consequence |
|---|---|---|
| 1 | **Camera movement still does avoidable DOM work.** | Every overlay synchronization queries mounted cards and writes their positions; fixed-size cards other than Desmos still use `left/top`. Canvas callbacks also read `getBoundingClientRect()`. This creates scaling and layout risks as cards accumulate. [whiteboard-pinned-object-layer.tsx:239](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:239), [whiteboard-canvas.tsx:77](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-canvas.tsx:77). |
| 2 | **Heavy live modules have no viewport-aware budget.** | Desmos, private notes, and calculators bypass ordinary visibility-based presentation. Once activated, distant graphs can remain mounted. Keeping active instances stable is correct; keeping every instance active indefinitely limits scale. [whiteboard-module-registry.ts:168](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-module-registry.ts:168), [whiteboard-pinned-object-layer.tsx:1022](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:1022). |
| 3 | **Persistence repeatedly processes entire boards.** | Persistent-change detection stringifies both scenes; recovery sanitizes, deep-clones, serializes, and synchronously writes the board. These are credible sources of pauses on large boards, even though writes are debounced elsewhere. [whiteboard-serialization.ts:175](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-serialization.ts:175), [whiteboard-recovery.ts:26](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-recovery.ts:26). |
| 4 | **Card history is expensive and separate from drawing history.** | A module edit compares entire arrays and retains up to fifty full snapshots, including unrelated rich content. Card undo then operates independently of native drawing undo. Moving a graph and drawing an arrow do not form one understandable chronology. [whiteboard-module.tsx:1008](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1008), [whiteboard-module.tsx:1029](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-module.tsx:1029). |
| 5 | **Closed study controls still calculate their contents.** | Scene retrieval, search, frame collection, and minimap bounds run before rendering the closed `<details>`. Hiding navigation does not remove its computation. [whiteboard-study-tools.tsx:48](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-study-tools.tsx:48). |
| 6 | **Current graph state follows a separate device-local persistence path.** | The scoped graph controller receives `graphWorkspace` as initial state but does not write its evolving state back through `onChangeModule`. JSON export explicitly retrieves the newer localStorage state. That exposes a durability gap: ordinary board saves can omit the latest graph state. [whiteboard-pinned-object-layer.tsx:564](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:564), [use-math-workspace.ts:318](C:/Users/User/Documents/ChatGPT/Bindernotes/src/hooks/use-math-workspace.ts:318), [whiteboard-export.ts:55](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-export.ts:55). |
| 7 | **Private-note cards receive an unconditional “saved” status.** | Their context hardcodes `autosaveStatus: "saved"`, clears errors, reports no unsaved changes, and supplies no-op save/retry callbacks. The card should reflect its containing board’s actual persistence state. [whiteboard-pinned-object-layer.tsx:382](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/whiteboard/whiteboard-pinned-object-layer.tsx:382). |
| 8 | **Desmos initialization can keep polling hidden layouts.** | `waitForRenderableLayout` uses an ongoing animation-frame geometry check alongside a ResizeObserver, without a deadline. A mounted but unrenderable graph can keep doing unnecessary work. [desmos-embed.tsx:686](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/math/desmos-embed.tsx:686). |
| 9 | **“Find open space” ignores existing cards.** | Both near-viewport placement functions accept `_existingModules` but simply center the new module. Repeated insertion can stack tools over existing work despite collision helpers elsewhere in the file. [whiteboard-layout.ts:114](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-layout.ts:114). |
| 10 | **Visual export loses the headline feature.** | Whole-board SVG turns graphs into text reference cards. A student’s annotated graph therefore loses its plotted mathematical evidence when exported. [whiteboard-export.ts:34](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-export.ts:34). |
| 11 | **Chemistry is not integrated into the live board system.** | The whiteboard registry has general/math/history contexts, without chemistry modules. Meanwhile, the component titled “Desmos … graph” always renders a generated SVG sparkline, even when its copy suggests a live graph can open. [whiteboard-module-registry.ts:14](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-module-registry.ts:14), [chemistry-workspace-modules.tsx:1140](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/chemistry/chemistry-workspace-modules.tsx:1140). |
| 12 | **The Lewis builder’s illustration does not represent the selected molecule.** | Its picture always contains the formula’s first letter plus fixed H and O nodes. Changing to CH₄ or NH₃ changes descriptive labels without producing the corresponding structure; the octet check is literal text. This needs a correct structural model before visual enhancement. [chemistry-workspace-modules.tsx:937](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/chemistry/chemistry-workspace-modules.tsx:937). |

**2–3. Thirty-four ideas, with implementation and scores**

Scores are **impact / effort / risk**, each 1–5. Higher effort means more work; higher risk means greater correctness, interaction, or data-integrity risk.

For compact file references:

- `WB/` means `src/components/whiteboard/`.
- `WBL/` means `src/lib/whiteboards/`.
- `Math/` means `src/components/math/`.
- `Chem/` means `src/components/chemistry/`.

Unless noted, proposals use existing dependencies and browser APIs, with backward-compatible data inside existing board JSON. They require no new library, engine replacement, service key, or database table change. Every animation must honor `prefers-reduced-motion`; active drawing and graph interaction take priority over decorative movement.

**Phase A: performance and seamlessness**

**A1. Establish a whiteboard performance contract.**  
**Why:** “Instant” needs a measurable definition that future features cannot quietly break.  
**Build:** Extend existing performance diagnostics and browser interaction fixtures to cover a reference board with 1,000 drawing objects, eight graphs, and eight notes. Record camera-frame work, dropped frames, graph initialization, resize counts, and alignment error.  
**Ship when:** On an agreed reference laptop, overlay work stays below 2 ms at p95, alignment error stays within 1 CSS pixel, and ordinary dragging reconstructs no calculator. **5 / 2 / 1**

**A2. Give every card one efficient camera path.**  
**Why:** Graphs, notes, and ink should move as one surface.  
**Build:** In `WB/whiteboard-pinned-object-layer.tsx`, register DOM refs once and translate every card rather than rediscovering nodes or changing layout positions. Cache canvas host metrics in `WB/whiteboard-canvas.tsx`; invalidate them on actual layout changes. Preserve all three anchor modes.  
**Ship when:** Steady camera movement performs no geometry reads and causes no card-position layout work. **5 / 3 / 2**

**A3. Introduce a bounded live-graph lifecycle.**  
**Why:** Twenty graphs should not make the graph being edited sluggish.  
**Build:** Add deferred, live, and parked states around `WBL/whiteboard-module-registry.ts`, the pinned layer, and `Math/desmos-embed.tsx`. Start by deferring offscreen initialization. Later park distant inactive graphs after a generous idle period, preserving real previews and state. Never evict the focused graph during interaction.  
**Ship when:** Active graphs never remount during gestures; returning to parked graphs restores identical state. **5 / 4 / 4**

**A4. Make graph state part of the board’s saved revision.**  
**Why:** A saved board should preserve the mathematical work inside its graphs.  
**Build:** Connect the scoped math controller to revisioned `graphWorkspace` updates in `WB/whiteboard-pinned-object-layer.tsx`; capture current graph state before board save, switch, export, and teardown. Coalesce changes without replaying state into the active calculator. Use existing module JSON and ownership rules.  
**Ship when:** A board round trip restores expressions, parameters, graph bounds, and 2D/3D mode without relying on a preexisting local cache. **5 / 3 / 3**

**A5. Make save preparation proportional to the edit.**  
**Why:** Autosave must remain invisible while the student works.  
**Build:** Replace full-scene equality checks with element/version signatures, cache unchanged asset serialization, and remove redundant cloning across serialization, recovery, and storage. Move suitable preparation to a worker. Preserve the existing synchronous recovery guarantee until an alternative proves equivalent.  
**Ship when:** Ordinary save preparation stays below 4 ms at p95 on the reference board, with existing interruption and recovery cases preserved. **5 / 4 / 3**

**A6. Record undoable intentions instead of whole module arrays.**  
**Why:** Undo should restore a meaningful action without copying every note on the board.  
**Build:** Replace snapshots in `WB/whiteboard-module.tsx` with reversible insert/remove/move/resize/content transactions. Coalesce typing bursts. Subsequently coordinate drawing and card chronology while retaining native text and Desmos undo inside focused editors.  
**Ship when:** Fifty card moves use at least 80% less history memory; “Undo move graph” reverses exactly one move. **5 / 4 / 4**

**A7. Make closed controls cost almost nothing.**  
**Why:** Students should gain performance when they minimize the workspace chrome.  
**Build:** Mount study-tool contents only when expanded. Cache lesson plaintext and content bounds by revision; update only the minimap viewport rectangle during navigation. Files: `WB/whiteboard-study-tools.tsx`, `WB/whiteboard-module.tsx`, `WBL/whiteboard-navigation.ts`.  
**Ship when:** Closed controls perform zero searches, frame rebuilds, or lesson-flatten operations. **4 / 2 / 1**

**A8. Extend gesture ownership across mouse, trackpad, touch, and pen.**  
**Why:** The student should never wonder whether a gesture will move the graph or the board.  
**Build:** Preserve the existing graph/header/canvas ownership contract, then add explicit handling and coverage for pinch, wheel, pointer cancellation, pen-plus-touch, and focus changes. Centralize shared rules instead of adding blanket event blocking.  
**Ship when:** The device matrix shows zero unintended board movement during graph interaction and zero swallowed graph gestures. **5 / 3 / 3**

**A9. Finish the Desmos lifecycle: bounded waiting, retry, and one durable write.**  
**Why:** Loading and settling should feel as dependable as steady interaction.  
**Build:** Replace perpetual layout polling with observation and a bounded fallback; expose a student-facing retry action. Deduplicate the synchronous graph write and subsequent effect write in `use-math-workspace.ts`. Retain final-state capture before destruction.  
**Ship when:** Hidden graphs do not poll every frame, failed initialization is recoverable, and one graph-state revision produces one normal durable write. **4 / 3 / 2**

**A10. Show one truthful save status everywhere.**  
**Why:** Confidence in saved work is part of perceived quality.  
**Build:** Pass board dirty generation, acknowledgement, local recovery status, and error state into note and graph contexts. Wire card save/retry controls to actual handlers in `WB/whiteboard-module.tsx`, the pinned layer, and toolbar.  
**Ship when:** No card says “Saved” while its latest content is pending or only held in memory. **5 / 2 / 1**

**A11. Add a continuous graph-focus view for small screens.**  
**Why:** A phone should offer a usable graph without losing the surrounding problem.  
**Build:** Expand the same graph host into the available viewport through `WB/whiteboard-module-card.tsx` and floating UI; restore its original frame afterward. Account for the software keyboard and safe areas. Keep the calculator instance stable and defer internal resizing appropriately.  
**Ship when:** Focus/unfocus preserves expression editing and graph bounds, with accessible controls at 390 px width. **4 / 3 / 3**

**A12. Export the actual graph, with its mathematical context.**  
**Why:** The finished handout should contain the evidence visible during study.  
**Build:** Add a graph export adapter between `Math/desmos-embed.tsx` and `WBL/whiteboard-export.ts`. First verify the pinned Desmos version’s supported capture capability; extend local typings accordingly. Embed the captured viewport, expression legend, and surrounding annotations.  
**Ship when:** A graph-and-annotation SVG faithfully matches the chosen graph bounds and survives reopening independently. **5 / 3 / 3**

**Phase B: “visual pop”**

**B1. Add restrained, optional springy navigation.**  
**Why:** Moving between regions can feel fluid and spatially understandable.  
**Build:** Introduce short inertial board pans and critically damped fit/bookmark transitions through the camera controller. Drive canvas and overlays from the same camera updates. Cancel immediately on new input; do not smooth live card dragging or intercept Desmos navigation.  
**Ship when:** There is no rebound, drift, or competing native momentum. Reduced-motion mode uses immediate transitions. **3 / 4 / 4**

**B2. Combine magnetic alignment with genuinely open insertion.**  
**Why:** Neat derivations and graph comparisons should be easy to arrange.  
**Build:** Reuse collision helpers in `WBL/whiteboard-layout.ts`; search nearby free slots. Add edge, center, and equal-gap snapping against cards and drawing bounds in the card drag path. Use screen-pixel tolerances and a temporary bypass modifier.  
**Ship when:** Guides behave consistently at different zoom levels, and repeated insertions do not cover existing cards. **4 / 3 / 2**

**B3. Offer polished ink and optional hold-to-convert shapes.**  
**Why:** Handwritten work should look intentional while preserving the student’s style.  
**Build:** Build on Excalidraw’s existing ink pipeline; add restrained pen presets and pointer-up recognition for lines, circles, arrows, and axes. Keep the original stroke available through undo. If directly using `perfect-freehand`, its existing locked version is **MIT**.  
**Ship when:** Recognition never interrupts drawing, uncertain strokes remain unchanged, and accepted conversions undo cleanly. **4 / 4 / 3**

**B4. Give tool changes a clear, calm visual language.**  
**Why:** Premium polish comes from legible state and fast access.  
**Build:** Refine the launcher, floating UI, card chrome, and `src/whiteboard-release.css`: consistent typography, compact pen presets, a command palette, and brief focus/selection transitions. Use charcoal surfaces with restrained teal/violet accents from `DESIGN.md`; avoid persistent animated effects.  
**Ship when:** Common actions take two interactions after opening the palette, with no layout shift or animation during active gestures. **4 / 2 / 1**

**B5. Make graphs first-class selectable board objects.**  
**Why:** A graph should participate in a problem’s composition alongside ink and formulas.  
**Build:** Add stable object identities and group metadata to board JSON; coordinate graph selection, duplication, locking, grouping, and connectors across `whiteboard-types.ts`, the pinned layer, and canvas adapter. Keep Desmos as the graph engine.  
**Ship when:** A graph, its heading, and its annotations can move and duplicate together without state leakage. **5 / 5 / 4**

**B6. Let equations move directly between notes, board, and graph.**  
**Why:** Students should spend their attention on mathematics instead of retyping it.  
**Build:** Promote selected formulas into editable KaTeX tiles with “Plot,” “Substitute,” and “Attach explanation.” Route plotting to an explicitly selected graph using existing expression requests. Files: `Math/math-blocks.tsx`, math workspace modules, and the board registry. KaTeX is already installed under **MIT**.  
**Ship when:** A lesson formula becomes a linked plotted expression in two actions. **5 / 3 / 2**

**B7. Attach annotations to mathematical coordinates and objects.**  
**Why:** “This maximum” should stay attached when the graph viewport changes.  
**Build:** Store graph instance, expression ID, mathematical point, and caption in board JSON. Add a supported Desmos coordinate adapter after checking API compatibility; avoid scraping internal DOM. Begin with manually selected points, then add constrained root/tangent attachments.  
**Ship when:** Labels stay aligned through graph pan, board zoom, card movement, and resizing. **5 / 4 / 4**

**B8. Connect shared sliders to side-by-side graph experiments.**  
**Why:** One parameter can reveal relationships across several representations.  
**Build:** Add board-scoped named parameters with explicit expression bindings. Use existing Desmos expression APIs for coalesced updates; allow independent A/B branches and matched axis bounds. Persist at interaction boundaries.  
**Ship when:** One slider updates two graphs without feedback loops, and branching preserves the original experiment. **5 / 4 / 3**

**B9. Replace decorative molecules with correct editable structures.**  
**Why:** Chemistry becomes compelling when students can manipulate bonds, lone pairs, and charge.  
**Build:** Replace fixed Lewis markup with an atom/bond/lone-pair/charge model rendered in SVG. Reuse the formula parser and periodic-table data; add chemistry registry entries and serialization. Start with five verified structures, then add a schematic VSEPR view.  
**Ship when:** Every supported structure has correct atom counts, bonds, charge, and electron accounting. Unsupported cases are identified clearly. **5 / 4 / 4**

**B10. Connect chemistry data, real Desmos graphs, and observations.**  
**Why:** A virtual experiment should produce coherent evidence without manual copying.  
**Build:** Extract shared experiment state from titration/kinetics components. Bind an editable table, a Desmos table-expression adapter, and observation notes through a dataset ID. Preserve units and distinguish simulated from entered measurements.  
**Ship when:** Selecting a point highlights its table row and observation, and the complete experiment survives board reload. **5 / 4 / 3**

**B11. Turn navigation into a map of the student’s work.**  
**Why:** Large boards need meaningful destinations.  
**Build:** Extend existing study tools with click/drag minimap navigation, keyboard controls, named problem frames, and search over graph expressions and parameters. Cache the index by content revision. Fit destinations into the unobscured viewport.  
**Ship when:** A named problem or expression is reachable in two actions, including on mobile. **4 / 3 / 2**

**B12. Make checkpoints visual and experimentally meaningful.**  
**Why:** “Before changing frequency” is more useful than an anonymous saved view.  
**Build:** Extend existing bookmarks and graph snapshots with actual thumbnails, selected objects, and optional parameter states. Store portable checkpoints in board JSON. Keep navigation separate from explicit state restoration, which must be undoable.  
**Ship when:** Backup/import preserves a checkpoint and restores its exact experiment on request. **4 / 3 / 2**

**Phase C: bigger bets**

**C1. AI-authored solutions that appear as editable, scrubbable board steps. [NEEDS APPROVAL]**  
**Why:** Students could inspect and change a solution instead of receiving an opaque answer block.  
**Build:** Define validated step commands containing formulas, graph changes, explanations, assumptions, and object additions. Render a step timeline with pause, scrub, “try next,” and branch. Prove the renderer using authored solutions before connecting a model service.  
**Ship when:** Every reveal is reversible and uncertain steps are distinguishable from checked ones. Approval covers the model service/key. **5 / 5 / 5**

**C2. Find the first unsupported step in a derivation.**  
**Why:** Feedback at the point of misunderstanding is more useful than a corrected final answer.  
**Build:** Start with typed linear/polynomial algebra and unit transformations using a small explicit expression model and deterministic rules. Preserve domain restrictions; report “not checked” outside supported cases. Connect feedback to the exact step object.  
**Ship when:** A curated misconception set is handled reliably without falsely approving invalid transformations. **5 / 4 / 4**

**C3. Turn selected handwriting into linked, editable mathematics. [NEEDS APPROVAL]**  
**Why:** Pen users could move smoothly from rough work to graphing and verification.  
**Build:** Send only a selected ink region to a chosen recognition service; retain original strokes, provide symbol correction, and create an editable equation tile linked to the ink. Begin with isolated expressions rather than whole pages.  
**Ship when:** Correction is faster than retyping on a representative student sample. Approval covers the recognition service/key. **5 / 5 / 5**

**C4. Track assumptions and dependencies across a solution.**  
**Why:** Changing an input should reveal which conclusions need reconsideration.  
**Build:** Add typed links between inputs, equations, graph expressions, and claims. Recompute supported numeric dependencies and mark dependent prose as needing review. Files: board types/serialization, equation objects, and a small dependency evaluator.  
**Ship when:** Changing an initial condition updates bound computations and identifies affected conclusions without rewriting student explanations. **5 / 4 / 4**

**C5. Build a manipulable unit-cancellation and stoichiometry workbench.**  
**Why:** Students can see why a calculation works, including errors ordinary calculators conceal.  
**Build:** Turn existing stoichiometry steps into fraction blocks with typed units and reaction ratios. Students assemble grams → moles → ratio → grams, then inspect cancellations and conservation. Reuse `stoichiometry.ts` and `molar-mass.ts`.  
**Ship when:** Supported chains detect reversed ratios, incompatible units, and incorrect coefficient use. **5 / 3 / 3**

**C6. Create reaction storyboards with atom and electron accounting.**  
**Why:** Chemical change becomes something students can explain step by step.  
**Build:** Extend molecule objects into before/after reaction frames with persistent atom identities. Start with atom conservation and balanced equations; later add a limited, authored set of electron-flow mechanisms with explicit charge bookkeeping. Use SVG and existing chemistry helpers.  
**Ship when:** Supported steps conserve the required quantities, with discrete-state playback under reduced motion. **5 / 5 / 4**

**C7. Replay the student’s reasoning, including wrong turns.**  
**Why:** Reviewing how an answer emerged can be more educational than viewing the finished board.  
**Build:** Record semantic transactions—completed stroke, equation edit, graph checkpoint, hypothesis—rather than every pointer sample. Add timeline labels and branches, starting with current-session playback and downloadable replay data.  
**Ship when:** A student can revisit a previous hypothesis and branch from it without changing the original work. **4 / 4 / 3**

**C8. Turn solved problems into retrieval practice packets.**  
**Why:** The board can become useful study material after the initial session.  
**Build:** Group source question, working, graph evidence, and conclusion. Let students hide selected steps, answer again, and reveal their own explanation. Begin with manually authored prompts and deterministic parameter variants stored in board JSON.  
**Ship when:** A finished problem becomes a reusable practice item in under thirty seconds. **5 / 3 / 2**

**C9. Add an offline revision vault with visual conflict comparison. [NEEDS APPROVAL]**  
**Why:** Students should be able to recover and compare substantial work across interruptions.  
**Build:** Introduce a quota-aware IndexedDB revision store, cached application shell, and side-by-side conflict viewer. Build on existing revision guards. Offline graph snapshots and annotations remain usable; live Desmos availability is treated separately.  
**Ship when:** Interrupted edits and competing revisions can be recovered without silent overwrite. Approval covers the new local database schema and migration design. **4 / 4 / 4**

**C10. Offer tightly scoped collaborative tutoring. [NEEDS APPROVAL]**  
**Why:** A tutor could explain directly on the student’s problem while preserving ownership.  
**Build:** Start with explicit session access, tutor pointers, and one active editor at a time using existing Supabase capabilities. Share selected problem frames rather than an entire private workspace. Add concurrent editing only after the simpler model works.  
**Ship when:** Join, leave, revocation, reconnect, and ownership boundaries behave correctly. Approval covers access-model/database changes. **4 / 5 / 5**

**4. My top ten, ranked**

This ranking balances immediate value, foundational importance, and differentiation.

| Rank | Idea | Short justification | Approval |
|---|---|---|---|
| **1** | **A2 — Efficient shared camera path** | The entire product’s quality is judged whenever the student pans. | No |
| **2** | **A4 — Board-owned graph persistence** | The flagship feature must survive saving and reopening as reliably as ink. | No |
| **3** | **A3 — Bounded live-graph lifecycle** | Makes ambitious, graph-heavy boards feasible without sacrificing active interaction. | No |
| **4** | **A5 — Edit-proportional persistence** | Prevents growing notes and drawings from making every subsequent feature slower. | No |
| **5** | **A12 — Actual graph export** | Immediately improves the usefulness of completed student work. | No |
| **6** | **B5 — First-class graph objects** | Establishes the object model needed for grouping, comparison, attachments, and solutions. | No |
| **7** | **B7 — Mathematical annotations** | A label that follows the mathematics is a powerful, visible differentiator. | No |
| **8** | **B9 — Correct editable molecules** | Fixes a current correctness problem and opens a distinctive chemistry experience. | No |
| **9** | **B10 — Connected chemistry experiments** | Turns separate existing tools into a complete investigation workflow. | No |
| **10** | **C1 — Scrubbable AI solutions** | Potentially exceptional once editable objects, reliable state, and verification foundations exist. | **Yes: model service/key** |

I would ship **A7 and A10 alongside the first wave** because their scope is small and their benefits are immediate. I would schedule inertia after camera alignment and gesture ownership pass their acceptance criteria.

**5. What nobody does well yet—and where BinderNotes could stand out**

These are differentiation hypotheses from the product and code, rather than verified claims about every competitor.

- **Keep every representation of a problem connected.** An equation, graph, table, unit calculation, and written claim should describe the same investigation. Changing a parameter should preserve that relationship. This is particularly strong for calculus, kinetics, and titration.

- **Preserve the conditions under which a claim was true.** A student’s “these curves intersect twice” should retain the relevant expressions, bounds, and parameter values. Later edits should make changed assumptions visible.

- **Make mistakes inspectable.** Preserve the step where a student divided by an expression that might be zero, reversed a mole ratio, or confused a coefficient with a subscript. Let them repair that point and see the consequences.

- **Use chemistry’s structure as the interaction model.** Atoms, bonds, electron pairs, charge, and units should constrain what the objects mean. A correct Lewis structure that exposes electron accounting has more educational value than an attractive generic molecule.

- **Make prediction a first-class action.** Let students record “I expect the vertex to move right” or “the equivalence volume will increase,” then change one variable, compare results, and explain the discrepancy. Preserve prediction and evidence together.

- **Make “show your work” the natural output.** The final artifact should already contain the question, editable reasoning, graph or molecular evidence, assumptions, and conclusion. Exporting or revisiting it should preserve that chain.