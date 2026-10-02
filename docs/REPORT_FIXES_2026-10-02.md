# October 2 product report repairs

This change addresses the findings in `BinderNotes_testing_and_improvement_report_2026-10-02 (1).pdf` and the reported whiteboard lag and snapping. The PDF was used as investigation evidence, not as authorization to operate production systems. Work starts from the recorded release checkout, commit `61ee7aa`, on `codex/report-fixes-2026-10-02`.

## Changes and evidence

| Finding | Implemented behavior | Verification |
| --- | --- | --- |
| F01: recent edits lost on navigation | Owner- and record-scoped synchronous recovery journals, outgoing draft flush, serialized saves, reload recovery, and unload warning when work remains. Reader and Personal Notes journals cannot erase one another. | Draft-store, reader, page navigation and recovery regressions. |
| F02: old response acknowledges newer edits | Saves acknowledge the immutable submitted generation; later edits remain pending and are sent in order. Old page instances cannot clear a new instance's recovery journal. | Held-response and remount regressions. |
| F03: stale tabs overwrite | Existing-note updates require owner, record ID and expected `updated_at` in one conditional database update. Creation uses INSERT. Conflicts retain the local draft and offer a separate copy. Applies to personal notes, personal documents, binder reader notes, and whiteboards; cross-tab notifications refresh note queries. | Service contract and conflict/recovery tests. A real authenticated staging suite is included but was not executed. |
| F04: annotations disappear | Rich-text document changes propagate regardless of focus. Incoming hydration explicitly suppresses update emission. | Real TipTap comment, tag and link command propagation tests, plus page control tests. |
| F05: modal tags use old state | Tag changes enter the same revision-aware draft path as title/body changes. | Immutable save payload and tag regression tests. |
| F06: collapsed editor | The study stage scrolls when the controls and editor exceed the viewport. Editors retain a usable minimum size; minimal chrome keeps the writing surface visible. | Real Chrome at 1165×757, 820×600, 821×757, 1180×900, 1181×600 and 1440×900, Notes/Read, plus three density modes; exact text survives local save/reload. |
| F07: canvas points at unrelated note | Explicit routes cannot silently expose another note. New canvas notebooks open their own scoped whiteboard, initialize the chosen editable template once and reopen that scope. Empty and missing binders show their own state. | Page routing tests and real-browser scoped canvas persistence. |
| F08: filters disagree | The filtered list, count, selection and route agree. Browser Back resolves its requested record before resetting stale filters. | Page filtering and history regression tests. |
| F09: annotation/card actions incomplete | Board annotation actions preserve source identifiers and editable annotation data; the manager, send and dismiss actions work. | Annotation and module persistence tests. |
| F10: misleading quiz feedback/results | Machine-scored answers, incomplete answers and self-reviewed explanation responses have distinct outcomes. Rubrics appear for explanation questions. Attempts finish through the service and stored results load by owner, quiz and attempt. | Scoring, rendered quiz flow and result retrieval/remount tests. |
| F11: blank numeric answers accepted as zero | Empty/whitespace numeric input is incomplete; an explicitly entered zero remains valid when zero is expected. | Numeric scoring and authored zero-answer UI cases. |
| F12: offer/account journey | Pricing states the current free offer and actual board/graph limits; future paid plans have no purchase action. First-use links open signup. Password hints, reset, confirmation/resend and update-password states use the real auth API. Help links are visible. | Auth API and page tests; real desktop/mobile public route checks. Published policy documents still require owner-supplied URLs. |
| F13: first-use and keyboard details | Public written quick-start, wrapping tutorial controls, practical landing copy, accurate showcase label, tab keyboard relationships, Escape/focus return, and useful chemistry vocabulary. Only exact recognized seed placeholders are repaired at read time; authored content is preserved. | Public route/browser checks, keyboard/page tests and chemistry projection tests. |
| F14: recovery incomplete | Archive & restore and validated JSON import create a new board without replacing the original. Backups include available graph workspace state; imported graphs have independent instance IDs. Conflict recovery archives the local draft before opening the latest server record. | Real downloaded JSON bytes imported, malformed/version rejection, original/restore content and positions checked in Chrome; import/storage unit tests. |
| F15: release evidence | Automatic PR/push validation, separate manual authenticated staging verification, build SHA/time/dirty metadata in `build-info.json` and account diagnostics. Maintenance/deployment workflows remain separate. | Full unit suite, browser suite, TypeScript, production build and asset/environment guards; see final execution record below. |

## Whiteboard interaction repair

The canvas was receiving an old saved camera snapshot after scene/module updates, which moved it back while the user was panning or moving a card. Scene updates no longer replay that camera state. Pointer movement updates card/camera geometry through animation frames, and expensive React camera work waits until the gesture settles. Drag state survives unrelated rerenders; pointer cancellation, blur and second pointers end the gesture safely.

Browser tests check intermediate card positions at successive pointer moves, not only the final position. They also pan the board, save, reload, and assert that the released position remains unchanged. A 390px viewport exercises accessible controls and card movement. These checks establish the tested interactions; they are not a frame-rate benchmark or a claim about every physical touch/pen device.

## Running verification

```sh
npm ci
npm run typecheck
npm test -- --maxWorkers=4
npm run build
npm run scan:build
npm run verify:client-env
npx playwright install chromium
npm run test:e2e
npm run verify:auth:live
```

On Windows with installed Chrome, set `PLAYWRIGHT_CHANNEL=chrome` for `test:e2e`. The layout and whiteboard browser fixture uses real application components and browser storage. It deliberately has no production account. Public-route checks exercise the application against a synthetic `.invalid` Supabase URL. Neither fixture is a substitute for authenticated server persistence.

To run authenticated staging verification, supply `E2E_STAGING_URL`, `E2E_EMAIL`, `E2E_PASSWORD` and `E2E_NOTE_PATH`, then run `npm run test:e2e:staging`. Use a disposable staging account and an existing note titled `TEST ...`; the test edits it and creates a conflict copy. It refuses the known production hostname. The manual GitHub workflow reads credentials from the `staging` environment secrets and disables traces, screenshots and video. Verify the staging site's backend is disposable before running it.

## Boundaries before production promotion

- No production deployment, database migration, seed, data repair or account mutation is part of this patch. Existing owner policies and schema remain in place.
- Real authenticated cloud save/reload, deployed RLS, recovery-email delivery and cross-device conflicts remain unverified in this session. The signed-out live auth smoke checks actual rendered controls and errors, not only HTTP status.
- Publish actual policy documents and set `VITE_PRIVACY_POLICY_URL` and `VITE_TERMS_URL` to HTTPS URLs. The UI does not fabricate a privacy policy, terms or support contact.
- Recovery journals depend on browser storage. Personal Notes recovery is scoped to the tab; it does not promise survival after that tab is closed. Save failures and storage failure remain visible.
- The historical 148-object board, physical pen/IME/screen-reader behavior, extended offline/reconnect sessions and a full scientific-content audit were not verified. No claim of a universal 10/10 experience is made.

## Final execution record

- Unit/regression suite: **1,193 tests passed in 163 files**.
- Browser suite: **21 tests passed**, including 15 editor/layout cases, four whiteboard/recovery cases, and two desktop/mobile public journeys. Public screenshots were subsequently checked again after the heading animation completed.
- TypeScript checks for application and Vite configuration: passed.
- Production build and built-asset/client-environment guards: passed. Existing large optional chunk warnings remain; these were not treated as proof of interaction latency.
- Live signed-out auth rendering at `https://www.bindernotes.com/auth`: passed. This checks the currently deployed site's controls, not deployment of this patch or a signed-in persistence round trip.
- Git whitespace check passed with `cr-at-eol` to account for this checkout's existing mixed Windows line endings.

CI uploads its browser report and build identity under the exact Git SHA. Local screenshots and logs are retained in ignored `test-results/` and `.tmp/` directories. The authenticated staging suite was not run because a designated disposable staging account and deployment were not supplied.
