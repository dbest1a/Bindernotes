# BinderNotes Agent Instructions

Permanent rules for this project:

- Work only inside `C:\Users\kaich\Documents\Codex\bindernotes-clean-project` unless the user explicitly changes the workspace.
- Do not deploy, push, publish, create releases, or change production systems unless the user explicitly asks in that turn.
- Do not wipe, reset, migrate, reseed, or mutate Supabase data unless the user explicitly approves that exact operation.
- Do not print secrets. You may inspect whether env files exist and which variable names are present, but never echo values.
- Use real Supabase authentication and account behavior only. Do not reintroduce demo auth.
- Do not show demo binders inside real account workspaces.
- Never claim auth works from HTTP 200 alone. Live auth verification must inspect rendered page content.
- Personal Notes and binder-linked account data must remain user-owned and RLS-protected.
- Supabase-backed binders such as Jacob Math Notes must not be blocked only because old local sample IDs overlap.

Validation commands:

- `npm.cmd run typecheck`
- `npm.cmd run test`
- `npm.cmd run build`
- `npm.cmd run verify:auth:live`
- Targeted checks often needed before Personal Notes work:
  - `npm.cmd test -- src/lib/personal-notes.test.ts src/lib/personal-notes-schema.test.ts src/services/personal-notes-service.test.ts src/pages/personal-notes-page.test.tsx`
  - `npm.cmd test -- src/components/editor/rich-text-editor.test.tsx`
  - `npm.cmd test -- src/services/binder-service.account-data.test.ts src/lib/security-hardening.test.ts`

Style principles:

- BinderNotes should feel like a polished educational workspace for students: calm, organized, fast, useful, and premium.
- Avoid generic admin-dashboard styling, cramped developer-tool layouts, toy demo surfaces, fake content, and stock classroom imagery.
- Use clear typography, readable contrast, restrained panels, useful icons, calm motion, and layouts that help students scan and act.
- Keep marketing cinematic and premium, but keep the authenticated workspace practical and study-first.
- Mobile layouts must be touch-friendly, non-overlapping, and readable without hiding the core workflow.

Performance rules:

- Treat lag as a product bug.
- Avoid mounting heavy modules unnecessarily; lazy-load rich editors, math blocks, diagnostics, whiteboard/canvas tools, and media surfaces when possible.
- Drag and resize interactions should avoid React state updates on every pointer move; prefer refs, direct style updates, and requestAnimationFrame throttling.
- Pause or reduce decorative motion during scrolling, dragging, reduced-motion, and performance mode.
- Verify important UI changes visually on desktop and mobile before deploy.
