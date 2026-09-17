# Database runtime checks and reconciliation

Historical SQL files remain unchanged. `migration-bundle.mjs` combines the two reviewed 0016 files into one version **only in a new staging directory**, recording the normalized SHA-256 of each source. Unknown duplicate versions fail. Do not push directly from the historical source directory.

Before an existing database upgrade, run `inspect-migration-history.sql` read-only against the explicitly selected environment and retain the results privately. A recorded 0016 does not identify which file ran. Object presence alone does not prove equivalent policies or statements. Supported paths are a clean database, the complete historical chain through 0015, and the complete recovery schema through 0025 with both 0016 components. Partial schemas, ambiguous 0016 or unexpected history require a reviewed environment-specific forward repair; automatic history rewriting is not provided.

```sh
node scripts/database/migration-bundle.mjs /path/to/new/empty-migrations-directory
node scripts/database/run-runtime-tests.mjs
node scripts/database/run-runtime-tests.mjs --upgrade-from=0015
node scripts/database/run-runtime-tests.mjs --upgrade-from=0025
node scripts/database/run-runtime-tests.mjs --upgrade-from=production-observed
```

The runner creates a random disposable database on loopback, applies the bundle in transactions, exercises actual roles/CRUD/functions and concurrent connections, then drops only that exact database. It never loads `.env`, accepts a remote host or uses `SUPABASE_DB_URL`. Configure `BINDERNOTES_PG_BIN`, `BINDERNOTES_TEST_DB_PORT` (default 55439), and optionally `BINDERNOTES_TEST_DB_USER` (default postgres). Cluster roles in the platform fixture are created only if absent. No existing database contents are touched.

Exact mode requires real `pg_cron` and `pgmq` extensions. The auth/storage fixture provides their SQL contract, not GoTrue, PostgREST or Storage HTTP. Those need preview verification too.

The production-observed fixture simulates the read-only September17 catalog: history through0018, all PersonalNotes objects, and unrecorded0020–0022 helper/policy hardening without0019 whiteboard payload constraints. This is an explicitly labeled simulation, not a production dump or proof of complete schema equivalence. All upgrade fixtures preserve meaningful existing profile/note content and rerun the role/concurrency scenarios. Full repository system+math seed payloads are applied twice against the disposable database to verify their actual shapes and idempotency.

On Windows without Docker, `--native-no-cron` runs real PostgreSQL authorization, transactions, constraints and concurrent connections. It loads real upstream PGMQ 1.5.1 SQL from `BINDERNOTES_TEST_PGMQ_SQL`, verifying SHA-256 `65b9302faa660539584769a572b57f2df76ccf1b3a2153c37cefc57b8db633e9`. [Upstream SQL](https://raw.githubusercontent.com/pgmq/pgmq/v1.5.1/pgmq-extension/sql/pgmq.sql). Native mode omits only extension registration and the two cron job registrations/unschedules from 0018; it provides no fake scheduler functions. This is runtime evidence, **not a passed full Supabase release gate**. Cron workers and Supabase HTTP are unverified in this mode.

## Database API

- `save_personal_content(p_kind,p_record,p_expected_revision,p_operation_id)` accepts `note`, `document` or `learner-note` and snake-case table fields. Exclude timestamps/revision from p_record. New/legacy revision is zero. The result is the saved row with incremented revision.
- `save_whiteboard_snapshot(p_board,p_expected_revision,p_create_version,p_operation_id)` accepts canonical scene_json/module_elements. Current scene and requested version commit together. The server determines ownership, payload measurements, version numbers and quota. Free/Plus retain three active boards; active Studio/Everything receive 20. Downgrades preserve existing boards and prevent new allocations above the limit.
- Stale revisions raise SQLSTATE 40001, CONTENT_REVISION_CONFLICT. Clients must preserve drafts and offer recovery choices. A stable operation UUID retries the identical request without a second version. Reusing an ID for another payload is rejected; replay after subsequent editing reports a conflict.
- Safe pin/archive/move metadata writes remain column-granted and increment revision. Direct content/title updates cannot bypass CAS. Direct creation cannot set revision. Private foreign parents are checked on direct writes too.
- `apply_catalog_seed(p_payload)` is service-role-only and writes allowlisted system/math catalog tables in one transaction. Browser operators cannot invoke it. No hosted seed was run during remediation.
- account_entitlements is owner-readable and service-write-only. Paid creator access never changes profiles.role. Creators manage only their own non-system binders/lessons and cannot manage roles, purchases, global templates or seeding.

The client and migration0027 require a coordinated deployment: old direct-content clients are denied rather than bypassing CAS. Rollback only to an RPC-compatible client; keep additive schema/data. Removing CAS protection is not a safe rollback. History reconciliation for production remains blocked until its actual recorded state and schema are reviewed.

Mutation receipts contain hashes, identity and revision, not document payloads. Define an offline-retry retention horizon before a future service maintenance job prunes receipts; this migration never deletes student data or old versions.

## Native Auth and PostgREST browser environment

`start-local-api-stack.mjs` creates a separate random database in the loopback PostgreSQL runtime, runs **real GoTrue auth migrations**, applies the application migration bundle, and starts real GoTrue and PostgREST behind a tiny route-only HTTP proxy. It creates four disposable Auth accounts and seeds the actual catalog transactionally. It never loads `.env` or contacts the hosted database. Existing occupied API ports cause it to refuse startup.

Set `BINDERNOTES_LOCAL_RUNTIME` to the outside-repository native runtime directory containing `pgsql/bin/psql.exe`, `pgmq-1.5.1.sql`, `gotrue.exe` and `postgrest/postgrest.exe`. PostgreSQL must already listen on `127.0.0.1:55439`. No system install is required. Runtime logs and `local-api-stack.json` (local passwords and anon key) stay outside Git. Read that manifest programmatically to configure Vite; do not print it into reports or commit it.

```sh
node scripts/database/start-local-api-stack.mjs
node scripts/database/check-local-api-stack.mjs
```

The gateway is `http://127.0.0.1:55442`; Auth listens on 55440 and PostgREST on 55441, all loopback-only. The proxy only routes requests and adds localhost CORS headers. It does not fabricate authentication or database results. The HTTP smoke verifies four actual password sign-ins, refresh-token exchange, owner-only profiles, denied role escalation, note snapshot persistence/readback, idempotent retry, denied cross-owner access and stale-revision rejection. Its temporary note is deleted afterward. Services remain running for browser journeys; the manifest records their PIDs and the exact disposable database name for deliberate teardown after verification.

Reproduction sources used on September17:

- PostgreSQL17.11 official [EDB portable binary](https://get.enterprisedb.com/postgresql/postgresql-17.11-3-windows-x64-binaries.zip), SHA-256 `4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf`.
- Official [PostgREST16.3 Windows archive](https://github.com/PostgREST/postgrest/releases/download/v16.3/postgrest-v16.3-windows-x86-64.zip), SHA-256 `5ea4b57b10a26be45521e8e31476a91084c8fe91e060951f04985d86e79367fa`. Its runtime requires the PostgreSQL `bin` directory on the child process PATH for libpq; no global PATH changes.
- Official [Supabase Auth v2.197.0 source](https://codeload.github.com/supabase/auth/zip/refs/tags/v2.197.0), archive SHA-256 `359a3235b3280e8c8c175559450a07b72249504edc55b266ab9be1776470526b`, compiled locally with Go1.27.1. Upstream does not publish a Windows binary and its unconditional Unix socket option does not compile on Windows. The **documented local portability patch** replaces only `net.ListenConfig.Control` in `cmd/serve_cmd.go` with `net.ListenConfig{}` and removes the now-unused `syscall` and `golang.org/x/sys/unix` imports. It disables Unix SO_REUSEPORT; all Auth handlers, token/password logic and migrations remain upstream. This is a locally compiled development binary, not an unmodified official distribution. Local binary SHA-256 `3ae3ffdbfc6dfb3811adcedb91db9c6b81b203c37d91f4353173d64195a3359f`.

This additional environment proves real Auth/PostgREST interactions. It still does **not** provide pg_cron workers, Storage HTTP, Realtime, delivered email, OAuth or production infrastructure equivalence. Auto-confirmed local test email avoids sending messages. Storage/Realtime requests receive an explicit 501 rather than a fake success. It is not the complete Supabase release gate.
