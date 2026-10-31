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

Help a student find the right material, continue writing beside it, and resolve a failed save without losing either version. Keep the existing visual language and storage model.

1. **Claude Opus 5.5 / max — Find and navigate.** Own new `src/components/search/*`, `src/lib/search/*`, a dedicated search CSS file if needed, app-shell, dashboard, Personal Notes command coordination, and their tests. Provide a header search trigger and Ctrl/Cmd+K across signed-in routes; search available lessons and personal notes with direct result links; preserve the Personal Notes page's specialized actions without opening two dialogs; fix Workspace's active navigation for binder/folder routes. Use existing account-scoped query hooks, loaded only when the search UI needs them. Do not edit persistence, reader, workspace module, or shared type files.
2. **Codex gpt-6-astra / ultra — Save and recover; integration lead.** Own save queue/status, learner-note conflict classification, binder reader, study-core/workspace module bindings and tests. Give stale-version conflicts explicit recovery actions, preserve draft/title/math content, and remove unsupported device-safety claims. Stop automatic conflict retries; keep errors and recovery scoped to the correct note. No schema or existing storage-key changes.
3. **Codex — Verification and release.** Own fixture integration, browser regression tests, documentation, rollback validation and final commits. Claude independently reviews Codex's completed diff; Codex reviews Claude's commits before integration. Separate T3-prepared worktrees for parallel implementation. No concurrent edits to the same files.

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
- Browser baseline: default Playwright browser absent; retry with installed Chrome in progress. T3 preview successfully rendered the isolated study workspace at port 5196.

## Rollback strategy

Retain the tagged baseline and external bundle. Commit documentation, recovery and search as distinct slices. Use `git revert` on exact pass commits on a new rollback branch, never a destructive reset. Test both the full sequence and individual feature reverts before handoff. Returning to the pre-pass empty requested folder is possible simply by leaving the new clone unused; the original checkouts were never modified. Do not delete local notes, browser storage, or untracked user files as part of rollback.

## Deferred

Unify the broader review/study-loop beta features; verify live Supabase migration order (including duplicate historical 0016 numbering) separately; reduce oversized editor/whiteboard chunks. These require a different scope and are not bundled into this local candidate.
