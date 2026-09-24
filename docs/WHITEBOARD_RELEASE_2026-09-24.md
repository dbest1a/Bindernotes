# Whiteboard release record — 24 September 2026

This records the disposition of the original audit: 20 improvements, 20 bug-fix targets, and 10 product directions. It is a scope and evidence record, not a claim that all 50 requests are complete or that BinderNotes has been ranked against the market.

**Release identity:** final commit **PENDING**; deployment URL/build identifier **PENDING**. The release coordinator must replace these after verification and deployment.

**Source provenance:** this work starts from recovered baseline `b285adb` (`chore: preserve recovered local BinderNotes baseline`), after previously recorded `94525210`. A known production `gitDirty` state means the earlier production build must not be described as an exact clean checkout of that recorded commit. This release preserves the recovered baseline instead of silently replacing it with the older clean history.

**Database:** the existing legacy production schema is unchanged. No migration, reseed, account-data rewrite, or RLS change is part of this release. Client tests with mocked storage do not establish compatibility with every deployed database shape. A missing/incompatible remote table must leave an honest local recovery/error state rather than a false cloud-save confirmation.

## Status definitions and file references

- **Implemented:** present in this patch; any visual, device, or production verification limitations still apply.
- **Existing:** already available before this patch; not newly implemented here.
- **Partial:** a useful subset or foundation exists, with the remaining requirement stated.
- **Unverified:** an observation or behavior still needs the specified evidence.
- **Not implemented:** no complete implementation is claimed.

The following short references keep the mapping readable. All paths are relative to the repository root.

| Reference | Files |
| --- | --- |
| Module | `src/components/whiteboard/whiteboard-module.tsx` |
| Canvas | `src/components/whiteboard/whiteboard-canvas.tsx` |
| Cards | `src/components/whiteboard/whiteboard-module-card.tsx`, `src/whiteboard-release.css` |
| Source picker | `src/components/whiteboard/whiteboard-pinned-object-layer.tsx` |
| Controls | `src/components/whiteboard/whiteboard-floating-ui-layer.tsx`, `whiteboard-toolbar.tsx`, `whiteboard-board-list.tsx` in the same directory |
| Study tools | `src/components/whiteboard/whiteboard-study-tools.tsx`, `src/lib/whiteboards/whiteboard-navigation.ts` |
| Export | `src/lib/whiteboards/whiteboard-export.ts`, Canvas |
| Persistence | `src/lib/whiteboards/whiteboard-storage.ts`, `whiteboard-recovery.ts`, `whiteboard-serialization.ts`, `whiteboard-types.ts` in the same directory, Module |
| Templates | `src/components/whiteboard/whiteboard-template-picker.tsx`, `src/lib/whiteboards/whiteboard-templates.ts` |

## The 20 improvements

| # | Original request | Status and actual delivery |
| --- | --- | --- |
| 1 | Unique, editable board names | **Implemented.** Module selects an unused numbered title; Controls expose board-name editing. |
| 2 | Thumbnails and last-edited times | **Partial.** Board rows show edited times and can display an available thumbnail. Automatic thumbnail generation/cloud persistence is not implemented; new/remote records currently initialize thumbnails to null. Controls, Persistence. |
| 3 | Explain the “2 / 3” counter | **Implemented.** Counter says “saved”; existing beta limit remains three saved boards. Controls. |
| 4 | Searchable board manager | **Implemented.** Search by title/subject, preserve the actual total count, and keep an active query clearable after archiving. Controls. |
| 5 | Starter templates on empty boards | **Implemented.** Eight named workflows now insert editable titles, four labeled work areas and specific prompts. Graph Annotation includes axes, Geometry Diagram includes a labeled triangle, and Unit Circle includes a circle, axes and coordinates. Blank Board stays empty. Chooser is available in the lab and sidebar. Templates, Module; three focused template tests. |
| 6 | Prominent Add module button | **Implemented.** Lab action reads “Add module”; embedded launcher already supplies “Add Module.” Controls and `whiteboard-module-launcher.tsx`. |
| 7 | Lesson search | **Implemented.** Search lesson/binder titles across folders, including unfiled binders; no stale lesson can be confirmed from an empty folder. Source picker. |
| 8 | Preview before insertion | **Implemented.** Selected lesson shows a bounded plain-text preview and math-block count; insertion still requires confirmation. Source picker. |
| 9 | Compact reference/full reading modes | **Existing + corrected.** Card menus already exposed display modes; CSS now respects full/summary headers and full-mode statistics. Cards and `src/components/workspace/study-core-modules.tsx`. |
| 10 | Auto-fit card content | **Implemented.** “Fit content” sizes lesson cards using their content and reading overflow, capped to the viewport; longer content remains scrollable. Cards. |
| 11 | Distraction-free drawing | **Partial.** Controls can be minimized and existing full-board mode retained. There is no new pen-only or complete Zen workflow. Controls, Module. |
| 12 | Dockable/collapsible panels | **Partial / existing.** Existing sidebar resize/collapse plus minimized lab controls; arbitrary docking/rearrangement of the main controls is not added. Controls, Module. |
| 13 | Minimap | **Implemented, basic.** Read-only overview shows drawings, cards, and viewport. It is not a draggable navigator. Study tools. |
| 14 | Easy Fit all | **Implemented.** “Fit all content” handles drawings and board-positioned cards, including fixed-size cards. Screen-pinned tools remain screen-pinned. Study tools, Canvas. |
| 15 | Named region bookmarks | **Implemented, device-local.** Up to 20 named views per account/board on this device; replace/remove supported. No cloud bookmark synchronization. Study tools. |
| 16 | Alignment guides | **Partial.** Arrange cards provides automatic placement; interactive snapping/alignment guides between drawings and cards are not implemented. Module. See review notes below for zoom-layout verification. |
| 17 | Reusable color/pen presets | **Not implemented as a new feature.** Existing Excalidraw styling controls remain; no BinderNotes preset library or cross-device preset persistence. Canvas. |
| 18 | Direct sticky-note creation | **Partial.** “Add sticky note” in Study tools creates a Private Notes card. It is not a new native Excalidraw toolbar icon or a separate sticky-note object type. Module, Study tools. |
| 19 | Clear saving/offline/error/time states | **Implemented with production verification pending.** Saved/local/error labels, last-save time, recovery-failure reporting, and stale-acknowledgement protection. Time is not proof of remote durability when cloud storage is unavailable. Controls, Persistence. |
| 20 | Drawing/card/complete-board export options | **Partial.** Native Image export remains drawings-only; new whole-board SVG adds static card text and JSON preserves stored board data/source references. No dedicated cards-only selector or live-widget export. Export scope is displayed in Study tools. |

## The 20 bug-fix targets

The original audit's items 1–13 were reported observations; 14–20 were proposed validation targets. This release does not retroactively turn all targets into reproduced defects.

| # | Original target | Status and evidence/limit |
| --- | --- | --- |
| 1 | Previous board reopened blank / possible data loss | **Implemented prevention; original data recovery unverified.** Flush outgoing edits, reject unloaded/mismatched records, ignore stale saves/loads/canvas callbacks, preserve synchronous recovery drafts, and isolate canvas instances by board. Save snapshots preserve the loaded scene while Excalidraw is still initializing; card/rename saves capture unflushed drawing state first. Tests cover these loading and race cases. No claim that the original 148-object board was recovered. Persistence, Module, Canvas. |
| 2 | Previous count changed from 148 to 0 | **Implemented.** Unloaded metadata retains count and cannot be saved as empty content; visible counts exclude deleted drawing-history elements. Persistence. |
| 3 | Export omitted lesson module | **Implemented alternate export.** Whole-board SVG includes static source/card text; native drawing Image export is explicitly described as drawings-only. Interactive graph/calculator state is not rendered as a live widget. Export. |
| 4 | Export background disagreed with canvas | **Implemented correction.** Canvas/export share logical-background normalization and dark-mode export settings. Tests cover legacy default normalization; browser export checks confirm drawing and card markup. Canvas, Export. |
| 5 | Default rectangle nearly invisible | **Implemented and visually checked.** A real rectangle drawn with the native tool is visibly light on the dark canvas and survives reload. User-selected stroke/background combinations can still have low contrast. Canvas. |
| 6 | Formula section clipped | **Implemented.** Lesson panel, summary, and formula launcher share a flex/scroll layout instead of a full-height panel overflowing hidden siblings. Cards. |
| 7 | Enlarging still left formula section clipped | **Implemented.** Outer scrolling, a usable reading minimum, nonshrinking formula controls, and Fit content preserve access at smaller sizes. Desktop/mobile visual checks remain necessary. Cards. |
| 8 | Resize handle covered “Use this lesson” | **Implemented.** A separate footer reserves resize space; keyboard resizing respects minimum dimensions. Cards; focused interaction tests. |
| 9 | Back to workspace covered drawing inspector | **Implemented and visually checked.** Return control stays away from the upper-left inspector and mobile bottom controls. The duplicate return hides while expanded mobile controls provide Home. `src/whiteboard-release.css`. |
| 10 | BOARD SIZE label wrapped | **Implemented.** Compact nonwrapping “fixed” badge with explanatory tooltip and responsive header groups. Cards. |
| 11 | “1 objects” | **Implemented.** Singular/plural handling in board rows and toolbar. Controls; board-list tests. |
| 12 | “Loaded from Supabase” | **Implemented.** Normal loaded state says “Board loaded.” Technical error details may still appear when relevant to a failure. Module. |
| 13 | Normal board offered “Delete broken board” | **Implemented.** Normal action is “Archive board” with confirmation for the active-board action. Row archive is separate. Recovery-only unsynced content is materialized as a durable local archived snapshot before clearing its pending marker; storage failure retains the draft. An archive-restoration UI is not added. Controls, Persistence. |
| 14 | Module/drawing zoom behavior | **Existing explicit modes, clarified.** Board cards scale, board-fixed-size cards retain readable screen size, viewport tools stay on screen. Tests cover coordinate conversions. No claim that these deliberately different modes now all scale identically. Cards, `whiteboard-coordinate-utils.ts`, overlay tests. |
| 15 | Search source text and module titles | **Implemented.** Search visible drawing text, module titles/note content, and supplied lesson text. OCR of handwritten ink is not included. Study tools, Module. |
| 16 | Undo/redo module insertion, resize, source change | **Implemented separate card history.** Module-array changes use board-scoped history, with explicit Undo card/Redo card buttons. It is not a single merged chronology with Excalidraw drawing undo; refresh discards in-memory card history. Module. |
| 17 | Undo history leaks across boards | **Implemented protection.** Card history resets by board; canvas remounts by board identity. Regression test checks that another board's cards cannot be imported by undo. Module, Canvas. |
| 18 | Immediate refresh preserves latest edit | **Implemented recovery path.** Snapshot before debounce/network work, flush on unmount/pagehide, and read pending canvas state. Tests simulate pagehide before normal throttled emission. Browser/process crashes and storage denial remain separate limits. Persistence, Module. |
| 19 | Interrupted save retains a local copy and reports errors | **Implemented.** Recovery token prevents an older acknowledgement from deleting newer edits; missing quota/cloud storage gets honest failure messages. Tests cover failure combinations. Multi-device conflict resolution is not implemented. Persistence. |
| 20 | Module input must not trigger canvas shortcuts | **Implemented.** Module/tool/search keyboard events stay within their editing surfaces without preventing native text editing. Tests cover typing, Delete, undo keys, and resize keys. Native pen/IME/device combinations still need manual checks. Cards, Study tools, Controls. |

## The 10 market directions

These were proposals, not verified competitive claims. Existing educational features are not substitutes for the complete requested capability.

| # | Direction | Delivery and prerequisite |
| --- | --- | --- |
| 1 | Connected study canvas | **Partial / existing foundation.** Source-scoped lesson/formula cards, highlights, comments, quotes, and source references exist. New search/preview makes them easier to use. Linking every diagram to an exact source passage and maintaining those anchors through source edits needs an explicit diagram-to-source model and interaction design. Source picker, Module, `whiteboard-note-targeting.ts`. |
| 2 | Handwriting becomes editable mathematics | **Not implemented.** Requires recognition/model service, math-document representation, confidence/correction UI, ink preservation, consent/data handling, and recognition evaluation. |
| 3 | Live mathematical objects | **Partial / existing.** Desmos graph, calculator, saved graphs, formulas, and math blocks are registered modules. A unified manipulable geometry/equation/slider object system on the canvas is not added. `whiteboard-module-registry.ts`, `src/components/math/math-workspace-modules.tsx`. |
| 4 | Tutor understands the board | **Not implemented.** Requires board/selection context packaging, source retrieval/citations, model backend, authentication/rate limits, and evaluation. No new AI endpoint is introduced. |
| 5 | Detect first wrong step and give a hint | **Not implemented.** Requires structured solution steps, mathematical validation, calibrated uncertainty, pedagogy, and tests against representative student work. |
| 6 | Board-to-practice conversion | **Not implemented as an integrated board flow.** Existing lesson/review helpers do not constitute automatic board-to-quiz/spaced-repetition conversion. Requires extraction, question generation/validation, storage and review scheduling. |
| 7 | Reasoning playback/narration | **Not implemented.** Undo and recovery are not a replay timeline. Requires durable timestamped action/event recording, playback, and optional audio capture/synchronization. |
| 8 | Collaborative tutoring | **Not implemented.** Requires shared access model, real-time presence/synchronization, concurrent-edit resolution, teacher/student controls, authorization and load tests. No permission or collaboration schema is changed. |
| 9 | Dependable offline work | **Partial.** Local recovery, serialized saves, meaningful states and JSON backup are added/hardened. No offline app shell, complete revision browser, cross-device conflict merge, or guaranteed recovery after storage eviction. Persistence, Study tools. |
| 10 | Excellent pen interaction | **Existing foundation / unverified on devices.** Excalidraw provides drawing input; existing performance paths reduce unnecessary refresh work. No new pressure/palm-rejection implementation or hardware latency benchmark. Requires stylus/touch testing on target tablets and browsers. Canvas and performance diagnostics. |

## Verification record

| Check | Recorded result | Remaining evidence |
| --- | --- | --- |
| Focused module/source tests | 74 passed during implementation: card, overlay, source-picker suites | Re-run after final combined changes if affected. |
| Focused study-tools/board-manager tests | 10 passed: live source search, minimap frames, bookmark scope/cap/storage failures, export retry/latest scene, board search/archive | Re-run if final product changes affect these components. |
| Independent persistence regression check | **41 passed** across Canvas, module persistence, remote storage and templates after loading/unflushed-edit/archive fixes | Final combined-suite result remains coordinator-owned. |
| TypeScript | Final production build passed application and Node configuration type checks. | No unresolved type errors. |
| Diff whitespace | Final `git diff --check` passed. | Existing mixed CRLF/LF baseline produces line-ending warnings; no whitespace errors. |
| Broader test run | **1,130 / 1,130 tests passed** on final product source with four workers. | An earlier build-concurrent run hit one lazy-render timeout in unchanged SimplePresentationShell; that seven-test file passed in isolation, then the complete suite passed without the concurrent build. No test was skipped or weakened. |
| Production build/assets | Production build, client environment/output guard, and asset budgets passed. Initial JS/CSS: 261.38 kB gzip; whiteboard module: 42.29 kB gzip. | Existing large lazy vendor chunk warnings remain; no hardware latency benchmark is claimed. |
| Browser layout | Real Excalidraw/component fixture passed desktop 1440×1000 and mobile 390×844: drawing/reload/board switching, source search/preview, card resize/reload, card fit and mobile controls, with no page errors. | Fixture used local storage and did not bypass production authentication. Tablet hardware and every embedded workspace combination are not verified. |
| Download contents | Actual downloaded JSON contained the drawing and source module; SVG contained native drawing paths and lesson text. | Graphs/calculators remain static reference cards; linked source documents are not copied into JSON. |
| Authentication/account ownership | Signed-out auth UI rendered correctly at desktop/mobile sizes and protected routes redirected to auth. | Authenticated cloud save/load is **unverified**. Windows Application Control blocked the local GoTrue test runtime; no production credentials/account writes were used as a substitute. |
| Production persistence/schema | Read-only production schema/aggregate check: 34 boards, no scene-field or module-field disagreements, and no positive-count/empty-canonical-scene mismatch. Legacy schema unchanged. | No database migration or production board mutation was performed. Mocked storage regression tests do not prove a real authenticated round trip. |
| Final release | Commit **PENDING**; deployment **PENDING** | Coordinator records SHA, target URL/build identifier, deployed verification outcome and remaining limits. |

## Independent code-review notes

The new source/search/bookmark UI renders strings through React rather than raw HTML. Export card titles/text/background attributes are XML-escaped; the hostile-text export test checks that injected script text does not become a script element. Drawing markup comes from Excalidraw's exporter, whose installed implementation normalizes hyperlink URLs through `@braintree/sanitize-url`. This limited review found no confirmed new script-injection path. It is not a full security certification.

Concrete review findings were sent to the release coordinator and corrected:

1. Arrange cards initially divided all module dimensions by zoom. Normal board-anchor dimensions are already in board units, so arrangement at zoom 2 could overlap cards. **Resolved in code:** use anchor-aware export-frame dimensions, including collapsed-card height. Final integrated visual verification remains in the release checklist.
2. A truncated SVG card initially claimed “Full stored text in JSON backup.” Linked lesson text is not copied into the JSON backup. **Resolved in code:** the message now says full text remains in its source; the export-scope disclosure distinguishes references from stored note text.
3. Reading an initializing Excalidraw API could return an empty scene before the existing board had restored. **Resolved with regression:** while API `isLoading` is true, save/backup snapshots retain loaded elements, files and background; an intentionally empty scene after readiness remains a valid edit.
4. A card/rename save could overtake the canvas change debounce. **Resolved with regression:** `persistBoard` captures the current canvas scene and count before writing recovery/network snapshots.
5. A successful archive after a failed save could clear the only complete recovery snapshot. **Resolved with regressions:** copy full recovery content into archived local storage before clearing its marker; when local archive storage fails, keep recovery and report a partial archive error.
6. Simultaneous cloud/device-storage failure could lose the latest draft on board switching. **Resolved with regressions:** keep an account/board-scoped memory snapshot, preserve it across A→B→A, distinguish tab-only recovery from durable storage, and clear only the acknowledged recovery token and its known superseded disk token. Closing or reloading the tab still loses memory-only edits; the UI says to keep it open.

The three-board beta limit, native drawing export limits, device-local bookmarks/recovery, static widget export, and unfinished product directions above must remain visible in release communication. Shipping this patch does not justify saying all 50 requests are complete.
