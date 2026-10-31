# Study continuity release candidate — 31 October 2026

## Baseline and boundaries

The requested `C:\Users\User\Documents\ChatGPT\Bindernotes` directory was empty (including hidden files), with no Git repository. The nearby main checkout at `New project\Bindernotes` is `ac24e663a95fcbaf5a69bf6ac77501e9dbf0d081`, substantially behind the existing release-fix branch. Independent Claude discovery and Codex inspection agree to use the latest existing local release-fix commit, preserving its established data protections.

- Source: `C:\Users\User\Documents\ChatGPT\New project\Bindernotes-whiteboard-release`
- Source branch: `codex/report-fixes-2026-10-02`
- Starting commit: `f26e6d40dfcf14e90c4ef8d2dc01a87014a2b748`
- Source tracked/untracked status: clean. Ignored credentials, caches, and outputs were not copied.
- Candidate: a separate local clone at the requested path, with no remote configured.
- Candidate branch: `free-will/2026-10-31-study-continuity`
- Baseline tag: `baseline/free-will-2026-10-31`
- Backup directory: `C:\Users\User\Documents\ChatGPT\Bindernotes-baselines\free-will-2026-10-31`
- Backup: verified `source-baseline.bundle`, original checkout/worktree inventory in `baseline.json`, and a SHA-256 inventoried copy of the six untracked research documents from the older main checkout. Original files remain in place.

The explicit workspace in the user's request supersedes AGENTS.md's historical machine path. No deployment, push, live account changes, schema migrations, production sign-in, or real-note testing is part of this pass. Original/default branches remain unchanged. Existing historical source is retained locally; backups are never uploaded.

## Product direction and ownership

Resume: after an explicit workspace pause, the user explicitly reauthorized the candidate path above. The existing Claude worktree outside the root is clean and remains unused. Both providers now edit the authorized root with exclusive file ownership; only Codex stages/commits. New verification artifacts stay under the root's ignored `.tmp/free-will` directory. All non-workspace permanent rules remain in force. The pre-resume partial diff is preserved there as `resume-preserved.patch`.

Help a student find the right material, continue writing beside it, and resolve a failed save without losing either version. Keep the existing visual language and storage model.

1. **Claude Opus 5.5 / max — Find and navigate.** Own new `src/components/search/*`, `src/lib/search/*`, a dedicated search CSS file if needed, app-shell, dashboard, Personal Notes command coordination, and their tests. Provide a header search trigger and Ctrl/Cmd+K across signed-in routes; search available lessons and personal notes with direct result links; preserve the Personal Notes page's specialized actions without opening two dialogs; fix Workspace's active navigation for binder/folder routes. Use existing account-scoped query hooks, loaded only when the search UI needs them. Do not edit persistence, reader, workspace module, or shared type files.
2. **Codex gpt-6-astra / ultra — Save and recover; integration lead.** Own save queue/status, learner-note conflict classification, binder reader, study-core/workspace module bindings and tests. Give stale-version conflicts explicit recovery actions, preserve draft/title/math content, and remove unsupported device-safety claims. Stop automatic conflict retries; keep errors and recovery scoped to the correct note. No schema or existing storage-key changes.
3. **Codex — Verification and release.** Own fixture integration, browser regression tests, documentation, rollback validation and final commits. Claude independently reviews Codex's completed diff; Codex reviews Claude's changes before integration. After the workspace clarification, both implementations use the authorized root with exclusive file ownership. The initially prepared external T3 worktree remains unused. No concurrent edits to the same files.

## Shared contracts

- Search uses existing `useDashboard`, `usePersonalNotes`, route IDs and account scoping. No service API or global shared type changes required by Claude. Existing `/notes` route semantics and editor commands stay compatible.
- The reader's additional recovery callbacks are optional fields on `WorkspaceModuleContext` and `PrivateNotesModule` props, owned solely by Codex. Other modules must remain compatible.
- Conflict detection uses a typed error rather than matching localized error text. Saving a separate copy uses the existing personal-note creation API. Original learner-note revision predicates remain intact.
- Search and recovery styles use existing theme tokens. Keyboard focus remains visible and dialogs restore focus. New account content is never placed in analytics or fixtures.

## Acceptance

- Global search opens once, works by keyboard, exposes loading/empty/error states, opens non-recent lessons and personal notes directly, and fits phone widths. Existing editor commands remain reachable.
- Conflicting saves cannot overwrite a newer version or repeatedly retry the same obsolete revision. The user can preserve a separate copy or explicitly load the latest version. Failure during recovery retains the draft; edits made during recovery are not silently cleared.
- Generic save status makes no durability promise beyond its actual in-memory lifetime. Older async completions cannot replace a newer operation's status or retry closure.
- Relevant unit/service tests plus integrated typecheck, build and browser checks pass or have exact documented pre-existing/external failures. No production auth or database behavior is claimed from fixtures.
- Each verified slice is a coherent commit. Reverting the pass is tested in a disposable checkout, with an unrelated later file retained.

## Baseline checks

- Node 24.22.1 from the installed Codex runtime; npm 11.6.2 invoked through bundled pnpm because npm is absent from shell PATH. `npm ci` succeeded (existing React/Excalidraw peer warnings).
- Vitest: **163 files, 1,203 tests passed** (77.31 s), log `baseline-tests.log` in the backup directory.
- TypeScript application and Node configurations: both exit 0.
- Guarded production build: exit 0 using the existing synthetic browser-fixture URL/key, never real credentials. Large-chunk and stale Browserslist warnings pre-exist.
- Browser baseline: default Playwright browser absent; installed Chrome passed 21 tests with 3 opt-in external Desmos tests skipped. T3 preview successfully rendered the isolated study workspace at port 5196.

## Rollback strategy

Retain the tagged baseline and external bundle. Commit documentation, recovery and search as distinct slices. Use `git revert` on exact pass commits on a new rollback branch, never a destructive reset. Test both the full sequence and individual feature reverts before handoff. Returning to the pre-pass empty requested folder is possible simply by leaving the new clone unused; the original checkouts were never modified. Do not delete local notes, browser storage, or untracked user files as part of rollback.

## Deferred

Unify the broader review/study-loop beta features; verify live Supabase migration order (including duplicate historical 0016 numbering) separately; reduce oversized editor/whiteboard chunks. These require a different scope and are not bundled into this local candidate.

## Consequential decisions during implementation

- Keep the existing storage schema and owner/revision predicates. Conflict recovery reads the latest learner note without seeding or repairing any account content. Keep both uses the existing loose Personal Note API when a user chooses it in the app; verification never invokes that API against production.
- Generic queue storage is memory-only, so offline wording asks users to keep the tab open. Lesson-note session recovery is supplementary; downloads provide an explicit portable copy without overstating browser durability.
- Real browser inspection exposed repeated mobile guidance ahead of the study controls. A small presentation-only stylesheet trims that repetition and increases touch targets, retaining the existing study modes and layouts. It is separately reversible.
- No real Supabase configuration or account credentials were copied into this candidate. Required live-auth verification checks the rendered signed-out production form only. Authenticated read/write verification remains outside the evidence collected here.

## Provider handoff (lead change mid-pass)

At 13:49 the Codex root (`gpt-6-astra`) spawned a native Codex helper, `/root/queue_review_fixes`, to fix review findings F2/F6 in `save-queue.ts`, `save-queue.test.ts` and `sync-recovery.ts`. That helper failed before it started (0 runs, 0 items, no file changes). The root chat then failed twice with "Codex used a feature that ChatGPT sharing does not support" (T3 category `subscription_sharing_unsupported_capability`; Codex was authenticated, runtime v0.156.1). It had not yet edited any reader file for the review findings.

The user switched the root thread to Claude Opus 5.5 (`claude-opus-5-5`, max) and asked Claude to continue as lead. Claude took over the failed helper's scope and root's reader/recovery scope. The running Claude search task kept its exclusive files. Claude now stages and commits root-owned slices. The user then asked to restore dual-provider collaboration with one controlled attempt: a fresh, bounded, read-only Codex reviewer (`gpt-6.1-sol`, high effort, no nested agents) started successfully through T3 delegation to review the queue fixes.

## Review findings resolved after the handoff

Independent Claude review of Codex's recovery work (F1-F8) and how each was resolved:

| Finding | Severity | Resolution |
| --- | --- | --- |
| F1 stale refetch / jsonb key order stops autosave | High | Canonical snapshots; refetched rows are classified against the known revision. Older rows are ignored. Conflicts are flagged only for strictly newer revisions, and never while the note's own write is in flight. |
| F2 queue hides an earlier failed write behind a later success | Medium | Each failed operation is tracked per scope and retried oldest-first. Codex review then caught that a retry could restore an older value. Writes now declare targets, a newer saved write supersedes older failures for them, and multi-field patches rebase (`e201f72`). |
| F3 duplicate live regions; focus lost after recovery | Medium | One problems-only announcer per note surface. Focus moves to the outcome when its button disappears; otherwise the outcome is announced. |
| F4 "Retry" wording with no Retry button | Low/Medium | Conflict-specific copy whenever a conflict is active. |
| F5 no way out when the account note was deleted | Low | The draft is kept and saved as the lesson note again. The stale revision and cached row are cleared. |
| F6 unhandled rejection on reconnect | Low | The reconnect retry catches its rejection, and the effect is keyed by content rather than an inline array. |
| F7 "Open in Personal Notes" leaves before saving | Low | It saves first and opens only once everything typed is in the account copy. It is not offered offline or during a conflict. |
| F8 draft lost on return when session storage fails | Low | The journal falls back to this tab's memory, and an outdated stored journal is removed. |
| UI nits | Low | Class-based selectors with an accurate scope comment; a Wi-Fi-off icon when offline. |
