# Jacob Math Notes Coverage Ledger

This ledger was created from the uploaded `Jacob's Math Notes (1).docx` source and the current BinderNotes repo state.

## Source Audit

- Uploaded DOCX extraction: 3,902 non-empty paragraphs, about 302k characters.
- Source starts with HS Geometry and continues through Algebra 2, PreCalculus, Calculus, Multivariable Calculus, Linear Algebra, Differential Equations, and Real Analysis.
- Current BinderNotes learner binder already had 27 Jacob lesson records.
- Before this pass, the math-learning infrastructure only had 8 broad Jacob module cards and 8 Jacob-specific seeded practice questions.
- The missing product layer was not the binder lesson list. It was full coverage inside math modules, formula cards, graph/demo cards, linked practice, related concepts, and explicit coverage tracking.

## Current Coverage Model

Structured source of truth: `src/lib/jacob-math-coverage.ts`

Generated from that source:

- 27 published Jacob math modules.
- 54 linked practice questions, at least two per section.
- Formula/theorem card metadata for every section.
- Graph/demo card metadata for every section, using only 2D and 3D.
- Related concepts for every section.
- Preset recommendation for every section.

## Section Ledger

| # | Section | Binder lesson | Math module slug | Source coverage | Formula cards | Graph cards | Practice | Preset | Remaining TODO |
|---|---|---|---|---|---:|---:|---:|---|---|
| 01 | Geometry Language, Rigid Motions, and Dilation | `lesson-jacob-geometry-foundations` | `jacob-01-geometry-language-rigid-motions-dilation` | Terms, rigid transformations, dilation | 2 | 1 | 2 | Math Guided Study | Arbitrary center dilation controls |
| 02 | Triangle Congruence, Similarity, and Angle Bisectors | `lesson-jacob-triangles-similarity` | `jacob-02-triangle-congruence-similarity-angle-bisectors` | Congruence, similarity, angle bisector theorem | 2 | 1 | 2 | Math Proof / Concept Mode | Visual proof cards for each postulate |
| 03 | Right-Triangle Trig, Inverse Trig, and Special Triangles | `lesson-jacob-right-triangle-trig` | `jacob-03-right-triangle-trig-inverse-trig-special-triangles` | SOHCAHTOA, inverse trig, special triangles, elevation/depression | 2 | 1 | 2 | Math Graph Lab | Triangle diagram controls |
| 04 | Coordinate Geometry, Segment Division, and Conic Basics | `lesson-jacob-circles-conics` | `jacob-04-coordinate-geometry-segment-division-conic-basics` | Segment division, conics, focus/directrix | 2 | 1 | 2 | Math Graph Lab | Ellipse/hyperbola sliders |
| 05 | Circles, Radians, and Laws of Sines and Cosines | `lesson-jacob-circles-laws` | `jacob-05-circles-radians-laws-sines-cosines` | Circles, radians, sectors, laws, ellipses | 2 | 1 | 2 | Math Graph Lab | Circle theorem proof-step cards |
| 06 | Polynomial Operations, Cubes, and Finite Series | `lesson-jacob-polynomials-series` | `jacob-06-polynomial-operations-cubes-finite-series` | Polynomial operations, cube identities, remainder theorem, series | 2 | 1 | 2 | Math Guided Study | Synthetic division stepper |
| 07 | Graphing Polynomials, Rational Exponents, and Logarithms | `lesson-jacob-logs-transformations` | `jacob-07-graphing-polynomials-rational-exponents-logarithms` | Graphing polynomials, rational exponents, logs | 2 | 1 | 2 | Math Graph Lab | Multiplicity toggles |
| 08 | Parent Functions, Unit Circle, Rational Functions, and Matrices | `lesson-jacob-rational-matrices` | `jacob-08-parent-functions-unit-circle-rational-functions-matrices` | Parent transformations, unit circle, rational functions, binomial theorem, matrices | 2 | 1 | 2 | Math Graph Lab | Rational asymptote/hole cards |
| 09 | Composite Functions, Trig Identities, and Complex Numbers | `lesson-jacob-functions-trig-identities` | `jacob-09-composite-functions-trig-identities-complex-numbers` | Composition, trig identities, complex numbers | 2 | 1 | 2 | Math Graph Lab | Identity matching set |
| 10 | Vectors, Matrices Continued, Probability, Growth, Series, and Precalculus Limits | `lesson-jacob-complex-vectors` | `jacob-10-vectors-matrices-probability-growth-series-precalc-limits` | Vectors, probability, growth, series, limits | 2 | 1 | 2 | Math Guided Study | Permutation/combination matching |
| 11 | Calculus Limits and the Derivative Definition | `lesson-jacob-calculus-limits` | `jacob-11-calculus-limits-derivative-definition` | Limits, epsilon-delta, derivative definition, important limits, L'Hopital | 2 | 1 | 2 | Math Graph Lab | Epsilon band interaction |
| 12 | Derivative Rules and Core Techniques | `lesson-jacob-calculus-derivatives` | `jacob-12-derivative-rules-core-techniques` | Power, product, quotient, chain, implicit differentiation | 2 | 1 | 2 | Math Practice Mode | Rule-identification flash practice |
| 13 | Applications of Differential Calculus | `lesson-jacob-diff-calc-applications` | `jacob-13-applications-differential-calculus` | Linearization, MVT, optimization, second derivatives | 2 | 1 | 2 | Math Graph Lab | Optimization scenario templates |
| 14 | Integrals, Antiderivatives, and the Fundamental Theorem of Calculus | `lesson-jacob-integrals-ftc` | `jacob-14-integrals-antiderivatives-ftc` | Antiderivatives, definite integrals, FTC, substitution, parts | 2 | 1 | 2 | Math Graph Lab | Rectangle-count slider |
| 15 | Differential Equations and Applications of Integral Calculus | `lesson-jacob-diffeq-integral-apps` | `jacob-15-differential-equations-integral-applications` | Separable equations, logistic growth, average value, volume, arc length | 2 | 1 | 2 | Math Graph Lab | Slope field renderer |
| 16 | Parametric Equations, Polar Coordinates, Infinite Series, and Taylor Series | `lesson-jacob-parametric-polar-series` | `jacob-16-parametric-polar-infinite-series-taylor` | Parametric, polar, infinite series, Taylor/Maclaurin | 2 | 1 | 2 | Math Graph Lab | Convergence interval practice |
| 17 | Multivariable Foundations and Vector Algebra | `lesson-jacob-multivar-foundations` | `jacob-17-multivariable-foundations-vector-algebra` | Vector algebra, dot/cross products, 3D coordinates | 2 | 1 | 2 | Math Graph Lab | 3D vector arrow styling |
| 18 | Partial Derivatives, Gradient, Divergence, Curl, and Jacobian | `lesson-jacob-multivar-operators` | `jacob-18-partial-derivatives-gradient-divergence-curl-jacobian` | Partials, gradient, divergence, curl, Jacobian, Hessian | 2 | 1 | 2 | Math Graph Lab | Vector-field cards |
| 19 | Multivariable Applications, Optimization, Integration, Green, and Stokes | `lesson-jacob-multivar-apps-integration` | `jacob-19-multivariable-applications-optimization-integration-green-stokes` | Lagrange, multiple integrals, line/surface integrals, Green/Stokes/Divergence | 2 | 1 | 2 | Math Graph Lab | Theorem comparison cards |
| 20 | Linear Systems, Matrix Operations, Inverses, and Determinants | `lesson-jacob-linear-systems-determinants` | `jacob-20-linear-systems-matrix-operations-inverses-determinants` | Systems, row operations, inverses, determinants, Cramer's rule | 2 | 1 | 2 | Math Proof / Concept Mode | REF/RREF stepper |
| 21 | Vector Spaces, Bases, Change of Basis, and Eigenvalues | `lesson-jacob-vector-spaces-eigenvalues` | `jacob-21-vector-spaces-bases-change-of-basis-eigenvalues` | Vector spaces, bases, change of basis, eigenvalues, similarity | 2 | 1 | 2 | Math Proof / Concept Mode | Change-of-basis practice |
| 22 | Orthogonality, Least Squares, Spectral Theorem, and SVD | `lesson-jacob-orthogonality-svd` | `jacob-22-orthogonality-least-squares-spectral-svd` | Orthogonality, projections, least squares, spectral theorem, SVD | 2 | 1 | 2 | Math Proof / Concept Mode | Decomposition comparison cards |
| 23 | Differential Equations, Systems, Fourier Series, and Heat Flow | `lesson-jacob-differential-equations-fourier` | `jacob-23-differential-equations-systems-fourier-heat-flow` | Integrating factors, second-order equations, systems, Fourier series, heat equation | 2 | 1 | 2 | Math Graph Lab | Fourier partial-sum graph |
| 24 | Real Analysis Foundations: Sets, Fields, Real Numbers, and Completeness | `lesson-jacob-analysis-foundations` | `jacob-24-real-analysis-sets-fields-completeness` | Sets, number systems, ordered fields, completeness | 2 | 1 | 2 | Math Proof / Concept Mode | Least-upper-bound proof steps |
| 25 | Real Analysis: Sequences, Metric Spaces, and Continuity | `lesson-jacob-analysis-sequences-continuity` | `jacob-25-real-analysis-sequences-metric-spaces-continuity` | Sequences, Cauchy, subsequences, metric spaces, compactness, continuity | 2 | 1 | 2 | Math Proof / Concept Mode | Compactness theorem cards |
| 26 | Real Analysis: Series, Power Series, and Uniform Convergence | `lesson-jacob-analysis-series-functions` | `jacob-26-real-analysis-series-power-series-uniform-convergence` | Series, power series, radius, uniform convergence, M-test | 2 | 1 | 2 | Math Proof / Concept Mode | Convergence-test practice |
| 27 | Real Analysis: Differentiation, Taylor Theory, Riemann Integration, and Improper Integrals | `lesson-jacob-analysis-derivatives-integration` | `jacob-27-real-analysis-differentiation-taylor-riemann-improper-integrals` | Differentiation, Taylor theory, Riemann/Riemann-Stieltjes, improper integrals | 2 | 1 | 2 | Math Proof / Concept Mode | Riemann integrability proof cards |

## Remaining Depth Work

Every major section is now represented and connected to formulas, graph/demo cards, practice, related concepts, and a workspace recommendation. The remaining work is deeper interactivity inside some cards: row-reduction steppers, richer proof-step editors, custom circle theorem diagrams, and more granular page-by-page examples from the source document.
