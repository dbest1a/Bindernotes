# Local large-notebook API measurement

Measured on 17 September 2026 against the existing disposable GoTrue/PostgREST/PostgreSQL stack at loopback API55442. Source snapshot: `b1d5d93b1a5df2fd4c4154b3de2e98399b17c78f`. This is supporting BE28 evidence, not a production capacity, browser responsiveness or cost forecast.

A fresh, real Auth learner account owned 1,500 synthetic study notes across 12 notebooks (125 notes each), four subject folders and 24 outline documents. Every third note referenced an outline document. Rich-text note bodies contained 8–16 paragraphs: JSON content sizes ranged from 4,810 to 9,655 bytes, with a median of 7,217 bytes. Repeated educational text makes this reproducible but is not a sample of real students' writing.

The account was created through the local Auth API and signed in with a real password exchange. Fixture inserts and measured requests then used its authenticated learner token and ordinary REST/RPC ownership policies. No SQL, schema change, hosted request or existing account mutation was used. Credentials were neither printed nor included in this document.

The measurement copied the application's current metadata projection directly from `src/services/personal-notes-service.ts` and used its owner filter, active-row filter, stable ID ordering and 200-row pagination. The comparison fetched the same notes with `select=*` and identical pagination; it is a controlled full-row comparison, not a reconstruction of the old application's entire load sequence. Selected content used the current exact-owner/exact-ID single-row query. Search used the actual `search_personal_notes` RPC with 200-result pages.

Three consecutive runs alternated metadata/full-row ordering. Times include local HTTP response consumption and JSON parsing; bytes are UTF-8 response bodies before any transfer compression. These are three warm-ish samples, not statistically stable percentiles.

| Operation                        | Returned rows and pages                  | Response bytes | Median elapsed |   Observed range |
| -------------------------------- | ---------------------------------------- | -------------: | -------------: | ---------------: |
| Note metadata                    | 1,500; seven pages of 200 and one of 100 |        639,527 |      116.53 ms |  99.44–129.99 ms |
| Same notes, including all bodies | 1,500; same eight pages                  |     11,642,038 |      172.16 ms | 157.79–184.84 ms |
| One selected note body           | 1; one request                           |          7,170 |        9.52 ms |    9.10–18.87 ms |
| Body-only marker search          | 300; pages of 200 and 100                |         21,596 |      117.76 ms | 112.55–122.51 ms |
| Broad body-text search           | 1,500; seven pages of 200 and one of 100 |        107,984 |      440.34 ms | 368.14–469.26 ms |

Metadata reduced note-list response bytes by **94.51%** relative to the full-row control. Adding one selected body still used **94.45%** fewer bytes. The four folders, 12 notebooks and 24 document metadata rows contributed another 14,036 bytes across three requests, measured separately. These figures are not compressed egress or billed usage.

Assertions verified all 1,500 unique note IDs, no body/math payload fields in metadata, exact selected-body equality, and the exact expected search identities without duplicates or missing pages. Both search phrases existed in bodies, not titles or tags. Search returned only kind/ID pairs. Crossing the usual 1,000-row result boundary did not truncate these paged reads.

Broad search was the slowest measured operation despite its small response. The current RPC searches rich JSON text for each requested page; this experiment does not establish acceptable search latency on a hosted service or with concurrent students. The next performance gate should exercise real browser collection construction, list rendering, TipTap hydration, search interaction and navigation over representative network latency, with mixed document/whiteboard sizes and multiple users.

Ignored local evidence is `.tmp/remediation/local-performance-verification.mjs` and `.tmp/remediation/local-performance-verification.json`. The harness refuses any backend other than the specified loopback API and creates a new disposable account when rerun. The fixture remains only in the existing disposable local stack until its normal teardown. The evidence excludes full `getPersonalNotesWorkspace` orchestration/dashboard work, browser rendering, WAN/TLS, CDN compression, Storage HTTP, cold starts, concurrent load and production cost. It cannot close those remaining release or performance gates.
