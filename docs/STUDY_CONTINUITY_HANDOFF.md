# Study continuity — local release candidate

This pass connects three things a student does: finding study material, writing beside it, and recovering from a failed save. It keeps the existing Supabase schema, authentication, ownership checks, RLS, and user data. Nothing has been pushed, deployed, published, migrated, or seeded, and no account data was written by any automated step.

## Try it

### Real app, connected to the BinderNotes backend

`http://127.0.0.1:5173`. Sign in with a real BinderNotes account.

- **Configuration.** The ignored file `.env.development.local` holds only `VITE_SUPABASE_URL` and the publishable `VITE_SUPABASE_ANON_KEY`. It targets project `ejisbofqfxitckaevmip`, the project named in `RUN_THIS_NEXT.md`.
- **Where the values came from.** They were copied, without being displayed, from the existing Vercel production pull in `Bindernotes-whiteboard-release`, the checkout this candidate was cloned from. No service-role key, secret key, or Vercel token was copied.
- **Why that file name.** Only the dev server reads `.env.development.local`. Unit tests and production builds never see the live backend.
- **Checks run.** A read-only `GET /auth/v1/settings` returned HTTP 200, with email and Google sign-in enabled. `scripts/verify-live-auth.mjs --url http://127.0.0.1:5173/auth` passed by inspecting rendered content; no credentials were submitted.
- **Real data.** This is the live production backend. Notes typed here save to the signed-in account, and "Keep both" creates a real Personal Note. RLS applies exactly as in production.
- **Google sign-in.** It returns to `127.0.0.1:5173` only if that origin is on the project's auth redirect allowlist, which was not checked or changed. Email and password sign-in works locally either way.
- **Not covered by the checks above.** Signed-in save, reload, and two-tab conflicts were not exercised by any automated check in this pass.
- **Disconnecting.** Delete `.env.development.local` and restart the dev server.

To start the app server again with the installed Node runtime:

```powershell
Set-Location -LiteralPath 'C:\Users\User\Documents\ChatGPT\Bindernotes'
$env:PATH = 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;' + $env:PATH
node node_modules/vite/bin/vite.js --config vite.config.ts --configLoader runner --host 127.0.0.1 --port 5173
```

### Isolated fixtures (synthetic data, no account)

Start the fixture server with `node node_modules/vite/bin/vite.js --config e2e/fixtures/vite.config.ts --configLoader runner`. These pages show the real components with a stubbed backend, so they are never evidence of sign-in or saving.

- `http://127.0.0.1:5196/e2e/fixtures/search.html`: global search. Try Ctrl/Cmd+K, the header button, typing words in any order, the arrow keys, Enter, and Escape. Add `?page=notes` for the Personal Notes command hand-off.
- `http://127.0.0.1:5196/e2e/fixtures/index.html?preset=notes-focus&recovery`: lesson-note conflict recovery. Try Keep both, Use latest… (Cancel or Replace), and Download draft. Add `&recovery-error` for the failure path.

## What changed

**Find and navigate**
- A header search button and Ctrl/Cmd+K on every signed-in route open one dialog. Results are grouped into lessons, personal notes, binders, folders, and pages, and any lesson opens directly in the reader.
- The dialog and its account-scoped data load only while it is open: a 16.5 kB lazy chunk.
- Matching ignores word order and tolerates small typos. The same matcher drives the dashboard filter, which now finds any matching document, not only the six most recent.
- On `/notes`, Ctrl/Cmd+K opens global search, which lists "Personal Notes commands", so only one palette is ever open. A note URL opens that exact note even when filters would hide it.
- Workspace is highlighted on binder, folder, and reader routes, and Math lab anywhere under `/math`.

**Write and recover**
- The save queue is serialized, and offline state is reported honestly: "Offline — keep this tab open."
- Version conflicts offer Keep both (the draft is saved as a separate Personal Note, including title, content, and math), Use latest… (requires explicit confirmation), and Download draft. There is no automatic retry of an obsolete revision.
- Editor hydration no longer emits destructive empty edits.
- After the independent review:
  - A stale refetch, or Postgres reordering JSON keys, can no longer stop autosave with a false conflict.
  - "Open in Personal Notes" saves first.
  - A deleted account note is recoverable.
  - Conflict copy no longer mentions a Retry button that isn't shown.
  - Drafts survive in memory when browser storage fails.
  - Failed history and highlight saves stay visible and retryable instead of being hidden by a later success.
  - A reconnect retry can no longer raise an unhandled rejection.

**Accessibility and mobile**
- Screen readers hear only problems: conflicts, failures, and offline state. Routine saves are silent.
- Focus moves to the outcome when a recovery button disappears.
- Mobile study controls sit closer to the lesson, with 44 px touch targets.

## Collaboration and provider history

- **Root integration (until 13:49).** OpenAI Codex `gpt-6-astra` (ultra), root T3 session `<t3-thread://v2/4b80b5ec-8fc9-41a1-8053-c079d147a486/a09c42d4-06d5-4685-88f4-c27d5902427c>`. Built the save and recovery, editor, and mobile slices (`cce64e8` through `7301c96`), the fixture harness, and the first rollback test.
- **Failure.** A native Codex helper, `/root/queue_review_fixes`, failed before it started: no runs, no file changes. The root chat then failed twice with "Codex used a feature that ChatGPT sharing does not support" (T3 category `subscription_sharing_unsupported_capability`).
- **Root integration (after the failure).** Anthropic Claude Opus 5.5 `claude-opus-5-5` (max), in the same root thread, at the user's direction. Implemented every independent-review fix in this file, integrated and reviewed the search workstream, connected the local backend, ran the final verification, and rehearsed rollback.
- **Search and navigation.** Claude Opus 5.5 delegated session `60f29b52` (`<t3-thread://v2/4b80b5ec-8fc9-41a1-8053-c079d147a486/thread:delegated-task:command%3Amcp%3Aad8d24d7-acf5-4db7-9330-c53f1302142b%3Adelegate-task%3A75f20ecf-e734-4b54-8cb4-2c3f69699eb8>`). Codex cross-reviewed it while in progress: focus-trap tabbability and no-match wording.
- **Independent review of the Codex recovery work.** Claude Opus 5.5 (`<t3-thread://v2/4b80b5ec-8fc9-41a1-8053-c079d147a486/thread:delegated-task:command%3Amcp%3Aad8d24d7-acf5-4db7-9330-c53f1302142b%3Adelegate-task%3A8a6b4f03-f123-401a-877e-94c8a552ecf3>`). Findings F1–F8 are resolved as listed in `docs/FREE_WILL_PASS_2026-10-31.md`.
- **Independent review of the queue fixes.** A fresh, read-only Codex reviewer, `gpt-6.1-sol` (high, no nested agents): `<t3-thread://v2/4b80b5ec-8fc9-41a1-8053-c079d147a486/thread:delegated-task:command%3Amcp%3Affd98327-083e-421c-baae-00aa939acc6e%3Adelegate-task%3A6c57f299-f8da-43a6-a072-c038074fc5df>`. Result: see "Codex review" below.

Exclusive file ownership was kept throughout, and only the root lead staged and committed.

## Codex review

**First review** (`gpt-6.1-sol`, high effort, read-only, of the uncommitted queue fixes). It completed normally: no edits, 13 focused tests passed.

- **One high-severity finding.** Keeping every failed write retryable (the F2 fix) let a retry of an older failed patch overwrite a newer successful edit to the same field. Reproducer: an argument-chain field is set to `old` and fails, then set to `new` and saves, then the retry wrote `old` again.
- **Fixed in `e201f72`.** Writes declare targets (argument-chain fields, highlighted text ranges). A newer saved write supersedes an older failure for those targets, including a retry already queued behind it, and a multi-field patch retries only the fields nothing newer has saved.
- **Tests.** Three regression tests, including the reviewer's reproducer, fail without the fix.
- **Sound, per the reviewer.** Independent failures stay visible, scopes are serialized, retry batches are claimed without duplicates, status counters behave, and the reconnect rejection is handled.

**Second review** (same model, read-only, at `b6c5519`): a re-check of that fix plus the Claude reader-recovery commits `ccd2b8e` to `8f1fcb5` (`<t3-thread://v2/4b80b5ec-8fc9-41a1-8053-c079d147a486/thread:delegated-task:command%3Amcp%3Affd98327-083e-421c-baae-00aa939acc6e%3Adelegate-task%3Aa4a0ae48-acc5-41ed-9c35-9657aa128cc1>`).

- **Result: no new concrete issues.**
- **The earlier high-severity finding is fixed by `e201f72`.**
  - Retries keep their original order and recompute superseded targets when they run.
  - Fully superseded retries skip their write; partially superseded patches rebase.
  - New items with no targets still retry.
- **Checked and found sound:**
  - Canonical, key-order-insensitive comparison, and microsecond-precise revision ordering. Older refetches can't regress the save baseline.
  - Save-before-open, including typing added during an in-flight save.
  - Deleted-note recovery: the draft is kept and re-inserted.
  - Unchanged server ownership and `updated_at` predicates.
  - Journal memory fallback with conditional clearing.
  - The problems-only live region, and guarded focus.
  - Personal Notes URL anchoring: no wrong-note exposure.
- **Tests:** its focused run passed, 62 tests in 5 files.

## Protected baseline and commits

- **Candidate.** `C:\Users\User\Documents\ChatGPT\Bindernotes`, branch `free-will/2026-10-31-study-continuity`, no remote.
- **Baseline.** Tag `baseline/free-will-2026-10-31` = `f26e6d40dfcf14e90c4ef8d2dc01a87014a2b748`. The source checkout `C:\Users\User\Documents\ChatGPT\New project\Bindernotes-whiteboard-release` (branch `codex/report-fixes-2026-10-02`) was never modified.
- **Off-machine bundle.** `C:\Users\User\Documents\ChatGPT\Bindernotes-baselines\free-will-2026-10-31`. Interrupted edits are preserved as `.tmp/free-will/resume-preserved.patch`.
- **Line endings.** Several files store mixed CRLF/LF in Git. Every commit keeps the original endings on untouched lines, so diffs show only real changes.

| Commit | Slice |
| --- | --- |
| `dfc4493` | docs: protected baseline and plan (Codex) |
| `cce64e8` | Serialize queued saves; honest offline status (Codex) |
| `f5cd643` | Editor hydration never emits destructive empty edits (Codex) |
| `8996e6b` | Conflict recovery: Keep both / Use latest / Download (Codex) |
| `4e064a4` | Mobile study controls closer to the lesson (Codex) |
| `ef45d36` | Restore recovering drafts when returning to a lesson (Codex) |
| `0e6e9ee` | Clear recovery completion text when writing resumes (Codex) |
| `7301c96` | Keep verification artifacts out of dev watching (Codex) |
| `ccd2b8e` | Stale refetch / jsonb key order no longer blocks autosave (F1) |
| `834f08b` | Save before "Open in Personal Notes" (F7) |
| `2a2ac34` | Recover a lesson note deleted elsewhere (F5) |
| `f6dbf58` | Conflict copy without a missing Retry (F4) |
| `b95d642` | Drafts survive in memory when storage fails (F8) |
| `8f1fcb5` | Problems-only announcements; focus after recovery (F3) |
| `2e9fab2` | Class-based mobile trim selectors (review nits) |
| `08cfe1c` | Shared word-order-insensitive matcher |
| `296a9b7` | Global search (Ctrl/Cmd+K) and section-aware navigation |
| `9bcf2f1` | Dashboard search finds any matching document |
| `70c524a` | Personal Notes Ctrl/Cmd+K hand-off; open linked notes exactly |
| `3678394` | Browser coverage for global search |
| `e201f72` | Failed collection saves stay retryable without restoring stale values (F2/F6 + Codex finding) |
| (this commit) | docs: handoff and pass record |

## Verification on the integrated tree

- **TypeScript.** `tsconfig.json` and `tsconfig.node.json` both exit 0.
- **Vitest.** 170 files, 1,288 tests passed at `e201f72` (baseline: 163 files, 1,203 tests).
- **Mutation checks.** Each reader fix's regression test fails when that fix is removed. For the stale-refetch race, two guards each prevent the false conflict, so that test fails only when both are removed. The three queue supersession tests fail without supersession.
- **Production build.** Passes with synthetic placeholder values, never real ones. Large-chunk, stale Browserslist, and React/Excalidraw peer warnings were already present.
- **Browser (installed Chrome).** 30 passed and 3 opt-in external Desmos checks skipped: search, note recovery, public, whiteboard, workspace.
- **Live sign-in page.** `verify:auth:live` (production `/auth`) and the same checker against the local candidate (`127.0.0.1:5173/auth`) both passed by inspecting rendered content. Neither proves signed-in save or load.
- **Visual checks.**
  - Recovery panel at 1440×900 and 390×844: focus lands on the outcome, and nothing overflows.
  - Search dialog at 1440×900 and 390×844, synthetic data.
  - Real `/auth` page with the backend connected.

## Undo

All undo steps add commits; none use `reset`. Ignored local files (`.env.development.local`, `.tmp/`) and untracked user files are never touched by `git revert`.

**Everything from this pass, keeping later work.** Rehearsed in a disposable worktree: 21 revert commits, the tree returned to the baseline exactly, a later unrelated user commit was kept, and the result typechecks.

```powershell
git switch -c rollback/study-continuity free-will/2026-10-31-study-continuity
git revert --no-edit baseline/free-will-2026-10-31..e201f72
```

That range covers all code commits. Also revert the docs commit if you want the documents gone too.

Simply using the baseline instead also works: `git switch -c use-baseline baseline/free-will-2026-10-31`. The original source checkout is unchanged as well.

**One improvement.** Run `git revert --no-edit <commit>` with a hash from the table.
- Reverting only `834f08b` on top of everything else was rehearsed: clean, 639 tests across 86 files pass.
- To remove search entirely, revert `3678394 70c524a 9bcf2f1 296a9b7 08cfe1c` in that order. Rehearsed before the queue commit existed: the tree returned exactly to `2e9fab2`, and recovery was kept. Search and the queue fix touch different files.
- Reverting only `e201f72` on the final tip was rehearsed: the tree returns exactly to `3678394`.
- The dashboard (`9bcf2f1`) and Personal Notes (`70c524a`) search slices can each be reverted alone. Without `70c524a`, `/notes` keeps its own Ctrl/Cmd+K palette, and it takes the shortcut first.

**Disconnect the local backend.** Delete `.env.development.local`.

## Follow-up, in priority order

1. With an approved test account and explicit permission for test writes, verify signed-in save, reload, and two-tab conflict recovery against a disposable or staging dataset.
2. Visually check the real signed-in header between 1280 and 1440 px, and decide whether `/math/lab/whiteboard` and the public pages, which render outside the app shell, should offer search.
3. Move the admin dashboard filter and the Personal Notes list search to the shared matcher.
4. Reduce the oversized editor and whiteboard bundles, and consolidate duplicated workspace chrome.
5. Audit the historical migration order (duplicate `0016_` prefix) read-only before proposing any database operation.
