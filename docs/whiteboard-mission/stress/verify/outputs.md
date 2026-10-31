# Stress-test verification outputs

Each script below was run from the repo root with:

```
uv run --no-project --with sympy --with mpmath --with scipy python docs/whiteboard-mission/stress/verify/<script>
```

uv version: uv 0.13.4 (7456b60bc 2026-10-20 x86_64-pc-windows-msvc). Each script prints a `FINAL:` line and asserts its results against [answer-key.md](../answer-key.md). A failed assertion would appear below as a traceback with a non-zero exit code.

## q01_keyhole_contour.py

```text
residue route        : 0.710285103073621 + 3.3881317890172e-21*I
closed form 2pi(4^(1/3)-1)/(3 sqrt3): 0.710285103073621
direct quadrature    : 0.710285103073621
FINAL: I = 2*pi*(4^(1/3)-1)/(3*sqrt(3)) = 0.710285
[exit code: 0]
```

## q02_log_squared_integral.py

```text
J0 = 1.2091995761561452337  vs 2pi/(3sqrt3) = 1.2091995761561452337
J1 = -3.2843e-47  (t -> 1/t antisymmetry => 0)
J2 = 3.536095247000319427  vs 16pi^3/(81sqrt3) = 3.536095247000319427
direct quadrature : 2.0585294138965755683
closed form       : 2.0585294138965755683
sympy form: pi*(27*log(2)**2 + 8*pi**2) / (81 sqrt3)
FINAL: I = pi*ln(2)^2/(3*sqrt3) + 8*pi^3/(81*sqrt3) = sqrt3*pi*(27 ln^2 2 + 8 pi^2)/243 = 2.05853
Mellin route: J0 = 2*sqrt(3)*pi/9  J1 = 0  J2 = 16*sqrt(3)*pi**3/243
[exit code: 0]
```

## q03_stokes_cylinder_plane.py

```text
curl F = [-2*y - 1, -2*z - 1, 2*x - 1]
direct line integral   = -20*pi
curl F . (1,1,1) on plane = 4*x - 9
surface integral       = -20*pi
FINAL: circulation = -20*pi = -62.831853
[exit code: 0]
```

## q04_phase_portrait.py

```text
(0,0): J=[[4, 0], [0, 3]] eigenvalues=[4, 3] -> unstable node
(0,3): J=[[-2, 0], [-3, -3]] eigenvalues=[-2, -3] -> stable node
(2,1): J=[[-2, -4], [-1, -1]] eigenvalues=[-sqrt(17)/2 - 3/2, -3/2 + sqrt(17)/2] -> saddle
(4,0): J=[[-4, -8], [0, -1]] eigenvalues=[-1, -4] -> stable node
saddle eigenvalue -3/2 + sqrt(17)/2 ~ 0.561553 eigenvector (1, -sqrt(17)/8 - 1/8), slope -0.640388
saddle eigenvalue -sqrt(17)/2 - 3/2 ~ -3.56155 eigenvector (1, -1/8 + sqrt(17)/8), slope 0.390388
separatrix crosses x = 3.0: y = 1.373878
separatrix crosses x = 1.0: y = 0.583707
separatrix crosses x = 0.5: y = 0.342415
upper separatrix branch comes in from infinity; lower branch emanates from the unstable node (0,0)
trajectory from (3.0, 1.5) -> (0.0, 3.0)   (start lies above the separatrix, which is at y=1.3739)
trajectory from (1.0, 0.5) -> (4.0, 0.0)   (start lies below the separatrix, which is at y=0.5837)
trajectory from (0.5, 0.5) -> (0.0, 3.0)   (start lies above the separatrix, which is at y=0.3424)
FINAL: (0,0) unstable node [4,3]; (4,0) stable node [-4,-1]; (0,3) stable node [-2,-3]; (2,1) saddle [(-3+sqrt17)/2, (-3-sqrt17)/2]; (3,1.5)->(0,3); (1,0.5)->(4,0)
[exit code: 0]
```

## q05_jordan_exponential.py

```text
char poly: (lambda - 2)**3*(lambda + 1)
rank (A-2I)^1 = 3
rank (A-2I)^2 = 2
rank (A-2I)^3 = 1
rank (A+I) = 3
Jordan form J = [[-1, 0, 0, 0], [0, 2, 1, 0], [0, 0, 2, 1], [0, 0, 0, 2]]
x(t) = [-(t**2 + 2*t - 2)*exp(2*t)/2, -(t*exp(3*t) + exp(3*t) - 1)*exp(-t), -t*(t + 2)*exp(2*t)/2, -(exp(t) - 1)*(exp(2*t) + exp(t) + 1)*exp(-t)]
x(1) exact = [-exp(2)/2, (1 - 2*exp(3))*exp(-1), -3*exp(2)/2, (1 - exp(3))*exp(-1)]
x(1) numeric (sympy) = ['-3.694528', '-14.410233', '-11.083584', '-7.021177']
x(1) numeric (scipy expm) = ['-3.694528', '-14.410233', '-11.083584', '-7.021177']
FINAL: J = diag(J_3(2), J_1(-1)); x(1) = (-e^2/2, e^-1 - 2e^2, -3e^2/2, e^-1 - e^2) ~ (-3.6945, -14.4102, -11.0836, -7.0212)
[exit code: 0]
```

## q06_penney_patterns.py

```text
E[wait for HTHT] = 20   (Conway AA = 20)
E[wait for THTT] = 18   (Conway BB = 18)
P(HTHT first) = 9/14,  P(THTT first) = 5/14
Conway odds A:B = 18:10 -> P(A) = 9/14
E[game length] = 90/7 = 12.857143
Monte Carlo (200000): P(A) ~ 0.6437, E[len] ~ 12.825
Conway game length (AA*BB-AB*BA)/(AA+BB-AB-BA) = 90/7  [AA=20, BB=18, AB=10, BA=0]
FINAL: E[HTHT]=20, E[THTT]=18, P(Alice/HTHT first)=9/14, E[game length]=90/7
[exit code: 0]
```

## q07_exponential_diophantine.py

```text
brute force m<400, n<200: [(2, 1, 3), (3, 0, 3)]
squares mod 3: [0, 1]  mod 4: [0, 1]  mod 5: [0, 1, 4]  mod 8: [0, 1, 4]
2^m mod 5 cycle: [1, 2, 4, 3] (square residues only for m even)
5^n mod 8 for odd n: [5]
(m even, n even, n>=1) -> 2^m+5^n mod 3: [2]
FINAL: (m, n) = (2, 1) [4+5=9] and (3, 0) [8+1=9]; no others
[exit code: 0]
```

## q08_feuerbach_distance.py

```text
A = [2, 3*sqrt(5)]  (B=(0,0), C=(8,0))
O = [4, 11*sqrt(5)/10]  H = [2, 4*sqrt(5)/5]  N = [3, 19*sqrt(5)/20]  I = [3, sqrt(5)]
R = 21*sqrt(5)/10  r = sqrt(5)
IN = sqrt(5)/20 = 0.1118033989   R/2 - r = sqrt(5)/20
OI = sqrt(105)/10  check R(R-2r) = 21/20  OI^2 = 21/20
OH = sqrt(445)/10  nine-point radius R/2 = 21*sqrt(5)/20
Feuerbach point F = [3.0000000, 4.4721360]
FINAL: IN = sqrt(5)/20 = 0.111803
[exit code: 0]
```

## q09_polyprotic_exact_ph.py

```text
exact pH = 9.138182832
species (M): H3A 2.092e-12  H2A- 1.617e-05  HA2- 1.981e-03  A3- 2.427e-06
[H+] = 7.275e-10  [OH-] = 1.375e-05
naive (pKa2+pKa3)/2 = 9.55
textbook improved formula pH = 9.1399059
bisection pH = 9.138182832
FINAL: pH = 9.138 (3 d.p.; naive 9.55, improved amphiprotic formula 9.140)
[exit code: 0]
```

## q10_diprotic_titration.py

```text
Veq1 = 20.00 mL, Veq2 = 40.00 mL
V =      0 mL  pH = 2.263769  -> 2.26
V =  10.00 mL  pH = 3.4117329  -> 3.41
V =  20.00 mL  pH = 5.6269559  -> 5.63
V =  30.00 mL  pH = 7.8500131  -> 7.85
V =  40.00 mL  pH = 10.168017  -> 10.17
V =  45.00 mL  pH = 11.854044  -> 11.85
shortcut checks: V=10 Henderson pKa1 = 3.40; V=20 (pKa1+pKa2)/2 = 5.625; V=30 pKa2 = 7.85
curve samples (mL, pH): (0,2.26), (2.5,2.66), (5,2.96), (7.5,3.20), (10,3.41), (12.5,3.63), (15,3.88), (17.5,4.25), (20,5.63), (22.5,7.01), (25,7.37), (27.5,7.63), (30,7.85), (32.5,8.07), (35,8.33), (37.5,8.69), (40,10.17), (42.5,11.57), (45,11.85), (47.5,12.01), (50,12.12)
FINAL: pH(0, 10, 20, 30, 40, 45 mL) = 2.26, 3.41, 5.63, 7.85, 10.17, 11.85
[exit code: 0]
```

## q11_complexation_solubility.py

```text
S = 7.534109e-03 M,  free [NH3] = 0.234936 M,  [Ag+] = 1.0836e-08 M,  [Cl-] = 0.017534 M
fractions Ag+ / AgNH3+ / Ag(NH3)2+ = 1.438e-06 / 6.009e-04 / 0.999398
scipy fsolve: S = 7.534109e-03, [NH3] = 0.234936
naive (no NH3 depletion, beta2 only) S = 8.2097e-03
for comparison, no added NaCl: S = 1.1141e-02
FINAL: S = 0.00753 mol/L (7.53e-3 M); [Ag(NH3)2+]/S = 0.9994
[exit code: 0]
```

## q12_nernst_permanganate_agcl.py

```text
(RT/F) ln10 = 0.059159 V
E°(AgCl/Ag) = 0.2231 V
E(cathode, MnO4-/Mn2+) = 1.30256 V
E(anode, AgCl/Ag)      = 0.31789 V  (check via Ag+/Ag: 0.31789 V)
E°cell = 1.2889 V
Ecell = 0.98468 V  (from overall Q: 0.98468 V)
dG = -475.04 kJ per mol reaction (n = 5)
log10 K = 108.93
sensitivity: with 0.05916 V instead of exact RT ln10/F, Ecell = 0.98468 V
FINAL: Ecell = 0.985 V; dG = -475 kJ/mol (per 5 e-, reaction as written)
[exit code: 0]
```

## q13_vant_hoff_n2o4.py

```text
(a) T(K=1) = 325.135 K
(b) K(340.0 K) = 2.56730
(c) x = 0.27885 bar, P(N2O4) = 0.12115 bar, P(NO2) = 0.55770 bar, P_total = 0.67885 bar, alpha = 0.69712
implied dS° = 179.310 J/(mol K); dH/dS = 325.135 K (same as (a))
FINAL: T(K=1) = 325.1 K; K(340.0 K) = 2.567; P_total = 0.679 bar; alpha = 0.697
[exit code: 0]
```

## q14_reversible_consecutive_kinetics.py

```text
eigenvalues: [-39/400 - 3*sqrt(73)/400, -39/400 + 3*sqrt(73)/400] = [-0.16158002808988148, -0.033419971910118515]
[B](t) = 4*(3*exp(3*sqrt(73)*t/200) + sqrt(73)*exp(3*sqrt(73)*t/200) - sqrt(73) - 3)*exp(-3*t*(sqrt(73) + 13)/400)/(3*sqrt(73) + 73)
t_max = ln(l+/l-)/(l+ - l-) = 200*sqrt(73)*log((3*sqrt(73)/400 + 39/400)/(39/400 - 3*sqrt(73)/400))/219 = 12.295928343152843 s
[B]max = 0.2462062776187699 M
t([C] = 0.250 M) = 27.49095095 s
ODE check: t_max ~ 12.2959 s, [B]max ~ 0.246206 M, t(C=0.25) ~ 27.4910 s
SSA effective k = 0.0720 s^-1 -> SSA t(C=0.25) = 9.63 s (badly off)
Vieta check: l+ * l- = k1*k2 = 0.0054 ; l+ + l- = k1+k-1+k2 = 0.195
closed form: [B] = k1[A]0/(l+ - l-) * (exp(-l- t) - exp(-l+ t))
FINAL: t_max = 12.3 s, [B]max = 0.246 M, t(C=0.250 M) = 27.5 s
[exit code: 0]
```

## q15_e2_stereochemistry.py

```text
calibration (1R,2R)-1-bromo-1,2-diphenylpropane: Newman azimuths {'C1': {'Br': 0, 'H': 120, 'Ph': 240}, 'C2': {'H': 180, 'Ph': 300, 'CH3': 60}} cis pairs [('H', 'CH3'), ('Ph', 'Ph')] -> Z
(1S,2R)-1-bromo-2-methyl-1-phenylbutane: Newman azimuths {'C1': {'Br': 0, 'Ph': 120, 'H': 240}, 'C2': {'H': 180, 'Et': 300, 'CH3': 60}}, cis pairs [('Ph', 'CH3'), ('H', 'Et')] -> (E)-2-methyl-1-phenylbut-1-ene
(1R,2S)-1-bromo-2-methyl-1-phenylbutane: Newman azimuths {'C1': {'Br': 0, 'H': 120, 'Ph': 240}, 'C2': {'H': 180, 'CH3': 300, 'Et': 60}}, cis pairs [('H', 'Et'), ('Ph', 'CH3')] -> (E)-2-methyl-1-phenylbut-1-ene
(1S,2S)-1-bromo-2-methyl-1-phenylbutane: Newman azimuths {'C1': {'Br': 0, 'Ph': 120, 'H': 240}, 'C2': {'H': 180, 'CH3': 300, 'Et': 60}}, cis pairs [('Ph', 'Et'), ('H', 'CH3')] -> (Z)-2-methyl-1-phenylbut-1-ene
(1R,2R)-1-bromo-2-methyl-1-phenylbutane: Newman azimuths {'C1': {'Br': 0, 'H': 120, 'Ph': 240}, 'C2': {'H': 180, 'Et': 300, 'CH3': 60}}, cis pairs [('H', 'CH3'), ('Ph', 'Et')] -> (Z)-2-methyl-1-phenylbut-1-ene
substrate C11H15Br: DoU = 4.0 ; product C11H14: DoU = 5.0
beta-carbons of C1: C2 (one H) and phenyl ipso C (no H) -> exactly one E2 product; no regiochemistry choice
FINAL: (1S,2R) substrate gives (E)-2-methyl-1-phenylbut-1-ene, i.e. [(E)-2-methylbut-1-en-1-yl]benzene
[exit code: 0]
```

## q16_nmr_structure.py

```text
observed (nH, 3J partners): [(1, 1), (1, 4), (1, 8), (2, 1), (3, 1), (6, 1)] ; observed 13C count: 7
--- isobutyl (E)-but-2-enoate  CH3-CH=CH-CO-O-CH2-CH(CH3)2: C8H14O2, DoU = 2, 13C signals = 7, 1H environments = 6
    1H  3J partners =  8  -> 9-line envelope   CH ~1.9-2.0 (8 neighbours)
    1H  3J partners =  4  -> 5-line envelope   H-beta ~6.9-7.0 (deshielded beta-H of enoate)
    1H  3J partners =  1  -> 2-line envelope   H-alpha ~5.8
    2H  3J partners =  1  -> 2-line envelope   OCH2 ~3.9
    3H  3J partners =  1  -> 2-line envelope   
    6H  3J partners =  1  -> 2-line envelope   
    matches every integration + multiplicity + 13C count: True
--- (E)-but-2-enyl 2-methylpropanoate (crotyl isobutyrate): C8H14O2, DoU = 2, 13C signals = 7, 1H environments = 6
    1H  3J partners =  6  -> 7-line envelope   CH ~2.55 septet
    1H  3J partners =  4  -> 5-line envelope   vinyl ~5.8
    1H  3J partners =  3  -> 4-line envelope   vinyl ~5.6
    2H  3J partners =  1  -> 2-line envelope   OCH2 ~4.5 (allylic)
    3H  3J partners =  1  -> 2-line envelope   
    6H  3J partners =  1  -> 2-line envelope   
    matches every integration + multiplicity + 13C count: False
--- sec-butyl (E)-but-2-enoate: C8H14O2, DoU = 2, 13C signals = 8, 1H environments = 7
    1H  3J partners =  5  -> 6-line envelope   OCH ~4.9 sextet
    1H  3J partners =  4  -> 5-line envelope   
    2H  3J partners =  4  -> 5-line envelope   
    3H  3J partners =  2  -> 3-line envelope   
    1H  3J partners =  1  -> 2-line envelope   
    3H  3J partners =  1  -> 2-line envelope   
    3H  3J partners =  1  -> 2-line envelope   
    matches every integration + multiplicity + 13C count: False
--- isobutyl 2-methylprop-2-enoate (isobutyl methacrylate): C8H14O2, DoU = 2, 13C signals = 7, 1H environments = 5
    1H  3J partners =  8  -> 9-line envelope   
    2H  3J partners =  1  -> 2-line envelope   
    6H  3J partners =  1  -> 2-line envelope   
    2H  3J partners =  0  -> 1-line envelope   =CH2 (two 1H singlets ~6.1/5.5)
    3H  3J partners =  0  -> 1-line envelope   
    matches every integration + multiplicity + 13C count: False
--- isobutyl but-3-enoate: C8H14O2, DoU = 2, 13C signals = 7, 1H environments = 6
    1H  3J partners =  8  -> 9-line envelope   
    1H  3J partners =  4  -> 5-line envelope   
    2H  3J partners =  1  -> 2-line envelope   
    2H  3J partners =  1  -> 2-line envelope   CH2 ~3.1 d
    2H  3J partners =  1  -> 2-line envelope   
    6H  3J partners =  1  -> 2-line envelope   
    matches every integration + multiplicity + 13C count: False
candidates consistent with the data: ['isobutyl (E)-but-2-enoate  CH3-CH=CH-CO-O-CH2-CH(CH3)2']
3J(H-alpha,H-beta) = 15.5 Hz -> trans (E); a Z-enoate shows ~11.5 Hz. IR 968 cm-1 (trans CH=CH wag) agrees.
FINAL: 2-methylpropyl (E)-but-2-enoate (isobutyl (E)-crotonate), C8H14O2, DoU 2
[exit code: 0]
```

