# Release process and remaining gates

No production deployment is approved by this document. The current production metadata is SHA94525210 with `gitDirty=1`; source recovery alone cannot establish an exact-source rollback. Keep deployment `dpl_65aNJ5kVKSKhSJVF7zmpdoVR4mTo` available until a tested successor and rollback exist.

`Validate BinderNotes` runs formatting, recommended ESLint, all TypeScript projects, Vitest unit/integration tests, build and dependency review. A separate matrix starts an actual disposable Linux Supabase stack for clean/0015/0025/observed-production-shape migration tests, real role CRUD, concurrent mutation tests and Auth. Its clean job also runs authenticated Playwright integration. The source schema's two historical0016 files are preserved and combined only into the reviewed temporary migration bundle. Nothing in ordinary CI loads hosted secrets, connects to hosted Supabase, repairs production history or deploys production.

The Windows native stack supplies additional real PostgreSQL/Auth/PostgREST evidence but does not run Storage HTTP, Realtime or pg_cron workers. The Linux matrix is not considered passed until its actual workflow results have been inspected. Current CI browser tests cover signed-in note persistence/account switching and protected-route denial. All10 requested local **and exact-SHA hosted preview** journeys still require their explicit evidence entries. A green subset cannot authorize production.

The former `fix-supabase-backend-seed` and `fix-repair-seed-and-deploy` workflows are retired with an explicit stop. They previously allowed bulk migration-history repair and direct schema/deploy steps without the complete new gates. Their source is preserved in Git history. Automatic Vercel Git deployment is disabled in this branch's config to prevent an unverified push/merge using shared production backend env. Explicit preview deployments remain possible to the existing project after environment review. See [Vercel Git deployment configuration](https://vercel.com/docs/project-configuration/git-configuration).

Required branch protection for the intended release branch: require the `quality` job and all four `database` matrix checks, require a current review, and prevent force-push/deletion. Connector permissions must be checked before claiming this was configured. No branch-protection configuration is implied by adding this file.

Before a hosted preview:

1. Commit the candidate and verify clean application sources. Record the exact40-character SHA and migration-bundle manifest hashes.
2. Use only the existing Vercel project `prj_W8PLZUB5r3zewZRQ7MUQg5DjNavx`, team `team_eLTiyPHlX4JA9e8U3hojs5L3`, repository `dbest1a/Bindernotes`.
3. Explicitly identify the preview backend. Never inherit production URL/keys for write testing. The user declined a paid Supabase branch; localhost services are not reachable by a hosted preview. A preview with an unavailable backend is a build artifact, not verified functionality.
4. Verify server-only secrets, browser public env, build SHA, absent private content/credentials in artifacts and billing/upload flags. Do not infer correct env from a successful build alone.
5. Run all10 browser journeys, review console/network errors and inspect Vercel build/runtime logs. Record deployment ID and metadata SHA. Any further commit invalidates exact-candidate evidence.

Before production:

1. Every BE task must have verified acceptance or a specifically reviewed external disposition compatible with the release. All mandatory release gates, Stripe test flows, supported uploads, commercial terms, migration review and rollback must pass.
2. Reconcile the actual production schema and recorded history read-only. The observed schema is selectively ahead of its recorded0018; do not rename0016 or mark versions applied from object presence alone.
3. Prepare and test the exact forward migration on a sanitized disposable upgrade snapshot. Preserve a production backup under the owner's normal secure process. Establish which old clients remain compatible; the CAS migration intentionally rejects old direct-content writes.
4. Apply only the reviewed compatible migration through the controlled release process, with explicit production-operation authorization if still needed. Never run an ordinary PR workflow against production.
5. Promote the **same verified deployment artifact/SHA**, then confirm aliases and perform the focused authenticated production smoke test. Do not rebuild a different commit and call it the preview-tested candidate.

Rollback:

- Before this remediation is released, no production rollback action is necessary; no production data or deployment has been changed.
- After a future release, use `vercel rollback <recorded-compatible-deployment-id> --scope <verified-team>` to restore the tested compatible artifact. Inspect its SHA and aliases afterward. Verify this command and permissions in the release environment first.
- Keep additive schema and student rows. Never down-migrate by dropping new content/review/asset tables or revoking safety boundaries. After migrations0027/0032, a pre-CAS/scene-alias client is **not** a safe rollback; prepare an RPC/canonical-scene-compatible fallback before release.
- If data repair is needed, preserve a backup and reproduce the exact repair against a disposable copy before an explicitly authorized forward fix. Do not restore a stale database snapshot over newer student work merely to roll back application code.
