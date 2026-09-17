# Dependency review — 17 September 2026

Baseline:1,074 tests, both TypeScript projects and production build passed before changes. npm audit originally reported48 entries (12high,33moderate,3low). Compatible lockfile updates and existing narrowly scoped overrides reduced that to1low; no moderate/high/critical entries remain in the recorded audit. Counts describe advisories, not proven application exploits.

Updated existing major lines for React Router, Vite, Vitest, DOMPurify, Mermaid and transitive dependencies. All TipTap extensions/core/PM are aligned on3.31.3; core and PM are explicit dependencies because application code imports them directly. Existing NanoID overrides remain scoped to Excalidraw's respective major versions. The official Stripe22.6.2 SDK is a new server-only dependency for BE17. React/framework/database/payment provider were not replaced.

Reachability review:

- TipTap's HTML attribute/prototype advisory affects a relevant rich-editor/import boundary; upgraded past the patched3.30.4 release. Import validation also rejects prototype/event-handler attributes. [Advisory](https://github.com/advisories/GHSA-cp6q-959q-f8rh).
- Router redirect and Vite Windows dev-server advisories were patched within existing major versions; routing/auth/dev build paths are used by this project. [Router advisory](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6), [Vite advisory](https://github.com/advisories/GHSA-fx2h-pf6j-xcff).
- NanoID fixes stay compatible with the major required by each Excalidraw dependency. [Advisory](https://github.com/advisories/GHSA-2v37-7h3g-55p8).
- Residual: esbuild0.27.7, low [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), concerns the esbuild serve API on Windows. This repository invokes Vite's dev server and esbuild transform/build; it does not invoke esbuild serve. Do not expose a separate esbuild serve instance. A0.28 override would cross the upstream compatible range; it was not applied blindly. Revisit when Vite/tsx select the patched release.

Clean lockfile `npm ci --ignore-scripts --no-audit --no-fund` passed after aligning TipTap. Old nested TipTap peer versions were removed from lock resolution, not suppressed through legacy peer resolution. Excalidraw's older Radix packages still declare React18 peer ranges; actual React19 browser/editor/whiteboard checks are required and no peer compatibility claim is inferred from install success.

Post-update broad run:1,288 tests passed and two layout-source checks failed because they prohibited the newly required board-identity key. Those checks were replaced with stronger actual canvas-instance resize/menu/board-switch assertions;17 focused tests pass. Production client build passed, preserving its auth environment guard. Final integrated checks and browser evidence are tracked in `BINDERNOTES_REMEDIATION.md`.
