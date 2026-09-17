# Math content audit — 17 September 2026

Scope: all **54 Jacob section practice questions**, their answer keys and explanations, plus all **17 overview practice questions** in `math-learning-seeds.ts` (71 total). This is a code/content review, not a teacher sign-off, curriculum accreditation, comprehensive proof review, or evidence of learning outcomes. Interactive graphs have not been visually certified by this audit.

## Findings and corrections

- All nine Jacob numeric answers agree with independently evaluated formulas: inverse tangent 36.8698976° (key 36.87, tolerance 0.05), arc length 10, geometric sum 15, vector norm 5, FTC difference 7, logistic capacity 20, dot product 1, determinant 5, sequence limit 1. The three overview numeric keys (6, 10, 1) also agree. No numeric answer was changed merely to match the implementation.
- The angle-bisector graph used D=(2,0), which does not bisect the angle for its chosen vertices. D now uses the adjacent-side length ratio; an independent test verifies that ratio. The practice prompt now specifies the vertex, internal bisector, and ordered ratio.
- The derivative ordering exercise ambiguously began with an average rate of change, then divided by h again. It now forms the numerator, divides once by nonzero h, then takes the limit. [OpenStax derivative definition](https://openstax.org/books/calculus-volume-1/pages/3-1-defining-the-derivative).
- Eigenvector feedback no longer claims direction is always preserved. Negative real eigenvalues reverse it; zero eigenvalues map to zero. The prompt requires v≠0. This follows directly from Av=λv. [MIT eigenvalue definition](https://www.ocw.mit.edu/ans7870/18/18.013a/textbook/HTML/chapter04/section06.html).
- The uniform-convergence graph x/n was missing a domain restriction. It now specifies [-5,5], where sup|x/n|=5/n→0. It explicitly states that convergence is not uniform on all of R: choosing x=n gives error 1 for every n.
- Cross-product direction now requires nonparallel, nonzero vectors and includes the right-hand rule; the zero cross product has no direction. [OpenStax cross product](https://openstax.org/books/calculus-volume-3/pages/2-4-the-cross-product).
- Added missing domains/conditions for real fractional powers, logarithms, parametric derivatives, logistic growth, average value, regular Lagrange constraints, real SVD, and the source-free constant-diffusivity heat equation. The Lagrange condition is necessary under its regularity assumptions, not sufficient for an optimum. [OpenStax Lagrange multipliers](https://openstax.org/books/calculus-volume-3/pages/4-8-lagrange-multipliers).
- The Taylor multiple-choice prompt excludes the tie at x=0. The qualitative prompt says approximation *can* worsen farther from the center, without promising monotonic error.

## Question ledger

Each row covers both questions in that section. “Review” denotes a reviewed mathematical explanation whose learner response still requires human/self review; the application does not evaluate its meaning.

| Section | First answer or review concept | Second answer or review concept |
|---|---|---|
| 01 | 90° CCW: (-2,3) | Review: distances triple |
| 02 | AAA congruence: false | BD:DC=2:3 |
| 03 | arctan(3/4)=36.8698976° | 1:1:√2 |
| 04 | Segment point (2,-2) | Focus/directrix definition: true |
| 05 | Arc length 10 | Law of Sines applies beyond right triangles |
| 06 | (a-b)(a²+ab+b²) | Sum 15 |
| 07 | x√x for x≥0 | log_b x + log_b y, positive arguments |
| 08 | Review: h/k translations | (cos θ,sin θ) |
| 09 | f(g(x)) | Polar angle controls direction: true |
| 10 | Vector magnitude 5 | n!/[r!(n-r)!], integers 0≤r≤n |
| 11 | Review: punctured-neighborhood behavior | Difference, quotient, limit |
| 12 | 5x⁴ | f'g+fg' |
| 13 | Review: local tangent estimate | Standard MVT requirements: true |
| 14 | FTC: 8−1=7 | Inner function derivative pattern |
| 15 | Capacity 20 for k>0 | Integral divided by b−a, a<b |
| 16 | y'(t)/x'(t), x'≠0 | x−x³/6 |
| 17 | Dot product 1 | Review: perpendicular/right-hand direction |
| 18 | (f_x,f_y,f_z) | Review: first derivative matrix |
| 19 | ∇f=λ∇g with regular constraint | Review: boundary/region integral relation |
| 20 | Determinant 5 | Zero determinant invertible: false |
| 21 | Av=λv, v≠0 | Review: independent spanning coordinates |
| 22 | Review: squared residual minimum | Real SVD A=UΣVᵀ |
| 23 | exp(∫p dx) | u_t=k u_xx with constant k>0 |
| 24 | Least upper bound | Review: real supremum exists |
| 25 | Sequence limit 1 | ε, δ, input bound, output bound |
| 26 | Review: one N for every domain point | Convergence of ΣM_n |
| 27 | Finite integral, upper endpoint limit, evaluation | Review: remainder measures error |

Independent executable fixtures in `src/lib/math-curriculum-audit.test.ts` cover every ID, calculate numeric oracles without reading stored keys, and test selected algebra identities and the diagram counterexample. The test verifies that review items are not marked automatically correct. It does **not** establish that arbitrary student text is correct. The reviewed overview keys cover derivative meaning/slope, tangent motion, sine Taylor polynomials, partial derivatives/tangent plane, dilation, transformations, unit-circle coordinates, local approximation, determinant interpretation, logistic capacity, and sequence limits.

## Provenance and coverage limits

The historical `jacob-math-notes-coverage.md` says these modules were derived from an uploaded `Jacob's Math Notes (1).docx`. That document, its immutable hash/version, precise page references, and reuse permission have not been verified in this remediation workspace. Historical subsection names establish an intended outline, not independently verified provenance. Generated module metadata now says “starter; provenance pending” and explains the limit in the learner-facing source section. Do not claim the source rights or all source content were audited.

AP AB and BC currently have course rows but no seed topics/modules of their own. Calculus 1, 2 and 3 each have one starter module. Jacob has eight broad overview modules plus 27 section modules with two section questions each. Course descriptions now state these limits. This is not complete high-school, university, or exam coverage. Completing coverage requires explicit objectives, prerequisite sequencing, more varied questions, misconceptions, proof/problem review, and a qualified educator's check against a specified curriculum.

Short-answer scoring compares accepted strings after limited normalization. It does not prove symbolic equivalence or understand alternative correct wording. The question and feedback UI now disclose this. Free responses can receive completion credit but never an automatic correctness label; result totals disclose that distinction. Existing persisted content will retain its historical values until a separately authorized seed/update is applied. No production content was changed by this audit.
