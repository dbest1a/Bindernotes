# BinderNotes Project Memory

## Product Purpose

BinderNotes is a student-first learning workspace. It brings lessons, private notes, highlights, formulas, graphing, whiteboards, tutorials, and organized binders into one premium study system.

The product goal is to beat scattered student workflows: separate PDFs, notes apps, calculators, whiteboards, screenshots, and study trackers. BinderNotes wins by keeping source material, thinking, annotations, math tools, and personal organization in one calm workspace tied to the student's account.

## Current Branch / Model

- Active recovery branch: `recovery/personal-notes-from-live-good`
- Working model name: Personal Notes from LiveGood
- This branch is ahead of main and bundles several feature areas, not just Personal Notes.
- Local `main` may be behind `origin/main`; compare both before merge decisions.

Largest branch areas:

- Personal Notes workspace and Supabase schema.
- Dashboard/admin makeover and tutorial video infrastructure.
- Workspace responsiveness, performance mode, and layout polish.
- Supabase performance/security migrations.
- Landing/pricing/readme copy and deployment configuration changes.

## Architecture

- App shell: `src/App.tsx` wires React Router, auth, theme, query client, protected routes, and lazy pages.
- Public routes: `/`, `/auth`, `/pricing`.
- Account routes: `/dashboard`, `/notes`, `/notes/:noteId`, `/notes/n/:noteId`, `/notes/binders/:personalBinderId`, `/folders/:folderId`, `/binders/:binderId`, `/binders/:binderId/documents/:lessonId`, math routes, `/admin`, `/tutorial`.
- Auth: `src/hooks/use-auth.tsx` uses Supabase sessions and profiles. `src/pages/auth-page.tsx` exposes email/password and Google sign-in.
- Data: `src/services/binder-service.ts` handles binders, lessons, learner notes, comments, highlights, workspace prefs, and account-data safety.
- Workspace: `src/components/workspace/*`, `src/lib/workspace-preferences.ts`, `src/lib/workspace-layout-engine.ts`, and `src/lib/workspace-preset-designs.ts`.
- Editor: `src/components/editor/rich-text-editor.tsx` uses TipTap StarterKit, Highlight, Typography, and Placeholder.
- Tutorials: `src/components/tutorials/*`, `src/lib/tutorials/*`, and `src/services/tutorial-service.ts`.
- Supabase schema and hardening live under `supabase/migrations`.

## Personal Notes Model

Personal Notes unifies several note types:

- Loose personal notes: user-owned notes not tied to a binder.
- Personal folders: user-owned organization containers.
- Personal binders: user-owned notebook/project groupings.
- Personal documents: pages inside personal binders.
- Binder-linked notes: existing `learner_notes` attached to lessons, shown inside Personal Notes without detaching them from source binders.

Core files:

- `src/pages/personal-notes-page.tsx`
- `src/lib/personal-notes.ts`
- `src/hooks/use-personal-notes.ts`
- `src/services/personal-notes-service.ts`
- `supabase/migrations/0016_personal_notes_workspace.sql`

Supabase account data:

- `personal_note_folders`
- `personal_note_binders`
- `personal_note_documents`
- `personal_notes`
- `learner_notes` for binder-linked notes

Local UI preference state:

- Personal Notes preferences are stored in localStorage per user.
- Personal Notes canvas frames are stored in localStorage per user.
- Workspace theme/global appearance preferences can also use localStorage.
- Account content must stay in Supabase, not hidden local fallbacks.

Important implementation notes:

- Autosave defaults on and debounces editor saves.
- Search/filter supports source filters, folders, tags, pinned notes, review later, math, empty/untitled/unfiled, and recency.
- Focus mode uses browser fullscreen when available and CSS focus fallback.
- Highlights are wired in TipTap; custom comment/tag/source/link annotation marks appear scaffolded and need review before being treated as fully persistent rich-text marks.

## Style Language

BinderNotes uses a premium education-SaaS language:

- Light/dark app tokens with charcoal, white, teal/cyan, violet, and restrained accent colors.
- Clean system/Inter-style UI typography with some editorial/display variants in specific workspace themes.
- Rounded but not toy-like panels, clear borders, soft shadows, and readable density.
- Personal Notes should feel like a focused notebook/editor with side organization, metadata, command tools, and calm full-screen writing.
- Workspace/module surfaces should feel like a modular study desk: lesson, notes, graphing, whiteboard, formula, comments, and evidence panels arranged by learning priority.
- Admin/dashboard surfaces are more cinematic and animated, but performance mode and reduced motion must quiet them.
- Marketing/homepage is cinematic and product-forward, but authenticated workflows should stay practical and fast.

## Auth / Supabase Rules

- Real Supabase auth only.
- No demo auth.
- No demo binders in real accounts.
- No secrets in output.
- No Supabase wipe/reset/migration/data mutation without explicit approval.
- Account notes, highlights, comments, and workspace layouts must require Supabase saves.
- RLS policies must keep user-owned rows scoped to `auth.uid()`.
- Live auth checks must inspect rendered DOM text, not just response status.

## Gotchas

- This recovery branch bundles Personal Notes with admin/tutorial/performance/security work. Do not merge or deploy it as a single blob without review.
- Migration status in the linked Supabase project is unknown until explicitly checked.
- Security/performance migrations are high impact and need separate review before application.
- `binder-service.ts` still imports local demo/system content for bundled content and fallbacks; account-data paths should continue to reject local shadow saves.
- Old local sample binder IDs must not block real Supabase-backed binders.
- Admin organization drafts currently use local draft behavior; verify before treating as backend-persisted organization.
- Full visual QA is still needed for Personal Notes, workspace canvas, admin makeover, tutorial prompts, auth, and mobile layouts.

## Validation Process

Before deploy or merge, run:

- `npm.cmd run typecheck`
- `npm.cmd run test`
- `npm.cmd run build`
- `npm.cmd run verify:auth:live`

Add targeted tests based on changed area:

- Personal Notes model/service/page/schema tests.
- Auth and account-data safety tests.
- Security hardening tests.
- Workspace performance/responsive tests.
- Rich text editor tests.
- Dashboard/admin/tutorial tests.

Manual verification still matters for:

- Rendered auth page content.
- Personal Notes editor autosave/focus/search/filter/organization.
- Workspace drag/resize responsiveness.
- Mobile tab/module behavior.
- Admin dashboard animation/performance mode.
- Tutorial video prompt and modal behavior.
