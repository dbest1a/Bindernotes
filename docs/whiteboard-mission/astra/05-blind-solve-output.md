**Q1.**
\[
\boxed{I=\frac{2\pi}{3\sqrt3}\left(\sqrt[3]{4}-1\right)=0.710285}
\]
Choose \(0<\arg z<2\pi\). The residues sum to \(e^{i\pi/3}(1-\sqrt[3]{4})/3\).
The keyhole contour gives \((1-e^{2\pi i/3})I=2\pi i\sum\mathrm{Res}\); both circular contributions vanish. **Confidence: high.**

**Q2.**
\[
\boxed{I=\frac{\pi}{3\sqrt3}\left[(\ln2)^2+\frac{8\pi^2}{27}\right]=2.05853}
\]
Introduce
\[
F(u)=\int_0^\infty\frac{x^u}{x^2+2x+4}\,dx
=\frac{\pi2^u}{\sqrt3}\frac{\sin(\pi u/3)}{\sin(\pi u)}.
\]
The requested integral is \(F''(0)\), evaluated using the removable singularity at \(u=0\). **Confidence: high.**

**Q3.**
\[
\boxed{\oint_C\mathbf F\cdot d\mathbf r=-20\pi}
\]
The curl is \((-2y-1,-2z-1,2x-1)\); the upward vector area element on the plane is \((1,1,1)\,dx\,dy\).
Stokes’ theorem reduces the integral to \(\iint_D(4x-9)\,dx\,dy\). The disk has area \(4\pi\) and mean \(x=1\). **Confidence: high.**

**Q4.**

| Equilibrium | Eigenvalues | Classification |
|---|---|---|
| \((0,0)\) | \(4,3\) | Unstable node |
| \((4,0)\) | \(-4,-1\) | Stable node |
| \((0,3)\) | \(-2,-3\) | Stable node |
| \((2,1)\) | \(\displaystyle\frac{-3\pm\sqrt{17}}2\) | Saddle |

For the interior equilibrium,
\[
\boxed{\lambda_\pm=\frac{-3\pm\sqrt{17}}2,\qquad
v_\pm=\begin{pmatrix}-1\pm\sqrt{17}\\-2\end{pmatrix}.}
\]
The limits are
\[
\boxed{(3,1.5)\longrightarrow(0,3),\qquad(1,0.5)\longrightarrow(4,0).}
\]
Classification follows from \(J=\begin{pmatrix}4-2x-2y&-2x\\-y&3-x-2y\end{pmatrix}\).
Since \((\ln(x/y))'=1-y\), the trajectories enter the invariant regions \(y>1,x<2y\) and \(y<1,x>2y\), respectively, forcing the stated limits. **Confidence: high.**

**Q5.**
\[
\boxed{J=J_3(2)\oplus J_1(-1)}
\]
Thus there is one \(3\times3\) block at \(2\) and one \(1\times1\) block at \(-1\).
\[
\boxed{
x(t)=
\begin{pmatrix}
e^{2t}(1-t-t^2/2)\\
-e^{2t}(1+t)+e^{-t}\\
-e^{2t}(t+t^2/2)\\
-e^{2t}+e^{-t}
\end{pmatrix},\quad
x(1)=
\begin{pmatrix}
-e^2/2\\
-2e^2+e^{-1}\\
-3e^2/2\\
-e^2+e^{-1}
\end{pmatrix}.}
\]
The characteristic polynomial is \((\lambda-2)^3(\lambda+1)\), with a length-three Jordan chain at \(2\).
Decomposing the initial vector into the two generalized eigenspaces produces the displayed solution. **Confidence: high.**

**Q6.**

(a) \(\boxed{\mathbb E[T_{\mathrm{HTHT}}]=20\text{ tosses},\quad \mathbb E[T_{\mathrm{THTT}}]=18\text{ tosses}}\).

(b) \(\boxed{P(\text{Alice wins})=9/14}\).

(c) \(\boxed{\mathbb E[T_{\mathrm{game}}]=90/7\text{ tosses}}\).

The single-pattern waiting times are \(2^4+2^2\) and \(2^4+2^1\), accounting for their self-overlapping prefixes.
For the competing-pattern automaton, Alice’s probabilities after initial H/T are \(5/7,4/7\); remaining expected times are \(86/7,80/7\). Averaging and including the first toss gives the answers. **Confidence: high.**

**Q7.**
\[
\boxed{(m,n)=(2,1)\ \text{or}\ (3,0).}
\]

- For \(m=0\), the sum is \(2\bmod4\); for \(m=1\), it is \(3\) or \(7\bmod8\). Neither is square.
- For even \(m=2a\ge2\), \((k-2^a)(k+2^a)=5^n\). Their difference is a power of two, forcing the factors to be \(1,5^n\), so \(5^n-1=2^{a+1}\). Even \(n\) is impossible modulo \(3\); odd \(n\) gives \(a=1\) modulo \(8\), hence \(n=1\).
- For odd \(m\ge3\), modulo \(8\) forces \(n=2r\). Factoring gives \((k-5^r,k+5^r)=(2,2^{m-1})\), hence \(5^r=2^{m-2}-1\). Modulo \(4\) forces \(m=3\), then \(r=0\).

Both pairs give \(k=3\). **Confidence: high.**

**Q8.**
\[
\boxed{IN=\frac{\sqrt5}{20}}
\]
Heron’s formula gives \(\Delta=12\sqrt5\), hence \(r=\sqrt5\) and \(R=21\sqrt5/10\).
By Feuerbach’s theorem, the incircle is internally tangent to the nine-point circle, so \(IN=R/2-r\). **Confidence: high.**

**Q9.**
\[
\boxed{\mathrm{pH}=9.138}
\]
For \(h=[H^+]\), \(C=0.00200\ \mathrm M\), solve the full balance
\[
h+2C=\frac{K_w}{h}
+C\frac{K_1h^2+2K_1K_2h+3K_1K_2K_3}
{h^3+K_1h^2+K_1K_2h+K_1K_2K_3}.
\]
This includes all four acid species and water; its root gives pH \(9.138182832\). **Confidence: high.**

**Q10.**

| NaOH added (mL) | pH |
|---:|---:|
| 0 | **2.26** |
| 10.00 | **3.41** |
| 20.00 | **5.63** |
| 30.00 | **7.85** |
| 40.00 | **10.17** |
| 45.00 | **11.85** |

\[
\boxed{V_{\mathrm{eq,1}}=20.00\ \mathrm{mL},\qquad V_{\mathrm{eq,2}}=40.00\ \mathrm{mL}.}
\]
With \(V\) in litres, use \(C_T=0.00200/(0.02500+V)\) and \([\mathrm{Na^+}]=0.1000V/(0.02500+V)\).
Each value solves \(h+[\mathrm{Na^+}]=K_w/h+C_T(K_1h+2K_1K_2)/(h^2+K_1h+K_1K_2)\). **Confidence: high.**

**Q11.**
\[
\boxed{S=7.53\times10^{-3}\ \mathrm M,\qquad
f_{\mathrm{Ag(NH_3)_2^+}}=0.9994}
\]
Writing \(L=[NH_3]\), \(a=[Ag^+]\), solve
\[
a(0.0100+S)=K_{sp},\quad S=a(1+\beta_1L+\beta_2L^2),\quad
0.250=L+a(\beta_1L+2\beta_2L^2).
\]
This gives \(L=0.23493633\ \mathrm M\); the fraction is \(\beta_2L^2/(1+\beta_1L+\beta_2L^2)\). **Confidence: high.**

**Q12.**

(a) \(\boxed{E^\circ(\mathrm{AgCl/Ag})=+0.223108\ \mathrm V}\).

(b) \(\boxed{E_{\mathrm{cell}}=+0.985\ \mathrm V}\).

(c) \(\boxed{\Delta G=-475\ \mathrm{kJ}}\), for the reaction as written.

Use \(E^\circ_{\mathrm{AgCl/Ag}}=0.7996+(RT/F)\ln K_{sp}\).
The actual reduction potentials are \(E_{\mathrm{Mn}}=1.30256373\ \mathrm V\) and \(E_{\mathrm{AgCl}}=0.31788511\ \mathrm V\); subtract them and use \(\Delta G=-5FE_{\mathrm{cell}}\) without intermediate rounding. **Confidence: high.**

**Q13.**

(a) \(\boxed{T=325.1\ \mathrm K}\).

(b) \(\boxed{K^\circ(340.0\ \mathrm K)=2.567}\).

(c) \(\boxed{P_{\mathrm{total}}=0.679\ \mathrm{bar},\qquad \alpha=0.697}\).

Integrate van ’t Hoff: \(\ln(K_2/K_1)=(58300/R)(1/T_1-1/T_2)\).
Using ideal-gas activities \(p_i/(1\ \mathrm{bar})\), the rigid-vessel balance gives \(K^\circ=1.600\alpha^2/(1-\alpha)\) and \(P_{\mathrm{total}}=0.400(1+\alpha)\ \mathrm{bar}\). **Confidence: high.**

**Q14.**

(a) \(\boxed{t_{\max B}=12.3\ \mathrm s,\qquad [B]_{\max}=0.246\ \mathrm M}\).

(b) \(\boxed{t_{[C]=0.250\,\mathrm M}=27.5\ \mathrm s}\).

Define
\[
a=\frac{39-3\sqrt{73}}{400},\qquad
b=\frac{39+3\sqrt{73}}{400}\qquad(\mathrm{s^{-1}}).
\]
The exact concentrations, with time in seconds, are
\[
\begin{aligned}
[A](t)&=\frac{0.500}{b-a}\left[(b-0.120)e^{-at}+(0.120-a)e^{-bt}\right],\\
[B](t)&=\frac{0.0600}{b-a}(e^{-at}-e^{-bt}),\\
[C](t)&=0.500-[A](t)-[B](t),
\end{aligned}
\qquad(\mathrm M).
\]
The two kinetic eigenvalues are \(-a,-b\), giving \(t_{\max B}=\ln(b/a)/(b-a)\).
The half-conversion time solves \(be^{-at}-ae^{-bt}=(b-a)/2\). **Confidence: high.**

**Q15.**

\[
\boxed{\text{(E)-2-methyl-1-phenylbut-1-ene},\qquad
\mathrm{PhCH=C(CH_3)CH_2CH_3}}
\]

Newman projection looking **C1 → C2**, with **f** = front and **b** = back:

```text
                    Br(f)
                      |
          Et(b) \     |     / Me(b)
                 \    ⊙    /
                   /  |  \
                H(f) Hβ(b) Ph(f)
```

Precisely: front Br/Ph/H occupy 12/4/8 o’clock; back Me/Hβ/Et occupy 2/6/10 o’clock. Br and Hβ are anti.

Curved electron-pair arrows:
\[
\mathrm{:OEt^-}\curvearrowright H_\beta,\qquad
\sigma(C_2-H_\beta)\curvearrowright\pi(C_1=C_2),\qquad
\sigma(C_1-Br)\curvearrowright Br.
\]

The CIP orders are Br > Ph > C2 > H at C1 and C1 > Et > Me > H at C2, confirming \(1S,2R\).
Anti elimination places the higher-priority alkene substituents Ph and Et on opposite sides, giving **E**. **Confidence: high.**

**Q16.**
\[
\boxed{\mathrm{(E)\!-\!CH_3CH=CHC(=O)OCH_2CH(CH_3)_2}}
\]
\[
\boxed{\text{2-methylpropyl (2E)-but-2-enoate}}
\]
The \(15.5\ \mathrm{Hz}\) alkene coupling establishes E geometry; the oxygenated CH₂ doublet, methine, and six-proton methyl doublet identify the 2-methylpropyl group.
The conjugated ester carbonyl and \(m/z\,69\) crotonyl fragment support the but-2-enoate portion; equivalent methyl carbons explain seven \(^{13}\mathrm C\) signals. **Confidence: high.**