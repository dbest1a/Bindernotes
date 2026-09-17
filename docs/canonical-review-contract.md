# Canonical account reviews

Recall Lab, Review Queue, and source/note/Math review actions now share `review_items`. Each row has one strict versioned payload (`CanonicalReviewRecord`), an owner and a compare-and-swap revision. Generic study fields carry the scheduling projection; the optional full Recall card preserves source anchors, tags, explanations, original identity, miss reasons and teach-back reflections. `review_events` keeps immutable rating history and response length, not the student's response text. `review_sessions` preserves Recall checkpoint summaries.

All account reads use owner filters and RLS. Authenticated users cannot write these tables directly. `save_review_item` validates ownership/content, checks the revision and saves the card and events in one transaction. A stable operation UUID makes lost-acknowledgement retries idempotent. The server derives ownership from `auth.uid()`; owner IDs in payloads must match. Session inserts are immutable and owner-scoped. See migration `0030_canonical_review.sql` and real PostgreSQL proofs in `scripts/database/review-cases.mjs`.

Recall edits are journaled on each input change, then debounced to the account. The existing revisioned save coordinator keeps failed drafts, restores them after reload, retires pending work on account changes, and exposes conflict recovery as an explicit copy or replacement from the account. Source-card creation and Review Queue ratings also journal stable operations before network requests. Saving requires available device storage; an unavailable journal is an error, not a successful save. Pending work stays on the originating device until the account confirms it. A fresh device reads confirmed account records and histories. Refresh retrieves later changes; this is not a live collaborative editor.

## Scheduling and migration

New ratings everywhere use `scheduleCanonicalReview` and the existing study scheduler: Forgot adds 10 minutes, Hard 1 day, Good at least 3 days, Easy at least 7 days; Good/Easy intervals scale with review count. Mastery, counters and Recall dates are updated together. This is a deterministic scheduling heuristic, not a validated learning algorithm.

Legacy browser data is inspected and imported only through an explicit action. The preview validates exact account and deck scope, content, counters, dates, IDs and history relationships. Anonymous and other-account records are not claimed. Migration retains the original due dates and history, never overwrites a different account record, and leaves every original browser key unchanged. Invalid, conflicting or oversized records are reported for recovery. The per-card transactional import limit is 1,000 history events; larger histories remain intact on the device and require a separately reviewed import. Legacy local helper functions remain only for migration/reference tests; primary review UI does not write them.

## Portable archive APIs

`canonical-review.ts` exports strict `canonicalReviewSchema`, `studyReviewEventSchema`, `recallSessionSchema`, and `recallCanonicalId`. Repository APIs are `listCanonicalReviews`, `readCanonicalReview`, `saveCanonicalReview`, `listCloudReviewEvents`, `listCloudRecallSessions`, and `saveCloudRecallSession`. The local migration APIs are `previewLocalReviewMigration` and `importLocalReviews`.

Archive remapping must update owner fields, source/deck IDs, Recall identity and the derived canonical ID together, then update history item IDs and session scope/card IDs. Validate the final record again. Importing through a transactional server archive operation must retain the same ownership/schema checks and should never replace a different existing record silently.

Nonreview Math problem logs, formula cards and graph links remain device-local. `math-local-portability.ts` provides `mathLocalArchiveSchema`, `readLocalMathArchive` and `mergeLocalMathArchive` for full, validated backup/restore of those three collections. It preserves graph JSON, reflections, attempts and links, rejects unsafe/oversized/nonfinite JSON, refuses owner mismatches and same-ID conflicts, and keeps a rollback journal during a multikey import. A cloud archive must retain its imported Math payload until local restoration succeeds. This helper does not imply cloud sync of those collections.

## Evidence boundaries

Service and UI tests cover fresh-device retrieval, uncertain retry, offline edit restoration, account switches, source/history preservation, migration conflicts and the final review-card summary. Real PostgreSQL tests independently exercise ownership, RLS, direct-write denial, concurrent revision contention, idempotency, invalid input and rollback. Browser verification of the complete authenticated route remains a separate release check.
