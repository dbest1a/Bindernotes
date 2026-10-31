# Whiteboard perf: baseline-desmos-labs (2026-10-31T15:38:53.349Z)

GPU: ANGLE (NVIDIA, NVIDIA GeForce RTX 5090 (0x00002B85) Direct3D11 vs_5_0 ps_5_0, D3D11); cores: 32; real Desmos: true; viewport 1440×900; pointer interval 8 ms

| Scenario | frames | >16.7ms | >33ms | p95 frame | max frame | LoAF >50ms (max) | LoAF script / render ms | ptr→frame p95 | worst interaction | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| slider@1x | 988 | 0 (0%) | 0 | 4.3 | 16.6 | 0 (0) | 0 / 0 | 3.9 | 16 |  |
| memory@1x | {"before":{"heapMB":28.78,"nodes":1456,"listeners":619,"documents":5},"after":{"heapMB":31.92,"nodes":1469,"listeners":626,"documents":5},"heapGrowthMB":3.14,"nodeGrowth":13,"listenerGrowth":7,"calculators":{"created":11,"destroyed":10},"liveCalculators":1,"pageErrors":[]} ||||||||||
| labs@1x | {"mathWhiteboardLab":{"warmReadyMs":252},"mathLab":{"warmReadyMs":115},"chem-concept-cards":{"warmReadyMs":388},"chem-quick-tools":{"warmReadyMs":383},"chem-periodic-table":{"warmReadyMs":446},"chem-element-builder":{"warmReadyMs":383},"chem-electron-config-builder":{"warmReadyMs":388},"chem-periodi ||||||||||
| slider@4x | 1181 | 31 (2.63%) | 1 | 16.6 | 41.6 | 0 (0) | 0 / 0 | 3.9 | 40 |  |
| memory@4x | {"before":{"heapMB":29.43,"nodes":1460,"listeners":619,"documents":5},"after":{"heapMB":31.99,"nodes":1469,"listeners":626,"documents":5},"heapGrowthMB":2.56,"nodeGrowth":9,"listenerGrowth":7,"calculators":{"created":11,"destroyed":10},"liveCalculators":1,"pageErrors":[]} ||||||||||
| labs@4x | {"mathWhiteboardLab":{"warmReadyMs":1346},"mathLab":{"warmReadyMs":495},"chem-concept-cards":{"warmReadyMs":587},"chem-quick-tools":{"warmReadyMs":630},"chem-periodic-table":{"warmReadyMs":1198},"chem-element-builder":{"warmReadyMs":759},"chem-electron-config-builder":{"warmReadyMs":649},"chem-perio ||||||||||

## Budgets

| Check | Scenario | Value | Pass |
| --- | --- | --- | --- |
| 60 fps: ≤1% frames over 16.7 ms | slider@1x | 0% (0) | ✅ |
| no frame > 33 ms | slider@1x | 0 | ✅ |
| no LoAF > 50 ms | slider@1x | 0 | ✅ |
| ink/pointer → frame p95 ≤ 20 ms | slider@1x | 3.9 | ✅ |
| no growth after 10 open/close (heap ≤ +1 MB, 0 live extra calculators) | memory@1x | 3.14 MB, 1 live | ❌ |
| warm interactive ≤ 1000 ms | labs@1x:mathWhiteboardLab | 252 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:mathLab | 115 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-concept-cards | 388 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-quick-tools | 383 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-periodic-table | 446 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-element-builder | 383 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-electron-config-builder | 388 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-periodic-trends-graph | 384 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-molecule-builder | 387 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-geometry-viewer | 384 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-reaction-balancer | 392 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-tri-reaction-view | 375 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-lab-coach | 383 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-stoichiometry-coach | 379 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-molar-mass-calculator | 384 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-solution-mixer | 389 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-molarity-calculator | 379 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-desmos-concentration-graph | 384 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-ph-calculator | 381 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-titration-lab | 383 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-desmos-titration-curve | 380 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-kinetics-simulator | 379 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-desmos-kinetics-plot | 393 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-data-table | 387 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-calorimetry-lab | 379 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-energy-diagram | 391 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-calculation-sheet | 383 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-safety-cards | 378 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-review-queue | 380 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-lab-notebook | 383 | ✅ |
| warm interactive ≤ 1000 ms | labs@1x:chem-reference-safety | 380 | ✅ |
| 60 fps: ≤1% frames over 16.7 ms | slider@4x | 2.63% (31) | ❌ |
| no frame > 33 ms | slider@4x | 1 | ❌ |
| no LoAF > 50 ms | slider@4x | 0 | ✅ |
| ink/pointer → frame p95 ≤ 20 ms | slider@4x | 3.9 | ✅ |
| no growth after 10 open/close (heap ≤ +1 MB, 0 live extra calculators) | memory@4x | 2.56 MB, 1 live | ❌ |
| warm interactive ≤ 1000 ms | labs@4x:mathWhiteboardLab | 1346 | ❌ |
| warm interactive ≤ 1000 ms | labs@4x:mathLab | 495 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-concept-cards | 587 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-quick-tools | 630 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-periodic-table | 1198 | ❌ |
| warm interactive ≤ 1000 ms | labs@4x:chem-element-builder | 759 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-electron-config-builder | 649 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-periodic-trends-graph | 650 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-molecule-builder | 622 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-geometry-viewer | 612 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-reaction-balancer | 630 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-tri-reaction-view | 629 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-lab-coach | 630 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-stoichiometry-coach | 594 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-molar-mass-calculator | 599 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-solution-mixer | 687 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-molarity-calculator | 601 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-desmos-concentration-graph | 627 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-ph-calculator | 642 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-titration-lab | 612 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-desmos-titration-curve | 626 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-kinetics-simulator | 683 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-desmos-kinetics-plot | 596 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-data-table | 608 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-calorimetry-lab | 617 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-energy-diagram | 600 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-calculation-sheet | 588 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-safety-cards | 602 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-review-queue | 667 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-lab-notebook | 583 | ✅ |
| warm interactive ≤ 1000 ms | labs@4x:chem-reference-safety | 603 | ✅ |
