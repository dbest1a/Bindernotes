# BinderNotes remediation evidence

Assessment: 17 September 2026. This record distinguishes implemented code from verified release gates. No production deployment or production data changes are authorized until every mandatory release gate passes.

## Preserved baseline and environment

- Working copy: `OLD CODEX WITH KEYS`, copied and hash-verified from the USB SSD; original untouched.
- Branch: `codex/bindernotes-remediation-2026-09-17`.
- Recovered parent: `94525210ad1ab752e11f669c3eaf53da56d35505`.
- Existing local work preserved first: `b285adb7622f61aa59dcda7e660184cff530c819` (93 application/documentation files). This is recovered work, not remediation credit.
- React 19 / TypeScript 5 / Vite 7 / TanStack Query 5 / Supabase Postgres and Auth / TipTap / Excalidraw; npm package-lock.json.
- Baseline lockfile install: npm 11 `ci --ignore-scripts --no-audit --no-fund` via bundled pnpm; passed. Peer warnings from Excalidraw/Radix require review.
- Baseline tests: **1,074 passing**, `.tmp/remediation/baseline-tests.json`. Both TypeScript projects passed. Production build passed. Logs excluded from Git.
- Baseline has no formatting/lint scripts, disposable database runtime tests, or full authenticated E2E command. These are missing gates, not passing results.
- Intended Vercel project: `prj_W8PLZUB5r3zewZRQ7MUQg5DjNavx`; GitHub `dbest1a/Bindernotes`; domains `bindernotes.com`, `www.bindernotes.com`.
- Production deployment read-only inspection: `dpl_65aNJ5kVKSKhSJVF7zmpdoVR4mTo`, READY, CLI deployment metadata says SHA `94525210ad1ab752e11f669c3eaf53da56d35505` and **gitDirty=1**. SHA alone does not identify its complete source; no exact-source rollback claim.
- Copied local env files contain browser configuration, not DB/service-role or Stripe credentials. Their values are never included in evidence. The Supabase connector identified production project ejisbofqfxitckaevmip. Only sanitized schema/grant metadata was read; production has recorded versions0001–0018 plus selectively applied later schema changes.
- Disposable local PostgreSQL 17 runs on loopback port 55439 outside the repository. It has no production data. Supabase pg_cron/pgmq full-stack coverage must be recorded separately.
- Supabase connector inspection: existing organization eosduuwuhavfwixgfmpa, no development branches. User explicitly declined the quoted paid branch ($0.01344/hour). No paid branch/project created.
- Real local Auth v2.197.0 + PostgREST16.3 + PostgreSQL17.11 are running on loopback API55442. Four disposable accounts represent learner A/B, creator and operator. Windows startup patch removes unsupported SO_REUSEPORT only. Supabase Storage HTTP, Realtime and pg_cron remain separate unverified platform gates.
- Local browser real learner sign-in succeeded on5173; all10 critical journeys and exact-SHA preview remain pending. No production deployment or database writes made.

## Baseline commands

```text
node <bundled-pnpm>/bin/pnpm.cjs dlx npm@11 ci --ignore-scripts --no-audit --no-fund
node node_modules/vitest/vitest.mjs run --config vite.config.ts --configLoader runner --reporter=json --outputFile=.tmp/remediation/baseline-tests.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json --pretty false
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.node.json --pretty false
node scripts/build-client.mjs
```

Tests/build use inert local browser config when they do not need a real backend. Production credentials are never used for test writes.

## Current implementation and evidence limits

The environment bullets above record the preserved baseline and initial setup. They are not the current completion state: later local interactive journeys are recorded in [Local browser verification](LOCAL_BROWSER_VERIFICATION.md). That record distinguishes real Auth/PostgREST operations, controlled HTTP failure or delayed-acknowledgement probes, and their exact limitations. The latest candidate is still undergoing integration; no task below is marked verified complete.

- Local browser evidence includes note save/reload and account switching, delayed acknowledgements, recoverable failed saves, two-origin conflicts, board/route persistence and contrast, saved quiz results and owner denial, cloud review/source/scheduling continuity, course trash/restore, fresh-account archive import, creator/operator separation and phone navigation. Refer to the browser document for individual artifact names and untested paths; these working-tree checks are not exact-SHA hosted preview evidence.
- Latest full suite: **1,537/1,537 passed**, zero failed/pending (`.tmp/remediation/final-tests-02.json`). All three TypeScript projects, ESLint (`final-lint-02.log`) and formatting (`final-format-check-03.log`) passed. The full suite preceded the final lazy-telemetry load correction in a17f3c5; its 13 focused tests subsequently passed. These checks do not substitute for exact-SHA hosted runtime verification.
- All four final native database paths through **0041** passed: clean, 0015, 0025 and simulated production-observed upgrades; each preserved fixture content, applied complete catalogs twice and verified generated contracts (68 tables/63 RPC names). Sanitized evidence is `../bindernotes-db-runtime/final0041-evidence.json`. Chemistry's missing trusted catalog caused the observed layout failure; fe0a48c corrected it, and 9ac8349 records successful actual browser checkpoint/preset reopen after reload.
- Guarded client build and the **unchanged asset-budget scan passed after a17f3c5**: main entry 61.94 kB against 120 kB; initial JS/CSS 267.24 kB gzip against 300 kB; no Supabase preload. The older `final-asset-scan.log` records the failure that prompted this fix, not the latest result. The telemetry import was made lazy; budgets were not raised.
- Personal Notes navigation extraction is committed in 7c823e1. The [large-notebook API measurement](LOCAL_PERFORMANCE_VERIFICATION.md), committed in 014b3bf, verifies actual 1,500-note paging, payload size and local timing; browser/WAN/concurrent-user performance remains separate. The GitHub remediation branch was pushed through 014b3bf; later report/fix commits and final deployment URLs are recorded by the release owner.
- The expanded Linux authenticated Playwright suite is configured and statically checked but has not been browser-executed locally; the full Linux Supabase workflow has no verified run recorded here. Native SQL/Auth evidence does not cover real Storage HTTP, Realtime, pg_cron workers, delivered email, OAuth or real Stripe provider flows.
- Production deployment, production data/schema writes, provider subscription changes and paid environment creation have not occurred. The user declined the paid Supabase branch. All new test accounts and content are disposable local data.
- [Database runtime evidence](../scripts/database/README.md), [release gates](RELEASE_PROCESS.md), [billing boundary](BILLING.md), [dependency review](DEPENDENCY_REVIEW.md), [content-free telemetry](OBSERVABILITY.md) and [commercial obligations](COMMERCIAL_INTEGRATIONS.md) define the remaining operational and external requirements.

The register deliberately uses **IN PROGRESS** for local implementations awaiting acceptance/final-candidate checks, and **BLOCKED — EXTERNAL ACTION REQUIRED** where external setup, rights, hosted verification or actual usage evidence prevents completion. A passing focused test or an implemented disabled feature is not a release approval.

## Publication checkpoint

The application candidate `c1d69951878723c05bc2307a170c4ad8f1369ce5` is published in a Vercel preview and the changes are pushed in [draft PR #2](https://github.com/dbest1a/Bindernotes/pull/2). See [hosted preview verification](HOSTED_PREVIEW_VERIFICATION.md) for exact deployment metadata and limitations. The latest complete local suite passes 1,543 tests; native compiled API startup and sixteen disabled requests also pass. CI platform fixes preserve historical migrations and runtime policies. Production and authenticated hosted acceptance remain blocked.

Latest inspected [GitHub run 35272366847](https://github.com/dbest1a/Bindernotes/actions/runs/35272366847), source `8b571f0a82a95a810930ef738fd4165ea1616e35`: quality **PASS**, including install, formatting, lint, types, native function startup, unit tests, build, asset budgets and audit. All four real Supabase jobs passed migrations and their SQL authorization/concurrency/storage/archive/search/account scenarios, then **FAILED** at the generated-types assertion (`supabase-check.mjs`, child exit 1). That assertion withheld the generator stderr, so the precise mismatch/process cause is not established. Authenticated browser CI was skipped. At the user's request to finish publishing immediately, no further CI iteration was started. This is an explicit remaining engineering blocker, not a passing full-platform gate.

## Task register

### BE01 — Replace Personal Notes autosave with revision-aware saves

- Priority: **20/20**.
- Assessment finding: Two reproduced races lose edits during note switching and slow saves.
- Acceptance: Use immutable snapshots and per-entity serialization. Old acknowledgements cannot clear newer edits. Both preservation probes pass.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Shared revision-aware controllers serialize immutable snapshots per owner/entity, preserve newer edits after old acknowledgements, and retain validated device journals. Personal Notes and reader learner notes expose explicit conflict-copy, account-version recovery and discard choices.
- Files changed: `src/lib/revisioned-save.ts`; `src/lib/personal-content-drafts.ts`; `src/hooks/use-personal-content-editor.ts`; `src/hooks/use-learner-note-editor.ts`; `src/services/personal-content-repository.ts`; `src/pages/personal-notes-page.tsx`.
- Tests added: Controller, journal, repository and rendered editor regressions cover delayed acknowledgements, note switching, newer edits, unmount, retry, storage failure and reader saves.
- Verification evidence: Focused automated checks passed. Real local Auth/PostgREST browser checks preserved the newer note through delayed acknowledgement, navigation and reload; see `docs/LOCAL_BROWSER_VERIFICATION.md` and `.tmp/remediation/browser/delayed-ack-reload-newer-note.txt`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final integrated candidate checks and exact-SHA preview repetition remain pending; local working-tree evidence is not release verification.
- Commit SHA: a3b2828; 4d133ba; 3902c50; aed9f0f.

### BE02 — Preserve pending whiteboard changes during navigation

- Priority: **20/20**.
- Assessment finding: Static lifecycle review found timers cleared and scene references replaced without preserving pending changes.
- Acceptance: Switch boards and routes during a pending save. Each scene is preserved and old responses cannot replace the current board.
- Dependencies: BE01; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Whiteboard retirement captures the original board and flushes pending canvas changes into independent revisioned writer slots. Remote acknowledgements cannot replace the selected board. Explicit conflict recovery preserves drafts; canvas/list theme contrast was corrected without remounting the scene.
- Files changed: `src/components/whiteboard/whiteboard-module.tsx`; `src/components/whiteboard/whiteboard-canvas.tsx`; `src/lib/whiteboards/whiteboard-drafts.ts`; `src/lib/whiteboards/whiteboard-storage.ts`; `src/styles.css`.
- Tests added: Draft persistence and actual canvas-instance tests cover rapid switching, route retirement, delayed responses, resize/menu changes, account changes and dark-theme contrast.
- Verification evidence: Focused checks passed. Real local browser rectangle/ellipse scenes survived board switches and route return; contrast correction retained the original rectangle. See `docs/LOCAL_BROWSER_VERIFICATION.md` and `.tmp/remediation/browser/whiteboard-contrast-fixed.png`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final integrated candidate checks and exact-SHA preview remain pending. The recorded browser fault/reload probe targets notes; it is not evidence of every whiteboard offline path.
- Commit SHA: 2f4afb1; 789a9ad; 5fdf31e; aed9f0f.

### BE03 — Isolate private caches and requests by account

- Priority: **20/20**.
- Assessment finding: A cache probe reused account A private data for the next same-key request. Full login switching remains untested.
- Acceptance: Scope private query keys by account. Cancel and clear private state on auth changes. Test A sign-out followed by B sign-in.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Owner-scoped query keys, auth generations, request cancellation, private-cache retirement, authenticated subtree remounts and retired save/graph callbacks isolate sessions. Confirmed server revocation clears the UI identity while preserving owner drafts; late status responses cannot retire a newer account.
- Files changed: `src/hooks/use-auth.tsx`; `src/lib/query-keys.ts`; `src/lib/save-queue.ts`; `src/lib/session-validation.ts`; `src/components/system/authenticated-app-providers.tsx`; `src/App.tsx`; `supabase/migrations/0039_account_session_status.sql`.
- Tests added: Auth lifecycle, query-key, graph callback, protected-route, delayed account-switch and session-validation regressions; real Auth revoked-token and cross-owner API checks.
- Verification evidence: Focused and integrated tests passed. Real local A-to-B browser transitions denied A's notes/drafts/attempts to B. A revoked session redirected a subsequent private-route visit to sign-in (`.tmp/remediation/browser/revoked-session-navigation.txt`); journal preservation and late-session protection are separately tested. See `docs/LOCAL_BROWSER_VERIFICATION.md` and `scripts/database/README.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final integrated candidate checks and exact-SHA preview remain pending. Server-session validation is triggered by navigation, foreground return and denied actions; it is not continuous background polling.
- Commit SHA: f6b7ea1; 3664cbe; c67b1a6; 04ccfef.

### BE04 — Verify and enforce role and purchase protections in production

- Priority: **20/20**.
- Assessment finding: Main lacks protections present in recovery. Live grants and migration state were not verified.
- Acceptance: Learners cannot assign admin roles, forge entitlements, publish unauthorized content or access another account’s private records.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Read-only production grant/history metadata was captured. Additive local migrations separate owner-readable, service-write-only entitlements from operator roles, enforce creator ownership and restrict revoked/deleting sessions. No production policy or entitlement was changed.
- Files changed: `supabase/migrations/0026_authorization_and_creator_entitlements.sql`; `supabase/migrations/0035_account_lifecycle.sql`; `scripts/database/production-authorization-metadata-2026-09-17.json`; `scripts/database/runtime-cases.mjs`.
- Tests added: Actual anonymous, learner A/B, entitled creator, operator and service-role actions exercise role escalation, forged entitlements, owned/foreign/system content and private parent relationships.
- Verification evidence: All four final native database paths through 0041 passed actual role/concurrency checks, including quiz parents and foreign-owned cascade preservation. Native Auth/PostgREST and local learner/creator/operator browser checks passed. Read-only production metadata establishes drift, not deployed remediation.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Review the exact hosted schema/history and authorize a controlled compatible migration and hosted verification. Selective production drift makes recorded version 0018 insufficient. No production writes or release approval are implied.
- Commit SHA: 1134640; 872153b; 04ccfef; 132c142; a842c9f.

### BE05 — Reconcile duplicate migration versions and upgrade history

- Priority: **20/20**.
- Assessment finding: Two migration files share version 0016. Blind renaming could conflict with deployed history.
- Acceptance: Reconcile recorded versions. A clean install and supported upgrade both succeed without dropping existing student data.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Historical duplicate 0016 sources remain unchanged. A reviewed bundler creates one temporary migration version with source hashes, rejects unknown duplicates and supports clean, 0015, 0025 and explicitly simulated production-observed upgrade paths. Upgrade tests preserve existing student rows.
- Files changed: `scripts/database/migration-bundle.mjs`; `scripts/database/inspect-migration-history.sql`; `scripts/database/run-runtime-tests.mjs`; `scripts/reconcile-supabase-migration-history.sh`; `scripts/database/README.md`.
- Tests added: Actual clean and three upgrade-path runs test transactional migrations, meaningful existing content, retained whiteboard history and complete system/math seed payloads applied twice.
- Verification evidence: Final native PostgreSQL clean, 0015, 0025 and production-observed upgrade runs through 0041 all passed and retained fixture content. Logs and hashes are in `../bindernotes-db-runtime/final0041-evidence.json`. The production-observed case remains a sanitized simulation, not a production dump or full equivalence proof.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Exact hosted migration reconciliation, full platform execution, reviewed forward migration/backup and compatible rollback remain required. No automatic migration-history repair or production migration was performed.
- Commit SHA: 1134640; f6323bd; 537ce16; ef876f7; a842c9f.

### BE06 — Repair chemistry policy helper permissions

- Priority: **19/20**.
- Assessment finding: Chemistry policies call is_admin after authenticated execution was revoked. This is a static contract mismatch.
- Acceptance: Legitimate chemistry catalog actions succeed and forbidden learner writes fail against the final migrated database.
- Dependencies: BE05; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Chemistry catalog policies use the private authorization helper. The trusted catalog transaction now includes Chemistry; learners read the operator-owned published catalog and save their own activity/preferences without attempting privileged catalog materialization.
- Files changed: `supabase/migrations/0026_authorization_and_creator_entitlements.sql`; `scripts/database/runtime-cases.mjs`; `src/services/system-seed-service.ts`; `src/services/binder-service.ts`; `scripts/database/check-local-chemistry-catalog.mjs`.
- Tests added: Real database tests exercise learner catalog reads, operator catalog writes, denied learner/creator catalog writes, owner activity insert/upsert/read and denied cross-account retry.
- Verification evidence: Final four-path native role suites passed. A real learner JWT read all 77 published Chemistry lessons and saved/reopened its own workspace preference; the browser retained its Titration Lab preset after reload without the earlier layout error. See `artifacts/be15-browser/README.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate database checks and hosted application of the reviewed migration remain pending under BE05/BE08/BE25.
- Commit SHA: 1134640; c06d176; 5126ce1; fe0a48c; a842c9f; 9ac8349.

### BE07 — Move privileged seeding to a trusted transaction

- Priority: **18/20**.
- Assessment finding: Browser seeding writes seed_versions after earlier upserts although its final grant is SELECT-only.
- Acceptance: Run authorized server-side seeding atomically. Failure rolls back partial writes and reports an actionable error.
- Dependencies: BE05; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: A service-role-only catalog RPC performs allowlisted system/math/Chemistry writes and seed-version updates atomically. Trusted adapters replace partial browser seeding; the browser seed control and learner-side catalog materialization were removed. Previously cached missing Chemistry mirrors are rechecked.
- Files changed: `supabase/migrations/0028_transactional_catalog_seed.sql`; `src/services/system-seed-service.ts`; `src/services/math-seed-service.ts`; `src/pages/admin-studio-page.tsx`; `scripts/database/catalog-fixture.ts`.
- Tests added: Actual SQL forbidden-role, invalid-payload and rollback scenarios plus complete repository system/math catalogs seeded twice verify transactional behavior and idempotency.
- Verification evidence: All four final native database paths applied the complete repository catalog twice and verified all 77 operator-owned Chemistry lessons. Local learner API/browser checks passed after the trusted local seed correction; 27 focused seed/note/preference regressions passed. No hosted catalog seed or production content update was run.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks and release migration compatibility remain pending. Existing production content does not acquire reviewed seed corrections until a separately authorized update.
- Commit SHA: 1134640; 3fe8be4; 9c4478e; fe0a48c; a842c9f; 9ac8349.

### BE08 — Add real database authorization and migration tests

- Priority: **20/20**.
- Assessment finding: SQL string checks do not prove the final schema grants work.
- Acceptance: Run clean and upgrade migrations, then actual CRUD/function tests for anonymous, learner A/B, operator and trusted backend roles.
- Dependencies: BE04, BE05; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: A loopback-only disposable PostgreSQL runner now exercises real grants, RLS, transactions, concurrent connections and clean/upgrade migration paths. A separate real GoTrue/PostgREST stack supplies Auth/HTTP evidence. Linux CI is configured for the full Supabase stack.
- Files changed: `scripts/database/run-runtime-tests.mjs`; `scripts/database/runtime-cases.mjs`; `scripts/database/review-cases.mjs`; `scripts/database/archive-cases.mjs`; `scripts/database/account-cases.mjs`; `scripts/database/start-local-api-stack.mjs`; `scripts/ci/supabase-check.mjs`; `.github/workflows/validate.yml`.
- Tests added: Role CRUD/function tests cover content CAS, seed rollback, quotas, review history, billing leases, trash, assets, archives, session revocation and account-deletion contention; native HTTP checks use four real disposable accounts.
- Verification evidence: Final native clean and 0015/0025/production-observed upgrade paths through 0041 all passed: 22 core scenario groups plus billing/review/assets/archive/search/account suites, complete catalog twice and generated-type comparison. Real sign-in, refresh, owner readback, cross-owner denial and revocation probes passed. Sanitized hashes/logs: `../bindernotes-db-runtime/final0041-evidence.json`; limits: `scripts/database/README.md`.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: The configured Linux workflow has not been evidenced as passing. Native Windows coverage excludes real Storage HTTP, Realtime and pg_cron workers; these cannot be claimed from SQL fixtures. Final candidate and full-platform release checks remain required.
- Commit SHA: 1134640; 5126ce1; f6323bd; 537ce16; ef876f7; 04ccfef; 132c142; a842c9f.

### BE09 — Persist recoverable drafts and offline retry operations

- Priority: **18/20**.
- Assessment finding: The current SaveQueue stores retry closures in memory while some messages imply durable device storage.
- Acceptance: Offline edit, reload and recovery preserve drafts. Storage failures are reported and recovered operations are account-scoped.
- Dependencies: BE01, BE03; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Versioned owner/entity/writer journals preserve immutable pending note, reader, whiteboard and review operations across reload. Stable operation IDs recover uncertain responses without duplicate writes. Malformed records, storage failures and unidentifiable legacy data are not presented as successful cloud saves.
- Files changed: `src/lib/personal-content-drafts.ts`; `src/lib/whiteboards/whiteboard-drafts.ts`; `src/lib/revisioned-save.ts`; `src/hooks/use-learner-note-editor.ts`; `src/services/canonical-review-service.ts`.
- Tests added: Reload/retry, duplicate-tab writer isolation, unavailable storage, malformed journal, lost acknowledgement and account-retirement regressions.
- Verification evidence: Real local fault-proxy HTTP 503 preserved a note draft through reload, hid it from B, then saved/reloaded it after reconnect. See `docs/LOCAL_BROWSER_VERIFICATION.md` and `.tmp/remediation/browser/reconnected-draft-saved-reload.txt`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks remain pending. The controlled HTTP-failure browser probe is not a browser-wide offline simulation or evidence for all journal types; pending work remains device-local until acknowledged.
- Commit SHA: a3b2828; 2f4afb1; 4d133ba; 0f04181; aed9f0f.

### BE10 — Detect concurrent edits across tabs and devices

- Priority: **18/20**.
- Assessment finding: An older writer can otherwise silently overwrite newer work.
- Acceptance: Use server revision checks. Two devices editing one note get an explicit conflict with keep/copy options.
- Dependencies: BE01; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Server compare-and-swap revisions and immutable operation receipts reject stale writes. Shared controllers preserve the local draft and expose explicit copy or account-version recovery. Review and creator writes also guard stale state.
- Files changed: `supabase/migrations/0027_revisioned_content_and_atomic_whiteboards.sql`; `supabase/migrations/0030_canonical_review.sql`; `src/lib/revisioned-save.ts`; `src/services/personal-content-repository.ts`; `src/services/creator-workspace-service.ts`.
- Tests added: Separate-connection SQL contention, stale revision, payload-mismatched retry, lost-acknowledgement and controller conflict/newer-edit tests.
- Verification evidence: Real local two-origin editing produced a visible conflict; recovery copied the older draft while preserving the newer cloud winner, and both survived reload. See `docs/LOCAL_BROWSER_VERIFICATION.md` and `.tmp/remediation/browser/two-session-conflict-copy-reload.txt`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks and exact-SHA preview remain pending. This is explicit conflict detection/recovery, not live collaborative merging.
- Commit SHA: 1134640; a3b2828; 2f4afb1; 0f04181; 5d44ac8; aed9f0f.

### BE11 — Correct chemistry calculation domains and validation

- Priority: **19/20**.
- Assessment finding: The actual acid helper labels a 1e-8 M strong acid as basic. Zero/negative inputs are also mishandled.
- Acceptance: Include water where appropriate or restrict the approximation. Validate finite inputs and independently test scientific edge cases.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Chemistry calculators reject blank, non-finite and invalid-domain input rather than substituting zero. Dilute strong-acid/base calculations include water equilibrium. Stoichiometry validation occurs before persistence; supported calculator UI surfaces actionable input errors.
- Files changed: `src/lib/chemistry/calculation-validation.ts`; `src/lib/chemistry/acid-base.ts`; `src/lib/chemistry/stoichiometry.ts`; `src/lib/chemistry/dilution.ts`; `src/lib/chemistry/titration-lab.ts`; `src/components/chemistry/chemistry-workspace-modules.tsx`.
- Tests added: `src/lib/chemistry/calculation-validation.test.ts`; `src/components/chemistry/chemistry-calculator-validation.test.tsx`; formula/balancer and calculator tests use independent expected values, dilute-water limits and finite/domain boundaries.
- Verification evidence: Independent scientific and rendered calculator regressions passed, including the dilute-acid counterexample. The authenticated local Titration Lab saved/reopened a 5.00 mL checkpoint, pH 1.18 and its measurement/notebook text; see `artifacts/be15-browser/README.md`. This does not certify every chemistry panel or laboratory model.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final built-candidate and exact-SHA preview checks remain pending; scientific model assumptions and supported activities must remain visible.
- Commit SHA: 78e0806; d7efd8c; c06d176; 9ac8349.

### BE12 — Fix numeric scoring and audit answer normalization

- Priority: **19/20**.
- Assessment finding: A blank numeric answer gets credit when the expected answer is zero. Duplicate selections are another helper-level concern.
- Acceptance: Reject blank/non-finite numeric answers. Normalize selection sets and test scoring boundaries against independent expected results.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Numeric parsing rejects blank/whitespace, NaN, Infinity and malformed values before scoring. Selection answers normalize duplicate entries as sets; tolerance boundaries use finite validated inputs. Text and free-response feedback disclose exact-string/self-review limitations.
- Files changed: `src/lib/finite-number.ts`; `src/lib/question-scoring.ts`; `src/pages/math-learning-page.tsx`; `src/lib/math-learning-seeds.ts`.
- Tests added: `src/lib/question-scoring.test.ts` and question UI/authoring regressions cover independent zero-answer, non-finite, tolerance-boundary, duplicate-selection and exact-text cases.
- Verification evidence: Focused scoring tests passed. A real local three-question quiz produced the expected 2/3 saved result and honest written-answer Review feedback; see `docs/LOCAL_BROWSER_VERIFICATION.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks remain pending. String matching is not symbolic equivalence or evaluation of arbitrary written reasoning.
- Commit SHA: 137e0fe; 10aab02; 3bff489.

### BE13 — Load saved quiz attempts and their actual results

- Priority: **18/20**.
- Assessment finding: The historical results route ignores its attempt ID and presents an empty state.
- Acceptance: Fetch the authorized attempt and answers by ID. Reopened results match saved work and inaccessible attempts are rejected.
- Dependencies: BE03, BE12; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: The result route loads the exact owner-authorized attempt ID and stored answers/snapshots, never a replacement attempt. Stable submission IDs support safe retry. Numeric/written inputs and question selection are named accessibly; invalid paragraph nesting in prompts was corrected.
- Files changed: `src/services/math-learning-service.ts`; `src/services/quiz-attempt-results-service.ts`; `src/hooks/use-quiz-attempt-results.ts`; `src/components/math/saved-quiz-results.tsx`; `src/pages/math-learning-page.tsx`.
- Tests added: Saved-attempt service/hook/page tests cover exact IDs, saved context, paging, stable retry, absent/foreign attempts and errors; rendered question checks assert named inputs and valid markup. Migration 0040 and real SQL races enforce owned quiz parents and preserve legacy shared attempt descendants.
- Verification evidence: Real local quiz submission, saved 2/3 result and reload passed; B was denied A's attempt. Fresh browser quiz checks showed correctly named inputs and no console warnings/errors. See `docs/LOCAL_BROWSER_VERIFICATION.md` and `.tmp/remediation/browser/quiz-accessibility-fixed.txt`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final integrated candidate and exact-SHA preview checks remain pending. Added Linux browser journey is configured but not claimed as executed.
- Commit SHA: 51064c5; f4c5515; 3bff489; cc01e86; aed9f0f; 132c142.

### BE14 — Unify and cloud-save the primary review model

- Priority: **18/20**.
- Assessment finding: Recall Lab, Review Queue and Math Study Loop keep separate browser-local records.
- Acceptance: Migrate local records safely. Shared ownership, source references and review history survive reload and a second device.
- Dependencies: BE03, BE09; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Recall Lab, Review Queue and Math/source actions now share owner-scoped cloud items, immutable events and sessions. Ratings update scheduling/history atomically with CAS and durable retries. Explicit validated legacy import preserves sources, dates/history and all original browser keys; invalid/conflicting/orphan records remain recoverable.
- Files changed: `supabase/migrations/0030_canonical_review.sql`; `src/lib/canonical-review.ts`; `src/services/canonical-review-service.ts`; `src/services/review-migration-service.ts`; `src/hooks/use-cloud-recall.ts`; `src/pages/review-page.tsx`; `docs/canonical-review-contract.md`.
- Tests added: Service/UI/migration tests cover fresh-device reads, source/history preservation, final-card completion, conflicts and offline retry. Real SQL tests prove direct-write/foreign-owner denial, strict payloads, immutable history, rollback and one winner among six same-revision writers.
- Verification evidence: Focused/integrated checks and final real PostgreSQL review scenarios passed. Local browser rating/reload retained the due date; a separate browser origin retrieved the source-linked record and schedule. Archive comparison preserved schedules/history. See `docs/LOCAL_BROWSER_VERIFICATION.md`, `.tmp/remediation/browser/review-second-origin-source.txt`, `review-second-origin-schedule.txt` and `archive-roundtrip-comparison.json`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks and hosted preview remain pending. Refresh retrieves other-device changes; nonreview Math logs/formulas/graph links remain device-local with portable backup. Oversized legacy histories are preserved rather than silently imported.
- Commit SHA: 0f04181; 3902c50; 537ce16; ccbe8b6; 2bf418f; cc01e86.

### BE15 — Connect chemistry work to account-owned persistence

- Priority: **14/20**.
- Assessment finding: Save adapters exist but production chemistry notes and experiments use component state.
- Acceptance: A supported chemistry activity saves, reopens and syncs with ownership checks. Keep it hidden until this works.
- Dependencies: BE06, BE11; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Supported stoichiometry, titration and chemistry notebook activities save versioned full snapshots to account-owned rows and reopen them. Stable IDs, explicit errors and owner retirement protect retries/account changes. Chemistry's missing catalog mirror was added to the trusted seed; learner catalog materialization was removed so owned layout preferences can persist.
- Files changed: `src/services/chemistry-activity-service.ts`; `src/components/chemistry/chemistry-activity-storage.tsx`; `src/components/chemistry/chemistry-workspace-modules.tsx`; `src/lib/chemistry/chemistry-types.ts`; `src/lib/chemistry/titration-lab.ts`; `src/services/system-seed-service.ts`; `src/services/binder-service.ts`; `scripts/database/check-local-chemistry-catalog.mjs`; `artifacts/be15-browser/README.md`.
- Tests added: Activity service/rendered storage tests cover full snapshots, create/reopen, invalid input, failure, stable retry and account retirement. Real SQL proves owner insert/upsert/read and cross-owner denial; 27 focused seed/note/preference regressions protect the browser-discovered catalog/layout correction.
- Verification evidence: Real local learner-B browser saved a 5.00 mL titration checkpoint, pH 1.18, measurement row, hypothesis and observation; hard reload plus explicit Reopen snapshot restored them. After the trusted catalog fix, the Titration Lab preset also survived reload with Ready status and no layout error; the original checkpoint reopened again. See `artifacts/be15-browser/README.md` and final screenshots.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final built-candidate and exact-SHA hosted preview checks remain pending. The observed layout failure is corrected and locally rechecked; coverage is limited to the named supported activities, not every chemistry tool.
- Commit SHA: c06d176; d7efd8c; ef876f7; fe0a48c; a842c9f; 9ac8349.

### BE16 — Make whiteboard quotas and version creation atomic

- Priority: **17/20**.
- Assessment finding: Count-then-write quotas and version numbering can race. Scene and version writes are separate.
- Acceptance: Concurrent requests cannot exceed the plan allowance or collide on versions. Scene/version creation succeeds or fails together.
- Dependencies: BE05; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Owner-serialized whiteboard RPCs enforce quota and create current scene plus optional version atomically. The server determines version numbers and payload size; operation receipts protect retries. Downgrades preserve existing boards while denying allocations above the applicable limit.
- Files changed: `supabase/migrations/0027_revisioned_content_and_atomic_whiteboards.sql`; `supabase/migrations/0032_whiteboard_canonical_storage_and_retention.sql`; `src/lib/whiteboards/whiteboard-storage.ts`; `scripts/database/runtime-cases.mjs`.
- Tests added: Real concurrent quota/version tests, stale revision, cross-owner and idempotent retry probes, and injected transaction failure verify no partial current/version commit.
- Verification evidence: Actual disposable PostgreSQL concurrency/rollback checks passed. Real local browser board persistence is documented in `docs/LOCAL_BROWSER_VERIFICATION.md`; it does not substitute for provider billing verification.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate database checks and compatible hosted migration remain pending. Billing-derived live entitlement correctness remains blocked under BE17.
- Commit SHA: 1134640; 3fe8be4; 537ce16.

### BE17 — Implement trusted checkout, webhooks and entitlements

- Priority: **18/20**.
- Assessment finding: Every paid checkout path currently returns a stub.
- Acceptance: Verify webhook signatures, deduplicate events and handle reversed order, cancellations and failed renewals. Match enforced limits to the plan.
- Dependencies: BE04, BE16, BE18; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Trusted Checkout/Portal/webhook endpoints validate Auth, choose configured prices server-side, verify signatures and mode, serialize per customer, deduplicate events and reconcile current subscription/invoice/refund/dispute state. Stale-price or duplicate open sessions expire before reuse; billing is disabled by default and never grants operator roles.
- Files changed: `server/billing/handlers.ts`; `server/billing/stripe-provider.ts`; `server/billing/supabase-store.ts`; `api/billing/checkout.ts`; `api/billing/portal.ts`; `api/billing/webhook.ts`; `supabase/migrations/0029_trusted_billing.sql`; `docs/BILLING.md`.
- Tests added: Handler/client/UI tests plus actual SDK signature/HTTP-response fixtures cover tamper/expiry, owner/mode/price checks, reordered/duplicate delivery, cancellation/renewal/refund/dispute outcomes and uncertain failures. Real SQL proves lease fencing, forbidden roles and atomic entitlement/receipt writes.
- Verification evidence: Focused tests passed; the reviewed provider/handler pair passed 34 tests after stale-price and dispute corrections. Real SQL lease/concurrency tests passed. These are local fixtures, not real Stripe test-mode purchases or webhook deliveries.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Owner must provide/configure Stripe test products, secrets, webhook and portal, then exercise checkout, renewal, refund, failed payment, cancellation and account-deletion interaction. Live activation, legal/tax setup and exact displayed-price configuration remain unverified; no purchase or provider account change was made.
- Commit SHA: 9bacba0; 933e348; 937d232; 872153b.

### BE18 — Separate paid creator access from global administration

- Priority: **20/20**.
- Assessment finding: Operator admin powers include broad access. Selling Studio must not grant those powers.
- Acceptance: Introduce feature entitlements and creator ownership separately. Paid users cannot acquire operator permissions.
- Dependencies: BE04; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: An authenticated creator workspace exposes owned eligible binder/lesson create, edit, reorder, publish and archive actions separately from operator Admin Studio. Entitlement and ownership are rechecked server-side; stale writes and uncertain acknowledgements preserve recoverable drafts. Paid access never changes profiles.role.
- Files changed: `src/pages/creator-workspace-page.tsx`; `src/services/creator-workspace-service.ts`; `src/hooks/use-creator-access.ts`; `src/lib/creator-drafts.ts`; `src/App.tsx`; `src/components/layout/app-shell.tsx`; `docs/creator-workspace.md`.
- Tests added: Creator service/page/navigation tests cover free/expired/active/operator access, system/foreign ownership, stale writes, lost acknowledgements, draft recovery and denied administration; real SQL independently tests publish/archive and conditional edit ownership.
- Verification evidence: Focused checks passed. Real local entitled-learner browser created/published/reloaded owned content but could not open Admin Studio; operator access passed. See `docs/LOCAL_BROWSER_VERIFICATION.md`. Entitlement fixture use is not a Stripe purchase.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate and exact-SHA preview checks remain pending. Initial creator tools exclude price editing and permanent deletion; commercial entitlement activation remains blocked by BE17/BE35.
- Commit SHA: 1134640; 5d44ac8; 9bacba0; cc01e86; aed9f0f.

### BE19 — Build portable export and validated reimport

- Priority: **17/20**.
- Assessment finding: No complete production note/binder export was found. Students cannot easily trust moving important work in.
- Acceptance: Export versioned JSON and readable text/HTML with equations, sources, tags, review records and assets. Reimport to a fresh account.
- Dependencies: BE14; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Account export produces a strict versioned archive and readable content. Transactional import validates ownership/hierarchy, remaps internal identities/references and retains local Math recovery data. External provenance URLs and opaque Desmos/whiteboard state remain verbatim. Invalid archives show safe actionable errors; binary assets use the staged private-file contract.
- Files changed: `src/lib/portable-archive.ts`; `src/services/portable-archive-service.ts`; `src/services/math-local-portability.ts`; `src/pages/account-data-page.tsx`; `src/lib/archive-errors.ts`; `supabase/migrations/0034_portable_workspace_archive.sql`; `scripts/database/archive-cases.mjs`.
- Tests added: Contract/service/page and real SQL tests cover malformed versions, unsafe attributes, foreign owners/parents, atomic rollback, receipt retry, ID collisions, external URL preservation and opaque graph/scene JSON. Local Math backup tests verify validation, conflicts and rollback journals.
- Verification evidence: Real local UI export to an empty recipient and re-export comparison preserved three note/document bodies, a notebook, two review cards, one event, relationships and schedules after intentional owner/ID remap. Version 999 was rejected. See `docs/LOCAL_BROWSER_VERIFICATION.md` and `.tmp/remediation/browser/archive-roundtrip-comparison.json`.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Binary assets were absent from the browser roundtrip fixture; real Storage upload/download/import/delete must pass before the full archive acceptance can close. Final candidate/exact-SHA preview checks and actionable-error browser recheck remain pending. No destructive replacement of existing account data is offered.
- Commit SHA: 2bf418f; 091cbf4; 36ca095; 9ffdc97; 30778a9; aed9f0f.

### BE20 — Implement consistent trash and restore behavior

- Priority: **17/20**.
- Assessment finding: Binder deletion hard-cascades documents while other entities soft-archive.
- Acceptance: Use a coherent retention model and restore a deleted course without losing relationships. Permanent deletion requires explicit intent.
- Dependencies: BE05; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Personal folders/courses/documents/notes share owner-scoped trash, restore and explicitly confirmed permanent deletion. Parent trash hides the tree without rewriting child archive flags or relationships; independently trashed children remain trashed on parent restore. Direct browser DELETE is revoked and unsaved work blocks destructive UI actions.
- Files changed: `supabase/migrations/0031_personal_workspace_trash.sql`; `src/lib/personal-trash.ts`; `src/services/personal-trash-service.ts`; `src/components/personal-notes-trash.tsx`; `src/pages/personal-notes-page.tsx`.
- Tests added: Tree/UI tests and actual SQL actions cover restore order, retained relationships/content, independent child trash, cross-owner/direct-delete denial and required literal DELETE confirmation.
- Verification evidence: Focused and real database tests passed. Real local browser course trash/restore/reload preserved its document and attached note, and the permanent-delete confirmation was shown disabled before explicit intent. The browser did not execute permanent deletion; see `docs/LOCAL_BROWSER_VERIFICATION.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate and exact-SHA preview checks remain pending. Trash is retained indefinitely until explicit owner deletion; account disposal is a separate trusted operation.
- Commit SHA: c6ea524; 3902c50; cc01e86; aed9f0f.

### BE21 — Complete account recovery, export and deletion services

- Priority: **16/20**.
- Assessment finding: No complete password-reset or account-deletion flow was found in reviewed source.
- Acceptance: Test reset tokens, session handling, account-owned exports and authenticated deletion across database and storage.
- Dependencies: BE03, BE19; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Password recovery, immediate server-session revocation, export access and trusted retryable deletion are implemented. Fresh Auth, same origin, explicit intent, operation IDs, billing/storage fences and owned cascade guards prevent false completion or loss of another user's descendants. Isolated password confirmation cannot replace a newer account session; pending deletion remains reachable without a profile.
- Files changed: `src/services/account-service.ts`; `src/services/account-reauthentication.ts`; `src/pages/account-page.tsx`; `src/pages/password-recovery-page.tsx`; `server/account/handlers.ts`; `server/account/runtime.ts`; `api/account/delete.ts`; `supabase/migrations/0035_account_lifecycle.sql`; `supabase/migrations/0038_preserve_shared_content_on_account_deletion.sql`; `supabase/migrations/0039_account_session_status.sql`; `supabase/migrations/0040_quiz_parent_ownership.sql`; `supabase/migrations/0041_preserve_foreign_owned_cascade_children.sql`.
- Tests added: Rendered no-profile/account-switch races, isolated SDK reauthentication, real GoTrue recovery/revocation/deletion and concurrent FK-attachment/deletion tests. Final 0041 scenarios verify all discovered owner-bearing cascade edges, foreign comment replies and legacy History/whiteboard/chemistry descendants remain protected.
- Verification evidence: Final four native database paths and real lifecycle HTTP probes passed, including revoked-token deletion receiving 401 while the account remained; fresh recovery/auth deletion passed. A local browser private-route visit after revocation reached sign-in. Local export passed. See `scripts/database/README.md` and `docs/LOCAL_BROWSER_VERIFICATION.md`.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Delivered recovery email, hosted redirect allowlists, OAuth reauthentication, physical Storage deletion and Stripe test-mode deletion preflight remain unverified. Deletion stays off by default until these gates and final candidate checks pass. Generated local recovery tokens do not prove email delivery.
- Commit SHA: 872153b; 3664cbe; c67b1a6; ef876f7; 04ccfef; 132c142; a842c9f.

### BE22 — Add reliable private file import and upload cleanup

- Priority: **16/20**.
- Assessment finding: General PDF import is missing. Tutorial upload can leave assets behind if metadata creation fails.
- Acceptance: Validate file size/type, use private asset ownership, resume large interrupted uploads and clean orphaned assets.
- Dependencies: BE04; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Private owner-reserved PDF/PNG/JPEG/WebP assets enforce 50 MiB/file and 500 MiB/account reservation limits. TUS uploads resume through validated owner journals; trusted completion verifies streamed size, magic bytes and SHA-256 before readiness. Staged imports, retryable deletion and cleanup fences prevent false success. Tutorial compensation checks exact saved references before removing new paths.
- Files changed: `supabase/migrations/0033_private_user_assets.sql`; `src/lib/resumable-upload.ts`; `src/services/private-assets-service.ts`; `src/components/personal-files.tsx`; `server/assets/handlers.ts`; `server/assets/runtime.ts`; `api/assets/complete.ts`; `api/assets/cleanup.ts`; `src/services/tutorial-service.ts`.
- Tests added: TUS protocol and streaming-handler fixtures cover interrupted/resumed offsets, malformed files, failures and cleanup races. Real SQL tests cover private paths, staged visibility, owner isolation, completion privilege and 12 concurrent quota reservations; tutorial tests cover lost acknowledgements/reference checks.
- Verification evidence: Local protocol/handler and real Storage-table RLS tests passed. Native Storage HTTP intentionally returns 501; no physical upload/download/delete success is claimed. See `scripts/database/README.md`.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Real nonproduction Storage HTTP/TUS, signed URL expiry, timeout/retry and byte deletion require a full platform. Configure and verify the actual cleanup scheduler before activation. Uploads remain off by default; PDF text extraction and malware scanning are not implemented by this file-storage feature.
- Commit SHA: b59ea2c; 8c215ed; ef876f7.

### BE23 — Repair missing test assets and add journey regressions

- Priority: **19/20**.
- Assessment finding: Recovery has two missing SQL test inputs and one newline-sensitive failure. Existing tests miss important state transitions.
- Acceptance: Restore required SQL artifacts, normalize newline assertions and pass save, account-switch, results and review completion regressions.
- Dependencies: BE01, BE02, BE03, BE12, BE13; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Missing SQL inputs and newline-sensitive assertions were repaired; lifecycle, account-switch, scoring/results, final-card, recovery and actual canvas-instance regressions now exercise the failing transitions. Disposable Linux authenticated browser suites were expanded without manufacturing API success.
- Files changed: `src/lib/supabase-data-api-grants.test.ts`; `src/lib/revisioned-save.test.ts`; `src/components/whiteboard/whiteboard-canvas.test.tsx`; `src/components/study/review-session.test.tsx`; `e2e/notes-auth.spec.ts`; `e2e/authenticated-journeys.spec.ts`; `e2e/fixtures.ts`; `e2e/README.md`.
- Tests added: Automated unit/integration regressions plus nine discovered browser tests across the two E2E specs cover notes/accounts, saved quiz results, cloud review, trash, creator/operator separation, mobile navigation and empty course feedback.
- Verification evidence: Latest broad Vitest run passed 1,537/1,537 with zero failed/pending tests (`.tmp/remediation/final-tests-02.json`). All three TypeScript projects, ESLint and format-check-03 passed. Local interactive browser evidence is recorded separately; expanded Linux Playwright tests were discovered/type/lint checked but not browser-executed locally.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: The 1,537-test full run preceded the final lazy-telemetry loading correction; its 13 focused tests, guarded rebuild and unchanged asset-budget scan passed. Final exact-SHA hosted journeys and Linux full-stack/E2E execution remain unverified.
- Commit SHA: 1134640; 789a9ad; 0f04181; 3bff489; cc01e86; aed9f0f; a842c9f; 7c823e1; a17f3c5.

### BE24 — Add PR checks and protect the release branch

- Priority: **19/20**.
- Assessment finding: Existing workflows are manual operational jobs. Reviewed branches are unprotected.
- Acceptance: Require typecheck, tests, build and disposable-database checks before merge. Keep production migrations separate.
- Dependencies: BE08, BE23; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: A PR validation workflow now runs formatting, ESLint, all TypeScript projects, unit/integration tests, build, dependency review and a disposable Linux Supabase clean/upgrade matrix. The clean matrix adds authenticated browser tests. Legacy manual seed/repair/deploy workflows stop explicitly; normal CI has no production backend secrets or migration/deployment path.
- Files changed: `.github/workflows/validate.yml`; `.github/workflows/fix-repair-seed-and-deploy.yml`; `.github/workflows/fix-supabase-backend-seed.yml`; `scripts/ci/supabase-check.mjs`; `scripts/ci/quality-files.mjs`; `playwright.config.ts`; `eslint.config.mjs`; `tsconfig.server.json`; `docs/RELEASE_PROCESS.md`.
- Tests added: Local workflow command, type/lint/build/test and browser-discovery checks; disposable migration/runtime scripts validate real role/concurrency behavior. Required GitHub checks are documented, not represented as configured.
- Verification evidence: Local validation passed 1,537 tests, all three TypeScript projects, ESLint and format-check-03; all four native database paths passed. The GitHub remediation branch was pushed through 014b3bf. No successful inspected GitHub workflow or enforced branch protection is claimed; adding/pushing workflow definitions is not merge-policy enforcement.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: An authorized repository owner must run and inspect the workflow and configure required quality/all database matrix checks, current review and force-push/deletion protection on the intended branch. A workflow file alone cannot enforce merge policy.
- Commit SHA: f6323bd; cc01e86; aed9f0f.

### BE25 — Verify the intended release and deployment path

- Priority: **19/20**.
- Assessment finding: Newest recovery commits have failed deployment statuses. This does not prove the current site is down.
- Acceptance: Choose the release branch, identify deployed SHA/schema, deploy successfully and exercise authenticated saves plus rollback recovery.
- Dependencies: BE24; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: The intended project, release branch and production deployment metadata are recorded. Release instructions require a clean exact-SHA candidate, isolated preview backend, artifact/env checks, all authenticated journeys, compatible forward migration and rollback. Automatic Vercel Git deployment is disabled in this branch to prevent unverified production-backend testing.
- Files changed: `docs/RELEASE_PROCESS.md`; `docs/LOCAL_BROWSER_VERIFICATION.md`; `vercel.json`; `.github/workflows/validate.yml`; `scripts/scan-build-assets.mjs`.
- Tests added: Local build/type/runtime/browser checks support candidate preparation; no hosted preview deploy, promotion, production migration or rollback exercise was executed.
- Verification evidence: Read-only production metadata identifies READY deployment dpl_65aNJ5kVKSKhSJVF7zmpdoVR4mTo with SHA 94525210 and gitDirty=1. The remediation branch push reached 014b3bf. After a17f3c5, the guarded build and unchanged asset scan passed: entry 61.94 kB (budget 120), initial JS/CSS 267.24 kB gzip (budget 300), no Supabase preload. No hosted runtime verification or production promotion is claimed here; the release owner records final URLs separately.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Verify the final exact-SHA preview against an approved reachable isolated backend, migrations, compatible fallback, runtime logs and rollback. The paid branch was declined. A preview with an unavailable backend proves only building, not authenticated functionality.
- Commit SHA: f6323bd; aed9f0f; 937d232; a17f3c5.

### BE26 — Triage advisories and update dependencies deliberately

- Priority: **18/20**.
- Assessment finding: Audit flags 44 package entries, including 11 high. Application exploitability was not established.
- Acceptance: Review reachable advisory conditions, update compatible packages/overrides, rerun audit and smoke-test editing, whiteboards and routing.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Compatible updates retain existing framework majors and scoped overrides; all directly used TipTap core/PM/extensions align at 3.31.3. Router, Vite, DOMPurify, Mermaid and transitive advisories were reviewed against actual usage; server-only Stripe SDK was added for billing.
- Files changed: `package.json`; `package-lock.json`; `docs/DEPENDENCY_REVIEW.md`.
- Tests added: Clean lockfile installation, npm audit, TypeScript/build, focused editor/canvas/auth tests and local interactive editor/whiteboard/routing checks.
- Verification evidence: Clean npm ci passed. Latest recorded audit has one low and zero moderate/high/critical entries. The broad 1,537-test run and all three TypeScript projects passed. After the final lazy-telemetry correction, 13 focused tests, guarded rebuild and unchanged asset-budget scan passed. Interactive editor/board checks are in `docs/LOCAL_BROWSER_VERIFICATION.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Residual low esbuild Windows serve advisory is documented; repository paths use transform/build rather than esbuild serve. Exact-SHA hosted browser checks remain open. Older Radix React 18 peer declarations do not establish React 19 compatibility from install alone.
- Commit SHA: 9bacba0; 2e59183; 5fdf31e; aed9f0f; a17f3c5.

### BE27 — Extract saving, navigation and domain responsibilities

- Priority: **14/20**.
- Assessment finding: Personal Notes, reader, binder service and global CSS are unusually large and mix concerns.
- Acceptance: Use thin routes, typed repositories, shared query keys and domain modules. New editors reuse the proven save contract.
- Dependencies: BE01, BE03; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Shared revisioned controllers/repositories own note, reader, board and review saving. A typed Personal Notes navigation hook now owns owner-scoped selection, filters, sidebar transitions and URL interpretation; a pure notebook domain module owns grouping. The route consumes these boundaries. Prior-note URL/binder mismatches, filtered browser Back destinations and retired-account callbacks are corrected.
- Files changed: `src/lib/revisioned-save.ts`; `src/services/personal-content-repository.ts`; `src/hooks/use-personal-content-editor.ts`; `src/hooks/use-learner-note-editor.ts`; `src/lib/query-keys.ts`; `src/lib/whiteboards/whiteboard-drafts.ts`; `src/services/canonical-review-service.ts`; `src/hooks/use-personal-entry-content.ts`; `src/hooks/use-personal-notes-navigation.ts`; `src/lib/personal-notes-navigation.ts`; `src/pages/personal-notes-page.tsx`.
- Tests added: Shared save/repository/hydration regressions plus eight MemoryRouter navigation tests exercise deep links, unavailable routes, binder selection, browser Back, filters, account changes, stale callbacks and document/note identity distinctions.
- Verification evidence: The bounded navigation extraction passed 67 focused tests including rendered Personal Notes save races, application TypeScript, ESLint and Prettier. The later full run passed 1,537 tests. It removed 385 net lines of coordination/model code from the page while retaining the shared revisioned save controller.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final built-candidate and exact-SHA browser repetition remain pending. Persistence and navigation coordination are extracted; large presentational components, remaining service boundaries and global CSS still warrant bounded maintenance, not a claim of a complete architecture rewrite.
- Commit SHA: a3b2828; 2f4afb1; 4d133ba; 0f04181; 3902c50; 5d44ac8; 7c823e1.

### BE28 — Load metadata first and paginate large collections

- Priority: **15/20**.
- Assessment finding: Note lists load full bodies. Whiteboard lists include large scene payloads.
- Acceptance: List views fetch bounded metadata and selected items load content on demand. Verify realistic large-course navigation.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Personal Notes, lessons and whiteboards load paged metadata and fetch only selected body/scene content. Account/generation guards protect delayed hydration and pending edits. Private note body search uses owner-scoped paged server search so metadata-only loading does not silently remove search coverage; mobile tools remain reachable.
- Files changed: `src/lib/metadata-pages.ts`; `src/hooks/use-personal-entry-content.ts`; `src/services/personal-notes-service.ts`; `src/services/binder-service.ts`; `src/lib/whiteboards/whiteboard-storage.ts`; `src/hooks/use-personal-note-search.ts`; `src/services/personal-note-search-service.ts`; `supabase/migrations/0037_personal_note_body_search.sql`; `docs/LOCAL_PERFORMANCE_VERIFICATION.md`.
- Tests added: Metadata paging, selected hydration, navigation/account race and backend query-shape tests; private body-search tests cover bounded results, cancellation, authorization and archived-tree visibility. Real SQL search cases verify the RPC.
- Verification evidence: A fresh real local Auth learner owned 1,500 synthetic notes across 12 notebooks, four folders and 24 documents. Exact metadata queries returned all IDs across eight pages: 639,527 raw bytes versus 11,642,038 full-row control (94.51% less), median 116.53 ms over three runs. Selected body median was 9.52 ms; actual body search returned all 300/1,500 expected identities in two/eight pages. See `docs/LOCAL_PERFORMANCE_VERIFICATION.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Actual large-collection API payload/timing/pagination is measured locally. Browser rendering/hydration, full workspace orchestration, WAN latency, cold starts, concurrent students and billed cost remain unmeasured; exact-SHA hosted preview remains open.
- Commit SHA: 3902c50; cb5c6ef; aed9f0f; 014b3bf.

### BE29 — Define version retention and remove duplicate scene storage

- Priority: **14/20**.
- Assessment finding: Unbounded snapshots and compatibility copies can increase storage and transfer costs.
- Acceptance: Choose retention, test pruning/recovery and migrate duplicate representations without losing current or retained versions.
- Dependencies: BE16; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Migration 0032 verifies equality before removing duplicate scene/module representations, failing transactionally on mismatch. Automatic/draft history retains the newest 50 versions plus all manual/checkpoint/snapshot versions; current state is never pruned. CAS restore writes a new snapshot and protects its recovery source.
- Files changed: `supabase/migrations/0032_whiteboard_canonical_storage_and_retention.sql`; `src/lib/whiteboards/whiteboard-storage.ts`; `src/lib/whiteboards/whiteboard-types.ts`; `src/components/whiteboard/whiteboard-version-history.tsx`; `scripts/database/runtime-cases.mjs`.
- Tests added: Real database tests generate 56 snapshots, check automatic pruning and manual/current preservation, restore/retry/conflict/foreign-owner denial, and verify duplicate-payload mismatch aborts without data loss.
- Verification evidence: Retention, equality-failure and recovery cases passed against real disposable PostgreSQL and supported upgrade fixtures; see `scripts/database/README.md`. No production history was pruned.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate database checks and coordinated hosted migration remain pending. Old clients requesting removed aliases need an RPC/canonical-scene-compatible fallback; version UI lists the latest 100 retained entries.
- Commit SHA: 537ce16; 2f4afb1.

### BE30 — Detect incomplete or stale dashboard summaries

- Priority: **14/20**.
- Assessment finding: Current fallback handles errors or empty summaries, not necessarily partially missing records.
- Acceptance: Identify partial coverage and stale refreshes. Repair or fall back without silently omitting student content.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Dashboard summary coverage is checked against authoritative lesson IDs and updated timestamps fetched without bodies. Missing, partial or stale summaries fall back to complete metadata rather than silently omitting content.
- Files changed: `src/lib/dashboard-summary-coverage.ts`; `src/services/binder-service.ts`; `src/lib/metadata-pages.ts`.
- Tests added: `src/lib/dashboard-summary-coverage.test.ts` and binder-service backend/performance tests cover partial IDs, stale timestamps, empty/error summaries, complete coverage and bounded metadata fallback.
- Verification evidence: Focused coverage and metadata suites passed. The fallback is implemented and tested; no production materialized-view repair or scheduler success is inferred.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks remain pending. Large-course timing and hosted refresh behavior still need measurement; source metadata remains authoritative when summary coverage is uncertain.
- Commit SHA: 3902c50.

### BE31 — Add privacy-conscious save, error and cost telemetry

- Priority: **17/20**.
- Assessment finding: Console logs and development-only marks do not explain production failures or costs.
- Acceptance: Record release, operation, duration, retries and failure type without note content. Measure storage/transfer per active student.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: The shared save controller records strictly bounded content-free operation metrics: release, operation, duration, retries, payload bytes and failure class. Account transitions clear buffers and invalidate late measurements. The authenticated bounded telemetry endpoint is off by default; metrics failures cannot interrupt saving.
- Files changed: `src/lib/operation-metrics.ts`; `src/lib/telemetry-contract.ts`; `src/lib/telemetry-runtime.ts`; `src/lib/revisioned-save.ts`; `server/telemetry.ts`; `api/telemetry.ts`; `docs/OBSERVABILITY.md`.
- Tests added: Client/server schema, buffer-limit, account-switch, late-response, Auth, payload-size and sensitive-field rejection tests; review saves use the explicit review_save operation.
- Verification evidence: Focused telemetry tests passed. Local diagnostic measurements and server logging code exist; no production collection, active-student denominator, invoice correlation or measured per-student cost is claimed.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Configure a verified release SHA, restricted sink/access/retention and infrastructure rate controls before enabling collection. Actual storage/transfer per active student requires usage and provider billing data that do not exist yet; payload-byte metrics alone do not satisfy that acceptance. Final candidate checks remain pending.
- Commit SHA: 07a0652; ccbe8b6; 937d232.

### BE32 — Validate persisted and imported document data

- Priority: **17/20**.
- Assessment finding: Local JSON, rich editor attributes and uploaded content need explicit contracts.
- Acceptance: Validate versions and schemas at import/service boundaries. Reject malformed payloads safely and test untrusted editor attributes.
- Dependencies: BE19, BE22; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Strict versioned contracts now validate draft journals, chemistry snapshots, canonical review, local Math and account archives before writes/import. Editor attributes reject executable/prototype payloads. Server archive validation independently checks ownership, relationships and shape; arbitrary external URLs and opaque calculator/canvas JSON are preserved. Errors expose safe guidance rather than raw schema/server payloads.
- Files changed: `src/lib/personal-content-contract.ts`; `src/lib/canonical-review.ts`; `src/lib/portable-archive.ts`; `src/lib/archive-errors.ts`; `src/lib/database-client.ts`; `src/services/math-local-portability.ts`; `supabase/migrations/0030_canonical_review.sql`; `supabase/migrations/0034_portable_workspace_archive.sql`.
- Tests added: Malformed versions/types/non-finite values, unsafe attributes/prototype keys, invalid owner/reference graphs, strict server rollback, opaque JSON collisions and friendly error regression tests.
- Verification evidence: Focused schema/import/service tests and real SQL rejection/rollback tests passed. Browser version 999 archive rejection was observed, followed by an automated friendly-error correction; see `docs/LOCAL_BROWSER_VERIFICATION.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks and browser recheck of the friendly validation wording remain pending. These schemas are not arbitrary file malware scanning; real Storage completion still requires BE22's platform gate.
- Commit SHA: a3b2828; 0f04181; 2bf418f; f4c5515; 091cbf4; 36ca095; 9ffdc97; 30778a9.

### BE33 — Review curriculum and answer correctness for supported courses

- Priority: **17/20**.
- Assessment finding: A broad catalog with 27 math modules and 54 questions does not establish full curriculum coverage.
- Acceptance: Review supported lessons and answers, record provenance and limits, and remove unreviewed claims. Keep scoring positioned as self-study.
- Dependencies: BE11, BE12; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: All 54 Jacob section and 17 overview math answer keys were reviewed with independent numeric/identity checks. Misleading graph/examples and domain conditions were corrected; course/source copy now states starter coverage and unverified provenance. Empty AP course sections show an honest empty state, and text/free-response grading limits are visible.
- Files changed: `src/lib/math-learning-seeds.ts`; `src/lib/jacob-math-coverage.ts`; `src/lib/math-curriculum-audit.test.ts`; `src/pages/math-learning-page.tsx`; `docs/math-curriculum-audit.md`; `docs/chemistry-source-ledger.md`.
- Tests added: Independent expected-value and answer-ID fixtures cover all 71 reviewed questions and selected algebra/diagram counterexamples; scoring/UI tests ensure self-review responses are not labeled automatically correct and empty courses are not presented as complete.
- Verification evidence: 112 focused curriculum/scoring tests and application TypeScript passed at implementation; later empty-state/quiz feedback checks passed. The review ledger records precisely what was checked. No production seed/content update was made.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Final candidate checks remain pending. Original source version/page mapping/reuse permission and qualified educator review remain outstanding under BE35; chemistry/history and broad course catalog are not independently certified. AP AB/BC have no own topic modules, and the catalog is not a complete syllabus.
- Commit SHA: 10aab02; 3bff489.

### BE34 — Generate database types and retire unsafe compatibility paths

- Priority: **13/20**.
- Assessment finding: Schema drift and shadow/demo fallbacks make account behavior harder to reason about.
- Acceptance: Generate types from the tested schema and validate adapters. Keep fallback content distinct from saved account data.
- Dependencies: BE05, BE08; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; final candidate checks remain open.
- Implementation: Database contracts are generated from the real disposable PostgreSQL catalog and checked against clean/upgrade schemas. The browser Supabase SDK and supported server/service boundaries use generated table/RPC types; unknown editor/scene payloads pass runtime JSON validation. Schema drift exposed missing History source fields, now added without weakening ownership or dropping content.
- Files changed: `scripts/database/generate-types.mjs`; `src/lib/database.generated.ts`; `src/lib/database-client.ts`; `src/lib/supabase.ts`; `src/services/math-learning-service.ts`; `src/services/chemistry-service.ts`; `supabase/migrations/0036_history_source_evidence_fields.sql`; `scripts/database/README.md`.
- Tests added: Generator drift checks against actual migrated catalogs, all three typed projects, runtime JSON rejection and real-role History source roundtrips. Final schema through 0041 contains 68 public tables and 63 RPC names.
- Verification evidence: Generated schema comparison passed independently on all four final native database paths through 0041. The three TypeScript projects passed the latest integration checkpoint. See `../bindernotes-db-runtime/final0041-evidence.json` and `scripts/database/README.md`.
- Status: **IN PROGRESS**.
- Remaining risk/blocker: Exact hosted schema reconciliation and final candidate checks after subsequent code changes remain pending. SQL JSON containers still require domain schemas; generated types do not prove runtime ownership, and starter/demo content remains distinct from saved account records.
- Commit SHA: ef876f7; f4c5515; 937d232; 04ccfef; 132c142; a842c9f.

### BE35 — Confirm commercial integration terms and asset obligations

- Priority: **16/20**.
- Assessment finding: The repository does not establish the owner’s commercial Desmos API agreement. No violation was established.
- Acceptance: Record permitted API usage, attribution and any costs for production integrations and bundled course assets before charging.
- Dependencies: None; final verification pending.
- Current validation: Local implementation and scoped evidence are recorded; external acceptance gates and final candidate checks remain open.
- Implementation: Primary-provider terms and actual integrations/assets were inventoried. Package/font/upstream notices and exact bundled-asset hashes are recorded and distributed. The inventory flags unconfirmed commercial Desmos permission, the inspected Vercel Hobby plan, Stripe setup and missing course/media/photo provenance instead of inferring rights from working keys or public access.
- Files changed: `docs/COMMERCIAL_INTEGRATIONS.md`; `docs/commercial-package-inventory.json`; `docs/font-license-inventory.json`; `docs/upstream-notice-sources.json`; `public/THIRD_PARTY_NOTICES.txt`; `public/FONT_NOTICES.txt`; `public/SUPPLEMENTAL_NOTICES.txt`; `public/UPSTREAM_NOTICES.txt`; `LICENSE`.
- Tests added: Engineering inventory/notice/source-hash review, not a test of private contracts or legal clearance. Final artifact notice-presence review remains part of the candidate gate.
- Verification evidence: `docs/COMMERCIAL_INTEGRATIONS.md` records checked official terms, specific assets, obligations and responsible owner. No contract was accepted, subscription purchased, provider contacted or account upgraded during remediation.
- Status: **BLOCKED — EXTERNAL ACTION REQUIRED**.
- Remaining risk/blocker: Founder must supply permitted Desmos and commercial hosting arrangements, Stripe merchant/test setup, content/media/photo rights and privacy/upload terms; complete exact distributed notice review. No legal violation or commercial clearance is inferred. No production deployment or paid Supabase branch was created.
- Commit SHA: 2e59183.
