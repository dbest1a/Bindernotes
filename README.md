# Binder Notes

Last updated: 2026-04-28

Binder Notes is a student-first learning workspace for reading course material, taking private notes, graphing math, building study layouts, and testing the product through a Vercel-ready public site.

The app has grown past the first Phase 1 MVP. It now includes:

- Public landing and pricing pages for `bindernotes.com`
- Supabase Auth with email/password sessions
- Admin and learner roles
- Published binders, folders, lessons, and system-seeded course content
- Learner-owned private notes, comments, highlights, and workspace preferences
- Tiptap rich text editing with LaTeX rendering
- Desmos-powered 2D and 3D graph modules
- Scientific calculator, saved graph states, and graph history
- Math learning routes for courses, modules, question authoring, quizzes, attempts, and results
- Jacob Math Notes coverage from Geometry through Real Analysis
- History learning content, including Roman history and a Russian Revolution showcase
- Supabase-backed whiteboards with templates, pinned objects, annotations, standalone lab support, and beta limits
- Workspace presets, simple presentation mode, canvas/study panels, focus mode, theme controls, and admin motion controls
- Admin-only premium dashboard makeover with Google Drive-style organize mode for folders and binders
- Stripe pricing and checkout service scaffolding
- Deployment hardening, client environment guards, seed repair scripts, responsive/layout verification, and live auth verification helpers

## What Changed Recently

The previous README was last touched on 2026-04-21. Since then, the repo has added several major areas:

- Math learning infrastructure: routes under `/math`, seeded calculus/Jacob modules, manual question banks, quiz sets, attempts, scoring, and Supabase tables in `0011_math_learning_infrastructure.sql`.
- Full Jacob Math Notes coverage: 27 published modules, 54 linked practice questions, formula cards, graph/demo cards, related concepts, and a coverage ledger in `docs/jacob-math-notes-coverage.md`.
- Whiteboard system: Supabase persistence, standalone math whiteboard lab, module cards, toolbar/launcher/template picker, pinned object layers, annotation targeting, serialization, layout helpers, and migrations `0012` through `0015`.
- Workspace and preset improvements: layout engine, preset validation, subject-aware module support, compact module spacing, accordion-organized settings, edit-layout snapback protection, focus fixes, and panel sizing tests.
- Responsiveness and performance passes: phone/tablet workspace adaptations, route/code splitting, reduced eager loading for admin/editor/math tooling, and settings search optimizations.
- Public marketing work: redesigned landing page and pricing page, plus a polished pricing comparison table.
- Admin dashboard preview: profile-gated Normal/Admin Makeover toggle, premium motion/color controls, glassy workspace redesign, dnd-kit folder/binder drag ordering, local admin order drafts, and migration-ready sort columns.
- History content expansion: Russian Revolution seed data and services alongside the existing history suite.
- Production readiness: `scripts/build-client.mjs`, `scripts/client-env-guard.mjs`, `scripts/verify-live-auth.mjs`, Vercel headers/rewrites, and additional seed/repair/verification scripts.

## Architecture

Binder Notes is a React + TypeScript + Vite SPA. Supabase is the source of truth for account, role, binder, lesson, notes, whiteboard, and workspace data. Production builds should use real Supabase Auth and seeded/system content; demo auth and demo binder shortcuts are intentionally kept out of production paths.

Key layers:

- `src/App.tsx` defines public, protected, legacy, math, admin, tutorial, and pricing routes.
- `src/pages` contains route-level screens.
- `src/components` contains reusable UI, editor, math, whiteboard, workspace, history, and layout components.
- `src/hooks` contains auth, React Query, autosave, math workspace, admin motion, and workspace preference hooks.
- `src/lib` contains Supabase setup, demo/system seeds, scoring, diagnostics, workspace engines, dashboard organization helpers, math coverage, whiteboard utilities, and production guards.
- `src/services` contains data access boundaries for binders, math learning, history, appearance, workspace presets, system seeds, and Stripe.
- `supabase/migrations` contains normalized tables, seed/support tables, RLS policies, math learning tables, appearance settings, and whiteboard storage.
- `docs` contains math infrastructure notes, Jacob coverage, and planning handoff notes.
- `scripts` contains seed, repair, verification, live auth, and client build safety scripts.

## Routes

Public:

- `/` public landing page
- `/pricing` pricing and plan comparison
- `/auth` signup/sign-in

Protected app:

- `/dashboard`
- `/folders/:folderId`
- `/binders/:binderId`
- `/binders/:binderId/documents/:lessonId`
- `/binder/:binderId` legacy redirect route
- `/admin`
- `/tutorial`

Math:

- `/math`
- `/math/lab`
- `/math/lab/whiteboard`
- `/math/courses/:courseSlug`
- `/math/modules`
- `/math/modules/:moduleSlug`
- `/math/questions`
- `/math/questions/new`
- `/math/questions/:questionId/edit`
- `/math/quizzes/:quizId`
- `/math/quizzes/:quizId/attempt`
- `/math/quizzes/:quizId/results/:attemptId`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Add local environment values:

   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   VITE_DESMOS_API_KEY="your-desmos-api-key"
   VITE_STRIPE_PUBLISHABLE_KEY="optional-stripe-publishable-key"
   VITE_STRIPE_PRO_PRICE_ID="optional-stripe-price-id"
   ```

4. Apply migrations:

   ```bash
   supabase db push
   ```

   Or apply the files in `supabase/migrations` through the Supabase SQL editor.

5. Create a user through the app signup screen. To make that user an admin:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'you@example.com';
   ```

6. Optional seed and repair commands:

   ```bash
   npm run seed:system
   npm run verify:system
   npm run seed:math
   npm run verify:math-seed
   ```

7. Start the app:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` starts Vite on `127.0.0.1`.
- `npm run build` runs the guarded client build through `scripts/build-client.mjs`.
- `npm run preview` previews the production build locally.
- `npm run test` runs Vitest.
- `npm run typecheck` runs TypeScript project checks.
- `npm run seed:system` seeds system content.
- `npm run repair:system` audits system content repair.
- `npm run repair:system:apply` applies system content repair.
- `npm run verify:system` verifies system content.
- `npm run verify:system-seed` verifies system seed state.
- `npm run seed:math` seeds math learning content.
- `npm run verify:math-seed` verifies math learning seed state.
- `npm run cleanup:placeholders` removes workspace placeholder artifacts.
- `npm run verify:auth:live` checks the production auth page.
- `npm run verify:client-env` checks built client output for environment leakage.

## Deployment

The app is Vercel-ready.

Required Vercel environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DESMOS_API_KEY`

Optional Vercel environment variables:

- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_STRIPE_PRO_PRICE_ID`

Important: `.env.local` only affects local development. Shared Vercel previews and production builds need their own project environment variables set in Vercel. After adding or changing `VITE_DESMOS_API_KEY`, trigger a fresh deploy so the client bundle is rebuilt with the updated value.

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## Production Hardening

The repo includes `vercel.json` protections for public testing:

- SPA rewrites for deep Binder Notes routes
- Content Security Policy for the app, Supabase calls, Stripe, and Desmos embeds
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` for HTTPS deployments
- Conservative `Permissions-Policy`

Recommended Vercel-side settings:

- Enable Vercel WAF managed rules.
- Keep Deployment Protection off only for environments intentionally shared with testers.
- Add Preview and Production copies of `VITE_DESMOS_API_KEY` if both preview links and the custom domain should load Desmos.
- If Supabase-backed auth is public, enable rate limits and bot protection at the provider layer.

## License

Binder Notes is proprietary software. The source code, product design, user interface, documentation, data models, and related materials are all rights reserved. See [LICENSE](LICENSE) for the full proprietary notice.

## Data And Migrations

The migration stack currently covers:

- Phase 1 binder notes, profiles, folders, binders, lessons, notes, comments, highlights, and RLS
- Highlight color and offset improvements
- Private user data policies and route-aligned content IDs
- History suite foundations and system suite folders
- Seed version read policies and removal of default user folders
- Profile appearance settings
- Math learning courses, topics, modules, graph states, questions, choices, quizzes, attempts, and scoring records
- Whiteboard foundation tables, launch readiness, beta limits, ownership, and standalone lab support
- Dashboard ordering columns for future backend persistence: `folders.sort_order`, `binders.dashboard_sort_order`, and `folder_binders.sort_order`

Whiteboard storage is implemented through `src/lib/whiteboards/whiteboard-storage.ts` with Supabase and local/demo paths covered by tests.

## Current Limits

- Collaboration has normalized comments, highlights, annotations, and whiteboard persistence, but realtime multi-user presence is still future work.
- Stripe has public pricing and client-side service boundaries, but production Checkout still needs serverless session creation, server-side secrets, webhooks, and entitlement updates.
- Free response quiz answers are stored but not AI-graded.
- Jacob Math Notes has broad structured coverage; deeper custom interactives such as row-reduction steppers, richer proof editors, and theorem-specific diagrams remain future depth work.
- Some workspace/preset polish is still active work, especially around advanced layout tools, drawers, and cramped secondary panels.
- Admin dashboard organization currently saves admin layout drafts locally while the new backend ordering columns are staged for a safer Supabase persistence pass.
