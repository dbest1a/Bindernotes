# Hosted preview verification

Verified on 17 September 2026. This is a public-page and disabled-endpoint smoke check, **not** a complete authenticated release acceptance.

- Preview: https://2026-04-20-build-web-apps-plugin-build-jczx4x4bz.vercel.app
- Deployment: `dpl_ABo5rhKqJxLUNm3oNLsp2FC3o8Cv`, Vercel **READY**, preview target.
- Source: `c1d69951878723c05bc2307a170c4ad8f1369ce5`, isolated clean detached checkout. Both Vercel commit metadata fields match. Later CI fixture/report changes do not alter application files.
- Existing project: `prj_W8PLZUB5r3zewZRQ7MUQg5DjNavx`, team `team_eLTiyPHlX4JA9e8U3hojs5L3`.
- GitHub: [draft PR #2](https://github.com/dbest1a/Bindernotes/pull/2). Main is not merged.
- Production remains `dpl_65aNJ5kVKSKhSJVF7zmpdoVR4mTo`; its two production domains still point to that deployment. No production migration or paid resource creation occurred.

## Deliberate environment limitation

The browser backend URL is the reserved non-resolving `https://preview-backend.invalid`, with an inert placeholder public key. The user declined a paid Supabase branch and chose local backend testing. No reachable isolated hosted backend has been configured. Login, signup, cloud persistence and the ten authenticated preview journeys therefore remain **unverified and unavailable in this preview**. The rendered login form alone is not evidence of working authentication. Do not enter credentials to test it.

Billing, private assets, account deletion and telemetry activation are explicitly disabled for this deployment. Their responses verify packaging and disabled behavior, not provider or data functionality. No real subscription, payment, file or account deletion was attempted.

## Observed browser checks

The landing page and pricing page rendered, including their navigation and plan descriptions. The sign-in form rendered. Visiting `/notes` while signed out redirected to `/auth?next=%2Fnotes` and rendered the sign-in form; no private workspace appeared. The captured browser error/warning log was empty for these interactions. No authenticated hosted success is inferred.

Evidence remains ignored under `.tmp/remediation/browser/`: `final-hosted-landing.png`, `final-hosted-auth.txt`, `final-hosted-protected-route.txt`, `final-hosted-pricing.txt`. Real signed-in local journeys are described separately in [Local browser verification](LOCAL_BROWSER_VERIFICATION.md).

## Actual hosted endpoint checks

Eight empty, unauthenticated POST requests were made through the authenticated Vercel CLI to this exact preview deployment. All returned the expected result; none returned a function invocation error. Sanitized results are in `.tmp/remediation/final-preview-endpoints.json` (20:42:21 UTC).

| Endpoint                | Expected and observed                  |
| ----------------------- | -------------------------------------- |
| `/api/billing/checkout` | 503 JSON: paid plans unavailable       |
| `/api/billing/portal`   | 503 JSON: paid plans unavailable       |
| `/api/billing/webhook`  | 503 JSON: paid plans unavailable       |
| `/api/assets/cleanup`   | 503 JSON: private uploads unavailable  |
| `/api/assets/complete`  | 503 JSON: private uploads unavailable  |
| `/api/assets/remove`    | 503 JSON: private uploads unavailable  |
| `/api/account/delete`   | 503 JSON: account deletion unavailable |
| `/api/telemetry`        | 401, empty body                        |

An earlier preview failed before the disabled billing guard because Node could not resolve an extensionless ESM import. Commit `c1d6995` fixed all eight API import graphs. `npm run test:functions` now compiles with NodeNext, imports emitted JavaScript in native Node, and verifies sixteen disabled requests without any network call; CI enforces this check. The actual hosted requests above confirm the fix reaches Vercel's runtime.

The final deployment's runtime log query for HTTP 500 over the verification interval returned no entries. This is scoped to the checked preview and requests, not a general production monitoring claim.

## Release decision

**NOT READY FOR DEPLOYMENT** means production release remains blocked. A READY UI preview and passing disabled endpoints do not satisfy the original authenticated preview, full platform, payment, migration/rollback or commercial gates. See the [final engineering report](FINAL_REMEDIATION_REPORT.md).
