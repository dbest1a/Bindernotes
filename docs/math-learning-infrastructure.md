# Math Learning Infrastructure

## What Was Added

BinderNotes now has a first production-oriented math learning layer for manual calculus modules, Jacob Math Notes modules, Desmos graphing, graph-state saving, question authoring, quizzes, and scored attempts.

This pass intentionally does not add payments, subscriptions, entitlement gates, LLMs, AI generation, chat, marketplace, or live games.

## Route Map

- `/math` - student-facing math landing page
- `/math/lab` - existing freeform math lab
- `/math/courses/:courseSlug` - course overview with topics and modules
- `/math/modules` - module index
- `/math/modules/:moduleSlug` - Desmos-powered module player
- `/math/questions` - manual question bank
- `/math/questions/new` - question editor
- `/math/questions/:questionId/edit` - edit existing question
- `/math/quizzes/:quizId` - quiz overview
- `/math/quizzes/:quizId/attempt` - quiz attempt and scored summary
- `/math/quizzes/:quizId/results/:attemptId` - results landing route

## Database Tables

Migration: `supabase/migrations/0011_math_learning_infrastructure.sql`

Added tables:

- `math_courses`
- `math_topics`
- `math_modules`
- `math_graph_states`
- `question_bank`
- `question_choices`
- `quiz_sets`
- `quiz_set_questions`
- `quiz_attempts`
- `question_attempts`

The migration is additive and non-destructive. RLS is enabled. Published modules/questions are readable, while user-created graph states, quiz sets, attempts, and private draft questions are scoped to the authenticated user.

## Desmos Integration Notes

Existing Desmos infrastructure was extended instead of replaced:

- `src/lib/desmos-loader.ts`
- `src/types/desmos.d.ts`
- `src/components/math/desmos-embed.tsx`
- `src/components/math/desmos-graph.tsx`

The app uses `VITE_DESMOS_API_KEY`, with optional compatibility for `NEXT_PUBLIC_DESMOS_API_KEY`. Calculator state from `getState()` is stored as opaque JSON and is never manually edited. Calculators call `destroy()` on unmount.

3D modules use `Desmos.Calculator3D` when available and show a safe fallback when the API key does not expose 3D.

The module player and the in-binder math workspace both expose a visible graph mode switch:

- `2D Graph` uses `Desmos.GraphingCalculator`
- `3D Graph` uses `Desmos.Calculator3D`

Workspace graph state is kept separately per mode so switching from a 2D function lab to a 3D surface lab does not overwrite the other mode's current state. Named saved graph snapshots also remember their calculator mode.

## Seed Data

Seed commands:

```bash
npm run seed:math
npm run verify:math-seed
```

Seed content includes:

- AP Calculus AB
- AP Calculus BC
- Calculus 1
- Calculus 2
- Calculus 3
- Jacob Math Notes

Published modules:

- Calc 1: Derivative as Slope
- Calc 2: Taylor Polynomial Explorer
- Calc 3: Surface and Tangent Plane Explorer
- Jacob Geometry: Transformations and Conics
- Jacob Algebra 2: Functions and Structure
- Jacob Precalculus: Trig, Complex Numbers, and Vectors
- Jacob Calculus: Tangents, Accumulation, and Series
- Jacob Multivariable: Surfaces and Vector Operators
- Jacob Linear Algebra: Transformations and Eigenvectors
- Jacob Differential Equations: Solution Behavior
- Jacob Real Analysis: Limits and Proof Habits

Seeds are deterministic and idempotent.

Jacob Math Notes is seeded as a learner-facing math course with topics for Geometry, Algebra 2, Precalculus, Calculus, Multivariable Calculus, Linear Algebra, Differential Equations, and Real Analysis. The original binder remains available as the readable note set, while the math course modules provide graph-first interactive entry points into the same conceptual arc.

## Quiz And Question Model

Manual questions support:

- multiple choice
- multiple select
- true/false
- short answer
- numeric
- free response
- fill blank
- matching
- step ordering

Scoring is app-side and lives in `src/lib/question-scoring.ts`.

Auto-scored now:

- multiple choice
- multiple select
- true/false
- numeric with tolerance
- short answer with normalization
- step ordering

Free response is stored without AI grading.

## Notes Integration

Simple View now exposes a small Linked Practice entry point for saved notes. If a note has been persisted and has a note ID, learners can create a math question linked to that note. If no saved note exists yet, the UI asks the learner to save notes first.

Deeper note-question management is intentionally left for a later pass so the existing document editor remains stable.

## How To Test

```bash
npm run typecheck
npm run test
npm run build
```

Manual verification:

- open `/math`
- open `/math/modules/derivative-as-slope`
- open `/math/modules/taylor-polynomial-explorer`
- open `/math/modules/surface-and-tangent-plane-explorer`
- open `/math/modules/jacob-multivariable-surfaces`
- switch the graph module between 2D Graph and 3D Graph
- save a graph state
- create a manual question
- build a quiz from selected questions
- complete a quiz attempt
- reopen existing binder/document pages

## Assumptions

- BinderNotes remains Vite + React + Supabase.
- Desmos API key remains client-exposed through Vite env.
- User-owned math data is scoped by `profiles.id`.
- Seed modules/questions are not user-private.
- No LLM or payment architecture is introduced in this phase.

## Remaining TODOs

- Add a richer quiz results history page that lists previous attempts by user.
- Add a safer read-only Desmos mode if the API supports the desired restrictions cleanly.
- Add optional graph thumbnails when storage policy is ready.
- Expand note-linked question management beyond the Simple View entry point.
- Add symbolic math equivalence later if a trusted non-LLM math engine is chosen.
