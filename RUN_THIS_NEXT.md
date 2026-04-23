# Binder Notes: next safe steps

Project ref: `ejisbofqfxitckaevmip`  
Supabase URL: `https://ejisbofqfxitckaevmip.supabase.co`

## What this fixes

The frontend is now strict about backend-native suite data. That means the workspace will only load seeded Supabase rows when Supabase is configured.

Right now the remote project is still missing the backend-native suite foundation tables and/or seed rows:

- `public.suite_templates`
- `public.seed_versions`
- `public.workspace_presets`
- system folders
- `folder_binders`

So the next safe steps are:

1. push the latest migrations
2. run the system seed from a server-side terminal
3. verify the row counts in Supabase

## Important safety rules

- Do **not** run `supabase db reset` against production.
- Do **not** put `SUPABASE_SERVICE_ROLE_KEY` in any frontend or Vite env file.
- Do **not** add the service-role key to `.env.local` for browser use.
- Use the service-role key **only** in a terminal or server-side environment when running `npm run seed:system`.

## PowerShell

```powershell
npm install
npm run typecheck
npm run test
npm run build

npx supabase link --project-ref ejisbofqfxitckaevmip
npx supabase db push

$env:SUPABASE_URL="https://ejisbofqfxitckaevmip.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<paste-service-role-key-here>"
# optional: force a specific admin profile to own the seeded rows
$env:SUPABASE_SYSTEM_OWNER_ID="<optional-admin-profile-uuid>"

npm run seed:system
```

## Mac/Linux Bash

```bash
npm install
npm run typecheck
npm run test
npm run build

npx supabase link --project-ref ejisbofqfxitckaevmip
npx supabase db push

export SUPABASE_URL="https://ejisbofqfxitckaevmip.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<paste-service-role-key-here>"
# optional: force a specific admin profile to own the seeded rows
export SUPABASE_SYSTEM_OWNER_ID="<optional-admin-profile-uuid>"

npm run seed:system
```

## What `npm run seed:system` should print

It should complete idempotently and print counts for:

- `suite_templates`
- `seed_versions`
- `workspace_presets`
- `system_folders`
- `folder_binders`
- `binders`
- `binder_lessons`

Running it again should not duplicate rows.

## SQL checks for the Supabase SQL editor

Use these after `npx supabase db push` and again after `npm run seed:system`.

```sql
select to_regclass('public.suite_templates');
select to_regclass('public.seed_versions');
select to_regclass('public.workspace_presets');

select count(*) from public.suite_templates;
select count(*) from public.seed_versions;
select count(*) from public.workspace_presets;
select count(*) from public.binders;
select count(*) from public.binder_lessons;
select count(*) from public.folders where source = 'system';
select count(*) from public.folder_binders;
```

## Expected outcome

After the migrations and system seed complete:

- the dashboard should stop showing missing-seed errors for system suites
- Algebra 1 Foundations should load from Supabase
- Rise of Rome should load from Supabase
- French Revolution History Suite Demo should load from Supabase
- workspace diagnostics should become informational instead of blocking

## If something still looks wrong

Check these first:

1. `VITE_SUPABASE_URL` points to the same project you linked: `ejisbofqfxitckaevmip`
2. `npx supabase db push` succeeded against that project
3. `npm run seed:system` used a real `SUPABASE_SERVICE_ROLE_KEY`
4. the SQL count checks above return non-zero rows for the suite tables
