# Authenticated browser journeys

These tests require the disposable Linux Supabase environment prepared by `scripts/ci/supabase-check.mjs clean`. The fixture creates actual Auth accounts for two learners, a paid creator and an operator, applies the migrations and seeds the study catalog. The manifest must point to localhost; hosted backends are rejected. No authenticated browser storage or successful API responses are manufactured.

`notes-auth.spec.ts` covers note creation, reload/navigation persistence, account isolation, unsigned access and operator-route denial. `authenticated-journeys.spec.ts` adds quiz result reopening, canonical review rating/scheduling across a fresh browser context, private course trash/restore, creator publishing and role separation, narrow-screen account navigation, and the empty course state. Each run requires a fresh disposable fixture; tests deliberately leave their created records for the lifetime of that fixture.

The added journeys were **not browser-executed locally on 2026-09-17**. Type checking, lint and Playwright test discovery are separate static checks and do not prove that these browser journeys pass. The clean-baseline Linux CI job is configured to execute them; its result must be recorded before claiming browser coverage. Local interactive CUA checks are reported separately and are not substitutes for running this suite.
