# BinderNotes whiteboard stress test

## Purpose

This test measures whether the BinderNotes whiteboard can carry a strong student through 16 hard problems: 8 in math and 8 in chemistry. The whiteboard combines Excalidraw, Desmos 2D/3D, Compute Engine-checked solution steps, RDKit structures, and the chemistry solvers (exact charge-balance pH, titration curves, complexation and solubility, Nernst, van 't Hoff, kinetics simulation).

Each question is designed so that:

- every constant it needs is given;
- its numbers differ from familiar textbook versions;
- it has a single unambiguous final answer;
- it takes a strong student 10–30 minutes;
- it can be presented with graphs, step cards and structures on one board.

The lead runs each question through the app and scores the board it produces.

Files:

- [Questions only](whiteboard-mission/stress/questions-only.md): for blind solving. It has no answers or hints.
- [Answer key](whiteboard-mission/stress/answer-key.md): worked solutions, final answers with tolerances, and what a strong whiteboard should show for each question.
- [Verification scripts](whiteboard-mission/stress/verify/): one Python script per question. Each asserts its result against the key.
- [Recorded outputs](whiteboard-mission/stress/verify/outputs.md): all 16 scripts exit with code 0.

Re-run any script from the repo root:

```
uv run --no-project --with sympy --with mpmath --with scipy python docs/whiteboard-mission/stress/verify/<script>.py
```

## Scoring rubric (10 points per question, 160 total)

| Criterion | Points | Full marks | Partial | Zero |
|---|---|---|---|---|
| Correctness | 4 | Final answer matches the key within the stated tolerance, and the shown method is sound. | 3: right method with one slip or a precision miss. 2: main idea right, final answer wrong. 1: relevant setup only. | Wrong or missing. |
| Visual quality | 3 | Graphs, structures and steps are accurate, labeled and readable. They are computed, not decorative: real curves, correct stereo wedges, checked steps. The layout is calm and scannable. | 2: accurate but cluttered, or one key visual missing. 1: mostly text, or a visual is wrong. | No usable visuals. |
| Interactivity | 2 | At least one live element changes the result meaningfully, such as a slider, draggable point, rotatable 3D view, solver input or editable step. Steps are re-checked by the CAS or solver. | 1: static but editable objects, or a single toy slider. | Static image or text only. |
| Speed | 1 | The board is usable within about 60 s of asking, without lag while panning, zooming or dragging. | 0.5: usable in 60–180 s, or noticeable jank. | Longer than 180 s, or stalls. |

Scoring notes:

- Correctness is judged only against [answer-key.md](whiteboard-mission/stress/answer-key.md).
- Hand-wavy shortcuts that happen to land on the answer still need a sound method for 4/4. For example, (pK_a2 + pK_a3)/2 in Q9 is wrong at the requested precision.
- For multi-part questions, award correctness proportionally across the parts.

## The 16 questions

Sixteen questions: eight math, eight chemistry. Every constant you need is given in the question. Give each final answer in the form and to the precision requested. Numerical tools (graphing, numerical integration, a CAS) are allowed.

### Math

#### Q1. Contour integral
Use a keyhole contour, with the branch cut along the positive real axis, to evaluate

I = ∫₀^∞ x^(1/3) / ((x + 1)(x + 4)) dx.

Give the exact value and its decimal value to 6 significant figures.

#### Q2. Definite integral
Evaluate

I = ∫₀^∞ (ln x)² / (x² + 2x + 4) dx

exactly, and give its decimal value to 6 significant figures.

#### Q3. Vector calculus in 3D
Let F(x, y, z) = (y − z², z + x², x − y²). Let C be the closed curve where the cylinder (x − 1)² + y² = 4 meets the plane x + y + z = 3. C is oriented counterclockwise when viewed from high on the positive z-axis looking down. Compute the circulation ∮_C F · dr exactly.

#### Q4. Phase portrait
Consider the system

x′ = x(4 − x − 2y),  y′ = y(3 − x − y)

on the closed first quadrant x ≥ 0, y ≥ 0.

(a) Find every equilibrium in the closed first quadrant. Classify each one (stable or unstable node, saddle, and so on) and give its Jacobian eigenvalues.
(b) For the interior equilibrium, give both eigenvalues exactly and an eigenvector for each.
(c) Find lim_{t→∞} (x(t), y(t)) for the trajectory starting at (3, 1.5), and for the trajectory starting at (1, 0.5).

#### Q5. Jordan form and matrix exponential
Let

A = [ [ 1, 1, 1, −1 ],
      [ −4, 2, 4, −3 ],
      [ −1, 1, 3, −1 ],
      [ −3, 0, 3, −1 ] ].

(a) Find the Jordan normal form of A, including the size of every block.
(b) Solve x′ = Ax with x(0) = (1, 0, 0, 0)ᵀ. Give x(t) and the exact vector x(1).

#### Q6. Probability
A fair coin is tossed repeatedly. Alice wins as soon as the consecutive tosses H T H T appear. Bob wins as soon as T H T T appear. Both watch the same sequence of tosses, and the game stops at the first win.

(a) Find the expected number of tosses until H T H T first appears, ignoring Bob. Do the same for T H T T, ignoring Alice.
(b) Find the exact probability that Alice wins.
(c) Find the exact expected length of the game.

#### Q7. Number theory
Find all pairs of nonnegative integers (m, n) for which 2^m + 5^n is a perfect square, and prove that there are no others.

#### Q8. Geometry
Triangle ABC has AB = 7, BC = 8 and CA = 9. Let I be its incenter. Let N be its nine-point center, which is the midpoint of the segment joining the circumcenter O and the orthocenter H. Find the distance IN exactly.

### Chemistry

Unless a question says otherwise: T = 25 °C (298.15 K), K_w = 1.00 × 10⁻¹⁴, concentrations are treated as activities (no activity coefficients), and solution volumes are additive.

#### Q9. Exact pH of a polyprotic salt
A triprotic acid H₃A has pK_a1 = 2.25, pK_a2 = 7.05 and pK_a3 = 12.05. Find the pH of a 2.00 × 10⁻³ M solution of Na₂HA. Use the full charge balance, with no simplifying approximations, and report the pH to 3 decimal places.

#### Q10. Titration curve
A 25.00 mL sample of 0.0800 M H₂A (pK_a1 = 3.40, pK_a2 = 7.85) is titrated with 0.1000 M NaOH. Use the exact charge balance and include dilution. Find the pH, to 2 decimal places, after adding 0, 10.00, 20.00, 30.00, 40.00 and 45.00 mL of NaOH. Also identify both equivalence volumes.

#### Q11. Coupled complexation and solubility
Solid AgCl is equilibrated with a solution made up to contain 0.250 M NH₃ (total analytical concentration, before any AgCl dissolves) and 0.0100 M NaCl.

Data: K_sp(AgCl) = 1.9 × 10⁻¹⁰. Ag⁺ + NH₃ ⇌ Ag(NH₃)⁺ has log β₁ = 3.25. Ag⁺ + 2 NH₃ ⇌ Ag(NH₃)₂⁺ has log β₂ = 7.10.

Ignore protonation of NH₃, chloro complexes of silver, and any volume change. Account for the NH₃ bound in the complexes.

Find the molar solubility S of AgCl (total dissolved silver, 3 significant figures). Also find the fraction of dissolved silver present as Ag(NH₃)₂⁺ (4 significant figures).

#### Q12. Nernst equation
Consider the cell, at 298.15 K:

Ag(s) | AgCl(s) | Cl⁻(aq, 0.0250 M) ‖ MnO₄⁻(aq, 0.0100 M), Mn²⁺(aq, 0.00200 M), H⁺ at pH 2.30 | Pt(s)

Data: E°(MnO₄⁻/Mn²⁺) = +1.512 V, E°(Ag⁺/Ag) = +0.7996 V, K_sp(AgCl) = 1.80 × 10⁻¹⁰, R = 8.314462 J mol⁻¹ K⁻¹, F = 96485.33 C mol⁻¹. Take a(H⁺) = 10^(−pH).

(a) Find E°(AgCl/Ag).
(b) Find E_cell, to 0.001 V.
(c) Find ΔG, in kJ to 3 significant figures, for the cell reaction written as
MnO₄⁻ + 8 H⁺ + 5 Ag(s) + 5 Cl⁻ → Mn²⁺ + 5 AgCl(s) + 4 H₂O.

#### Q13. van 't Hoff equation
For N₂O₄(g) ⇌ 2 NO₂(g), K° = 0.1420 at 298.15 K (standard pressure 1 bar), and ΔH° = +58.30 kJ mol⁻¹, assumed independent of temperature. R = 8.314462 J mol⁻¹ K⁻¹.

(a) At what temperature does K° = 1? Give it to 0.1 K.
(b) Find K° at 340.0 K, to 4 significant figures.
(c) N₂O₄ is put into an evacuated rigid vessel held at 340.0 K, in an amount that would exert 0.400 bar if none of it dissociated. Find the total equilibrium pressure (3 significant figures) and the fraction of N₂O₄ dissociated (3 significant figures).

#### Q14. Kinetics of a mechanism
A mechanism has these first-order steps:

A ⇌ B, with k₁ = 0.120 s⁻¹ forward and k₋₁ = 0.0300 s⁻¹ reverse
B → C, with k₂ = 0.0450 s⁻¹

At t = 0, [A]₀ = 0.500 M and [B]₀ = [C]₀ = 0. Solve the rate equations exactly; do not use the steady-state or pre-equilibrium approximation.

(a) Find the time at which [B] is largest (3 significant figures) and that maximum [B] (3 significant figures).
(b) Find the time at which [C] reaches 0.250 M (3 significant figures).

#### Q15. E2 stereochemistry
(1S,2R)-1-Bromo-2-methyl-1-phenylbutane, PhCH(Br)–CH(CH₃)CH₂CH₃, is heated with sodium ethoxide in ethanol. Assume the reaction goes only by an anti-periplanar E2 pathway.

Draw the reactive conformation as a Newman projection along C1–C2. Show the curved arrows. Name the alkene product with its full E/Z descriptor.

#### Q16. NMR structure elucidation
An unknown compound has molecular formula C₈H₁₄O₂.

- IR: 1720 (s), 1658 (m) and 968 (s) cm⁻¹. No absorption between 3200 and 3600 cm⁻¹.
- MS (EI): m/z 142 (M⁺); base peak at m/z 69.
- ¹H NMR (400 MHz, CDCl₃), δ:
  - 6.97 (1H, dq, J = 15.5, 6.9 Hz)
  - 5.86 (1H, dq, J = 15.5, 1.7 Hz)
  - 3.92 (2H, d, J = 6.7 Hz)
  - 1.95 (1H, m, apparent nonet, J ≈ 6.7 Hz)
  - 1.88 (3H, dd, J = 6.9, 1.7 Hz)
  - 0.94 (6H, d, J = 6.7 Hz)
- ¹³C NMR (101 MHz, CDCl₃), δ: 166.7, 144.5, 122.8, 70.5, 27.9, 19.1, 18.0.

Give the structure and its complete name, including any stereodescriptor.

## Results

Run on 31 October 2026 with `scripts/stress/run-stress-boards.mjs`: each board opened in the isolated lab fixture (dev server, synthetic learner, real Desmos and RDKit), every card rendered, and each Worked Solution card ran the app's own checker. All 16 boards rendered with no page errors, no Desmos expression errors and no KaTeX errors.

Scores are from an independent reviewer (Claude Sonnet 5.5, read-only, no access to the lead's opinions), who read the questions, the answer key, every screenshot and every run record. Speed was scored strictly by measured open time (1 point at 1.0 s or less, 0.5 up to 1.5 s), which is harsher than the rubric's 60-second wording. Checks are verified / not checked / mismatched steps.

| Question | Checks v/u/m | Open | Correctness /4 | Visuals /3 | Interactivity /2 | Speed /1 | Total | Reviewer's note |
|---|---|---|---|---|---|---|---|---|
| Q1 Contour integral | 8/3/0 | 0.8 s | 4 | 2.5 | 2 | 1 | 9.5 | Matches the key; the ML bounds and residue equation are not checked; contour has no arrowheads. |
| Q2 Definite integral | 13/0/0 | 0.8 s | 4 | 2.5 | 2 | 1 | 9.5 | All 13 steps verified; the integrand graph is a spike and a flat line. |
| Q3 3D vector calculus | 12/0/0 | 1.0 s | 4 | 2.5 | 1.5 | 0.5 | 8.5 | −20π correct; good 3D scene, rotation only; two steps clipped. |
| Q4 Phase portrait | 12/1/0 | 0.7 s | 4 | 2.5 | 2 | 1 | 9.5 | Equilibria and limits right; draggable trajectory. |
| Q5 Jordan form and e^{At} | 16/1/0 | 0.8 s | 3.5 | 2 | 2 | 1 | 8.5 | J and x(1) correct; the Jordan matrix is not checkable; answer truncated. |
| Q6 Probability (pattern race) | 9/14/0 | 0.8 s | 3.5 | 1.5 | 1 | 1 | 7.0 | Answers right; 14 steps are premises ("given"); small chain cards; static bars. |
| Q7 Number theory | 8/1/0 | 0.7 s | 4 | 1.5 | 1 | 1 | 7.5 | Complete proof; the 1,173-dot search grid adds little; static. |
| Q8 Geometry construction | 13/0/0 | 0.7 s | 4 | 2.5 | 2 | 1 | 9.5 | All verified; dragging A updates IN live; I and N labels collide. |
| Q9 Exact polyprotic pH | 9/2/0 | 0.7 s | 4 | 2 | 2 | 1 | 9.0 | pH 9.138 and species right; a clipped label and step. |
| Q10 Titration curve | 8/1/0 | 0.7 s | 4 | 2 | 1 | 1 | 8.0 | All six pH values right; static curve; answer clipped. |
| Q11 Complexation and solubility | 5/2/0 | 0.7 s | 4 | 2 | 1 | 1 | 8.0 | S and 0.9994 right; no ammonia slider; overlapping axis labels. |
| Q12 Nernst | 8/0/0 | 0.7 s | 4 | 2.5 | 2 | 1 | 9.5 | All checked; pH drag and cell diagram. |
| Q13 van 't Hoff | 7/1/0 | 0.7 s | 4 | 2 | 2 | 1 | 9.0 | All four results right; draggable T; answer hid α. |
| Q14 Kinetics mechanism | 7/1/0 | 0.8 s | 4 | 2 | 2 | 1 | 9.0 | All values right; drag-t readout; nested fractions hard to read. |
| Q15 E2 stereochemistry | 4/4/0 | 0.6 s | 3.5 | 2.5 | 1.5 | 1 | 8.5 | (E) product, Newman and arrows correct; the stereochemistry itself is not machine-checked. |
| Q16 NMR elucidation | 7/0/0 | 0.6 s | 4 | 2 | 1.5 | 1 | 8.5 | Structure and E right; the checks are only arithmetic; name truncated. |
| **Total** | **146/31/0** | | **62.5/64** | **34.5/48** | **26.5/32** | **15.5/16** | **139/160** | **Average 8.69 / 10** (target 8.0) |

### What changed after the review

The reviewer's three main weaknesses, and what was done (no second scoring pass was run, to save cost):

1. **Clipped lines in Worked Solution cards** (seven answers and many steps). Fixed in the app (`b698493`): display math now wraps where TeX would break it (after relations, `;`, `,` and `\quad`), with continuation lines indented and KaTeX's own spacing, so a line that fits looks unchanged. The Q6, Q10, Q12, Q13 and Q15 answers are now fully visible, and Q3's long integral wraps after its "=". Only a single piece wider than the card still scrolls, behind a soft edge fade (Q5's x(1) tuple, Q16's full name, the left sides of two Q11 and Q14 steps).
2. **"Checked" can read as more assurance than it is.** The edit view now says plainly that checks confirm the math inside each line (values, identities, solutions), not the reasoning between lines, and each chip's tooltip says what was checked. Numeric inequalities are now checked too (`da32447`: Q4 10 → 12 verified, Q16 6 → 7).
3. **Thin interactivity and some low-value diagrams** (Q6, Q7, Q10, Q11, Q15, Q16). These are board content rather than app features: sliders for pKa (Q10), total ammonia (Q11) and rate constants (Q14), a state diagram for Q6, a lighter Q7 search plot and arrowheads on the Q1 contour would each add a point or so. They are listed as next steps in the mission report.
