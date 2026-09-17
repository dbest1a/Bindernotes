# Local browser verification

These are observed working-tree checks from 17 September 2026, not evidence for a final release SHA or hosted preview. All accounts and content are disposable fixtures on the loopback Auth/PostgREST/PostgreSQL stack documented in `scripts/database/README.md`. No production account or student content was used.

## Save-failure harness

`scripts/database/local-fault-proxy.mjs` requires `BINDERNOTES_LOCAL_FAULT_TESTING=true` and listens only on `127.0.0.1:55443`, forwarding only to the real local gateway on port55442. Configure a separate local Vite process to use that URL and the disposable manifest's anon key. The proxy never fabricates a successful response. Auth and reads continue to reach the actual services.

Set `.tmp/remediation/browser-fault.json` to `{"mode":"pass"}`, `{"mode":"reject"}` or `{"mode":"hold"}`. Reject returns an explicit503 for the note, whiteboard and canonical review save RPCs. Hold lets PostgreSQL commit, then buffers the real acknowledgement until pass releases it. This tests uncertain/delayed acknowledgements separately from a rejected write. It is not a browser-wide offline simulation. The file and all browser evidence remain ignored; do not store credentials in reports.

## Observed journeys

| Journey | Observed result | Local evidence under `.tmp/remediation/browser/` |
| --- | --- | --- |
| Rapid note switching and delayed save acknowledgement | Distinct notes retained their own bodies. A newer edit made while an earlier acknowledgement was held survived navigation, acknowledgement release and reload. | `delayed-ack-reload-newer-note.txt` |
| Board and route switching | A rectangle in board one and ellipse in board two survived immediate switching, leaving the route and returning. After the dark-canvas contrast correction, the original rectangle remained and controls were legible. | `board-two-route-return.png`, `board-one-switch-return.png`, `whiteboard-contrast-fixed.png` |
| Account isolation | Signing out learner A and signing in learner B at A's private route showed no A content. A learner opening the operator route returned to the dashboard. | `account-B-private-route-denied.txt`, `learner-admin-redirect.txt` |
| Failed save, reload and reconnection | Explicit503 showed Save failed while retaining the body. Reload restored the draft. B could not see it. Returning as A after reconnect saved it, and another reload retained the saved body. | `blocked-save-draft-recovered.txt`, `blocked-draft-account-B-denied.txt`, `reconnected-draft-saved-reload.txt` |
| Concurrent edits in independent browser origins | After one session saved a newer revision, the stale session displayed a conflict and preserved its draft. Saving a separate recovery copy retained the older draft while keeping the cloud winner; reload verified the copy. | `two-session-conflict.txt`, `two-session-conflict-copy-reload.txt` |

The development server was changing during these checks. Historical HMR errors are not a clean-console release result. Repeat the complete required journeys against the final built candidate, then against its exact-SHA hosted preview. Real Storage HTTP, cron workers, delivered recovery email, OAuth and Stripe test-mode end-to-end verification remain separate gates.
