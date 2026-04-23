# Binder Notes

Binder Notes is a Phase 1 MVP for a student-first learning workspace:

- Supabase Auth with email/password sessions
- Admin/learner roles
- Published binders and lessons
- Learner-owned private notes
- Comments and highlights tied to lessons
- Tiptap rich text editing
- LaTeX rendering and function graph blocks
- Desmos-powered math lab with graph state persistence
- Built-in scientific calculator with history
- Tailwind + shadcn-style UI components
- Stripe pricing/checkout scaffolding
- User workspace presets, modules, themes, and locked setup mode

## Architecture

The app is a React + TypeScript + Vite SPA. Supabase is the source of truth once configured. The app includes a small in-memory demo fallback only so the interface can be reviewed before environment variables are present; it does not use `localStorage` for product data.

Key layers:

- `src/lib` contains Supabase setup, seed demo data, and utilities.
- `src/services` contains data access and payment service boundaries.
- `src/hooks` contains auth, React Query, and autosave helpers.
- `src/components` contains reusable UI, editor, math, and layout components.
- `src/pages` contains route-level screens.
- `supabase/migrations` contains normalized tables and RLS policies.

Workspace customization is intentionally isolated:

- `src/lib/workspace-preferences.ts` defines presets, modules, themes, and persistence helpers.
- `src/hooks/use-workspace-preferences.ts` loads/saves per-user, per-binder workspace state.
- `src/components/workspace` contains the panel registry, setup controls, and reusable panel chrome.
- Current runtime persistence uses `localStorage` for UI preferences only. The migration also includes `workspace_preferences` for backend sync.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example`:

   ```bash
   cp .env.example .env
   ```

3. Add Supabase values:

   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
   VITE_DESMOS_API_KEY="your-desmos-api-key"
   ```

4. Apply the Supabase migration:

   ```bash
   supabase db push
   ```

   Or paste `supabase/migrations/0001_binder_notes_phase1.sql` into the Supabase SQL editor.

5. Create a user through the app signup screen. To make that user an admin:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'you@example.com';
   ```

6. Optional seed:

   Edit `supabase/seed.sql` and replace `admin@example.com`, then run it in the Supabase SQL editor.

7. Start the app:

   ```bash
   npm run dev
   ```

## Deploy

The app is Vercel-ready.

Add these environment variables in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_DESMOS_API_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY` optional for the placeholder pricing page
- `VITE_STRIPE_PRO_PRICE_ID` optional until Checkout is wired

Important: `.env.local` only affects local development. Shared Vercel previews and production builds need
their own project environment variables set in Vercel before deployment. After adding or changing
`VITE_DESMOS_API_KEY`, trigger a fresh deploy so the client bundle is rebuilt with the updated value.

Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```

## Production Hardening

The repo includes a `vercel.json` with lightweight deployment protections that are safe for tonight's friend testing:

- SPA rewrites for deep BinderNotes routes
- Content Security Policy that allows the current app, Supabase calls, and Desmos embeds
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security` for HTTPS deployments
- conservative `Permissions-Policy`

Recommended Vercel-side settings for a public test:

- enable Vercel WAF managed rules
- keep Deployment Protection off only for the environment you intentionally want friends to use
- add Preview and Production copies of `VITE_DESMOS_API_KEY` if both preview links and the custom domain should load Desmos
- if you expose Supabase-backed auth publicly, enable rate limits / bot protection on auth endpoints at the provider layer as well

## Stripe Plan

Phase 1 includes a pricing page and a checkout service boundary in `src/services/stripe-service.ts`. The production path should add:

- `api/create-checkout-session` serverless route
- Stripe secret key stored server-side only
- Checkout Sessions for Pro subscriptions
- Webhook endpoint for `checkout.session.completed`
- Updates to `purchases` and role/entitlement records

## Current MVP Limits

- Collaboration is architected through normalized comments/highlights, but realtime presence and threaded UI are future work.
- Rich text is Tiptap-based; math blocks are separate structured blocks stored beside editor JSON.
- The math lab persists graph states and calculator history locally per user right now; backend sync can come later through Supabase UI preference storage.
- Concept nodes and edges are in the database and demo data, but the full visual graph UI can be expanded after the reader/admin flows stabilize.
- The first build intentionally prioritizes product foundation over feature sprawl.
