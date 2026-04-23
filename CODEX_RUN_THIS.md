# Binder Notes cloud fix + deploy

## Deployment platform detected

- `Vercel`

## Add these GitHub repository secrets

Go to:

`GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret`

Add:

- `SUPABASE_DB_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SYSTEM_OWNER_ID` (optional)
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Important:

- `SUPABASE_DB_URL` must be the **Postgres connection string**, not the API URL.
- `SUPABASE_SERVICE_ROLE_KEY` must stay in GitHub Actions secrets only.
- Do **not** put the service-role key in any `VITE_` variable.

## Which workflow to run

Go to:

`GitHub repo -> Actions -> Fix Repair Seed and Deploy -> Run workflow`

## First recommended run

- `apply_repair=false`
- `deploy_target=preview`
- leave `confirm_production` blank

This gives you:

1. typecheck, tests, and build
2. migration dry-run
3. migration apply
4. system seed
5. system placeholder repair dry-run
6. system verification
7. preview deploy only if everything above passes

## Second run only if the dry-run repair looks safe

- `apply_repair=true`
- `deploy_target=production`
- `confirm_production=DEPLOY PRODUCTION`

## How to know it worked

The workflow should finish green, and verification should pass for:

- `suite_templates`
- `seed_versions`
- `workspace_presets`
- `binders`
- `binder_lessons`
- `system_folders`
- `folder_binders`
- `binder-algebra-foundations`
- Algebra lessons present
- no pending system placeholder repair actions

Then confirm in the app:

- no Algebra seed missing diagnostic
- no random `Untitled math binder` cards
- highlights create, reload, recolor, and delete
- the deployed URL opens the fixed app

## Do not do this

- Do **not** run `supabase db reset` against production.
- Do **not** expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code or Vite env.
- Do **not** delete user data manually.
- Do **not** deploy if verification fails.
