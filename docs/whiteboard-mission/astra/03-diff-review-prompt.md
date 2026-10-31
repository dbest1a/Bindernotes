# Pre-checkpoint diff review: whiteboard performance harness and lab fixture

> **Workspace authorization:** the user explicitly authorized `C:\Users\User\Documents\ChatGPT\Bindernotes` as the workspace for this mission. It supersedes the historical `C:\Users\kaich\...` path in AGENTS.md, which does not exist on this machine. Proceed without asking; every other AGENTS.md rule still applies.

You are GPT-6 Astra, the independent reviewer on this mission. Read-only sandbox: read code, write nothing, do not run anything that writes, do not use the network, and never open `.env*` files or print any key.

Review the lead's (Claude Opus 5.5) diff on branch `whiteboard/best-on-internet`:

```
git diff b6c5519..HEAD -- scripts/perf e2e/fixtures
```

Also review the uncommitted `scripts/perf/whiteboard-audit-screens.mjs`.

This diff has no product code yet. It is a performance harness (`scripts/perf/whiteboard-perf.mjs`, `scripts/perf/desmos-key.mjs`) and an isolated lab fixture (`e2e/fixtures/lab.*`, `e2e/fixtures/auth.tsx`). The baseline numbers it produced are in `docs/whiteboard-mission/perf/baseline-*.md`.

## Check, with file:line evidence

1. **Measurement validity.** Do the metrics measure what they claim?
   - frame intervals from `requestAnimationFrame`;
   - the 60 Hz drop share, given that headless GPU Chrome does not cap `requestAnimationFrame` at 60 Hz here;
   - Long Animation Frame script and render split;
   - the Event Timing interaction maximum as an INP proxy;
   - pointermove → next-frame latency as an ink-lag proxy;
   - heap and DOM counters after garbage collection;
   - live versus destroyed Desmos calculators;
   - CPU-profile self and inclusive attribution.
   Point out biases, such as Playwright's input pacing, coalescing, timer resolution on Windows, the 300 ms tail, or synthetic elements that are unrealistic, and what to change.
2. **Scenario realism.** Do the stroke shape, pan paths, wheel zoom, slider drag, tool switches and warm-open method reflect real student use? Is "open each demo" measured fairly?
3. **Safety.**
   - Can anything here sign in, call Supabase, or write account data?
   - Is the Desmos key ever logged, written to disk, or recorded in a trace or report?
   - Does the fixture auth stub leak into the production build or the normal app? `e2e/` is excluded from the build; verify.
4. **Correctness bugs in the harness:** seeding guards, `addInitScript` ordering, the `sessionStorage` reseed check, selectors, error handling, budget evaluation.

Report findings most severe first: file:line, severity, what goes wrong, and a minimal fix. Also list what you verified as sound. End with whether the baseline numbers can be trusted as a basis for Phase A fixes, and any caveats to state alongside them.
