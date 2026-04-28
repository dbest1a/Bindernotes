# Handoff Note (2026-04-25)

This file is the active design plan for the BinderNotes preset/layout stabilization pass. It is planning-only and should not be implemented directly from this chat unless explicitly requested.

Current context: the focus is on a screenshot-driven UX diagnosis and rework plan for presets (simple/canvas/modular), spacing, duplicated controls (especially quick split), and simplified mode clarity. Use this plan as the implementation source of truth.

# BinderNotes Preset System Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the BinderNotes preset system so every preset is subject-aware, properly sized, responsive, visually professional, and useful for real students.

**Scope:** Planning only. Do not implement code in this pass.

---

## 1. Executive Summary

The current preset system has strong ideas but looks and behaves like an internal layout builder exposed directly to learners. The screenshots show repeated issues: cramped modules beside unused space, giant side bezels, nested scroll traps, duplicate quick split controls, canvas presets that expose too much customization chrome, and subject-specific layouts that do not always feel tailored.

Simple View is the strongest direction, but it still needs a cleaner color model and less visible chrome. Full Canvas is powerful but too chaotic unless it opens locked, compact, and subject-filtered. Advanced customization should remain available, but it needs a compact/expanded toggle and better grouping so students are not staring at empty configuration space or duplicated controls.

The most important product fix: separate the student-facing preset experience from the advanced layout editor. Students should see “Read,” “Take notes,” “Graph,” “Practice,” or “Build argument,” while advanced users can still open the full customization layer.

---

## 2. Screenshot-by-Screenshot Review

### Screenshot 1: Simple View, Vocab and Formula Sheet

**Preset/view:** Simple View with Study Surface set to History Gold on a math lesson.

**Visual issues:**
- Top area consumes too much vertical space before lesson content appears.
- The math lesson uses History Gold, which feels mismatched.
- Large beige surface feels calm, but the content starts too low.
- The right edge shows awkward partial overflow/side bezel.

**Functional issues:**
- Study Surface should default to matching the app theme, not a random subject surface.
- Math lessons should not easily end up in History Gold unless the user explicitly chooses it.

**Student confusion:**
- A learner sees a math lesson styled like history and may assume the app is inconsistent.

**Severity:** High.

**Fix direction:**
- Add first/default Simple View option: **Study Surface Match**.
- Replace the Simple View “Custom” surface tile with **Study Surface Match**.
- “Study Surface Match” uses the current app theme tokens automatically.
- Keep Classic Light, Warm Paper, Night Study, History Gold, Math Blue, High Contrast.
- Only show subject-specific surfaces as manual choices.

### Screenshot 2: Canvas Split Study, Source + Private Notes

**Preset/view:** Canvas, Split Study, locked study mode.

**Visual issues:**
- Two large panels fill width better than some other screenshots, but both panels contain repeated controls.
- The content inside panels has excessive nested padding.
- The right panel wastes top space before the actual note editor.

**Functional issues:**
- Quick split controls appear inside multiple panels.
- The panel headers act like mini toolbars duplicated across the workspace.

**Student confusion:**
- “Split study” appears as both the current preset and an action inside each panel.

**Severity:** High.

**Fix direction:**
- Keep one global quick split control in the workspace toolbar or preset menu.
- Remove repeated quick split buttons from every panel header.
- Panel headers should expose panel-specific actions only.

### Screenshot 3: Narrow Source Panel Crop

**Preset/view:** Split Study/canvas panel cropped horizontally.

**Visual issues:**
- Left bezel/margin is huge relative to the visible content.
- The source card is squeezed into a narrow column.
- A horizontal scrollbar is visible, indicating content/canvas sizing is not adapting well.

**Functional issues:**
- Canvas or panel content is wider than its viewport.
- Snap/resize behavior likely leaves modules partly offscreen.

**Student confusion:**
- It feels like the workspace is broken or accidentally panned.

**Severity:** Critical.

**Fix direction:**
- Add viewport-aware canvas fitting.
- Ensure locked mode never starts horizontally scrolled.
- Clamp module x/y/w/h into visible canvas.
- Reduce outer bezels and padding in locked study mode.

### Screenshot 4: Duplicated Panel Header Controls

**Preset/view:** Two panel headers side by side.

**Visual issues:**
- Duplicate “Focus source,” “Split study,” and “Sticky manager” controls appear in multiple headers.
- Buttons crowd the panel title.

**Functional issues:**
- Controls are not scoped clearly: some are workspace-level, not panel-level.

**Student confusion:**
- A user cannot tell whether “Split study” changes the whole workspace or only that panel.

**Severity:** High.

**Fix direction:**
- Move workspace-level controls to the top toolbar.
- Panel headers should show only: collapse, expand, panel menu.
- “Sticky manager” should be one workspace-level tool, not repeated everywhere.

### Screenshot 5: Focus Mode, Split Study

**Preset/view:** Focus mode while still showing Canvas/Split Study shell.

**Visual issues:**
- Focus mode still shows too much header and workspace chrome.
- The central close button floats awkwardly.
- Note title row appears with a heavy gray highlight and clipped text.

**Functional issues:**
- Focus is not truly immersive.
- The right notes editor title overflows.

**Student confusion:**
- “Focus” suggests full-screen study, but the UI still feels like a dashboard.

**Severity:** High.

**Fix direction:**
- Focus mode should hide global header, breadcrumbs, workspace buttons, preset controls, and panel chrome.
- Show only content plus one small “Exit focus” control.
- Notes panel title should truncate cleanly and never create a giant gray bar.

### Screenshot 6: Notes Focus With Binder Notebook

**Preset/view:** Canvas, Notes Focus, locked mode.

**Visual issues:**
- Left source panel is too narrow.
- Binder notebook right side is extremely cramped.
- Center note panel is usable, but the surrounding panels feel squeezed and busy.
- Many nested cards create visual noise.

**Functional issues:**
- Binder notebook tries to show hierarchy, section notebook, stats, and lesson preview all at once.
- Too many scrollbars.

**Student confusion:**
- The notebook looks powerful but intimidating and hard to read.

**Severity:** Critical for Notes Focus.

**Fix direction:**
- Notes Focus should use one main note editor, a compact source reference, and a collapsible notebook drawer.
- Binder notebook should open as a drawer or full-panel mode, not a cramped side rail.
- Hide notebook stats unless the user opens “Notebook overview.”

### Screenshot 7: Math Graph Lab, Calculator Mostly Blank

**Preset/view:** Math Graph Lab.

**Visual issues:**
- Desmos graph gets good central space.
- Left formula sheet is cramped.
- Right scientific calculator appears black/blank until scrolling.
- Right column stacks too many things vertically.

**Functional issues:**
- Scientific calculator initial viewport is not useful.
- Formula cards have nested scrollbars and cramped width.
- Saved graphs are offscreen.

**Student confusion:**
- The calculator looks broken because it is a black rectangle.

**Severity:** High.

**Fix direction:**
- Scientific calculator needs a minimum visible keypad/result area.
- If collapsed, show a compact calculator button instead of a blank panel.
- Formula sheet should either be a bottom strip or wider side drawer.
- Graph Lab should prioritize graph + formula/explanation + graph controls.

### Screenshot 8: Math Graph Lab, Narrow Three-Column Layout

**Preset/view:** Math Graph Lab with source, graph, notes/formulas/saved graphs.

**Visual issues:**
- Three columns are conceptually good, but the graph is too narrow for Desmos controls.
- Right column is too cramped and vertically overloaded.
- Saved graphs are buried below formula sheet.

**Functional issues:**
- Too many independent scroll regions.
- 2D/3D toggle is visible, good, but graph state controls compete with panel scroll.

**Student confusion:**
- The learner may not know whether to scroll the page, the graph panel, formula panel, or saved graph panel.

**Severity:** High.

**Fix direction:**
- Graph Lab should use two main zones: large graph and one helper rail.
- Helper rail should have tabs: Formula, Notes, Saved Graphs.
- On smaller laptops, source should collapse into a top summary or drawer.

### Screenshot 9: Math Guided Study

**Preset/view:** Math Guided Study.

**Visual issues:**
- Graph is large, which is good.
- Left source panel and right notes/math blocks are too narrow.
- Right note title is clipped.
- Formula cards are split across left and right, causing duplication/confusion.

**Functional issues:**
- Guided Study and Graph Lab feel too similar.
- The lesson content is not central enough for “Guided Study.”

**Student confusion:**
- It is unclear how this differs from Math Graph Lab.

**Severity:** Medium/High.

**Fix direction:**
- Math Guided Study should center lesson content first, with graph as secondary.
- Math Graph Lab should center graph first.
- Define distinct layouts:
  - Guided Study: lesson 50%, notes/formulas/practice 50%.
  - Graph Lab: graph 65%, helper rail 35%.

### Screenshot 10: History Annotation Mode

**Preset/view:** History Annotation Mode.

**Visual issues:**
- Outline/search column is useful but too wide for what it contains.
- Sticky-note manager is tiny and cramped.
- Highlights panel is mostly empty but occupies significant space.
- Related concepts are pushed low.
- Browser fullscreen banner adds clutter but is external.

**Functional issues:**
- Sticky manager has internal horizontal scrolling.
- Empty panels are shown even when they have no content.

**Student confusion:**
- Annotation Mode should feel like marking up a source, but it currently feels like many side tools at once.

**Severity:** High.

**Fix direction:**
- Annotation Mode should show source center, highlights/annotations side, notes drawer.
- Hide empty highlights until first highlight exists.
- Sticky manager should be a floating drawer, not a cramped card.

### Screenshot 11: History Guided

**Preset/view:** History Guided.

**Visual issues:**
- Three-column structure is promising.
- Timeline right panel is too narrow for event cards.
- Source evidence appears partially over/under other content.
- Notes title clipping appears again.

**Functional issues:**
- Evidence card layout appears to overflow.
- Timeline and evidence compete in the same narrow area.

**Student confusion:**
- It is unclear whether the right column is timeline-first or evidence-first.

**Severity:** High.

**Fix direction:**
- History Guided should use story/source 50%, timeline 25%, evidence/notes 25%.
- Evidence should be a drawer or bottom panel, not squeezed under timeline.
- Fix clipped note titles globally.

### Screenshot 12: History Timeline Focus

**Preset/view:** History Timeline Focus.

**Visual issues:**
- This is one of the better concepts: timeline is dominant.
- Still has too many scrollbars.
- Bottom source evidence and argument builder panels are partly visible and may distract.

**Functional issues:**
- Timeline focus still loads many secondary modules.

**Student confusion:**
- If the preset is timeline focus, bottom argument/evidence panels should feel optional.

**Severity:** Medium.

**Fix direction:**
- Timeline Focus should show timeline large, event detail beside it, source/argument collapsed into tabs.
- Bottom panels should not be visible until opened.

### Screenshot 13: History Source Evidence

**Preset/view:** History Source Evidence.

**Visual issues:**
- Strong idea: source, evidence, notes/myth.
- Center source evidence column is readable but dense.
- Right column stacks notes and myth/history, making both cramped.

**Functional issues:**
- Myth vs History may not belong in Source Evidence by default.
- Notes panel height is too small when myth panel is visible.

**Student confusion:**
- The preset name says Source Evidence, but myth checking competes for attention.

**Severity:** Medium/High.

**Fix direction:**
- Source Evidence should show source + evidence locker + claim scratch.
- Myth vs History should be collapsed unless lesson tag requires it.

### Screenshot 14: History Argument Builder

**Preset/view:** History Argument Builder.

**Visual issues:**
- Argument builder is visible and useful, but its fields are cramped.
- Source and notes also compete for equal attention.
- Several textareas are too small.
- Notes title is clipped.

**Functional issues:**
- Prompt says “French Revolution” inside Rise of Rome context, which is a content/preset mismatch bug.
- The cause chain panel has empty state but does not provide enough guidance.

**Student confusion:**
- Wrong prompt breaks trust immediately.

**Severity:** Critical.

**Fix direction:**
- Fix argument prompts to be binder/lesson-specific.
- Argument Builder should center argument chain and evidence, with source as reference.
- Textareas need larger default heights and fewer side-by-side micro fields.

### Screenshot 15: History Full Studio

**Preset/view:** History Full Studio, zoomed out.

**Visual issues:**
- Huge unused dark space on the right.
- Actual modules are clustered in the center/left and too small.
- Many panels are visible at once, reducing readability.
- Full Studio looks like a debugging dashboard, not a study environment.

**Functional issues:**
- Canvas layout is not using available width.
- Snap/fit rules are failing to distribute modules across the canvas.

**Student confusion:**
- “Full Studio” should feel powerful; instead it feels like the layout is accidentally zoomed/scaled wrong.

**Severity:** Critical.

**Fix direction:**
- Full Studio must use available canvas width.
- Add “Fit to screen” for locked mode.
- Add snap-to-module and distribute tools.
- Show advanced layout controls only after user enters customization.

---

## 3. Global Problems Across Presets

1. Presets are too globally exposed.
   - Math/history/general presets are mixed.
   - Users see irrelevant choices.

2. Workspace-level controls are duplicated inside panels.
   - Quick split, sticky manager, and source focus appear repeatedly.

3. Too many nested scroll areas.
   - Page scroll, canvas scroll, panel scroll, module scroll, and card scroll often stack together.

4. Locked study mode still feels like edit mode.
   - The UI shows too many layout controls.

5. Full Canvas wastes space.
   - Some modules cluster while half the screen is empty.

6. Modules do not consistently fit content.
   - Binder notebook, formula sheet, scientific calculator, sticky manager, and notes panels are especially affected.

7. Preset differences are not always clear.
   - Math Guided Study and Math Graph Lab overlap visually.
   - Annotation Mode and Notes Focus overlap conceptually.

8. Focus mode is not focused enough.
   - Too much shell remains visible.

---

## 4. Simplified View Fixes

### Required Study Surface Change

Replace the current Simple View “Custom” study surface option with:

**Study Surface Match**

Behavior:
- It is the first/default Simple View surface option.
- It uses the current app theme colors automatically.
- It updates when the global app theme changes.
- If the user manually selects Classic Light, Warm Paper, Night Study, History Gold, Math Blue, or High Contrast, matching stops.
- This behavior applies only to Simple View.

Final Simple View surface list:
1. Study Surface Match
2. Classic Light
3. Warm Paper
4. Night Study
5. History Gold
6. Math Blue
7. High Contrast

Do not show “Custom” as a Simple View study surface tile. Custom color editing should live in the global App Theme / Appearance system, not as a separate Simple View surface.

### Simplified View UX

Simple View should:
- Hide advanced preset controls.
- Keep only: Workspace, Study Surface, Settings, Focus.
- Let users collapse the controls row.
- Default to subject-aware surface if the app theme does not provide enough contrast.
- Use full viewport in Focus mode.

---

## 5. Advanced User Customization Rework

Advanced customization should stay available, but the default view must be cleaner.

Add a two-level model:

### Compact Customization

Shown by default:
- Current mode
- Recommended preset
- Two alternate presets
- App Theme / Study Surface where relevant
- Focus and Reset Layout

### Expanded Customization

Hidden behind “Advanced layout tools”:
- Full preset list
- Snap/grid controls
- Panel density
- Canvas dimensions
- Module visibility
- Resize/snap behavior
- Per-binder save toggles

Benefits:
- Advanced users keep power.
- Students avoid dead space and control overload.
- Settings panel can become shorter and easier to scan.

---

## 6. Preset System Redesign

### Rename/Organize Presets Around Student Intent

Student-facing groups:
- Read
- Take Notes
- Split Study
- Graph Lab
- Practice
- Build Argument
- Timeline
- Source Evidence
- Full Studio / Canvas

### Merge Or Hide Redundant Presets

- Merge duplicate Math Graph Lab.
- Merge Annotation Mode with Notes Focus unless Annotation becomes a clearly highlight-first mode.
- Hide Full Math Canvas and History Full Studio under Advanced.

### Subject-Aware Filtering

Math binders show:
- Focused Reading
- Notes Focus
- Split Study
- Math Simple Presentation
- Math Guided Study
- Math Graph Lab
- Math Proof / Concept Mode
- Math Practice Mode
- Full Math Canvas under Advanced

History binders show:
- Focused Reading
- Notes Focus
- Split Study
- History Guided
- History Timeline Focus
- History Source Evidence
- History Argument Builder
- History Full Studio under Advanced

---

## 7. Layout And Spacing Fixes

Global layout rules:
- Reduce side bezels in locked mode.
- Use available width before adding scrollbars.
- Clamp canvas modules to visible area on load.
- Avoid three or more always-visible vertical scroll regions.
- Do not show empty panels at full size.
- Give each preset one clear primary module.

Minimum useful sizes:
- Lesson/source panel: at least 420px wide desktop.
- Notes editor: at least 480px wide desktop.
- Desmos graph: at least 620px wide and 480px tall desktop.
- Formula sheet: at least 320px wide, or use bottom strip/tabs.
- Timeline: at least 420px wide when primary.
- Argument builder: at least 520px wide when primary.

---

## 8. Module Snap Mode Fixes

Current issue:
- Snap mode appears to snap modules to walls/edges but not reliably to other modules.

Required snap behavior:
- Snap to canvas edges.
- Snap to grid positions.
- Snap to other module edges.
- Snap to equal gaps between modules.
- Show alignment guides while dragging.
- Prevent modules from being dropped partly offscreen.
- Add “Fit to screen” in locked mode.
- Add “Tidy layout” to distribute visible modules evenly.

Spacing constants:
- Outer canvas padding: 16-24px desktop, 8-12px mobile.
- Module gap: 12-16px.
- Snap threshold: 8-12px.

---

## 9. Duplicate / Redundant UI Controls

Duplicate quick split controls should be removed from panel headers.

Keep:
- One global “Split Study” control in the top workspace toolbar or compact preset menu.

Remove from repeated panel headers:
- Split study
- Sticky manager
- Focus source when it changes global layout

Panel headers should only include:
- Panel title
- Collapse/expand
- Panel options menu

---

## 10. Module-Specific Fixes

### Binder Notebook

Problems:
- Extremely cramped.
- Too many stats, hierarchy cards, and preview cards at once.

Fix:
- Make it a full drawer or full panel mode.
- In side panel, show only section list and recent notes.
- Move stats to “Notebook overview.”

### Vocab / Formula Sheets

Problems:
- Cards too narrow.
- Formula cards get squeezed into scrollable boxes.
- The formula sheet is sometimes split across multiple panels.

Fix:
- Use responsive card grid.
- In narrow rails, show formula title + formula only.
- Add “Open formula sheet” full drawer.

### Scientific Calculator

Problems:
- Appears mostly black/blank unless scrolled.

Fix:
- Give calculator a fixed minimum visible keypad height.
- If space is insufficient, collapse to a calculator launcher.
- Never show a blank black rectangle as the default state.

### Sticky Manager

Problems:
- Tiny, cramped, and horizontal scrolling appears.

Fix:
- Make sticky manager a drawer/modal.
- Panel card should only show recent stickies and “New sticky.”

### Notes Editor

Problems:
- Titles clip.
- Toolbar can dominate small panels.

Fix:
- Truncate title properly.
- Compact toolbar in narrow panels.
- Minimum editor height of 280px.

### Desmos Graph

Problems:
- Good when central, poor when squeezed.
- Graph Lab and Guided Study are too similar.

Fix:
- Graph Lab: graph primary.
- Guided Study: lesson primary, graph secondary.
- Avoid remounting Desmos on preset switch unless graph mode changes.

### History Timeline / Evidence / Argument

Problems:
- Timeline and evidence cards often compete in narrow columns.
- Argument builder has cramped textareas.
- Wrong French Revolution prompt appears in Rome.

Fix:
- Timeline Focus: timeline primary.
- Source Evidence: evidence primary.
- Argument Builder: argument primary.
- Fix prompt content to be binder/lesson-specific.

---

## 11. Prioritized Implementation Plan

### P0: Must Fix Before Serious User Testing

1. Add Simple View **Study Surface Match** and remove Simple View “Custom” tile.
2. Filter presets by subject and mode.
3. Remove duplicate Math Graph Lab.
4. Remove duplicate quick split controls from panel headers.
5. Fix focus mode to truly hide chrome.
6. Fix Full Studio / Full Canvas wasted space and initial offscreen placement.
7. Fix binder notebook cramped layout.
8. Fix scientific calculator blank/black initial display.
9. Fix Rise of Rome argument prompt mismatch.

### P1: Important Polish And Usability

1. Add compact/expanded customization toggle.
2. Redesign settings panel into sections/tabs.
3. Resize every preset around a single primary module.
4. Add snap-to-module alignment.
5. Add “Fit to screen” and “Tidy layout.”
6. Collapse empty panels by default.
7. Reduce side bezels and nested padding.
8. Improve formula/vocab sheet responsive layout.

### P2: Nice-To-Have Improvements

1. Preset thumbnails.
2. “Recommended for this lesson” badge.
3. Last-used preset per binder.
4. Keyboard shortcuts for Focus and Split Study.
5. Animated alignment guides while dragging.
6. Preset preview before applying.

---

## 12. Final Codex Implementation Prompt

You are working on BinderNotes.

Focus only on the preset/workspace UI stabilization described in `docs/superpowers/plans/2026-04-25-preset-layout-stabilization.md`.

Do not work on payments, migrations, seeds, history content, math content, or unrelated theme rewrites.

Implement:
1. Simple View `Study Surface Match` as the first/default study surface option.
2. Replace the Simple View `Custom` surface tile with `Study Surface Match`.
3. Subject-aware preset filtering so math binders do not show history presets and history binders do not show math presets.
4. Mode-aware preset filtering so Simple View, Study Panels, and Canvas do not show irrelevant presets.
5. Remove duplicate Math Graph Lab.
6. Remove duplicate quick split controls from panel headers.
7. Move workspace-level controls to the top toolbar or compact preset menu.
8. Make Focus mode truly immersive by hiding global chrome.
9. Make Full Canvas / Full Studio locked by default, with advanced customization behind an explicit button.
10. Add compact/expanded customization mode.
11. Resize every preset so the primary module is clear and modules do not waste space or become cramped.
12. Fix binder notebook cramped layout.
13. Fix vocab/formula sheets so formulas are readable.
14. Fix scientific calculator so it never appears as a mostly blank black panel.
15. Improve snap mode so modules snap to canvas edges, grid positions, and other modules.
16. Add `Fit to screen` and `Tidy layout`.
17. Fix the Rise of Rome argument prompt mismatch.

Add tests for:
- Study Surface Match default behavior.
- Manual study surface selection stops matching app theme.
- Math/history preset filtering.
- No duplicate Math Graph Lab.
- Study Surface only appears in Simple View.
- Quick split control is not duplicated in panel headers.
- Focus mode hides chrome.
- Preset validation catches too-small panels and duplicate preset titles.

Run:
- `npm run typecheck`
- `npm run test`
- `npm run build`

Then verify locally and in browser:
- Simple View defaults to Study Surface Match.
- Math shows math/general presets only.
- History shows history/general presets only.
- Full Canvas opens locked.
- Focus fills the screen.
- Binder notebook, formula sheets, calculator, graph lab, timeline, evidence, and argument builder are no longer cramped or wasteful.
