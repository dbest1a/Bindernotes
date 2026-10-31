// Chemistry boards Q9–Q16. Every number written into a step is computed here from the question's data
// and asserted against the answer key; the board's checker then re-verifies it independently.
import { r, solution, desmos, molecule, text, arrow, line, ellipse, rect, EX } from "./lib.mjs";
import { L, COL, fmt, slider } from "./gen-math.mjs";

const bisect = (f, lo, hi, iterations = 200) => {
  let flo = f(lo);
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.sign(fm) === Math.sign(flo)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
};
const assertClose = (label, value, expected, tol) => {
  if (Math.abs(value - expected) > tol) throw new Error(`${label}: ${value} differs from key ${expected}`);
};
const f = (value, digits) => value.toFixed(digits);
export const boards = {};

// ---------------------------------------------------------------- Q9
{
  const K1 = 10 ** -2.25, K2 = 10 ** -7.05, K3 = 10 ** -12.05, Kw = 1e-14, C = 2e-3;
  const D = (h) => h ** 3 + K1 * h ** 2 + K1 * K2 * h + K1 * K2 * K3;
  const proton = (h) => h + (C * K1 * h ** 2) / D(h) + (2 * C * h ** 3) / D(h) - (C * K1 * K2 * K3) / D(h) - Kw / h;
  const pH = bisect((p) => proton(10 ** -p), 8, 10);
  assertClose("Q9 pH", pH, 9.13818, 5e-5);
  const p = f(pH, 5);
  const h = 10 ** -Number(p);
  const r1 = h / K2, r3 = K3 / h, r0 = h ** 2 / (K1 * K2);
  const HA = (C * 1e6) / (1 + r1 + r3 + r0);
  const naive = (7.05 + 12.05) / 2;
  const improved = -Math.log10(Math.sqrt((K2 * (K3 * C + Kw)) / (K2 + C)));
  boards[9] = {
    title: "Q9 Exact pH of Na2HA",
    subject: "Chemistry",
    modules: [
      solution("q9-sol", {
        title: "Q9 · Exact pH of 2.00 mM Na₂HA",
        problem: r`H$_3$A: p$K_{a1}=2.25$, p$K_{a2}=7.05$, p$K_{a3}=12.05$. Find the pH of $2.00\times10^{-3}$ M Na$_2$HA from the full charge balance (3 d.p.).`,
        steps: [
          [r`2C+h = C(\alpha_1+2\alpha_2+3\alpha_3)+\frac{K_w}{h}`, "Charge balance with [Na⁺] = 2C. α are the species fractions, denominator D = h³ + K₁h² + K₁K₂h + K₁K₂K₃."],
          [r`h+C\alpha_1+2C\alpha_0 = C\alpha_3+\frac{K_w}{h}`, "Subtract the mass balance: proton condition [H⁺] + [H₂A⁻] + 2[H₃A] = [A³⁻] + [OH⁻]. Solved numerically: pH = " + p + "."],
          [r`\frac{10^{-${p}}}{10^{-7.05}} \approx ${fmt(r1, 5)}`, "[H₂A⁻]/[HA²⁻] = h/K₂ at the solution."],
          [r`\frac{10^{-12.05}}{10^{-${p}}} \approx ${fmt(r3, 5)}`, "[A³⁻]/[HA²⁻] = K₃/h."],
          [r`\frac{2000}{1+\frac{10^{-${p}}}{10^{-7.05}}+\frac{10^{-12.05}}{10^{-${p}}}+\frac{10^{-2\cdot${p}}}{10^{-2.25}\cdot10^{-7.05}}} \approx ${fmt(HA, 6)}`, "[HA²⁻] in µM (C = 2000 µM)."],
          [r`${fmt(HA, 6)}\cdot${fmt(r1, 5)} \approx ${fmt(HA * r1, 4)}`, "[H₂A⁻] in µM."],
          [r`${fmt(HA, 6)}\cdot${fmt(r3, 5)} \approx ${fmt(HA * r3, 4)}`, "[A³⁻] in µM."],
          [r`10^{6}\cdot\frac{10^{-14}}{10^{-${p}}} \approx ${fmt((1e6 * Kw) / h, 4)}`, "[OH⁻] in µM: much larger than [A³⁻], which is why the shortcut fails."],
          [r`10^{6}\cdot10^{-${p}}+${fmt(HA * r1, 4)}+2\cdot${fmt(HA * r0, 3)} \approx ${fmt(HA * r3, 4)}+${fmt((1e6 * Kw) / h, 4)}`, "Proton condition balances in µM: left (H⁺ + H₂A⁻ + 2H₃A) = right (A³⁻ + OH⁻)."],
          [r`\frac{7.05+12.05}{2} = ${naive}`, "Contrast: the naive (pK₂ + pK₃)/2 is badly wrong here."],
          [r`-\log_{10}\sqrt{\frac{10^{-7.05}\left(10^{-12.05}\cdot0.002+10^{-14}\right)}{10^{-7.05}+0.002}} \approx ${fmt(improved, 5)}`, "Contrast: the improved formula gives 9.140, which misses at 3 d.p."],
        ],
        answer: r`\mathrm{pH}=${f(pH, 3)}`,
      }, L.sol),
      desmos("q9-residual", "Proton-condition residual vs pH (µM)", L.right1, {
        viewport: { xmin: 8.4, xmax: 9.9, ymin: -60, ymax: 60 },
        list: [
          r`K_{1}=10^{-2.25}`,
          r`K_{2}=10^{-7.05}`,
          r`K_{3}=10^{-12.05}`,
          r`C=0.002`,
          r`D(h)=h^{3}+K_{1}h^{2}+K_{1}K_{2}h+K_{1}K_{2}K_{3}`,
          r`P(h)=10^{6}\left(h+\frac{CK_{1}h^{2}+2Ch^{3}-CK_{1}K_{2}K_{3}}{D(h)}-\frac{10^{-14}}{h}\right)`,
          { latex: r`y=P\left(10^{-x}\right)`, color: COL.blue, lineWidth: "3" },
          { latex: r`(${p},0)`, color: COL.red, showLabel: true, label: `pH = ${f(pH, 3)} (C = 2.00 mM)`, labelOrientation: "above_right" },
          { latex: r`x=9.55`, color: COL.gray, lineStyle: "DASHED" },
          { latex: r`(9.55,-40)`, hidden: true, showLabel: true, label: "naive 9.55", color: COL.gray, labelOrientation: "left" },
        ],
      }),
      desmos("q9-alpha", "Species fractions α vs pH", L.right2, {
        viewport: { xmin: 0, xmax: 14, ymin: -0.08, ymax: 1.1 },
        list: [
          r`K_{1}=10^{-2.25}`,
          r`K_{2}=10^{-7.05}`,
          r`K_{3}=10^{-12.05}`,
          r`D(h)=h^{3}+K_{1}h^{2}+K_{1}K_{2}h+K_{1}K_{2}K_{3}`,
          r`a_{0}(x)=\frac{10^{-3x}}{D(10^{-x})}`,
          r`a_{1}(x)=\frac{K_{1}10^{-2x}}{D(10^{-x})}`,
          r`a_{2}(x)=\frac{K_{1}K_{2}10^{-x}}{D(10^{-x})}`,
          r`a_{3}(x)=\frac{K_{1}K_{2}K_{3}}{D(10^{-x})}`,
          { latex: r`y=a_{0}(x)`, color: COL.red, lineWidth: "3" },
          { latex: r`y=a_{1}(x)`, color: COL.orange, lineWidth: "3" },
          { latex: r`y=a_{2}(x)`, color: COL.green, lineWidth: "3" },
          { latex: r`y=a_{3}(x)`, color: COL.blue, lineWidth: "3" },
          { latex: r`x=${p}`, color: COL.black, lineStyle: "DASHED" },
          r`q=10.5`,
          r`w_{1}=\frac{\operatorname{round}\left(10^{4}a_{1}(q)\right)}{10^{4}}`,
          r`w_{2}=\frac{\operatorname{round}\left(10^{4}a_{2}(q)\right)}{10^{4}}`,
          r`w_{3}=\frac{\operatorname{round}\left(10^{4}a_{3}(q)\right)}{10^{4}}`,
          r`q_{r}=\frac{\operatorname{round}\left(100q\right)}{100}`,
          { latex: r`(q,a_{2}(q))`, color: COL.green, dragMode: "X", pointSize: "14", showLabel: true, label: "drag", labelOrientation: "above" },
          { latex: r`(3.3,0.52)`, hidden: true, showLabel: true, label: "at pH ${q_r}:", color: COL.gray, labelOrientation: "right" },
          { latex: r`(3.3,0.41)`, hidden: true, showLabel: true, label: "α(H₂A⁻) = ${w_1}", color: COL.orange, labelOrientation: "right" },
          { latex: r`(3.3,0.30)`, hidden: true, showLabel: true, label: "α(HA²⁻) = ${w_2}", color: COL.green, labelOrientation: "right" },
          { latex: r`(3.3,0.19)`, hidden: true, showLabel: true, label: "α(A³⁻) = ${w_3}", color: COL.blue, labelOrientation: "right" },
          { latex: r`(1.2,0.9)`, hidden: true, showLabel: true, label: "H₃A", color: COL.red },
          { latex: r`(4.6,0.9)`, hidden: true, showLabel: true, label: "H₂A⁻", color: COL.orange },
          { latex: r`(8.2,1.03)`, hidden: true, showLabel: true, label: `HA²⁻ (pH ${f(pH, 3)})`, color: COL.green },
          { latex: r`(13.2,0.9)`, hidden: true, showLabel: true, label: "A³⁻", color: COL.blue },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q10
{
  const K1 = 10 ** -3.4, K2 = 10 ** -7.85, Kw = 1e-14;
  const residual = (V, h) => {
    const CA = 2 / (25 + V), Na = (0.1 * V) / (25 + V);
    return Na + h - (CA * (K1 * h + 2 * K1 * K2)) / (h * h + K1 * h + K1 * K2) - Kw / h;
  };
  const volumes = [0, 10, 20, 30, 40, 45];
  const keyPH = [2.26, 3.41, 5.63, 7.85, 10.17, 11.85];
  const pHs = volumes.map((V, i) => {
    const value = bisect((p) => residual(V, 10 ** -p), 1, 13);
    assertClose(`Q10 pH at ${V} mL`, Number(value.toFixed(2)), keyPH[i], 1e-9);
    return value;
  });
  const balance = (V, pH) => {
    // ν = (K₁h + 2K₁K₂)/(h² + K₁h + K₁K₂), divided through by K₁h; everything in mM.
    const p = Number(f(pH, 4));
    const e = (value) => f(value, 4);
    const Na = V === 0 ? "0" : r`\frac{100\cdot${V}}{${25 + V}}`;
    return r`${Na}+10^{${e(3 - p)}} \approx \frac{2000}{${25 + V}}\cdot\frac{1+2\cdot10^{${e(p - 7.85)}}}{10^{${e(3.4 - p)}}+1+10^{${e(p - 7.85)}}}+10^{${e(p - 11)}}`;
  };
  boards[10] = {
    title: "Q10 Diprotic titration curve",
    subject: "Chemistry",
    modules: [
      solution("q10-sol", {
        title: "Q10 · 25.00 mL of 0.0800 M H₂A vs 0.1000 M NaOH",
        problem: r`p$K_{a1}=3.40$, p$K_{a2}=7.85$. Exact charge balance with dilution: pH at 0, 10, 20, 30, 40, 45 mL, and both equivalence volumes.`,
        steps: [
          [r`\frac{25.00\cdot0.0800}{0.1000} = 20.00,\quad 2\cdot20.00 = 40.00`, "2.000 mmol H₂A: V_eq1 = 20.00 mL and V_eq2 = 40.00 mL."],
          [r`\mathrm{Na}+h = C_A\frac{K_1h+2K_1K_2}{h^2+K_1h+K_1K_2}+\frac{K_w}{h}`, "Charge balance at volume V: C_A = 2.000/(25 + V) M, [Na⁺] = 0.1000·V/(25 + V) M. Each line below is this balance in mM at the solved pH, with the fraction divided through by K₁h: (1 + 2K₂/h)/(h/K₁ + 1 + K₂/h)."],
          ...volumes.map((V, i) => [balance(V, pHs[i]), `V = ${V.toFixed(2)} mL: pH = ${pHs[i].toFixed(4)} → ${pHs[i].toFixed(2)}.`]),
          [r`3.40+\log_{10}\frac{1.000}{1.000} = 3.40,\quad \frac{3.40+7.85}{2} = 5.625`, "Shortcuts (Henderson at 10 mL, amphiprotic average at 20 mL) are close but not exact: K₁ is large relative to C."],
        ],
        answer: r`\mathrm{pH}: ${pHs.map((value) => value.toFixed(2)).join(",\\ ")}\ \text{at}\ 0,10,20,30,40,45\ \text{mL};\ V_{eq}=20.00,\ 40.00\ \text{mL}`,
      }, L.sol),
      desmos("q10-curve", "Titration curve from the exact charge balance", L.rightFull, {
        viewport: { xmin: -2, xmax: 52, ymin: 0, ymax: 14 },
        list: [
          r`p_{1}=3.4`,
          r`p_{2}=7.85`,
          r`c=0.08`,
          r`K_{1}=10^{-p_{1}}`,
          r`K_{2}=10^{-p_{2}}`,
          r`n=25c`,
          r`\nu(h)=\frac{K_{1}h+2K_{1}K_{2}}{h^{2}+K_{1}h+K_{1}K_{2}}`,
          r`V(h)=\frac{n\nu(h)-25\left(h-\frac{10^{-14}}{h}\right)}{0.1+h-\frac{10^{-14}}{h}}`,
          { latex: r`\left(V\left(10^{-t}\right),t\right)\left\{0\le V\left(10^{-t}\right)\le50\right\}`, color: COL.blue, lineWidth: "3", parametricDomain: { min: "1", max: "13" } },
          { latex: r`x=10n`, color: COL.gray, lineStyle: "DASHED" },
          { latex: r`x=20n`, color: COL.gray, lineStyle: "DASHED" },
          { latex: r`x=5n`, color: COL.gray, lineStyle: "DOTTED" },
          { latex: r`x=15n`, color: COL.gray, lineStyle: "DOTTED" },
          ...volumes.map((V, i) => ({ latex: r`(${V},${pHs[i].toFixed(4)})`, color: COL.red, pointSize: "11", showLabel: true, label: `${V} mL: pH ${pHs[i].toFixed(2)}`, labelOrientation: ["right", "above_left", "above_left", "below_right", "below_right", "above_left"][i] })),
          { latex: r`(20,0.8)`, hidden: true, showLabel: true, label: "V_eq1 = 20.00 mL", color: COL.gray, labelOrientation: "right" },
          { latex: r`(40,0.8)`, hidden: true, showLabel: true, label: "V_eq2 = 40.00 mL", color: COL.gray, labelOrientation: "right" },
          { latex: r`(1,13.2)`, hidden: true, showLabel: true, label: "x: V NaOH (mL)   y: pH   dotted: half-equivalence (10, 30 mL)", color: COL.gray, labelOrientation: "right" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q11
{
  const Ksp = 1.9e-10, b1 = 10 ** 3.25, b2 = 10 ** 7.1, NT = 0.25, Cl0 = 0.01;
  // For a trial free NH3 (L), S follows from the Ksp/complex balance; then match total NH3.
  const sOf = (Lf) => { const phi = 1 + b1 * Lf + b2 * Lf * Lf; return (-Cl0 + Math.sqrt(Cl0 * Cl0 + 4 * Ksp * phi)) / 2; };
  const ntOf = (Lf) => { const S = sOf(Lf); const ag = Ksp / (Cl0 + S); return Lf + ag * (b1 * Lf + 2 * b2 * Lf * Lf); };
  const Lf = bisect((x) => ntOf(x) - NT, 0.1, 0.25);
  const S = sOf(Lf);
  const ag = Ksp / (Cl0 + S);
  const phi = 1 + b1 * Lf + b2 * Lf * Lf;
  const frac2 = (b2 * Lf * Lf) / phi;
  assertClose("Q11 S", Number(S.toPrecision(3)), 7.53e-3, 1e-12);
  assertClose("Q11 fraction", Number(frac2.toPrecision(4)), 0.9994, 1e-9);
  const Ls = Lf.toPrecision(6), Ss = (S * 1000).toPrecision(6);
  // Label anchors placed on each balance curve (x = S in mM, y = free NH3 in M).
  const agY = (xm) => { const target = (0.001 * xm * (Cl0 + 0.001 * xm)) / Ksp; return bisect((y) => 1 + b1 * y + b2 * y * y - target, 0, 1); };
  const nhY = (xm) => { const a = Ksp / (Cl0 + 0.001 * xm); return bisect((y) => y + a * (b1 * y + 2 * b2 * y * y) - NT, 0, 0.25); };
  const agLabel = [7.75, agY(7.75)];
  const nhLabel = [6.4, nhY(6.4)];
  boards[11] = {
    title: "Q11 AgCl in ammonia with chloride",
    subject: "Chemistry",
    modules: [
      solution("q11-sol", {
        title: "Q11 · AgCl in 0.250 M NH₃ + 0.0100 M NaCl",
        problem: r`$K_{sp}=1.9\times10^{-10}$, $\log\beta_1=3.25$, $\log\beta_2=7.10$. Find the molar solubility $S$ (3 s.f.) and the fraction of dissolved Ag as Ag(NH$_3$)$_2^+$ (4 s.f.).`,
        steps: [
          [r`S = \frac{K_{sp}}{0.0100+S}\left(1+\beta_1L+\beta_2L^2\right)`, "Silver balance; [Cl⁻] = 0.0100 + S and L = free NH₃."],
          [r`0.250 = L+\frac{K_{sp}}{0.0100+S}\left(\beta_1L+2\beta_2L^2\right)`, "Ammonia balance, counting NH₃ bound in the complexes. Solved together: S = " + Ss + " mM, L = " + Ls + " M."],
          [r`10^{9}\cdot\frac{1.9\times10^{-10}}{0.0100+${Ss}\times10^{-3}} \approx ${fmt(ag * 1e9, 5)}`, "[Ag⁺] in nM."],
          [r`10^{3}\cdot${fmt(ag * 1e9, 5)}\times10^{-9}\left(1+10^{3.25}\cdot${Ls}+10^{7.10}\cdot${Ls}^2\right) \approx ${Ss}`, "Silver balance holds (mM): S = [Ag⁺](1 + β₁L + β₂L²)."],
          [r`10^{3}\left(${Ls}+${fmt(ag * 1e9, 5)}\times10^{-9}\left(10^{3.25}\cdot${Ls}+2\cdot10^{7.10}\cdot${Ls}^2\right)\right) \approx 250.0`, "Ammonia balance holds (mM)."],
          [r`\frac{10^{7.10}\cdot${Ls}^2}{1+10^{3.25}\cdot${Ls}+10^{7.10}\cdot${Ls}^2} \approx ${frac2.toPrecision(5)}`, "Fraction of dissolved silver present as Ag(NH₃)₂⁺."],
          [r`10^{4}\cdot\frac{10^{3.25}\cdot${Ls}}{1+10^{3.25}\cdot${Ls}+10^{7.10}\cdot${Ls}^2} \approx ${fmt((1e4 * b1 * Lf) / phi, 3)}`, "Ag(NH₃)⁺ fraction ×10⁴ (≈ 6.0 × 10⁻⁴); free Ag⁺ is about 1.4 × 10⁻⁶."],
        ],
        answer: r`S=${(S * 1000).toPrecision(3)}\times10^{-3}\ \mathrm{M};\quad \text{fraction as Ag(NH}_3)_2^+=${frac2.toPrecision(4)}`,
      }, L.sol),
      desmos("q11-balances", "The two balances in the (S, L) plane", L.right1, {
        viewport: { xmin: 5.5, xmax: 9.5, ymin: 0.228, ymax: 0.242 },
        list: [
          r`K=1.9\cdot10^{-10}`,
          r`\beta_{1}=10^{3.25}`,
          r`\beta_{2}=10^{7.1}`,
          r`N_{T}=0.25`,
          r`a(x)=\frac{K}{0.01+0.001x}`,
          { latex: r`0.001x=a(x)\left(1+\beta_{1}y+\beta_{2}y^{2}\right)`, color: COL.blue, lineWidth: "3" },
          { latex: r`y+a(x)\left(\beta_{1}y+2\beta_{2}y^{2}\right)=N_{T}`, color: COL.red, lineWidth: "3" },
          { latex: r`(${Ss},${Ls})`, color: COL.black, pointSize: "12", showLabel: true, label: `solution: S = ${(S * 1000).toPrecision(3)} mM, L = ${Number(Ls).toFixed(4)} M`, labelOrientation: "below_right" },
          { latex: r`(${agLabel[0].toFixed(3)},${agLabel[1].toFixed(5)})`, hidden: true, showLabel: true, label: "Ag balance: S = [Ag⁺](1 + β₁L + β₂L²)", color: COL.blue, labelOrientation: "left" },
          { latex: r`(${nhLabel[0].toFixed(3)},${nhLabel[1].toFixed(5)})`, hidden: true, showLabel: true, label: "NH₃ balance: 0.250 = L + bound NH₃", color: COL.red, labelOrientation: "above" },
          { latex: r`(5.6,0.2288)`, hidden: true, showLabel: true, label: "x: S (mM)   y: free NH₃ L (M)", color: COL.gray, labelOrientation: "right" },
        ],
      }),
      desmos("q11-solubility", "Solubility vs total NH₃ (exact, parametric in free NH₃)", L.right2, {
        viewport: { xmin: -0.02, xmax: 0.52, ymin: -1, ymax: 17 },
        list: [
          r`K=1.9\cdot10^{-10}`,
          r`\beta_{1}=10^{3.25}`,
          r`\beta_{2}=10^{7.1}`,
          r`\phi(l)=1+\beta_{1}l+\beta_{2}l^{2}`,
          r`S(l)=\frac{-0.01+\sqrt{0.0001+4K\phi(l)}}{2}`,
          r`T(l)=l+\frac{K}{0.01+S(l)}\left(\beta_{1}l+2\beta_{2}l^{2}\right)`,
          { latex: r`\left(T(t),1000S(t)\right)`, color: COL.blue, lineWidth: "3", parametricDomain: { min: "0", max: "0.48" } },
          { latex: r`(0.25,${Ss})`, color: COL.red, pointSize: "12", showLabel: true, label: `0.250 M NH₃: S = ${(S * 1000).toPrecision(3)} mM`, labelOrientation: "above_left" },
          { latex: r`(0.01,15.5)`, hidden: true, showLabel: true, label: "x: total NH₃ (M)   y: S (mM), with 0.0100 M Cl⁻", color: COL.gray, labelOrientation: "right" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q12
{
  const R = 8.314462, T = 298.15, F = 96485.33;
  const k = (R * T * Math.LN10) / F;
  const E0AgCl = 0.7996 + k * Math.log10(1.8e-10);
  const Ecath = 1.512 - (k / 5) * Math.log10(0.002 / (0.01 * 10 ** (-2.3 * 8)));
  const Ean = E0AgCl - k * Math.log10(0.025);
  const Ecell = Ecath - Ean;
  const dG = (-5 * F * Ecell) / 1000;
  assertClose("Q12 E0", Number(E0AgCl.toFixed(4)), 0.2231, 1e-9);
  assertClose("Q12 Ecell", Number(Ecell.toFixed(3)), 0.985, 1e-9);
  assertClose("Q12 dG", Number(dG.toPrecision(3)), -475, 1e-9);
  const ks = k.toPrecision(6);
  const E0s = E0AgCl.toPrecision(6);
  boards[12] = {
    title: "Q12 Nernst permanganate vs Ag/AgCl",
    subject: "Chemistry",
    modules: [
      solution("q12-sol", {
        title: "Q12 · Nernst: MnO₄⁻/Mn²⁺ vs AgCl/Ag",
        problem: r`Ag | AgCl | Cl$^-$ (0.0250 M) ‖ MnO$_4^-$ (0.0100 M), Mn$^{2+}$ (0.00200 M), pH 2.30 | Pt at 298.15 K. (a) $E^\circ$(AgCl/Ag) (b) $E_{cell}$ (c) $\Delta G$ for 5 e⁻.`,
        steps: [
          [r`\frac{8.314462\cdot298.15}{96485.33}\ln 10 \approx ${ks}`, "(RT/F) ln 10 in volts."],
          [r`0.7996+${ks}\log_{10}\left(1.80\times10^{-10}\right) \approx ${E0s}`, "(a) E°(AgCl/Ag) = E°(Ag⁺/Ag) + (RT/F) ln 10 · log K_sp."],
          [r`1.512-\frac{${ks}}{5}\log_{10}\frac{0.00200}{0.0100\cdot\left(10^{-2.30}\right)^{8}} \approx ${Ecath.toPrecision(6)}`, "Cathode: MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O."],
          [r`${E0s}-${ks}\log_{10}(0.0250) \approx ${Ean.toPrecision(6)}`, "Anode couple: AgCl + e⁻ → Ag + Cl⁻ at [Cl⁻] = 0.0250 M."],
          [r`${Ecath.toPrecision(6)}-${Ean.toPrecision(6)} \approx ${Ecell.toPrecision(5)}`, "(b) E_cell = E_cathode − E_anode."],
          [r`${(1.512 - E0AgCl).toPrecision(7)}-\frac{${ks}}{5}\log_{10}\frac{0.00200}{0.0100\cdot10^{-18.4}\cdot0.0250^{5}} \approx ${Ecell.toPrecision(5)}`, "Same result from E°cell = 1.512 − 0.2231 and the overall Q = [Mn²⁺]/([MnO₄⁻][H⁺]⁸[Cl⁻]⁵), n = 5; [H⁺]⁸ = 10^(−18.4)."],
          [r`\frac{-5\cdot96485.33\cdot${Ecell.toPrecision(6)}}{1000} \approx ${dG.toPrecision(5)}`, "(c) ΔG = −nFE_cell in kJ mol⁻¹."],
          [r`\frac{5\left(1.512-${E0s}\right)}{${ks}} \approx ${((5 * (1.512 - E0AgCl)) / k).toPrecision(4)}`, "log K = nE°cell/((RT/F) ln 10): the reaction is overwhelmingly favourable."],
        ],
        answer: r`E^\circ_{\mathrm{AgCl/Ag}}=${E0AgCl.toFixed(4)}\ \mathrm V;\quad E_{cell}=${Ecell.toFixed(3)}\ \mathrm V;\quad \Delta G=${dG.toPrecision(3)}\ \mathrm{kJ\,mol^{-1}}`,
      }, L.sol),
      desmos("q12-ph", "E_cell vs pH (slope −8·0.05916/5 V per pH)", { x: 580, y: 0, width: 760, height: 430 }, {
        viewport: { xmin: -0.3, xmax: 7.3, ymin: 0.45, ymax: 1.32 },
        list: [
          r`k=\frac{8.314462\cdot298.15}{96485.33}\ln10`,
          r`E_{0}=0.7996+k\log\left(1.8\cdot10^{-10}\right)`,
          r`c_{l}=0.025`,
          r`E(p)=1.512-E_{0}-\frac{k}{5}\log\left(\frac{0.002}{0.01\cdot10^{-8p}c_{l}^{5}}\right)`,
          { latex: r`y=E(x)`, color: COL.purple, lineWidth: "3" },
          { latex: r`(2.3,E(2.3))`, color: COL.red, pointSize: "12", showLabel: true, label: `pH 2.30: E_cell = ${Ecell.toFixed(3)} V`, labelOrientation: "above_right" },
          r`p_{d}=5`,
          r`E_{d}=\frac{\operatorname{round}\left(1000E(p_{d})\right)}{1000}`,
          { latex: r`(p_{d},E(p_{d}))`, color: COL.orange, dragMode: "X", pointSize: "14", showLabel: true, label: "drag: pH ${p_d} → E_cell = ${E_d} V", labelOrientation: "below_left" },
          { latex: r`(3.2,1.27)`, hidden: true, showLabel: true, label: "x: pH   y: E_cell (V), [Cl⁻] = 0.0250 M, [MnO₄⁻] = 0.0100 M, [Mn²⁺] = 0.00200 M", color: COL.gray, labelOrientation: "right" },
        ],
      }),
    ],
    elements: [
      // Cell diagram with electron flow, below the graph (board coordinates; Excalidraw light palette).
      rect("q12-anode", 600, 470, 300, 160, { color: EX.blue, strokeWidth: 2 }),
      text("q12-anode-t", 615, 482, "Anode (−), oxidation\nAg | AgCl | Cl⁻ (0.0250 M)\nAg + Cl⁻ → AgCl + e⁻\nE = 0.3179 V", { fontSize: 16, color: EX.blue }),
      rect("q12-cathode", 1020, 470, 320, 160, { color: EX.pink, strokeWidth: 2 }),
      text("q12-cathode-t", 1035, 482, "Cathode (+), reduction\nPt | MnO₄⁻, Mn²⁺, H⁺ (pH 2.30)\nMnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O\nE = 1.3026 V", { fontSize: 16, color: EX.pink }),
      text("q12-bridge", 925, 530, "‖\nsalt\nbridge", { fontSize: 16, color: EX.muted }),
      arrow("q12-e", [[750, 466], [750, 448], [1180, 448], [1180, 466]], { color: EX.orange, strokeWidth: 2 }),
      text("q12-e-t", 905, 452, "e⁻ (wire) →", { fontSize: 16, color: EX.orange }),
      text("q12-overall", 600, 650, "Overall (n = 5): MnO₄⁻ + 8H⁺ + 5Ag + 5Cl⁻ → Mn²⁺ + 5AgCl + 4H₂O\nE°cell = 1.512 − 0.2231 = 1.2889 V;   E_cell = 0.985 V;   ΔG = −475 kJ mol⁻¹", { fontSize: 16, color: EX.ink }),
    ],
  };
}

// ---------------------------------------------------------------- Q13
{
  const R = 8.314462, dH = 58300, K298 = 0.142;
  const T1 = 1 / (1 / 298.15 - (R * Math.log(1 / K298)) / dH);
  const K340 = K298 * Math.exp((-dH / R) * (1 / 340 - 1 / 298.15));
  const x = (-K340 + Math.sqrt(K340 * K340 + 6.4 * K340)) / 8;
  assertClose("Q13 T", Number(T1.toFixed(1)), 325.1, 1e-9);
  assertClose("Q13 K", Number(K340.toPrecision(4)), 2.567, 1e-9);
  assertClose("Q13 P", Number((0.4 + x).toPrecision(3)), 0.679, 1e-9);
  assertClose("Q13 alpha", Number((x / 0.4).toPrecision(3)), 0.697, 1e-9);
  const Ks = K340.toPrecision(6), xs = x.toPrecision(6);
  boards[13] = {
    title: "Q13 van 't Hoff N2O4",
    subject: "Chemistry",
    modules: [
      solution("q13-sol", {
        title: "Q13 · N₂O₄ ⇌ 2 NO₂ (van 't Hoff)",
        problem: r`$K^\circ=0.1420$ at 298.15 K, $\Delta H^\circ=+58.30$ kJ/mol. (a) $T$ where $K^\circ=1$ (b) $K^\circ$(340.0 K) (c) 0.400 bar N$_2$O$_4$ at 340.0 K: total pressure and fraction dissociated.`,
        steps: [
          [r`\left(\frac{1}{298.15}-\frac{8.314462\ln(1/0.1420)}{58300}\right)^{-1} \approx ${T1.toPrecision(6)}`, "(a) ln(K₂/K₁) = −(ΔH°/R)(1/T₂ − 1/T₁) with K₂ = 1."],
          [r`\frac{58300}{298.15}+8.314462\ln 0.1420 \approx ${(dH / 298.15 + R * Math.log(K298)).toPrecision(5)}`, "Equivalently ΔS° = ΔH°/T + R ln K (J mol⁻¹ K⁻¹), and T = ΔH°/ΔS°."],
          [r`0.1420\,e^{-\frac{58300}{8.314462}\left(\frac{1}{340.0}-\frac{1}{298.15}\right)} \approx ${Ks}`, "(b) K° at 340.0 K."],
          [r`4x^2+${Ks}x-0.400\cdot${Ks}=0`, "(c) ICE: P(N₂O₄) = 0.400 − x, P(NO₂) = 2x, K = 4x²/(0.400 − x)."],
          [r`\frac{-${Ks}+\sqrt{${Ks}^2+16\cdot0.400\cdot${Ks}}}{8} \approx ${xs}`, "Positive root (bar)."],
          [r`\frac{4\cdot${xs}^2}{0.400-${xs}} \approx ${Ks}`, "Check: the root reproduces K°."],
          [r`0.400+${xs} \approx ${(0.4 + x).toPrecision(4)}`, "Total pressure P = 0.400 + x (bar)."],
          [r`\frac{${xs}}{0.400} \approx ${(x / 0.4).toPrecision(4)}`, "Fraction dissociated α = x/0.400."],
        ],
        answer: r`T=${T1.toFixed(1)}\ \mathrm K;\quad K^\circ(340.0\ \mathrm K)=${K340.toPrecision(4)};\quad P_{tot}=${(0.4 + x).toPrecision(3)}\ \mathrm{bar};\quad \alpha=${(x / 0.4).toPrecision(3)}`,
      }, L.sol),
      desmos("q13-vanthoff", "van 't Hoff plot: ln K vs 1/T (×1000)", L.right1, {
        viewport: { xmin: 2.75, xmax: 3.55, ymin: -2.6, ymax: 1.6 },
        list: [
          r`m=-\frac{58300}{8.314462}`,
          { latex: r`y=\ln0.142+\frac{m}{1000}\left(x-\frac{1000}{298.15}\right)\left\{2.7\le x\le3.6\right\}`, color: COL.blue, lineWidth: "3" },
          { latex: r`\left(\frac{1000}{298.15},\ln0.142\right)`, color: COL.black, showLabel: true, label: "298.15 K: K = 0.1420", labelOrientation: "right" },
          { latex: r`\left(\frac{1000}{${T1.toFixed(3)}},0\right)`, color: COL.red, showLabel: true, label: `K = 1 at ${T1.toFixed(1)} K`, labelOrientation: "above_right" },
          { latex: r`\left(\frac{1000}{340},\ln${Ks}\right)`, color: COL.green, showLabel: true, label: `340.0 K: K = ${K340.toPrecision(4)}`, labelOrientation: "above_right" },
          { latex: r`y=0`, color: COL.gray, lineStyle: "DASHED" },
          { latex: r`(2.78,-1.6)`, hidden: true, showLabel: true, label: "slope = −ΔH°/R = −7012 K", color: COL.blue, labelOrientation: "right" },
          { latex: r`(2.78,-2.2)`, hidden: true, showLabel: true, label: "x: 1000/T (1/K)   y: ln K", color: COL.gray, labelOrientation: "right" },
        ],
      }),
      desmos("q13-alpha", "Fraction dissociated α(T) at 0.400 bar initial", L.right2, {
        viewport: { xmin: 255, xmax: 405, ymin: -0.05, ymax: 1.05 },
        list: [
          r`K(T)=0.142e^{-\frac{58300}{8.314462}\left(\frac{1}{T}-\frac{1}{298.15}\right)}`,
          r`q(T)=\frac{-K(T)+\sqrt{K(T)^{2}+6.4K(T)}}{8}`,
          { latex: r`y=\frac{q(x)}{0.4}`, color: COL.purple, lineWidth: "3" },
          r`T_{s}=340`,
          { latex: r`\left(T_{s},\frac{q(T_{s})}{0.4}\right)`, color: COL.red, dragMode: "X", pointSize: "14", showLabel: true, label: "drag: T = ${T_s} K → α = ${a_s}, P_tot = ${P_s} bar", labelOrientation: "above_left" },
          r`a_{s}=\frac{\operatorname{round}\left(1000\frac{q(T_{s})}{0.4}\right)}{1000}`,
          r`P_{s}=\frac{\operatorname{round}\left(1000\left(0.4+q(T_{s})\right)\right)}{1000}`,
          { latex: r`(258,0.95)`, hidden: true, showLabel: true, label: "x: T (K)   y: α (fraction of N₂O₄ dissociated)", color: COL.gray, labelOrientation: "right" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q14
{
  const k1 = 0.12, km1 = 0.03, k2 = 0.045, A0 = 0.5;
  const sum = k1 + km1 + k2, prod = k1 * k2;
  const lp = (sum + Math.sqrt(sum * sum - 4 * prod)) / 2, lm = (sum - Math.sqrt(sum * sum - 4 * prod)) / 2;
  const B = (t) => ((k1 * A0) / (lp - lm)) * (Math.exp(-lm * t) - Math.exp(-lp * t));
  const Cc = (t) => A0 * (1 - (lp * Math.exp(-lm * t) - lm * Math.exp(-lp * t)) / (lp - lm));
  const tmax = Math.log(lp / lm) / (lp - lm);
  const tC = bisect((t) => Cc(t) - 0.25, 1, 100);
  assertClose("Q14 tmax", Number(tmax.toPrecision(3)), 12.3, 1e-9);
  assertClose("Q14 Bmax", Number(B(tmax).toPrecision(3)), 0.246, 1e-9);
  assertClose("Q14 tC", Number(tC.toPrecision(3)), 27.5, 1e-9);
  const LP = r`\frac{39+3\sqrt{73}}{400}`, LM = r`\frac{39-3\sqrt{73}}{400}`, DL = r`\frac{6\sqrt{73}}{400}`;
  const Bt = r`\frac{0.06}{${DL}}\left(e^{-${LM}t}-e^{-${LP}t}\right)`;
  const At = r`\frac{0.5}{${DL}}\left(\left(0.12-${LM}\right)e^{-${LP}t}+\left(${LP}-0.12\right)e^{-${LM}t}\right)`;
  const tms = tmax.toPrecision(6), tCs = tC.toPrecision(6);
  boards[14] = {
    title: "Q14 A ⇌ B → C exact kinetics",
    subject: "Chemistry",
    modules: [
      solution("q14-sol", {
        title: "Q14 · A ⇌ B → C, exact solution",
        problem: r`$k_1=0.120$, $k_{-1}=0.0300$, $k_2=0.0450$ s$^{-1}$; $[A]_0=0.500$ M. (a) $t$ and value of $[B]_{max}$ (b) $t$ when $[C]=0.250$ M. No steady-state approximation.`,
        steps: [
          [r`\lambda^2-0.195\lambda+0.0054=0`, "Decay constants of M = [[−k₁, k₋₁], [k₁, −(k₋₁ + k₂)]]: λ₊ + λ₋ = k₁ + k₋₁ + k₂, λ₊λ₋ = k₁k₂."],
          [r`\lambda=\frac{39\pm3\sqrt{73}}{400}`, `λ₊ ≈ ${lp.toFixed(5)} s⁻¹, λ₋ ≈ ${lm.toFixed(5)} s⁻¹.`],
          [r`\frac{d}{dt}\left(${Bt}\right) = 0.12\cdot${At}-0.075\cdot${Bt}`, "CAS check that [B](t) = k₁[A]₀(e^(−λ₋t) − e^(−λ₊t))/(λ₊ − λ₋) and the matching [A](t) satisfy d[B]/dt = k₁[A] − (k₋₁ + k₂)[B]."],
          [r`\frac{d}{dt}\left(${At}\right) = -0.12\cdot${At}+0.03\cdot${Bt}`, "… and d[A]/dt = −k₁[A] + k₋₁[B]."],
          [r`\frac{\ln\left(\frac{39+3\sqrt{73}}{39-3\sqrt{73}}\right)}{${DL}} \approx ${tms}`, "(a) d[B]/dt = 0 at t_max = ln(λ₊/λ₋)/(λ₊ − λ₋), in s."],
          [r`\frac{0.06}{${DL}}\left(e^{-${LM}\cdot${tms}}-e^{-${LP}\cdot${tms}}\right) \approx ${B(tmax).toPrecision(5)}`, "[B]max in M."],
          [r`500\left(1-\frac{${LP}e^{-${LM}\cdot${tCs}}-${LM}e^{-${LP}\cdot${tCs}}}{${DL}}\right) \approx 250.0`, "(b) [C](t) = [A]₀(1 − (λ₊e^(−λ₋t) − λ₋e^(−λ₊t))/(λ₊ − λ₋)) equals 250.0 mM at t = " + tC.toFixed(3) + " s."],
          [r`\frac{\ln 2}{\frac{0.120\cdot0.0450}{0.0300+0.0450}} \approx ${(Math.LN2 / ((k1 * k2) / (km1 + k2))).toPrecision(4)}`, "Contrast: the steady-state k_eff = k₁k₂/(k₋₁ + k₂) = 0.072 s⁻¹ would predict 9.63 s. Invalid: B builds up to half of [A]₀."],
        ],
        answer: r`t_{max}=${tmax.toPrecision(3)}\ \mathrm s,\ [B]_{max}=${B(tmax).toPrecision(3)}\ \mathrm M;\quad t\left([C]=0.250\ \mathrm M\right)=${tC.toPrecision(3)}\ \mathrm s`,
      }, L.sol),
      desmos("q14-curves", "[A], [B], [C] from the exact solution", L.rightFull, {
        viewport: { xmin: -4, xmax: 124, ymin: -0.03, ymax: 0.56 },
        list: [
          r`k_{1}=0.12`,
          r`k_{r}=0.03`,
          r`k_{2}=0.045`,
          r`a_{0}=0.5`,
          r`\sigma=k_{1}+k_{r}+k_{2}`,
          r`l_{p}=\frac{\sigma+\sqrt{\sigma^{2}-4k_{1}k_{2}}}{2}`,
          r`l_{m}=\frac{\sigma-\sqrt{\sigma^{2}-4k_{1}k_{2}}}{2}`,
          r`B(t)=\frac{k_{1}a_{0}}{l_{p}-l_{m}}\left(e^{-l_{m}t}-e^{-l_{p}t}\right)`,
          r`A(t)=\frac{a_{0}}{l_{p}-l_{m}}\left(\left(k_{1}-l_{m}\right)e^{-l_{p}t}+\left(l_{p}-k_{1}\right)e^{-l_{m}t}\right)`,
          r`C(t)=a_{0}-A(t)-B(t)`,
          { latex: r`y=A(x)\left\{x\ge0\right\}`, color: COL.blue, lineWidth: "3" },
          { latex: r`y=B(x)\left\{x\ge0\right\}`, color: COL.red, lineWidth: "3" },
          { latex: r`y=C(x)\left\{x\ge0\right\}`, color: COL.green, lineWidth: "3" },
          { latex: r`y=a_{0}\left(1-e^{-\frac{k_{1}k_{2}}{k_{r}+k_{2}}x}\right)\left\{x\ge0\right\}`, color: COL.green, lineStyle: "DASHED" },
          r`t_{m}=\frac{\ln\left(l_{p}/l_{m}\right)}{l_{p}-l_{m}}`,
          { latex: r`(t_{m},B(t_{m}))`, color: COL.red, pointSize: "12", showLabel: true, label: "[B]max = ${B_m} M at t = ${t_r} s", labelOrientation: "above_right" },
          r`B_{m}=\frac{\operatorname{round}\left(10^{4}B(t_{m})\right)}{10^{4}}`,
          r`t_{r}=\frac{\operatorname{round}\left(100t_{m}\right)}{100}`,
          { latex: r`(${tC.toFixed(3)},0.25)`, color: COL.green, pointSize: "12", showLabel: true, label: `[C] = 0.250 M at t = ${tC.toFixed(2)} s`, labelOrientation: "below_right" },
          r`t_{d}=60`,
          { latex: r`x=t_{d}`, color: COL.gray, lineStyle: "DOTTED" },
          { latex: r`(t_{d},A(t_{d}))`, color: COL.blue },
          { latex: r`(t_{d},C(t_{d}))`, color: COL.green },
          r`v_{A}=\frac{\operatorname{round}\left(1000A(t_{d})\right)}{1000}`,
          r`v_{B}=\frac{\operatorname{round}\left(1000B(t_{d})\right)}{1000}`,
          r`v_{C}=\frac{\operatorname{round}\left(1000C(t_{d})\right)}{1000}`,
          { latex: r`(t_{d},B(t_{d}))`, color: COL.red, dragMode: "X", pointSize: "14", showLabel: true, label: "drag: t = ${t_d} s  [A] ${v_A}  [B] ${v_B}  [C] ${v_C}", labelOrientation: "above_right" },
          { latex: r`(40,0.53)`, hidden: true, showLabel: true, label: "dashed: steady-state [C], k_eff = 0.072 s⁻¹ (fails)", color: COL.green, labelOrientation: "right" },
          { latex: r`(100,A(100))`, hidden: true, showLabel: true, label: "[A]", color: COL.blue, labelOrientation: "below" },
          { latex: r`(100,B(100))`, hidden: true, showLabel: true, label: "[B]", color: COL.red, labelOrientation: "above" },
          { latex: r`(110,C(110))`, hidden: true, showLabel: true, label: "[C]", color: COL.green, labelOrientation: "below" },
          { latex: r`(2,-0.015)`, hidden: true, showLabel: true, label: "x: t (s)   y: concentration (M)", color: COL.gray, labelOrientation: "right" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q15
{
  // Newman projection along C1→C2 (front C1 bonds from the centre, back C2 bonds from the circle).
  const cx = 800, cy = 598, R = 62;
  const deg = (a) => (a * Math.PI) / 180; // 0° = up, clockwise
  const at = (angle, radius) => [cx + radius * Math.sin(deg(angle)), cy - radius * Math.cos(deg(angle))];
  const front = [[0, "Br"], [120, "Ph"], [240, "H"]];
  const back = [[180, "H"], [300, "Et"], [60, "CH₃"]];
  const labelAt = (angle) => { const [x, y] = at(angle, 122); return [x - 12, y - 12]; };
  const elements = [
    ellipse("q15-circle", cx - R, cy - R, 2 * R, 2 * R, { color: EX.ink }),
    ...front.map(([angle], i) => line(`q15-f${i}`, [[cx, cy], at(angle, 100)], { color: EX.ink, strokeWidth: 3 })),
    ...back.map(([angle], i) => line(`q15-b${i}`, [at(angle, R), at(angle, 100)], { color: EX.muted, strokeWidth: 3 })),
    ...front.map(([angle, label], i) => { const [x, y] = labelAt(angle); return text(`q15-fl${i}`, x, y, label, { fontSize: 20, color: label === "Br" ? EX.red : EX.ink }); }),
    ...back.map(([angle, label], i) => { const [x, y] = labelAt(angle); return text(`q15-bl${i}`, x, y, label, { fontSize: 20, color: label === "H" ? EX.orange : EX.muted }); }),
    text("q15-title", 580, 420, "Newman projection along C1→C2", { fontSize: 18, color: EX.ink }),
    text("q15-sub", 580, 446, "front C1 (1S): Br 0°, Ph 120°, H 240°   back C2 (2R): H 180°, Et 300°, CH₃ 60°", { fontSize: 14, color: EX.muted }),
    // Curved arrows: EtO⁻ → H on C2; C2–H σ → C1=C2 π; C1–Br σ → Br⁻.
    text("q15-eto", cx - 175, cy + 112, "EtO⁻", { fontSize: 20, color: EX.blue }),
    arrow("q15-a1", [[cx - 120, cy + 128], [cx - 60, cy + 148], [cx - 16, cy + 122]], { color: EX.blue, curved: true }),
    arrow("q15-a2", [[cx + 8, cy + 84], [cx + 44, cy + 50], [cx + 12, cy + 14]], { color: EX.blue, curved: true }),
    arrow("q15-a3", [[cx + 8, cy - 50], [cx + 40, cy - 80], [cx + 16, cy - 104]], { color: EX.blue, curved: true }),
    text("q15-n1", cx - 104, cy + 150, "①", { fontSize: 14, color: EX.blue }),
    text("q15-n2", cx + 44, cy + 56, "②", { fontSize: 14, color: EX.blue }),
    text("q15-n3", cx + 42, cy - 86, "③", { fontSize: 14, color: EX.blue }),
    text("q15-arrows", 1000, 500, "Curved arrows (anti-periplanar E2):\n① EtO⁻ lone pair → H on C2\n② C2–H σ bond → C1=C2 π bond\n③ C1–Br σ bond → Br⁻ leaves", { fontSize: 16, color: EX.ink }),
    text("q15-cis", 1000, 618, "Groups 60° apart end up cis:\nPh cis to CH₃, H cis to Et.\nPh (C1) and Et (C2) are trans → (E)", { fontSize: 16, color: EX.ink }),
    text("q15-like", 1000, 708, "Contrast: the like pair (1R,2R)/(1S,2S)\nwould give the (Z) alkene.", { fontSize: 14, color: EX.muted }),
  ];
  boards[15] = {
    title: "Q15 E2 stereochemistry",
    subject: "Chemistry",
    modules: [
      solution("q15-sol", {
        title: "Q15 · Anti-periplanar E2",
        problem: r`(1S,2R)-1-Bromo-2-methyl-1-phenylbutane + NaOEt/EtOH, anti-periplanar E2 only. Newman projection, curved arrows, and the product with its E/Z descriptor.`,
        steps: [
          [r`\mathrm{Br} > \mathrm{Ph} > \mathrm{C2} > \mathrm{H}`, "CIP at C1: Ph is (C,C,C) and C2 is (C,C,H). The molecule card shows the drawn (1S,2R) labels."],
          [r`\mathrm{C1} > \mathrm{Et} > \mathrm{CH_3} > \mathrm{H}`, "CIP at C2: C1 carries (Br,C,H)."],
          [r`\frac{2\cdot11+2-15-1}{2} = 4`, "Substrate C₁₁H₁₅Br: degree of unsaturation 4 (the ring)."],
          [r`11\cdot12.011+15\cdot1.008+79.904 \approx 227.144`, "Substrate molar mass (g/mol); compare the molecule card."],
          [r`\frac{2\cdot11+2-14}{2} = 5`, "Product C₁₁H₁₄: one more degree of unsaturation, the new C=C."],
          [r`\theta_{\mathrm{H}}-\theta_{\mathrm{Br}} = 180^\circ`, "Only C2 bears a β-hydrogen, and it has one H: it must sit at 180° to Br (anti-periplanar). With C1 front (Br 0°, Ph 120°, H 240°) and C2 back (2R: H 180°, Et 300°, CH₃ 60°)."],
          [r`\left|120-60\right| = 60,\quad \left|300-240\right| = 60`, "Groups 60° apart end up cis: Ph cis to CH₃, and H cis to Et."],
          [r`\mathrm{Ph} > \mathrm{H},\quad \mathrm{Et} > \mathrm{CH_3}`, "Higher priorities on the alkene: Ph (on C1) and Et (on C2). They are trans, so the alkene is E."],
        ],
        answer: r`(E)\text{-2-methyl-1-phenylbut-1-ene}\ =\ [(E)\text{-2-methylbut-1-en-1-yl}]\text{benzene}`,
      }, { x: 0, y: 0, width: 540, height: 764 }),
      molecule("q15-substrate", { smiles: "Br[C@H](c1ccccc1)[C@H](C)CC", name: "(1S,2R)-1-bromo-2-methyl-1-phenylbutane", caption: "Substrate: C1 is the CHBr carbon (S), C2 the CH(CH₃) carbon (R). RDKit assigns the CIP labels from the SMILES.", showAtomNumbers: false }, { x: 560, y: 0, width: 380, height: 400 }),
      molecule("q15-product", { smiles: "CC/C(C)=C/c1ccccc1", name: "(E)-2-methyl-1-phenylbut-1-ene", caption: "Product: Ph and Et are trans across C1=C2, so E." }, { x: 960, y: 0, width: 380, height: 400 }),
    ],
    elements,
  };
}

// ---------------------------------------------------------------- Q16
{
  // Splitting tree for δ 6.97 (dq, J = 15.5, 6.9 Hz), drawn to scale at 1 Hz = 6 px.
  const s = 6, x0 = 720, y0 = 492;
  const half = 15.5 / 2;
  const level1 = [-half, half];
  const level2 = level1.flatMap((d) => [-1.5, -0.5, 0.5, 1.5].map((k) => d + k * 6.9));
  const px = (hz) => x0 + hz * s;
  const tree = [
    text("q16-tl", 580, 458, "Splitting tree, δ 6.97 (H on C2): dq, to scale", { fontSize: 16, color: EX.ink }),
    line("q16-t0", [[px(0), y0], [px(0), y0 + 24]], { color: EX.ink }),
    ...level1.map((d, i) => line(`q16-t1${i}`, [[px(0), y0 + 24], [px(d), y0 + 58]], { color: EX.ink })),
    ...level1.map((d, i) => line(`q16-t1v${i}`, [[px(d), y0 + 58], [px(d), y0 + 74]], { color: EX.ink })),
    ...level2.map((d, i) => line(`q16-t2${i}`, [[px(level1[Math.floor(i / 4)]), y0 + 74], [px(d), y0 + 112]], { color: EX.muted })),
    ...level2.map((d, i) => line(`q16-t2v${i}`, [[px(d), y0 + 112], [px(d), y0 + 112 + [1, 3, 3, 1][i % 4] * 9]], { color: EX.orange, strokeWidth: 3 })),
    text("q16-tl1", px(19) + 14, y0 + 34, "³J = 15.5 Hz to H on C3 (trans → E)", { fontSize: 14, color: EX.ink }),
    text("q16-tl2", px(19) + 14, y0 + 84, "³J = 6.9 Hz to CH₃ (C1): 1:3:3:1 quartets", { fontSize: 14, color: EX.ink }),
    text("q16-table", 580, 652, "Candidates (C₈H₁₄O₂ esters)\n✓ isobutyl (E)-crotonate: every integration, multiplet and the 7-line ¹³C count fit\n✗ (E)-crotyl isobutyrate: CH septet near δ 2.55; allylic OCH₂ near δ 4.5\n✗ sec-butyl crotonate, isobutyl methacrylate, isobutyl but-3-enoate: counts or multiplets fail", { fontSize: 14, color: EX.ink }),
  ];
  boards[16] = {
    title: "Q16 NMR structure elucidation",
    subject: "Chemistry",
    modules: [
      solution("q16-sol", {
        title: "Q16 · C₈H₁₄O₂ from IR, MS, ¹H and ¹³C NMR",
        problem: r`IR 1720, 1658, 968 cm$^{-1}$, no O–H; MS $m/z$ 142 (M$^+$), base 69; $^1$H: 6.97 dq (15.5, 6.9), 5.86 dq (15.5, 1.7), 3.92 d 2H, 1.95 m 1H, 1.88 dd 3H, 0.94 d 6H; $^{13}$C: 166.7, 144.5, 122.8, 70.5, 27.9, 19.1, 18.0.`,
        steps: [
          [r`\frac{2\cdot8+2-14}{2} = 2`, "Degree of unsaturation 2: one C=O (IR 1720, ¹³C 166.7, conjugated ester) and one C=C (IR 1658, ¹³C 144.5 and 122.8)."],
          [r`8\cdot12.011+14\cdot1.008+2\cdot15.999 \approx 142.198`, "Molar mass matches M⁺ 142."],
          [r`4\cdot12+5\cdot1+16 = 69`, "Base peak m/z 69 = C₄H₅O⁺, the crotonyl acylium CH₃CH=CH–C≡O⁺."],
          [r`15.5 > 11.5`, "δ 6.97 dq couples to one vinyl H (15.5 Hz) and a CH₃ (6.9 Hz): the β-H of an α,β-unsaturated ester. ³J = 15.5 Hz means the vinyl hydrogens are trans, so E (Z-crotonates show about 11.5 Hz). IR 968 cm⁻¹ (trans CH=CH wag) agrees."],
          [r`2+6 = 8,\quad 8+1 = 9`, "δ 1.95 is coupled to OCH₂ (2 H) and two CH₃ (6 H): n + 1 = 9 lines, a nonet. Isobutyl group: OCH₂ d 3.92, CH 1.95, 2 × CH₃ d 0.94."],
          [r`8-1 = 7`, "Seven ¹³C signals for eight carbons: the two isobutyl methyls are equivalent (19.1)."],
          [r`3+1+1+2+1+6 = 14`, "Integrations account for all 14 H: 1.88 (3H), 6.97, 5.86, 3.92 (2H), 1.95, 0.94 (6H)."],
        ],
        answer: r`\mathrm{CH_3CH{=}CHC({=}O)OCH_2CH(CH_3)_2}:\ \text{2-methylpropyl }(E)\text{-but-2-enoate (isobutyl }(E)\text{-crotonate)}`,
      }, { x: 0, y: 0, width: 560, height: 764 }),
      molecule("q16-answer", {
        smiles: "C/C=C/C(=O)OCC(C)C",
        name: "2-methylpropyl (E)-but-2-enoate",
        caption: "Atom numbers in SMILES order. ¹H: C1 1.88 (3H, dd); C2 6.97 (dq); C3 5.86 (dq); C7 3.92 (2H, d); C8 1.95 (nonet); C9/C10 0.94 (6H, d). ¹³C: C4 166.7, C2 144.5, C3 122.8, C7 70.5, C8 27.9, C9/C10 19.1, C1 18.0.",
        showAtomNumbers: true,
      }, { x: 580, y: 0, width: 380, height: 440 }),
      molecule("q16-decoy", {
        smiles: "CC(C)C(=O)OC/C=C/C",
        name: "Decoy: crotyl isobutyrate",
        caption: "(E)-crotyl isobutyrate has the same integration pattern, but its CH is a septet near δ 2.55 and its OCH₂ (≈ δ 4.5) is allylic, coupling to a vinyl H. Rejected.",
      }, { x: 975, y: 0, width: 380, height: 440 }),
    ],
    elements: tree,
  };
}
