# Current Work

## Active Branch / Model

- Branch: `recovery/personal-notes-from-live-good`
- Model: Personal Notes from LiveGood
- Current goal: understand the recovery branch, document the project state, and wait for the next coding instruction.

## Current Status

This branch is a recovery/integration branch for Personal Notes plus bundled dashboard/admin/tutorial/performance/security work. It should be treated as review-needed before merge or deploy.

## Files To Inspect Before Coding

Core:

- `package.json`
- `README.md`
- `src/App.tsx`
- `src/types.ts`
- `src/styles.css`

Personal Notes:

- `src/pages/personal-notes-page.tsx`
- `src/lib/personal-notes.ts`
- `src/hooks/use-personal-notes.ts`
- `src/services/personal-notes-service.ts`
- `supabase/migrations/0016_personal_notes_workspace.sql`

Editor/workspace:

- `src/components/editor/rich-text-editor.tsx`
- `src/components/workspace/study-core-modules.tsx`
- `src/components/workspace/lesson-content-renderer.tsx`
- `src/components/workspace/workspace-window.tsx`
- `src/components/workspace/windowed-workspace.tsx`
- `src/components/workspace/workspace-settings.tsx`
- `src/lib/workspace-preferences.ts`
- `src/lib/workspace-layout-engine.ts`
- `src/lib/workspace-preset-designs.ts`

Auth/data safety:

- `src/hooks/use-auth.tsx`
- `src/pages/auth-page.tsx`
- `src/services/binder-service.ts`
- `src/services/binder-service.account-data.test.ts`
- `scripts/verify-live-auth.mjs`
- `vercel.json`

Dashboard/admin/tutorial/performance/security:

- `src/pages/dashboard-page.tsx`
- `src/components/dashboard/admin-dashboard-makeover.tsx`
- `src/pages/admin-studio-page.tsx`
- `src/components/tutorials/tutorial-prompt.tsx`
- `src/components/tutorials/tutorial-video-modal.tsx`
- `src/lib/tutorials/tutorial-registry.ts`
- `src/lib/tutorials/tutorial-preferences.ts`
- `src/services/tutorial-service.ts`
- `src/hooks/use-performance-mode.tsx`
- `src/lib/performance-mode.ts`
- `src/lib/performance-marks.ts`
- `src/lib/security-hardening.test.ts`
- `supabase/migrations/0018_backend_performance_layer.sql`
- `supabase/migrations/0019_security_hardening_rls.sql`
- `supabase/migrations/0020_supabase_security_advisor_lint_cleanup.sql`
- `supabase/migrations/0021_lock_profile_and_purchase_client_privileges.sql`
- `supabase/migrations/0022_supabase_performance_advisor_cleanup.sql`

## Do Not Touch Without Explicit Approval

- Deployments, Vercel production, publishing, releases, or Git pushes.
- Supabase data, migrations, resets, wipes, reseeds, or production schema changes.
- Secrets or env values.
- Demo auth or demo binders in real account flows.
- Destructive Git operations.

## Review Needed Before Implementation

- Whether this recovery branch becomes the main working branch.
- Whether Personal Notes should merge as-is or be split from admin/tutorial/security/performance changes.
- Whether migrations `0016` through `0022` have already been applied.
- Whether "LiveGood" means a style, content model, workflow, or just a recovery point.
- Whether annotation comment/tag/source/link marks need full TipTap persistence before shipping.
- Visual review for Personal Notes, mobile layouts, workspace modules, dashboard/admin, tutorials, auth, and homepage.
- Performance review for drag/resize, heavy module mounting, dashboard animation, and editor autosave.
