# Whiteboard stress test: answer key

The questions are in [questions-only.md](questions-only.md). Every number here was checked by a script in [verify/](verify/). Each script's full output is in [verify/outputs.md](verify/outputs.md). Each script asserts its result against this key, and all 16 exit with code 0.

**Final answers at a glance**

| Q | Topic | Final answer | Tolerance for full marks |
|---|---|---|---|
| 1 | Keyhole contour | 2π(4^(1/3) − 1)/(3√3) ≈ 0.710285 | exact form, or 6 s.f. |
| 2 | ∫ ln²x/(x²+2x+4) | π ln²2/(3√3) + 8π³/(81√3) = √3π(27 ln²2 + 8π²)/243 ≈ 2.05853 | exact form, or 6 s.f. |
| 3 | Stokes | ∮ F·dr = −20π ≈ −62.8319 | exact; the sign matters |
| 4 | Phase portrait | (0,0) unstable node {4, 3}; (4,0) stable node {−4, −1}; (0,3) stable node {−2, −3}; (2,1) saddle {(−3 ± √17)/2}. (3, 1.5) → (0, 3); (1, 0.5) → (4, 0) | all four types and both limits |
| 5 | Jordan / e^{At} | J = J₃(2) ⊕ J₁(−1); x(1) = (−e²/2, e⁻¹ − 2e², −3e²/2, e⁻¹ − e²) ≈ (−3.6945, −14.4102, −11.0836, −7.0212) | exact |
| 6 | Penney race | E = 20 (HTHT) and 18 (THTT); P(Alice) = 9/14; E[length] = 90/7 | exact fractions |
| 7 | 2^m + 5^n = k² | (m, n) = (2, 1) and (3, 0), both giving 9; no others | both pairs plus a proof |
| 8 | Feuerbach distance | IN = √5/20 ≈ 0.111803 | exact |
| 9 | Exact pH of Na₂HA | pH = 9.138 | ±0.001 |
| 10 | Titration | pH 2.26, 3.41, 5.63, 7.85, 10.17, 11.85 at 0, 10, 20, 30, 40, 45 mL; V_eq = 20.00 and 40.00 mL | ±0.01 each |
| 11 | AgCl in NH₃ + Cl⁻ | S = 7.53 × 10⁻³ M; fraction as Ag(NH₃)₂⁺ = 0.9994 | 3 s.f. / 4 s.f. |
| 12 | Nernst | E°(AgCl/Ag) = 0.2231 V; E_cell = 0.985 V; ΔG = −475 kJ mol⁻¹ | ±0.001 V; 3 s.f. |
| 13 | van 't Hoff | T(K° = 1) = 325.1 K; K°(340.0 K) = 2.567; P_tot = 0.679 bar; α = 0.697 | as requested |
| 14 | A ⇌ B → C | t_max = 12.3 s; [B]max = 0.246 M; t([C] = 0.250 M) = 27.5 s | 3 s.f. |
| 15 | E2 | (E)-2-methyl-1-phenylbut-1-ene, i.e. [(E)-2-methylbut-1-en-1-yl]benzene | E descriptor required |
| 16 | NMR | 2-methylpropyl (E)-but-2-enoate (isobutyl (E)-crotonate), CH₃CH=CHCO₂CH₂CH(CH₃)₂ | connectivity plus E |

---

## Q1. Keyhole contour (verify/q01_keyhole_contour.py)

**Solution.** Let f(z) = z^(1/3)/((z + 1)(z + 4)) with 0 < arg z < 2π, so the cut lies along the positive real axis. On the keyhole contour:

- On the small circle, |f| ~ |z|^(1/3). Times the length 2πε this tends to 0.
- On the large circle, |f| ~ R^(−5/3). Times 2πR this tends to 0.
- The upper edge contributes I. On the lower edge z^(1/3) = x^(1/3)e^(2πi/3), traversed inward, so it contributes −e^(2πi/3) I.

So (1 − e^(2πi/3)) I = 2πi [Res₋₁ + Res₋₄].

- Res at z = −1: (e^(iπ)/1)^(1/3)/(−1 + 4) = e^(iπ/3)/3.
- Res at z = −4: 4^(1/3)e^(iπ/3)/(−4 + 1) = −4^(1/3)e^(iπ/3)/3.

The sum is e^(iπ/3)(1 − 4^(1/3))/3. Also 1 − e^(2πi/3) = −2i e^(iπ/3) sin(π/3) = −i√3 e^(iπ/3). Therefore

**I = 2π(4^(1/3) − 1)/(3√3) ≈ 0.710285.**

This agrees with direct quadrature to 25 or more digits. A useful cross-check is the general formula ∫₀^∞ x^(a−1)/((x+b)(x+c)) dx = π(b^(a−1) − c^(a−1))/((c − b) sin πa) with a = 4/3.

**Strong whiteboard presentation:**
- A drawn keyhole contour with the cut, the two poles at −1 and −4, and arrows on all four pieces.
- A residue step card with both residues.
- One line showing the ML-estimate for each vanishing arc.
- A Desmos plot of the integrand on [0, 30] with the shaded area, labeled ≈ 0.7103.
- A CAS step check comparing the closed form with the numeric value.

## Q2. ∫₀^∞ ln²x/(x² + 2x + 4) dx (verify/q02_log_squared_integral.py)

**Solution.** Substitute x = 2t. Then x² + 2x + 4 = 4(t² + t + 1) and dx = 2dt, so

I = ½ ∫₀^∞ (ln 2 + ln t)²/(t² + t + 1) dt = ½ [ln²2 · J₀ + 2 ln 2 · J₁ + J₂], where J_k = ∫₀^∞ (ln t)^k/(t² + t + 1) dt.

- **J₀** = [(2/√3) arctan((2t + 1)/√3)]₀^∞ = 2π/(3√3).
- **J₁** = 0, because t → 1/t maps the integrand to its negative. The quadratic is palindromic: t²(1/t² + 1/t + 1) = t² + t + 1.
- **J₂**: use the Mellin transform F(s) = ∫₀^∞ t^(s−1)/(t² + 2t cos φ + 1) dt = π sin((1 − s)φ)/(sin φ sin πs) with φ = π/3. Write s = 1 + ε. Then F = (2π/√3) · sin(πε/3)/sin(πε) = (2π/(3√3)) [1 + (π² − π²/9)ε²/6 + …]. Hence J_k = F^(k)(1) gives J₂ = 2 · (2π/(3√3)) · (8π²/9)/6 = 16π³/(81√3).

**I = π ln²2/(3√3) + 8π³/(81√3) = √3 π (27 ln²2 + 8π²)/243 ≈ 2.05853.**

The script checks J₀, J₁ and J₂ both by quadrature and by series expansion of the Mellin transform.

**Strong whiteboard presentation:**
- The substitution step, then the symmetry t ↦ 1/t shown on a Desmos plot of ln t/(t² + t + 1). Its signed areas on (0, 1) and (1, ∞) cancel.
- A step card for the Mellin formula and its ε-expansion.
- A final numeric check against quadrature.

## Q3. Stokes' theorem: cylinder ∩ plane (verify/q03_stokes_cylinder_plane.py)

**Solution.** curl F = (∂F₃/∂y − ∂F₂/∂z, ∂F₁/∂z − ∂F₃/∂x, ∂F₂/∂x − ∂F₁/∂y) = (−2y − 1, −2z − 1, 2x − 1).

Take S to be the part of the plane z = 3 − x − y inside the cylinder. With the upward normal, n dS = (1, 1, 1) dA, which matches the counterclockwise-from-above orientation of C. Then

curl F · (1, 1, 1) = 2x − 2y − 2z − 3 = 4x − 9 after substituting z = 3 − x − y.

Over the disk D centered at (1, 0) with radius 2: ∬_D 4x dA = 4 · x̄ · Area = 4 · 1 · 4π = 16π, and ∬_D 9 dA = 36π.

**∮_C F · dr = 16π − 36π = −20π ≈ −62.8319.**

The script also parametrizes C directly as (1 + 2cos t, 2 sin t, 3 − x − y) and gets −20π.

**Strong whiteboard presentation:**
- A Desmos 3D scene with the cylinder, the tilted plane and the elliptical intersection curve, with an orientation arrow.
- The curl computed as a determinant step.
- The surface-integral reduction to 4x − 9.
- A centroid shortcut or polar integral.
- The direct line-integral check as a final step.

## Q4. Competitive Lotka–Volterra phase portrait (verify/q04_phase_portrait.py)

**Solution.** The nullclines are:

- for x′ = 0: x = 0 and x + 2y = 4
- for y′ = 0: y = 0 and x + y = 3

The Jacobian is J = [[4 − 2x − 2y, −2x], [−y, 3 − x − 2y]].

| Equilibrium | J | Eigenvalues | Type |
|---|---|---|---|
| (0, 0) | diag(4, 3) | 4, 3 | unstable node |
| (4, 0) | [[−4, −8], [0, −1]] | −4, −1 | stable node |
| (0, 3) | [[−2, 0], [−3, −3]] | −2, −3 | stable node |
| (2, 1) | [[−2, −4], [−1, −1]] | (−3 ± √17)/2 ≈ 0.5616, −3.5616 | saddle (det = −2) |

At the saddle:

- λ_u = (−3 + √17)/2 has eigenvector (1, −(1 + √17)/8) ≈ (1, −0.6404).
- λ_s = (−3 − √17)/2 has eigenvector (1, (√17 − 1)/8) ≈ (1, 0.3904).

This is bistability. The stable manifold of the saddle is the separatrix. It runs from the unstable node (0, 0) through (2, 1) and off to infinity, and it divides the basin of (4, 0), below it, from the basin of (0, 3), above it. Integrating backward along the stable eigenvector puts the separatrix at y = 0.5837 when x = 1 and at y = 1.3739 when x = 3.

- (3, 1.5) lies above the separatrix, so it tends to **(0, 3)**. This is the counterintuitive case: x starts at twice y, yet y wins.
- (1, 0.5) lies below the separatrix, so it tends to **(4, 0)**.

**Strong whiteboard presentation:**
- A Desmos 2D graph with the nullclines in two colors and the four equilibria marked by type (filled for stable, open for unstable).
- A direction field, the separatrix curve, and the two trajectories from the given starts.
- A Jacobian-and-eigenvalue step card for each equilibrium.
- Interactivity: a draggable start point whose trajectory updates.

## Q5. Jordan form and e^{At} (verify/q05_jordan_exponential.py)

**Solution.** The characteristic polynomial is (λ − 2)³(λ + 1).

For λ = 2: rank(A − 2I) = 3, rank(A − 2I)² = 2 and rank(A − 2I)³ = 1. The geometric multiplicity is 4 − 3 = 1, so there is a single block of size 3.

**J = J₃(2) ⊕ J₁(−1)**, that is, [[−1,0,0,0],[0,2,1,0],[0,0,2,1],[0,0,0,2]] up to block order.

Next, split x₀ along the eigenvector w = (0, 1, 0, 1) for λ = −1 (check: Aw = −w). This gives x₀ = u + w with u = (1, −1, 0, −1), and u lies in ker(A − 2I)³. With N = A − 2I:

- Nu = (−1, −1, −1, 0)
- N²u = (−1, 0, −1, 0)
- N³u = 0

So e^{At}x₀ = e^{2t}(u + tNu + (t²/2)N²u) + e^{−t}w, which gives

x(t) = ( (1 − t − t²/2)e^{2t}, e^{−t} − (1 + t)e^{2t}, −(t + t²/2)e^{2t}, e^{−t} − e^{2t} ).

**x(1) = (−e²/2, e⁻¹ − 2e², −3e²/2, e⁻¹ − e²) ≈ (−3.6945, −14.4102, −11.0836, −7.0212).**

This matches sympy's exact matrix exponential and scipy's expm.

**Strong whiteboard presentation:**
- Step cards for the characteristic polynomial, the rank table that fixes the block sizes, the decomposition x₀ = u + w, and the truncated series using N³u = 0.
- A Desmos plot of the four components x_i(t) on [0, 1.2].
- A CAS check that x′ = Ax and that x(0) is correct.

## Q6. Penney-type race HTHT vs THTT (verify/q06_penney_patterns.py)

**Solution.** Use Conway correlations, where XY = Σ 2^k over k such that the last k letters of X equal the first k letters of Y.

- AA (HTHT, HTHT): k = 4 and k = 2 match, so AA = 16 + 4 = 20.
- BB (THTT, THTT): k = 4 and k = 1 match, so BB = 16 + 2 = 18.
- AB (HTHT, THTT): k = 1 (T/T) and k = 3 (THT/THT) match, so AB = 2 + 8 = 10.
- BA (THTT, HTHT): no matches, so BA = 0.

Results:

- (a) E[wait for HTHT] = AA = **20**, and E[wait for THTT] = BB = **18**.
- (b) Conway's odds are A : B = (BB − BA) : (AA − AB) = 18 : 10. So **P(Alice wins) = 9/14 ≈ 0.643**. The pattern that takes longer to appear on its own still wins the race.
- (c) E[length] = (AA · BB − AB · BA)/(AA + BB − AB − BA) = 360/28 = **90/7 ≈ 12.857**.

The script confirms all of these with an exact absorbing Markov chain solved in rational arithmetic, plus a 200 000-run Monte Carlo (P ≈ 0.644, E ≈ 12.83).

**Strong whiteboard presentation:**
- A state diagram of the prefix automaton (∅, H, T, HT, TH, HTH, THT and the two absorbing states).
- The linear system as a step card.
- A bar chart comparing E[wait] with P(win), so the paradox is visible.

## Q7. 2^m + 5^n = k² (verify/q07_exponential_diophantine.py)

**Solution.**

*Case n = 0.* 2^m + 1 = k² gives (k − 1)(k + 1) = 2^m. Two powers of two that differ by 2 must be 2 and 4, so k = 3 and **m = 3**.

*Case n ≥ 1.*
- Mod 5: 2^m must be a square residue in {1, 4}, so m is even.
- Mod 3: with m even, 2^m + 5^n ≡ 1 + (−1)^n. If n were even this would be 2, which is not a square mod 3. So n is odd.
- Mod 8: if m ≥ 3, then 2^m + 5^n ≡ 5^n ≡ 5 (n odd), which is not a square mod 8. So m ∈ {0, 2}.
  - m = 0: (k − 1)(k + 1) = 5^n. Both factors would be powers of 5 differing by 2, which is impossible.
  - m = 2: (k − 2)(k + 2) = 5^n. Both factors are powers of 5 differing by 4, so they are 1 and 5. Then k = 3 and **n = 1**.

**Solutions: (m, n) = (3, 0) and (2, 1). Both give 9.**

A brute-force search over m < 400, n < 200 finds exactly these two pairs. The trap is the mod-5 step: it needs n ≥ 1, so an argument that forgets n = 0 misses (3, 0).

**Strong whiteboard presentation:**
- A case-split tree (n = 0 versus n ≥ 1), with small residue tables for mod 3, 5 and 8 as step cards.
- The factorization step shown as a pair of boxes.
- The brute-force check summarized.

## Q8. Incenter to nine-point-center distance (verify/q08_feuerbach_distance.py)

**Solution.** Use coordinates B = (0, 0), C = (8, 0), A = (2, 3√5). (Check: AB² = 4 + 45 = 49 and AC² = 36 + 45 = 81.)

- s = 12 and area K = √(12·5·4·3) = 12√5.
- r = K/s = √5.
- R = abc/(4K) = 504/(48√5) = 21√5/10.
- O = (4, 11√5/10).
- H = A + B + C − 2O = (2, 4√5/5). It lies on the altitude x = 2.
- N = (O + H)/2 = (3, 19√5/20).
- I = (aA + bB + cC)/(a + b + c) = (3, √5). The incircle touches BC at D = (s − b, 0) = (3, 0).

Since I and N lie on the line x = 3, **IN = √5 − 19√5/20 = √5/20 ≈ 0.111803.**

Feuerbach's theorem gives the same value: the incircle is internally tangent to the nine-point circle, so IN = R/2 − r = 21√5/20 − √5 = √5/20. The tangency point (the Feuerbach point) is (3, 2√5), the top of the incircle. As side checks, OI² = R(R − 2r) = 21/20 and OH = √445/10.

**Strong whiteboard presentation:**
- A constructed triangle with perpendicular bisectors to O, altitudes to H, angle bisectors to I, and the Euler line O–N–H.
- The nine-point circle (radius 21√5/20) and the incircle (radius √5), visibly tangent at the Feuerbach point.
- A zoomed inset of the tiny segment IN.
- Step cards for R, r and the coordinates, plus a CAS check of R/2 − r.

## Q9. Exact pH of 2.00 mM Na₂HA (verify/q09_polyprotic_exact_ph.py)

**Solution.** Let K₁ = 10^−2.25, K₂ = 10^−7.05, K₃ = 10^−12.05 and C = 2.00 × 10⁻³ M, so [Na⁺] = 2C. The charge balance is

[Na⁺] + [H⁺] = C(α₁ + 2α₂ + 3α₃) + K_w/[H⁺],

where the α are the usual fractions with denominator D = h³ + K₁h² + K₁K₂h + K₁K₂K₃. Subtracting the mass balance gives the proton condition [H⁺] + [H₂A⁻] + 2[H₃A] = [A³⁻] + [OH⁻]. Solving numerically:

**pH = 9.138** (9.13818…)

| Species | Concentration (M) |
|---|---|
| [H₂A⁻] | 1.62 × 10⁻⁵ |
| [HA²⁻] | 1.98 × 10⁻³ |
| [A³⁻] | 2.43 × 10⁻⁶ |
| [OH⁻] | 1.38 × 10⁻⁵ |

For comparison:
- The naive (pK_a2 + pK_a3)/2 gives 9.55, which is badly wrong because [OH⁻] ≫ [A³⁻].
- The improved formula h² = K₂(K₃C + K_w)/(K₂ + C) gives 9.140. It is close but fails at 3 d.p.

**Strong whiteboard presentation:**
- A charge-balance step card, then the proton condition.
- A Desmos plot of the charge-balance residual against pH, crossing zero at 9.138.
- A species-distribution (α) diagram with a vertical line at pH 9.138.
- A table of species.

## Q10. Diprotic titration curve (verify/q10_diprotic_titration.py)

**Solution.** There are n = 2.000 mmol of H₂A, so V_eq1 = **20.00 mL** and V_eq2 = **40.00 mL**. At each volume, C_A = 2.000/(25 + V) and [Na⁺] = 0.1000·V/(25 + V). Solve

[Na⁺] + h = C_A(K₁h + 2K₁K₂)/(h² + K₁h + K₁K₂) + K_w/h.

| V (mL) | 0 | 10.00 | 20.00 | 30.00 | 40.00 | 45.00 |
|---|---|---|---|---|---|---|
| pH | **2.26** | **3.41** | **5.63** | **7.85** | **10.17** | **11.85** |

The shortcuts give 3.40 at 10 mL (Henderson) and 5.625 at 20 mL ((pK_a1 + pK_a2)/2). The exact values differ slightly because H₂A dissociates appreciably: K₁ is large relative to C. At 30.00 mL the exact value is 7.8500.

**Strong whiteboard presentation:**
- A full Desmos titration curve from 0 to 50 mL, computed from the charge balance and not sketched.
- Markers at the six volumes, vertical lines at both equivalence points, and half-equivalence annotations.
- Optionally a dpH/dV curve.
- Interactivity: sliders for pK_a and concentration.

## Q11. AgCl in NH₃ with common ion (verify/q11_complexation_solubility.py)

**Solution.** The unknowns are S (total dissolved Ag) and L = [NH₃]free. Then [Cl⁻] = 0.0100 + S, [Ag⁺] = K_sp/(0.0100 + S), and

- S = [Ag⁺](1 + β₁L + β₂L²)
- 0.250 = L + [Ag⁺](β₁L + 2β₂L²)

Solving simultaneously:

**S = 7.53 × 10⁻³ M**, with L = 0.2349 M, [Ag⁺] = 1.08 × 10⁻⁸ M and [Cl⁻] = 0.01753 M.

The fractions of dissolved silver are Ag⁺ : Ag(NH₃)⁺ : Ag(NH₃)₂⁺ = 1.4 × 10⁻⁶ : 6.0 × 10⁻⁴ : **0.9994**.

Traps:
- Ignoring NH₃ depletion gives 8.21 × 10⁻³ M.
- Ignoring the added Cl⁻ gives 1.11 × 10⁻² M.

**Strong whiteboard presentation:**
- Mass-balance and charge-bookkeeping step cards.
- A Desmos plot of the two balance curves in the (S, L) plane, meeting at the solution.
- A pie or bar chart of the silver species.
- A slider for total NH₃ showing how solubility grows.

## Q12. Nernst: permanganate vs Ag/AgCl (verify/q12_nernst_permanganate_agcl.py)

**Solution.** (RT/F) ln 10 = 0.059159 V.

- (a) **E°(AgCl/Ag)** = E°(Ag⁺/Ag) + 0.059159 log K_sp = 0.7996 + 0.059159·log(1.80 × 10⁻¹⁰) = **0.2231 V**.
- Cathode: E = 1.512 − (0.059159/5) log([Mn²⁺]/([MnO₄⁻][H⁺]⁸)) = 1.512 − (0.059159/5) log(0.00200/(0.0100 × 10^−18.4)) = 1.30256 V.
- Anode: E = 0.2231 − 0.059159 log(0.0250) = 0.31789 V. Using Ag⁺/Ag with [Ag⁺] = K_sp/[Cl⁻] gives the same value.
- (b) **E_cell = 0.98468 V, so 0.985 V.** E°cell = 1.2889 V. The same result follows from the overall Q = [Mn²⁺]/([MnO₄⁻][H⁺]⁸[Cl⁻]⁵) with n = 5.
- (c) **ΔG = −5FE_cell = −475 kJ mol⁻¹** (−475.0). log K = 108.9.

**Strong whiteboard presentation:**
- A cell diagram with electron flow, the two half-reactions and the balanced overall equation.
- Step cards for E°(AgCl/Ag) from K_sp, each Nernst term, and ΔG.
- A Desmos graph of E_cell against pH, which falls at 8 × 0.05916/5 ≈ 0.0947 V per pH unit, with the pH 2.30 point marked.

## Q13. van 't Hoff for N₂O₄ ⇌ 2NO₂ (verify/q13_vant_hoff_n2o4.py)

**Solution.** Start from ln(K₂/K₁) = −(ΔH°/R)(1/T₂ − 1/T₁).

- (a) Set K₂ = 1. Then 1/T = 1/298.15 − R ln(1/0.1420)/58300, so **T = 325.1 K** (325.135). Equivalently, ΔS° = 179.31 J mol⁻¹ K⁻¹ and T = ΔH°/ΔS°.
- (b) **K°(340.0 K) = 2.567** (2.5673).
- (c) Let x be the pressure of N₂O₄ that dissociates. Then P(N₂O₄) = 0.400 − x and P(NO₂) = 2x, so K = 4x²/(0.400 − x). This gives 4x² + Kx − 0.400K = 0, so x = 0.27885 bar.
  - **P_total = 0.400 + x = 0.679 bar**
  - **α = x/0.400 = 0.697**
  - P(NO₂) = 0.558 bar and P(N₂O₄) = 0.121 bar.

**Strong whiteboard presentation:**
- A van 't Hoff plot of ln K against 1/T: a straight line with slope −ΔH°/R = −7012 K, crossing ln K = 0 at 1/T = 1/325.1.
- An ICE table step card and the quadratic solution.
- A slider for T showing α(T).

## Q14. A ⇌ B → C exact kinetics (verify/q14_reversible_consecutive_kinetics.py)

**Solution.** The linear system d[A, B]/dt = M[A, B] has M = [[−k₁, k₋₁], [k₁, −(k₋₁ + k₂)]]. Its decay constants λ± satisfy:

- λ₊ + λ₋ = k₁ + k₋₁ + k₂ = 0.195 s⁻¹
- λ₊λ₋ = k₁k₂ = 0.0054 s⁻²

So **λ± = (39 ± 3√73)/400**, that is 0.16158 and 0.03342 s⁻¹.

Then [B] = k₁[A]₀/(λ₊ − λ₋) · (e^(−λ₋t) − e^(−λ₊t)), and [C] = [A]₀[1 − (λ₊e^(−λ₋t) − λ₋e^(−λ₊t))/(λ₊ − λ₋)].

- (a) **t_max = ln(λ₊/λ₋)/(λ₊ − λ₋) = 12.3 s** (12.296), and **[B]max = 0.246 M** (0.24621).
- (b) Solving [C] = 0.250 M gives **t = 27.5 s** (27.491).

A stiff numerical ODE solve agrees to 10⁻⁴ s. The steady-state approximation (k_eff = k₁k₂/(k₋₁ + k₂) = 0.072 s⁻¹) would predict 9.6 s for (b). It is invalid here because B builds up to half of [A]₀.

**Strong whiteboard presentation:**
- A kinetics-simulator plot of [A], [B] and [C] against t (0 to 120 s), with markers at the B maximum and at [C] = 0.250 M.
- An overlay of the steady-state prediction so its failure is visible.
- Step cards for the eigenvalues and the closed forms.
- Sliders for k₁, k₋₁ and k₂.

## Q15. E2 stereochemistry (verify/q15_e2_stereochemistry.py)

**Solution.**

Priorities:
- At C1: Br > Ph > C2 > H. Ph is (C,C,C) and C2 is (C,C,H).
- At C2: C1 > Et > CH₃ > H. C1 is (Br,C,H).

The only β-carbon bearing hydrogen is C2, and it has one H. So there is a single E2 product, PhCH=C(CH₃)Et, and no regiochemistry question. Its geometry is fixed by the requirement that H(C2) and Br be anti-periplanar.

Newman projection along C1→C2, built from the descriptors:
- Front carbon C1 (1S): Br at 0°, Ph at 120°, H at 240°.
- Back carbon C2 (2R): H at 180° (anti to Br), Et at 300°, CH₃ at 60°.

Groups 60° apart end up cis in the alkene, so Ph is cis to CH₃ and H is cis to Et. On the alkene, Ph outranks H at C1 and Et outranks CH₃ at C2. The two higher-priority groups are trans, so the product is **(E)-2-methyl-1-phenylbut-1-ene**, i.e. **[(E)-2-methylbut-1-en-1-yl]benzene**.

Curved arrows:
1. From an EtO⁻ lone pair to H on C2.
2. From the C2–H σ bond to the C1–C2 π position.
3. From the C1–Br σ bond to Br, which leaves as Br⁻.

The script builds explicit tetrahedral 3D coordinates from the R/S descriptors, enforces the Br/H 180° dihedral, and reads off the cis pairs. It is calibrated on McMurry's textbook example, (1R,2R)-1-bromo-1,2-diphenylpropane → (Z)-1,2-diphenylpropene, which it reproduces. It also shows that the like pair (1R,2R)/(1S,2S) gives Z and the unlike pair (1S,2R)/(1R,2S) gives E, so the answer depends only on relative configuration. Bookkeeping: the substrate is C₁₁H₁₅Br (DoU 4) and the product is C₁₁H₁₄ (DoU 5).

**Strong whiteboard presentation:**
- An RDKit drawing of the substrate with stereo wedges and both CIP labels.
- A Newman projection in the anti-periplanar conformation.
- A curved-arrow mechanism panel with exactly three arrows.
- The product drawn from SMILES `CC/C(C)=C/c1ccccc1`, which is (E): Et and Ph trans.
- Optionally the (Z) product from the like diastereomer, for contrast.

## Q16. NMR structure elucidation (verify/q16_nmr_structure.py)

**Solution.**

C₈H₁₄O₂ has DoU = (2·8 + 2 − 14)/2 = 2. The evidence for each part of the molecule:

- **Ester group.** IR 1720 cm⁻¹ with ¹³C 166.7 indicates a conjugated ester C=O, which uses one DoU. There is no O–H band.
- **Conjugated C=C.** IR 1658 cm⁻¹ with ¹³C 144.5 and 122.8 indicates a C=C, the second DoU. The deshielded vinyl proton at δ 6.97 is the β-H of an α,β-unsaturated ester.
- **Acid part, CH₃–CH=CH–C(=O).**
  - δ 6.97 is a dq (J = 15.5 and 6.9 Hz): it couples to the other vinyl H and to a CH₃.
  - δ 5.86 is a dq with J = 15.5 Hz plus a 1.7 Hz allylic coupling.
  - δ 1.88 (3H, dd, 6.9 and 1.7 Hz) is the allylic CH₃.
  - ³J = 15.5 Hz means the vinyl hydrogens are **trans, so the alkene is E**. A Z-crotonate shows about 11.5 Hz. The strong IR band at 968 cm⁻¹ (trans CH=CH out-of-plane wag) agrees.
- **Alcohol part, OCH₂CH(CH₃)₂.**
  - δ 3.92 (2H, d) is an OCH₂ next to a CH, with ¹³C 70.5.
  - δ 1.95 (1H, nonet) is coupled to 2 + 6 = 8 H.
  - δ 0.94 (6H, d) is two equivalent methyls.
  - ¹³C 27.9 (CH) and 19.1 (2 × CH₃) complete the group.
- **Carbon count.** Seven ¹³C signals for eight carbons fits one pair of equivalent methyls.
- **MS.** M⁺ 142 matches. The base peak at m/z 69 is CH₃CH=CH–C≡O⁺, the crotonyl acylium.

**Structure: CH₃CH=CHC(=O)OCH₂CH(CH₃)₂, 2-methylpropyl (E)-but-2-enoate (isobutyl (E)-crotonate).** SMILES: `C/C=C/C(=O)OCC(C)C`.

The script hand-codes the formula, DoU, topological symmetry classes and first-order ³J multiplicities for five C₈H₁₄O₂ ester candidates. Only isobutyl (E)-crotonate matches every integration, splitting count and the 7-line ¹³C count. The closest rival, (E)-crotyl isobutyrate, has the same integration pattern. It is excluded by its methine septet (6 partners, near δ 2.55) instead of a nonet (8 partners), and by its OCH₂ near δ 4.5, which is allylic and couples to a vinyl H. The isomers sec-butyl (E)-crotonate, isobutyl methacrylate and isobutyl but-3-enoate fail on counts or multiplicities. The chemical-shift assignments themselves are documented reasoning; the script does not predict shifts.

**Strong whiteboard presentation:**
- An RDKit drawing from SMILES with each ¹H signal color-linked to its hydrogens.
- A DoU step card.
- A splitting-tree diagram for the dq at 6.97 and the nonet at 1.95.
- A short candidate-elimination table, with crotyl isobutyrate shown as the decoy.
- The E geometry justified by the 15.5 Hz coupling.
