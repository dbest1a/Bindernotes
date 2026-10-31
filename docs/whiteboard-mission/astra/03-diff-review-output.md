The baseline is useful for finding stalls, but several defects prevent treating its budgets as acceptance evidence.

Reviewed through `4aeeb1f`, including `whiteboard-audit-screens.mjs`. This was a static review: no files changed, no workloads/builds/tests or network requests run, and no `.env*` files opened.

1. **High — Repeated opens can seed the wrong board and omit the Desmos key.**  
   [whiteboard-perf.mjs:154](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:154) adds another persistent initialization script on every call. Earlier scripts replay on subsequent navigations, and their execution order is unspecified. Comparing payload **length** at line 158 also permits collisions between different boards.

   The early return precedes key injection, so reopening an unchanged board can leave the new document without its runtime key. Separately, `labs` receives a fresh context but never calls `openBoard`, so it never receives that key; Vite’s environment fallback can mask both defects.

   **Minimal fix:** install one origin-scoped initialization script per context; inject the key independently on every document; seed using an exact payload/version; modify only fixture storage keys. Assert the loaded board’s identity, element count, and graph count.

2. **High — The “60 fps drop share” is not a 60 Hz dropped-frame measurement.**  
   [whiteboard-perf.mjs:125](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:125) divides intervals above 16.7 ms by **all observed rAF intervals**. At approximately 230 callbacks/second, short intervals dilute long stalls. A 100 ms stall also counts only once.

   The [4× drawing baseline](C:/Users/User/Documents/ChatGPT/Bindernotes/docs/whiteboard-mission/perf/baseline-2026-10-31T15-27-25-334Z.md:13) illustrates this: p95 is 4.4 ms despite 316 intervals above 33 ms and 219 long animation frames.

   **Minimal fix:** rename this “share of observed rAF intervals above 16.7 ms.” Report stall duration per second and observed cadence. Use a verified 60 Hz presentation environment before claiming 60 Hz compliance; rAF callbacks alone do not establish displayed frames.

3. **High — The memory instrumentation retains destroyed calculators.**  
   [e2e/fixtures/desmos-loader.ts:10](C:/Users/User/Documents/ChatGPT/Bindernotes/e2e/fixtures/desmos-loader.ts:10) permanently stores each calculator in `window.__desmosChecks`. Destruction changes a flag but never releases that reference. Consequently, the [post-GC comparison](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:388) includes objects retained by the test itself.

   The flag is also set **before** the real `destroy()` returns. “11 created, 10 destroyed” establishes wrapper-call balance, not successful disposal or collection.

   **Minimal fix:** retain scalar diagnostics for destroyed instances and references only to live instances; remove references after successful destruction. Warm up, compare equivalent settled states, and measure several cycle batches. The reported +3.14/+2.56 MB cannot currently establish a product leak.

4. **High — Failed or unmeasured scenarios can evade the budgets.**  
   [whiteboard-perf.mjs:427](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:427) converts exceptions into results that receive no corresponding budget checks. Page errors do not invalidate results; `sliderMoved:false` is merely a note. At [line 449](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:449), missing Event Timing data passes through `null → 0`. Unsupported LoAF observation can similarly resemble zero long frames.

   **Minimal fix:** record explicit valid/failed/skipped/unsupported states, check `PerformanceObserver.supportedEntryTypes`, require scenario postconditions, produce failure rows for required missing measurements, and return a failing exit status. Validate scenario names, positive finite throttle values, and stroke counts before launching.

5. **High for the claimed conclusion — Pointer-to-rAF does not establish visible ink latency.**  
   [whiteboard-perf.mjs:78](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:78) measures pointer timestamps against the instrumentation loop’s next rAF timestamp. That callback can precede the application’s canvas update in the same frame. It does not observe ink consumption, canvas completion, or presentation, and it includes positioning moves outside active drawing.

   **Minimal fix:** label it a pointer-to-rAF scheduling proxy; restrict drawing measurements to active strokes; record coalesced input and delivered cadence. Use callback-time `performance.now()` for callback latency, and separately instrument ink commit/presentation before claiming “ink stays glued.”

6. **Medium — “Warm interactive” uses inconsistent clocks and readiness criteria.**  
   [whiteboard-perf.mjs:348](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:348) starts the study-workspace timer **after** the warm navigation resolves. Other timers include navigation. Math Lab waits only for a heading; chemistry accepts sufficiently long text without “Loading” ([line 373](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:373)). Those conditions can accept shells or fallback UI.

   Furthermore, the chemistry `chem-desmos-*` components actually render a [Sparkline fallback](C:/Users/User/Documents/ChatGPT/Bindernotes/src/components/chemistry/chemistry-workspace-modules.tsx:1140), not live calculators. Opening Math Lab also does not open each guided math demo.

   **Minimal fix:** start every timer before navigation; distinguish shell-ready from feature-ready; verify usable controls/runtime per case. Report reload-with-warm-caches separately from reopening inside the running application. Repeat cases and report median/p95.

7. **Medium — The advertised 120 Hz workload slows down with the application.**  
   [whiteboard-perf.mjs:251](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:251) awaits each Playwright move and then sleeps eight milliseconds. Browser processing, protocol round trips, input synchronization, and Windows timer scheduling extend that interval.

   The JSON records 3,400 drawing moves over 57,018 ms at 1× versus 98,969 ms at 4×: approximately 60 versus 34 moves/second across the scenario. Thus a slower application receives input more slowly, understating backlog and latency.

   **Minimal fix:** describe this as a paced mouse workload, report actual event intervals and coalescing, and distinguish fixed-work from fixed-rate tests. For fixed-rate testing, record intended deadlines and late delivery rather than silently extending the workload.

8. **Medium — LoAF script and render figures are overlapping phases.**  
   [whiteboard-perf.mjs:95](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:95) measures `renderStart → end`, which includes rendering-phase JavaScript such as rAF callbacks. Summing script durations therefore overlaps that interval. `styleAndLayoutStart → end` is another nested phase.

   These figures cover only long animation frames and do not measure total script work or GPU/compositor cost.

   **Minimal fix:** label them as overlapping, LoAF-only attribution. Do not add them together or interpret “0 / 0” as no script/render work. Use phase-aware attribution or a suitable sanitized trace for a disjoint breakdown.

9. **Medium — Measurement boundaries mix idle time with interaction and miss deferred work.**  
   [whiteboard-perf.mjs:89](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:89) includes observer entries according to callback-delivery time, rather than entry timestamps. `stop()` does not drain pending records.

   The [300 ms tail](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:223) dilutes frame distributions with idle callbacks yet ends before the product’s [1500 ms autosave debounce](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/whiteboards/whiteboard-limits.ts:9).

   **Minimal fix:** timestamp action boundaries, classify entries by those timestamps, drain observers, and report active interaction and settling/save work separately. Wait for observable save completion in the latter.

10. **Medium — Scenario execution needs stronger postconditions and representative coverage.**  
    [whiteboard-perf.mjs:179](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:179) returns an unchecked fallback point. Pan paths validate only their starting point and can leave the viewport. Tool selectors depend on exact English titles; tool selection, camera movement, zoom changes, and final stroke count are not asserted. Chemistry enumeration can silently return no cases before rendering completes.

    **Minimal fix:** reject missing valid points, constrain complete paths, use stable selectors, and assert each action’s outcome and expected case count. Reset a separate input RNG per scenario.

    The workload is useful stress coverage, with these realism limits:

    - Drawing consists of repeated short sine strokes with mouse input, without pen pressure or tilt.
    - The 320 objects are scattered across 5200×3600 units; this is not a viewport densely filled with notes.
    - Pan, Ctrl-wheel zoom, and wheel scrolling share one result, hiding which operation regresses.
    - Slider formulas are plausible, but successive passes jump back along the track.
    - Tool cycling without using each tool is a stress sequence rather than a study session.

    Add representative handwriting, dense visible content, continuous slider sweeps, and separate camera-operation results.

11. **Medium — Development and automation overhead can dominate profile conclusions.**  
    The [fixture configuration](C:/Users/User/Documents/ChatGPT/Bindernotes/e2e/fixtures/lab.vite.config.ts:7) runs through Vite/React development tooling. The available [profile summary](C:/Users/User/Documents/ChatGPT/Bindernotes/docs/whiteboard-mission/perf/profile-4x-2026-10-31T15-40-56-146Z.json:50) attributes 2141 ms to `exports.jsx`; other entries include Playwright selector work.

    [CPU labels](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:193) also discard directory paths and columns, potentially merging different functions. Raw profiler locations are not necessarily original TypeScript locations.

    **Minimal fix:** confirm important findings against an isolated production-mode fixture. Preserve sanitized relative paths/columns, resolve source maps, record profile duration and sampling configuration, and separate profiled diagnostic runs from unprofiled budget runs.

12. **Medium — Screenshot failures can be presented as successful evidence.**  
    [whiteboard-audit-screens.mjs:50](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-audit-screens.mjs:50) suppresses a calculator-ready timeout, then captions the screenshot “Live Desmos card.” Conditional branches silently omit expected screenshots. Most sessions’ page errors are discarded, and cleanup lacks `finally`.

    **Minimal fix:** record failed/skipped captures explicitly; require readiness for “live” captions; collect errors from every session; close browser resources in `finally`. The 390 px viewport is useful responsive-layout coverage, but does not simulate touch/mobile input behavior.

13. **Low, conditional — Safety guarantees exceed the enforced boundaries.**  
    [Configurable URLs and initialization](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:154) are not restricted to the intended origin/top frame; only `about:` is excluded. A redirect or incorrect fixture server can therefore receive the runtime key and storage initialization.

    There is no direct key logging, but [raw exception messages](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-perf.mjs:412) enter reports, and [screenshot errors](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/perf/whiteboard-audit-screens.mjs:64) enter the README and console. An error containing a key-bearing URL would be persisted. I found no demonstrated leak.

    **Minimal fix:** enforce loopback/fixture identity and top-frame initialization, reject backend/auth traffic, and redact the resolved key and `apiKey` parameters at every output boundary.

What I verified as sound:

- **Intended fixture isolation:** [lab aliases](C:/Users/User/Documents/ChatGPT/Bindernotes/e2e/fixtures/lab.vite.config.ts:12) select the null Supabase client and fixture auth. [Authentication methods throw](C:/Users/User/Documents/ChatGPT/Bindernotes/e2e/fixtures/auth.tsx:15); session/user are null. Under those configs, saves use local storage and no credentials are entered. Fresh contexts import no account session.
- **No fixture-auth leakage into the standard production build:** [build-client.mjs:18](C:/Users/User/Documents/ChatGPT/Bindernotes/scripts/build-client.mjs:18) explicitly selects root Vite configuration, whose alias points to `src`. No fixture imports were found in the normal application graph. TypeScript includes `src` only. Precisely, `vite.config.ts`’s `e2e` exclusion is for **Vitest**, not Rollup; production omission follows from the entry/import graph.
- **Key handling on normal paths:** the resolver does not write the key; reports store an availability boolean. No trace/HAR recording is enabled, raw CPU profiles are not saved, and source URL queries are stripped. The [Desmos loader](C:/Users/User/Documents/ChatGPT/Bindernotes/src/lib/desmos-loader.ts:137) necessarily sends the client key to Desmos in its script URL; an unconditional “never reaches disk” guarantee is not established.
- **rAF calculations:** adjacent timestamp subtraction, quantiles, and counts correctly summarize the observed callback intervals.
- **Event Timing aggregation:** grouping by `interactionId`, taking its longest event, then the maximum interaction is sound for a short-run worst **discrete-interaction proxy**. It is not page-lifetime INP; durations are quantized, entries below the requested threshold are absent, and continuous pointermove/wheel latency is not covered.
- **GC counters:** the double-GC sequence and heap/DOM/listener/document reads are appropriate snapshots once the retention defect is fixed. They are not total browser, worker, or GPU memory.
- **CPU accumulation:** weighting self samples by `timeDeltas` and walking ancestors for inclusive attribution is structurally sound. Inclusive rows overlap and must not be summed; sampled milliseconds are estimates.
- **Useful action checks:** real canvas readiness and the revised slider’s expression comparison are meaningful. The corrected slider report records movement; the initial slider/memory timeout rows remain failed measurements.

The baseline can guide Phase A investigation into drawing commits, pan/zoom work, and tool interactions. It cannot yet support claims of 60 Hz compliance, ≤20 ms visible ink latency, calculator leakage, or comparable warm-open performance. Preserve it as preliminary evidence from a synthetic, development-mode, uncapped-headless desktop run; 4× CPU throttling does not establish “typical student laptop” behavior. Fix the affected measurements and recapture the baseline before claiming quantitative improvements.