// Math boards Q1–Q8.
import { r, solution, desmos, molecule, text, arrow, line, ellipse, rect, EX } from "./lib.mjs";

const COL = { blue: "#2d70b3", red: "#c74440", green: "#388c46", purple: "#6042a6", orange: "#fa7e19", black: "#000000", gray: "#9ca3af", pink: "#e64ba6", teal: "#0f9d8a" };
const fmt = (value, digits = 6) => Number(value.toPrecision(digits)).toString();
const slider = (latex, min, max, step) => ({ latex, slider: { hardMin: true, hardMax: true, min: String(min), max: String(max), ...(step ? { step: String(step) } : {}) } });

// Shared layout (board coordinates; the runner opens the board at scroll (20, 76), zoom 1).
const L = {
  sol: { x: 0, y: 0, width: 560, height: 764 },
  right1: { x: 580, y: 0, width: 760, height: 372 },
  right2: { x: 580, y: 392, width: 760, height: 372 },
  rightFull: { x: 580, y: 0, width: 760, height: 764 },
};
export { L, COL, fmt, slider };

export const boards = {};

// ---------------------------------------------------------------- Q1
{
  const exact = (2 * Math.PI * (Math.cbrt(4) - 1)) / (3 * Math.sqrt(3));
  boards[1] = {
    title: "Q1 Keyhole contour",
    subject: "Math",
    modules: [
      solution("q1-sol", {
        title: "Q1 · Keyhole contour",
        problem: r`Evaluate $I=\int_0^\infty \dfrac{x^{1/3}}{(x+1)(x+4)}\,dx$ with a keyhole contour, branch cut on the positive real axis ($0<\arg z<2\pi$).`,
        steps: [
          [r`\left|\int_{|z|=\varepsilon} f\,dz\right| \le 2\pi\varepsilon\cdot\frac{\varepsilon^{1/3}}{(1-\varepsilon)(4-\varepsilon)}`, "ML estimate, small circle: the bound is about (π/2)ε^(4/3), which tends to 0."],
          [r`\left|\int_{|z|=R} f\,dz\right| \le 2\pi R\cdot\frac{R^{1/3}}{(R-1)(R-4)}`, "ML estimate, large circle: the bound behaves like 2πR^(−2/3), which tends to 0."],
          [r`(1-e^{2\pi i/3})\,I = 2\pi i\,(\operatorname{Res}_{-1}+\operatorname{Res}_{-4})`, "The upper edge gives I; on the lower edge z^(1/3) = x^(1/3)e^(2πi/3), traversed inward."],
          [r`\frac{e^{i\pi/3}}{(-1)+4} = \frac{1}{6}+\frac{\sqrt{3}}{6}i`, "Residue at z = −1: (−1)^(1/3) = e^(iπ/3) on this branch, divided by (z + 4) at z = −1."],
          [r`\frac{4^{1/3}e^{i\pi/3}}{(-4)+1} = -\frac{4^{1/3}}{3}e^{i\pi/3}`, "Residue at z = −4: (−4)^(1/3) = 4^(1/3)e^(iπ/3), divided by (z + 1) at z = −4."],
          [r`\frac{e^{i\pi/3}}{3}-\frac{4^{1/3}e^{i\pi/3}}{3} = \frac{e^{i\pi/3}(1-4^{1/3})}{3}`, "Sum of the residues."],
          [r`1-e^{2\pi i/3} = -i\sqrt{3}\,e^{i\pi/3}`, "Factor the left-hand coefficient."],
          [r`\frac{2\pi i}{-i\sqrt{3}\,e^{i\pi/3}}\cdot\frac{e^{i\pi/3}(1-4^{1/3})}{3} = \frac{2\pi(4^{1/3}-1)}{3\sqrt{3}}`, "Divide: the phases e^(iπ/3) cancel and I is real, as it must be."],
          [r`\frac{2\pi(4^{1/3}-1)}{3\sqrt{3}} \approx ${fmt(exact)}`, "Decimal value to 6 significant figures."],
          [r`\int_0^{\infty}\frac{x^{1/3}}{(x+1)(x+4)}\,dx \approx ${fmt(exact)}`, "Cross-check: direct numerical quadrature of the original integral."],
          [r`\frac{\pi\,(1^{1/3}-4^{1/3})}{(4-1)\sin(4\pi/3)} = \frac{2\pi(4^{1/3}-1)}{3\sqrt{3}}`, "Cross-check with the general formula π(b^(a−1) − c^(a−1))/((c − b) sin πa), a = 4/3, b = 1, c = 4."],
        ],
        answer: r`I=\dfrac{2\pi\left(\sqrt[3]{4}-1\right)}{3\sqrt{3}}\approx ${fmt(exact)}`,
      }, L.sol),
      desmos("q1-contour", "Keyhole contour and poles", { x: 580, y: 0, width: 760, height: 440 }, {
        viewport: { xmin: -11, xmax: 11, ymin: -5.3, ymax: 5.3 },
        list: [
          r`R=4.8`,
          r`\varepsilon=0.5`,
          r`\delta=0.16`,
          { latex: r`(R\cos t,R\sin t)`, color: COL.blue, parametricDomain: { min: r`\arcsin(\delta/R)`, max: r`2\pi-\arcsin(\delta/R)` } },
          { latex: r`(\varepsilon\cos t,\varepsilon\sin t)`, color: COL.blue, parametricDomain: { min: r`\arcsin(\delta/\varepsilon)`, max: r`2\pi-\arcsin(\delta/\varepsilon)` } },
          { latex: r`(t,\delta)`, color: COL.green, parametricDomain: { min: r`\sqrt{\varepsilon^2-\delta^2}`, max: r`\sqrt{R^2-\delta^2}` } },
          { latex: r`(t,-\delta)`, color: COL.purple, parametricDomain: { min: r`\sqrt{\varepsilon^2-\delta^2}`, max: r`\sqrt{R^2-\delta^2}` } },
          { latex: r`y=0\left\{x>0\right\}`, color: COL.gray, lineStyle: "DASHED" },
          { latex: r`(-1,0)`, color: COL.red, pointSize: "11", showLabel: true, label: "pole −1", labelOrientation: "below" },
          { latex: r`(-4,0)`, color: COL.red, pointSize: "11", showLabel: true, label: "pole −4", labelOrientation: "below" },
          { latex: r`(2.6,\delta)`, color: COL.green, showLabel: true, label: "upper edge → I", labelOrientation: "above_right", pointStyle: "OPEN" },
          { latex: r`(2.6,-\delta)`, color: COL.purple, showLabel: true, label: "← lower edge: −e^(2πi/3)·I", labelOrientation: "below_right", pointStyle: "OPEN" },
          { latex: r`\left(R\cos\frac{3\pi}{4},R\sin\frac{3\pi}{4}\right)`, color: COL.blue, showLabel: true, label: "C_R ↺ (→ 0 as R → ∞)", labelOrientation: "above_left", pointStyle: "OPEN" },
          { latex: r`(0,\varepsilon)`, color: COL.blue, showLabel: true, label: "C_ε ↻ (→ 0)", labelOrientation: "above", pointStyle: "OPEN" },
          { latex: r`(-10.6,-4.7)`, hidden: true, showLabel: true, label: "dashed: branch cut", labelOrientation: "right", color: COL.gray },
        ],
      }),
      desmos("q1-integrand", "Integrand: drag b to grow the area", { x: 580, y: 460, width: 760, height: 304 }, {
        viewport: { xmin: -1.5, xmax: 31, ymin: -0.025, ymax: 0.15 },
        list: [
          r`f(x)=\frac{x^{1/3}}{(x+1)(x+4)}`,
          { latex: r`y=f(x)\left\{x\ge0\right\}`, color: COL.blue, lineWidth: "3" },
          r`b=20`,
          { latex: r`0\le y\le f(x)\left\{0\le x\le b\right\}`, color: COL.blue },
          r`A=\int_{0}^{b}f(x)dx`,
          r`I_{exact}=\frac{2\pi\left(4^{\frac{1}{3}}-1\right)}{3\sqrt{3}}`,
          { latex: r`(b,0)`, color: COL.orange, dragMode: "X", pointSize: "14", showLabel: true, label: "drag b: shaded area ∫₀ᵇ f = ${A}", labelOrientation: "above_left" },
          { latex: r`(5,0.135)`, hidden: true, showLabel: true, label: "as b → ∞ the area tends to I = 2π(∛4 − 1)/(3√3) ≈ 0.710285", labelOrientation: "right", color: COL.gray },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q2
{
  const exact = (Math.sqrt(3) * Math.PI * (27 * Math.LN2 ** 2 + 8 * Math.PI ** 2)) / 243;
  boards[2] = {
    title: "Q2 Log-squared integral",
    subject: "Math",
    modules: [
      solution("q2-sol", {
        title: "Q2 · ∫ ln²x / (x² + 2x + 4)",
        problem: r`Evaluate $I=\int_0^\infty \dfrac{(\ln x)^2}{x^2+2x+4}\,dx$ exactly.`,
        steps: [
          [r`(2t)^2+2(2t)+4 = 4(t^2+t+1)`, "Substitute x = 2t, so dx = 2 dt and the quadratic becomes 4(t² + t + 1)."],
          [r`\int_0^{\infty}\frac{(\ln x)^2}{x^2+2x+4}\,dx = \frac12\int_0^{\infty}\frac{(\ln 2+\ln t)^2}{t^2+t+1}\,dt`, "After the substitution; expand (ln 2 + ln t)² = ln²2 + 2 ln 2 · ln t + ln²t, giving J₀, J₁, J₂."],
          [r`\frac{d}{dt}\left(\frac{2}{\sqrt{3}}\arctan\frac{2t+1}{\sqrt{3}}\right) = \frac{1}{t^2+t+1}`, "Antiderivative for J₀."],
          [r`\int_0^{\infty}\frac{1}{t^2+t+1}\,dt = \frac{2}{\sqrt3}\left(\frac{\pi}{2}-\frac{\pi}{6}\right) = \frac{2\pi}{3\sqrt{3}}`, "J₀ from the arctan antiderivative."],
          [r`\int_0^{\infty}\frac{\ln t}{t^2+t+1}\,dt = 0`, "J₁ = 0: t ↦ 1/t maps the integrand to its negative because t² + t + 1 is palindromic (see the graph)."],
          [r`\int_0^{\infty}\frac{t^{0.5-1}}{t^2+t+1}\,dt = \frac{\pi\sin(0.5\pi/3)}{\sin(\pi/3)\sin(0.5\pi)}`, "Mellin transform F(s) = ∫t^(s−1)/(t² + t + 1) dt = π sin((1 − s)π/3)/(sin(π/3) sin πs) for 0 < s < 2, so J_k = F⁽ᵏ⁾(1). Spot-check at s = 1/2."],
          [r`\frac{\pi}{\sin(\pi/3)}\cdot\frac{\sin(0.01\pi/3)}{\sin(0.01\pi)} \approx \frac{2\pi}{\sqrt3}\left(\frac13+\frac{4\pi^2}{81}(0.01)^2\right)`, "With s = 1 + ε, F = (π/sin(π/3))·sin(πε/3)/sin(πε) = (2π/√3)(1/3 + 4π²ε²/81 + …). Spot-check of the expansion at ε = 0.01."],
          [r`2\cdot\frac{2\pi}{\sqrt3}\cdot\frac{4\pi^2}{81} = \frac{16\pi^3}{81\sqrt3}`, "J₂ = F″(1) = 2 × (coefficient of ε²)."],
          [r`\int_0^{\infty}\frac{(\ln t)^2}{t^2+t+1}\,dt = \frac{16\pi^3}{81\sqrt{3}}`, "Numerical check of J₂."],
          [r`\frac12\left((\ln 2)^2\cdot\frac{2\pi}{3\sqrt3}+0+\frac{16\pi^3}{81\sqrt3}\right) = \frac{\pi(\ln 2)^2}{3\sqrt3}+\frac{8\pi^3}{81\sqrt3}`, "Assemble I = ½(ln²2 · J₀ + 2 ln 2 · J₁ + J₂)."],
          [r`= \frac{\sqrt3\,\pi\left(27(\ln 2)^2+8\pi^2\right)}{243}`, "Single fraction."],
          [r`\frac{\sqrt3\,\pi\left(27(\ln 2)^2+8\pi^2\right)}{243} \approx ${fmt(exact)}`, "Decimal value."],
          [r`\int_0^{\infty}\frac{(\ln x)^2}{x^2+2x+4}\,dx \approx ${fmt(exact)}`, "Final check against direct quadrature."],
        ],
        answer: r`I=\dfrac{\pi\ln^2 2}{3\sqrt3}+\dfrac{8\pi^3}{81\sqrt3}=\dfrac{\sqrt3\,\pi\left(27\ln^2 2+8\pi^2\right)}{243}\approx ${fmt(exact)}`,
      }, L.sol),
      desmos("q2-symmetry", "J₁ = 0: signed areas cancel", L.right1, {
        viewport: { xmin: -0.5, xmax: 12, ymin: -1.1, ymax: 0.45 },
        list: [
          r`g(t)=\frac{\ln t}{t^2+t+1}`,
          { latex: r`y=g(x)\left\{x>0\right\}`, color: COL.purple },
          { latex: r`g(x)\le y\le0\left\{0<x\le1\right\}`, color: COL.red },
          r`b=6`,
          { latex: r`0\le y\le g(x)\left\{1\le x\le b\right\}`, color: COL.green },
          r`A_{1}=\int_{0}^{1}g(t)dt`,
          r`A_{2}=\int_{1}^{b}g(t)dt`,
          r`S=A_{1}+A_{2}`,
          { latex: r`(b,0)`, color: COL.orange, dragMode: "X", pointSize: "14", showLabel: true, label: "drag b: ∫₀ᵇ g = ${S}", labelOrientation: "above" },
          { latex: r`(0.5,-0.75)`, hidden: true, showLabel: true, label: "area on (0, 1) = ${A_1}", labelOrientation: "right", color: COL.gray },
          { latex: r`(1.5,-0.4)`, hidden: true, showLabel: true, label: "area on (1, b) = ${A_2}  →  −(area on (0, 1)) as b → ∞, by t ↦ 1/t", labelOrientation: "right", color: COL.gray },
        ],
      }),
      desmos("q2-integrand", "Original integrand", L.right2, {
        viewport: { xmin: -0.5, xmax: 20, ymin: -0.2, ymax: 3.2 },
        list: [
          r`f(x)=\frac{(\ln x)^2}{x^2+2x+4}`,
          { latex: r`y=f(x)\left\{x>0\right\}`, color: COL.blue },
          { latex: r`0\le y\le f(x)\left\{0<x\le20\right\}`, color: COL.blue },
          r`I_{num}=\int_{0}^{1}f(x)dx+\int_{1}^{10000}f(x)dx`,
          r`I_{exact}=\frac{\sqrt{3}\pi\left(27\left(\ln2\right)^{2}+8\pi^{2}\right)}{243}`,
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q3
{
  boards[3] = {
    title: "Q3 Stokes cylinder and plane",
    subject: "Math",
    modules: [
      solution("q3-sol", {
        title: "Q3 · Circulation by Stokes' theorem",
        problem: r`$\mathbf F=(y-z^2,\ z+x^2,\ x-y^2)$; $C$: $(x-1)^2+y^2=4$ meets $x+y+z=3$, counterclockwise seen from above. Find $\oint_C \mathbf F\cdot d\mathbf r$.`,
        steps: [
          [r`\frac{\partial}{\partial y}\left(x-y^2\right)-\frac{\partial}{\partial z}\left(z+x^2\right) = -2y-1`, "curl F, first component: ∂F₃/∂y − ∂F₂/∂z."],
          [r`\frac{\partial}{\partial z}\left(y-z^2\right)-\frac{\partial}{\partial x}\left(x-y^2\right) = -2z-1`, "Second component: ∂F₁/∂z − ∂F₃/∂x."],
          [r`\frac{\partial}{\partial x}\left(z+x^2\right)-\frac{\partial}{\partial y}\left(y-z^2\right) = 2x-1`, "Third component: ∂F₂/∂x − ∂F₁/∂y."],
          [r`(-2y-1)+(-2z-1)+(2x-1) = 2x-2y-2z-3`, "Upward normal of z = 3 − x − y: n dS = (1, 1, 1) dA, which matches counterclockwise-from-above."],
          [r`2x-2y-2(3-x-y)-3 = 4x-9`, "Substitute z = 3 − x − y on the surface."],
          [r`\int_0^{2\pi}\int_0^{2}\left(4(1+r\cos\theta)-9\right)r\,dr\,d\theta = -20\pi`, "Integrate over the disk D: centre (1, 0), radius 2, in polar coordinates about the centre."],
          [r`4\cdot1\cdot4\pi-9\cdot4\pi = -20\pi`, "Centroid shortcut: ∬4x dA = 4·x̄·Area = 16π and ∬9 dA = 36π."],
          [r`\int_0^{2\pi}\left(2\sin t-(2-2\cos t-2\sin t)^2\right)(-2\sin t)\,dt = -20\pi`, "Direct check: r(t) = (1 + 2cos t, 2 sin t, 2 − 2cos t − 2 sin t), 0 ≤ t ≤ 2π. The F₁·x′ part."],
          [r`\int_0^{2\pi}\left(2-2\cos t-2\sin t+(1+2\cos t)^2\right)(2\cos t)\,dt = 4\pi`, "The F₂·y′ part."],
          [r`\int_0^{2\pi}\left(1+2\cos t-4\sin^2 t\right)(2\sin t-2\cos t)\,dt = -4\pi`, "The F₃·z′ part."],
          [r`-20\pi+4\pi-4\pi = -20\pi`, "The line integral agrees with the surface integral."],
          [r`-20\pi \approx -62.8319`, "Decimal value. The sign is negative."],
        ],
        answer: r`\oint_C \mathbf F\cdot d\mathbf r=-20\pi\approx -62.8319`,
      }, { x: 0, y: 0, width: 640, height: 764 }),
      desmos("q3-scene", "Cylinder, plane and the curve C", { x: 660, y: 0, width: 680, height: 764 }, {
        mode: "3d",
        viewport: { xmin: -2.5, xmax: 4.5, ymin: -3.5, ymax: 3.5, zmin: -4, zmax: 8 },
        list: [
          { latex: r`(1+2\cos t,2\sin t,[-2,0,2,4,6])`, color: COL.blue, lineWidth: "1", parametricDomain: { min: "0", max: r`2\pi` } },
          r`w=\frac{\pi}{6}\cdot\left[0,1,2,3,4,5,6,7,8,9,10,11\right]`,
          { latex: r`\left(1+2\cos\left(w\right),2\sin\left(w\right),t\right)`, color: COL.blue, lineWidth: "1", parametricDomain: { min: "-2", max: "6" } },
          { latex: r`z=3-x-y\left\{(x-1)^2+y^2\le4\right\}`, color: COL.green, fillOpacity: "0.55" },
          { latex: r`(1+2\cos t,2\sin t,2-2\cos t-2\sin t)`, color: COL.red, lineWidth: "4", parametricDomain: { min: "0", max: r`2\pi` } },
          r`a=0.8`,
          { latex: r`P=(1+2\cos a,2\sin a,2-2\cos a-2\sin a)`, color: COL.red, showLabel: true, label: "C, counterclockwise seen from above (arrow = r′(t))" },
          { latex: r`\operatorname{vector}\left(P,P+0.9(-2\sin a,2\cos a,2\sin a-2\cos a)\right)`, color: COL.red },
          { latex: r`\operatorname{vector}\left((1,0,2),(1,0,2)+(1,1,1)\right)`, color: COL.green },
          { latex: r`(1,0,2)`, color: COL.green, showLabel: true, label: "n = (1,1,1) upward" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q4
{
  // RK4 integration for the given starts and the separatrix (stable manifold of the saddle).
  const field = ([x, y]) => [x * (4 - x - 2 * y), y * (3 - x - y)];
  const rk4 = (p, h) => {
    const add = (a, b, s) => [a[0] + s * b[0], a[1] + s * b[1]];
    const k1 = field(p), k2 = field(add(p, k1, h / 2)), k3 = field(add(p, k2, h / 2)), k4 = field(add(p, k3, h));
    return [p[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), p[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
  };
  const path = (start, h, steps, every = 5, keep = () => true) => {
    const points = [start];
    let p = start;
    for (let i = 1; i <= steps; i++) {
      p = rk4(p, h);
      if (!keep(p)) break;
      if (i % every === 0) points.push(p);
    }
    return points;
  };
  const inBox = (p) => p[0] >= -0.01 && p[1] >= -0.01 && p[0] <= 6 && p[1] <= 6;
  const vs = [1, (Math.sqrt(17) - 1) / 8];
  const norm = Math.hypot(...vs);
  const sepA = path([2 + (1e-4 * vs[0]) / norm, 1 + (1e-4 * vs[1]) / norm], -0.002, 40000, 25, inBox);
  const sepB = path([2 - (1e-4 * vs[0]) / norm, 1 - (1e-4 * vs[1]) / norm], -0.002, 40000, 25, inBox);
  const sep = [...sepB.reverse(), ...sepA];
  const traj1 = path([3, 1.5], 0.005, 6000, 20);
  const traj2 = path([1, 0.5], 0.005, 6000, 20);
  const last1 = traj1[traj1.length - 1];
  const last2 = traj2[traj2.length - 1];
  if (Math.hypot(last1[0], last1[1] - 3) > 1e-3 || Math.hypot(last2[0] - 4, last2[1]) > 1e-3) throw new Error("Q4 trajectories did not converge to the key's limits");
  const table = (id, pts, color, label) => ({
    type: "table",
    id,
    columns: [
      { id: `${id}x`, latex: `x_{${id}}`, values: pts.map((p) => p[0].toFixed(4)) },
      { id: `${id}y`, latex: `y_{${id}}`, values: pts.map((p) => p[1].toFixed(4)), color, points: false, lines: true, lineWidth: "3" },
    ],
  });
  const lu = "\\frac{-3+\\sqrt{17}}{2}";
  const ls = "\\frac{-3-\\sqrt{17}}{2}";
  boards[4] = {
    title: "Q4 Phase portrait",
    subject: "Math",
    modules: [
      solution("q4-sol", {
        title: "Q4 · Competitive Lotka–Volterra",
        problem: r`$x'=x(4-x-2y)$, $y'=y(3-x-y)$ on $x,y\ge0$. Equilibria, types, eigen-data at the interior point, and the limits from $(3,1.5)$ and $(1,0.5)$.`,
        steps: [
          [r`2(4-2-2\cdot1)=0,\quad 1(3-2-1)=0`, "(2, 1) is an equilibrium: it lies on x + 2y = 4 and x + y = 3. The others: (0,0), (4,0), (0,3)."],
          [r`\lambda^2+3\lambda-2=0`, "At (2, 1): J = [[−2, −4], [−1, −1]], trace −3, determinant −2."],
          [r`\lambda=\frac{-3\pm\sqrt{17}}{2}`, "Interior eigenvalues ≈ 0.5616 and −3.5616: opposite signs, so (2, 1) is a saddle."],
          [r`(-2)(-1)-(-4)(-1) = -2`, "det J(2,1) < 0 confirms the saddle."],
          [r`-2-\left(${lu}\right)+4\cdot\frac{1+\sqrt{17}}{8} = 0`, "λᵤ = (−3 + √17)/2 has eigenvector (1, −(1 + √17)/8): first row of (J − λI)v = 0."],
          [r`-1-\left(-1-${lu}\right)\frac{1+\sqrt{17}}{8} = 0`, "Second row for λᵤ."],
          [r`-2-\left(${ls}\right)-4\cdot\frac{\sqrt{17}-1}{8} = 0`, "λₛ = (−3 − √17)/2 has eigenvector (1, (√17 − 1)/8): first row."],
          [r`-1+\left(-1-${ls}\right)\frac{\sqrt{17}-1}{8} = 0`, "Second row for λₛ."],
          [r`4-2\cdot0-2\cdot0 = 4,\quad 3-0-2\cdot0 = 3`, "(0, 0): J = diag(4, 3). Both positive: unstable node."],
          [r`4-2\cdot4-2\cdot0 = -4,\quad 3-4-2\cdot0 = -1`, "(4, 0): J = [[−4, −8], [0, −1]], triangular, eigenvalues −4 and −1: stable node."],
          [r`4-2\cdot0-2\cdot3 = -2,\quad 3-0-2\cdot3 = -3`, "(0, 3): J = [[−2, 0], [−3, −3]], eigenvalues −2 and −3: stable node."],
          [r`1.5 > 1.3739`, "At x = 3 the separatrix (stable manifold of the saddle, integrated backward) is at y = 1.3739. (3, 1.5) is above it, so it tends to (0, 3)."],
          [r`0.5 < 0.5837`, "At x = 1 the separatrix is at y = 0.5837. (1, 0.5) is below it, so it tends to (4, 0)."],
        ],
        answer: r`\begin{aligned}&(0,0)\ \text{unstable node}\ \{4,3\}\\&(4,0)\ \text{stable node}\ \{-4,-1\}\\&(0,3)\ \text{stable node}\ \{-2,-3\}\\&(2,1)\ \text{saddle}\ \left\{\tfrac{-3\pm\sqrt{17}}{2}\right\}\\&(3,1.5)\to(0,3),\quad (1,0.5)\to(4,0)\end{aligned}`,
      }, L.sol),
      desmos("q4-portrait", "Phase portrait: nullclines, field, separatrix", L.rightFull, {
        viewport: { xmin: -0.3, xmax: 5.3, ymin: -0.3, ymax: 4.3 },
        list: [
          r`u(x,y)=x(4-x-2y)`,
          r`v(x,y)=y(3-x-y)`,
          { latex: r`G=\left[(a,b)\operatorname{for}a=[0.15,0.45,...,5.25],b=[0.15,0.45,...,4.35]\right]`, hidden: true },
          r`N=\sqrt{u(G.x,G.y)^2+v(G.x,G.y)^2}`,
          { latex: r`G+0.2t\frac{(u(G.x,G.y),v(G.x,G.y))}{N}`, color: COL.gray, lineWidth: "1.5", parametricDomain: { min: "0", max: "1" } },
          { latex: r`G+0.2\frac{(u(G.x,G.y),v(G.x,G.y))}{N}`, color: COL.gray, pointSize: "4" },
          { latex: r`x+2y=4\left\{x\ge0,y\ge0\right\}`, color: COL.orange, lineWidth: "3" },
          { latex: r`x+y=3\left\{x\ge0,y\ge0\right\}`, color: COL.purple, lineWidth: "3" },
          table("s", sep, COL.black, "separatrix"),
          table("p", traj1, COL.red, "from (3,1.5)"),
          table("q", traj2, COL.blue, "from (1,0.5)"),
          { latex: r`(0,0)`, color: COL.black, pointStyle: "OPEN", showLabel: true, label: "(0,0) unstable node", labelOrientation: "above_right" },
          { latex: r`(4,0)`, color: COL.black, showLabel: true, label: "(4,0) stable node", labelOrientation: "above" },
          { latex: r`(0,3)`, color: COL.black, showLabel: true, label: "(0,3) stable node", labelOrientation: "right" },
          { latex: r`(2,1)`, color: COL.black, pointStyle: "CROSS", showLabel: true, label: "(2,1) saddle", labelOrientation: "below_right" },
          { latex: r`(3,1.5)`, color: COL.red, showLabel: true, label: "start (3, 1.5) → (0, 3)", labelOrientation: "right" },
          { latex: r`(1,0.5)`, color: COL.blue, showLabel: true, label: "start (1, 0.5) → (4, 0)", labelOrientation: "above_left" },
          r`P_{0}=(4.5,2.5)`,
          r`h=0.02`,
          r`E(p)=p+h\cdot(u(p.x,p.y),v(p.x,p.y))`,
          r`S(n)=\left\{n=0:P_{0},E(S(n-1))\right\}`,
          { latex: r`S\left([0,5,...,600]\right)`, color: COL.green, lines: true, points: false, lineWidth: "3" },
          { latex: r`P_{0}`, color: COL.green, dragMode: "XY", showLabel: true, label: "drag me: trajectory updates", labelOrientation: "above" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q5
{
  const x1 = r`\left(1-t-\frac{t^2}{2}\right)e^{2t}`;
  const x2 = r`\left(e^{-t}-(1+t)e^{2t}\right)`;
  const x3 = r`\left(-\left(t+\frac{t^2}{2}\right)e^{2t}\right)`;
  const x4 = r`\left(e^{-t}-e^{2t}\right)`;
  const e2 = Math.exp(2), em1 = Math.exp(-1);
  boards[5] = {
    title: "Q5 Jordan form and matrix exponential",
    subject: "Math",
    modules: [
      solution("q5-sol", {
        title: "Q5 · Jordan form and e^(At)",
        problem: r`$A=\begin{pmatrix}1&1&1&-1\\-4&2&4&-3\\-1&1&3&-1\\-3&0&3&-1\end{pmatrix}$. Find the Jordan form, and solve $x'=Ax$, $x(0)=(1,0,0,0)^T$.`,
        steps: [
          [r`1+2+3+(-1) = 2+2+2+(-1)`, "Trace check: the eigenvalues 2, 2, 2, −1 sum to tr A = 5."],
          [r`(\lambda-2)^3(\lambda+1) = \lambda^4-5\lambda^3+6\lambda^2+4\lambda-8`, "Characteristic polynomial (λ − 2)³(λ + 1), expanded: the λ³ coefficient −5 = −tr A."],
          [r`J=\begin{pmatrix}-1&0&0&0\\0&2&1&0\\0&0&2&1\\0&0&0&2\end{pmatrix}`, "rank(A − 2I) = 3, rank(A − 2I)² = 2, rank(A − 2I)³ = 1: geometric multiplicity 4 − 3 = 1, so one 3×3 block J₃(2), plus J₁(−1)."],
          [r`0+1+0-1 = 0,\quad 0+2+0-3 = -1,\quad 0+1+0-1 = 0,\quad 0+0+0-1 = -1`, "Rows of A times w = (0, 1, 0, 1): Aw = (0, −1, 0, −1) = −w, so w is the λ = −1 eigenvector."],
          [r`1+0 = 1,\quad -1+1 = 0,\quad 0+0 = 0,\quad -1+1 = 0`, "Split x₀ = u + w with u = (1, −1, 0, −1) in ker(A − 2I)³."],
          [r`-1-1+0+1 = -1,\quad -4+0+0+3 = -1,\quad -1-1+0+1 = -1,\quad -3+0+0+3 = 0`, "Rows of N = A − 2I times u: Nu = (−1, −1, −1, 0)."],
          [r`1-1-1+0 = -1,\quad 4+0-4+0 = 0,\quad 1-1-1+0 = -1,\quad 3+0-3+0 = 0`, "N²u = N(Nu) = (−1, 0, −1, 0)."],
          [r`1+0-1+0 = 0,\quad 4+0-4+0 = 0,\quad 1+0-1+0 = 0,\quad 3+0-3+0 = 0`, "N³u = N(N²u) = 0, so the exponential series stops after t²/2."],
          [r`\frac{d}{dt}\left(${x1}\right) = ${x1}+${x2}+${x3}-${x4}`, "x(t) = e^{2t}(u + tNu + t²N²u/2) + e^{−t}w. CAS check of row 1 of x′ = Ax."],
          [r`\frac{d}{dt}${x2} = -4${x1}+2${x2}+4${x3}-3${x4}`, "Row 2 of x′ = Ax."],
          [r`\frac{d}{dt}${x3} = -${x1}+${x2}+3${x3}-${x4}`, "Row 3 of x′ = Ax."],
          [r`\frac{d}{dt}${x4} = -3${x1}+3${x3}-${x4}`, "Row 4 of x′ = Ax."],
          [r`(1-0-0)e^{0} = 1,\quad e^{0}-(1+0)e^{0} = 0,\quad -(0+0)e^{0} = 0,\quad e^{0}-e^{0} = 0`, "Initial condition: x(0) = (1, 0, 0, 0)."],
          [r`\left(1-1-\frac12\right)e^{2} = -\frac{e^2}{2} \approx ${fmt(-e2 / 2, 5)}`, "x₁(1)."],
          [r`e^{-1}-2e^{2} \approx ${fmt(em1 - 2 * e2)}`, "x₂(1)."],
          [r`-\left(1+\frac12\right)e^{2} = -\frac{3e^2}{2} \approx ${fmt(-1.5 * e2)}`, "x₃(1)."],
          [r`e^{-1}-e^{2} \approx ${fmt(em1 - e2, 5)}`, "x₄(1)."],
        ],
        answer: r`J=J_3(2)\oplus J_1(-1);\quad x(1)=\left(-\tfrac{e^2}{2},\ e^{-1}-2e^2,\ -\tfrac{3e^2}{2},\ e^{-1}-e^2\right)\approx(-3.6945,-14.4102,-11.0836,-7.0212)`,
      }, L.sol),
      desmos("q5-components", "Components of x(t)", L.rightFull, {
        viewport: { xmin: -0.06, xmax: 1.75, ymin: -20, ymax: 3 },
        list: [
          { latex: r`x_{1}(t)=\left(1-t-\frac{t^{2}}{2}\right)e^{2t}`, color: COL.red },
          { latex: r`x_{2}(t)=e^{-t}-(1+t)e^{2t}`, color: COL.blue },
          { latex: r`x_{3}(t)=-\left(t+\frac{t^{2}}{2}\right)e^{2t}`, color: COL.green },
          { latex: r`x_{4}(t)=e^{-t}-e^{2t}`, color: COL.purple },
          { latex: r`y=x_{1}(x)\left\{0\le x\le1.2\right\}`, color: COL.red, lineWidth: "3" },
          { latex: r`y=x_{2}(x)\left\{0\le x\le1.2\right\}`, color: COL.blue, lineWidth: "3" },
          { latex: r`y=x_{3}(x)\left\{0\le x\le1.2\right\}`, color: COL.green, lineWidth: "3" },
          { latex: r`y=x_{4}(x)\left\{0\le x\le1.2\right\}`, color: COL.purple, lineWidth: "3" },
          r`s=1`,
          r`v_{1}=\frac{\operatorname{round}\left(10^{4}x_{1}(s)\right)}{10^{4}}`,
          r`v_{2}=\frac{\operatorname{round}\left(10^{4}x_{2}(s)\right)}{10^{4}}`,
          r`v_{3}=\frac{\operatorname{round}\left(10^{4}x_{3}(s)\right)}{10^{4}}`,
          r`v_{4}=\frac{\operatorname{round}\left(10^{4}x_{4}(s)\right)}{10^{4}}`,
          { latex: r`(s,x_{1}(s))`, color: COL.red, dragMode: "X", pointSize: "14", showLabel: true, label: "drag ↔  t = ${s}:  x₁ = ${v_1}", labelOrientation: "right" },
          { latex: r`(s,v_{2})`, color: COL.blue, showLabel: true, label: "x₂(s) = ${v_2}", labelOrientation: "right" },
          { latex: r`(s,v_{3})`, color: COL.green, showLabel: true, label: "x₃(s) = ${v_3}", labelOrientation: "right" },
          { latex: r`(s,v_{4})`, color: COL.purple, showLabel: true, label: "x₄(s) = ${v_4}", labelOrientation: "right" },
          { latex: r`x=s`, color: COL.gray, lineStyle: "DASHED" },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q6
{
  const pNames = "p_0 ∅, p_1 H, p_2 T, p_3 HT, p_4 TH, p_5 HTH, p_6 THT";
  boards[6] = {
    title: "Q6 Penney race HTHT vs THTT",
    subject: "Math",
    modules: [
      solution("q6-sol", {
        title: "Q6 · Conway leading numbers",
        problem: r`Alice waits for HTHT, Bob for THTT on the same fair-coin sequence. (a) Each expected waiting time alone. (b) $P(\text{Alice wins})$. (c) Expected game length.`,
        steps: [
          [r`2^4+2^2 = 20`, "AA (HTHT with itself): overlaps of length 4 and 2. (a) E[wait for HTHT] = 20."],
          [r`2^4+2^1 = 18`, "BB (THTT with itself): overlaps of length 4 and 1. (a) E[wait for THTT] = 18."],
          [r`2^1+2^3 = 10`, "AB: the last k letters of HTHT equal the first k of THTT for k = 1 (T) and k = 3 (THT)."],
          [r`0 = 0`, "BA: no suffix of THTT is a prefix of HTHT."],
          [r`\frac{18-0}{(18-0)+(20-10)} = \frac{9}{14}`, "(b) Conway's odds A : B = (BB − BA) : (AA − AB) = 18 : 10."],
          [r`\frac{20\cdot18-10\cdot0}{20+18-10-0} = \frac{90}{7}`, "(c) E[length] = (AA·BB − AB·BA)/(AA + BB − AB − BA)."],
          [r`\frac{90}{7} \approx 12.857`, "The slower pattern on its own (20 > 18) still wins the race 9 times in 14."],
        ],
        answer: r`E_{HTHT}=20,\ E_{THTT}=18;\quad P(\text{Alice})=\tfrac{9}{14};\quad E[\text{length}]=\tfrac{90}{7}`,
      }, { x: 0, y: 0, width: 420, height: 764 }),
      solution("q6-chain-p", {
        title: "Check: absorbing chain for P(Alice)",
        problem: `States by longest useful suffix: ${pNames}. pₖ = P(Alice wins | state k).`,
        steps: [
          [r`p_0=\frac{p_1+p_2}{2}`, "From ∅: H → H, T → T."],
          [r`p_1=\frac{p_1+p_3}{2}`, "From H: H → H, T → HT."],
          [r`p_2=\frac{p_4+p_2}{2}`, "From T: H → TH, T → T."],
          [r`p_3=\frac{p_5+p_2}{2}`, "From HT: H → HTH, T → T (HTT keeps only T)."],
          [r`p_4=\frac{p_1+p_6}{2}`, "From TH: H → H, T → THT."],
          [r`p_5=\frac{p_1+1}{2}`, "From HTH: H → H, T completes HTHT (Alice wins)."],
          [r`p_6=\frac{p_5+0}{2}`, "From THT: H → HTH, T completes THTT (Bob wins)."],
          [r`p_0=\tfrac{9}{14},\ p_1=\tfrac57,\ p_2=\tfrac47,\ p_3=\tfrac57,\ p_4=\tfrac47,\ p_5=\tfrac67,\ p_6=\tfrac37`, "Exact solution of the linear system; the checker substitutes it into all seven equations."],
        ],
        answer: r`P(\text{Alice wins})=p_0=\tfrac{9}{14}`,
      }, { x: 440, y: 0, width: 500, height: 372 }),
      solution("q6-chain-m", {
        title: "Check: absorbing chain for the game length",
        problem: `Same states; mₖ = expected further tosses from state k.`,
        steps: [
          [r`m_0=1+\frac{m_1+m_2}{2}`, "From ∅."],
          [r`m_1=1+\frac{m_1+m_3}{2}`, "From H."],
          [r`m_2=1+\frac{m_4+m_2}{2}`, "From T."],
          [r`m_3=1+\frac{m_5+m_2}{2}`, "From HT."],
          [r`m_4=1+\frac{m_1+m_6}{2}`, "From TH."],
          [r`m_5=1+\frac{m_1+0}{2}`, "From HTH (T ends the game)."],
          [r`m_6=1+\frac{m_5+0}{2}`, "From THT (T ends the game)."],
          [r`m_0=\tfrac{90}{7},\ m_1=\tfrac{86}{7},\ m_2=\tfrac{80}{7},\ m_3=\tfrac{72}{7},\ m_4=\tfrac{66}{7},\ m_5=\tfrac{50}{7},\ m_6=\tfrac{32}{7}`, "Exact solution; substituted into all seven equations."],
        ],
        answer: r`E[\text{length}]=m_0=\tfrac{90}{7}\approx12.857`,
      }, { x: 440, y: 392, width: 500, height: 372 }),
      desmos("q6-bars", "Waiting time vs winning chance", { x: 960, y: 0, width: 380, height: 764 }, {
        viewport: { xmin: -0.4, xmax: 4.9, ymin: -3.2, ymax: 23 },
        list: [
          { latex: r`\operatorname{polygon}((0.2,0),(0.2,20),(0.8,20),(0.8,0))`, color: COL.red },
          { latex: r`\operatorname{polygon}((1.2,0),(1.2,18),(1.8,18),(1.8,0))`, color: COL.blue },
          { latex: r`\operatorname{polygon}((2.7,0),(2.7,20\cdot\frac{9}{14}),(3.3,20\cdot\frac{9}{14}),(3.3,0))`, color: COL.red },
          { latex: r`\operatorname{polygon}((3.7,0),(3.7,20\cdot\frac{5}{14}),(4.3,20\cdot\frac{5}{14}),(4.3,0))`, color: COL.blue },
          { latex: r`(0.5,20)`, color: COL.red, showLabel: true, label: "E[HTHT] = 20", labelOrientation: "above" },
          { latex: r`(1.5,18)`, color: COL.blue, showLabel: true, label: "E[THTT] = 18", labelOrientation: "above" },
          { latex: r`(3,20\cdot\frac{9}{14})`, color: COL.red, showLabel: true, label: "P(Alice) = 9/14", labelOrientation: "above" },
          { latex: r`(4,20\cdot\frac{5}{14})`, color: COL.blue, showLabel: true, label: "P(Bob) = 5/14", labelOrientation: "above_left" },
          { latex: r`(1,-1.5)`, hidden: true, showLabel: true, label: "E[wait] (tosses)", color: COL.gray },
          { latex: r`(3.5,-1.5)`, hidden: true, showLabel: true, label: "P(win) × 20", color: COL.gray },
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q7
{
  boards[7] = {
    title: "Q7 2^m + 5^n = k^2",
    subject: "Math",
    modules: [
      solution("q7-sol", {
        title: "Q7 · 2^m + 5^n is a perfect square",
        problem: r`Find all nonnegative integers $(m,n)$ with $2^m+5^n=k^2$, and prove there are no others.`,
        steps: [
          [r`(3-1)(3+1) = 2^3`, "Case n = 0: (k − 1)(k + 1) = 2^m. Two powers of 2 that differ by 2 must be 2 and 4, so k = 3 and m = 3."],
          [r`2^3+5^0 = 3^2`, "So (m, n) = (3, 0) is a solution."],
          [r`1^2\bmod 5 = 1,\quad 2^2\bmod 5 = 4,\quad 3^2\bmod 5 = 4,\quad 4^2\bmod 5 = 1`, "Case n ≥ 1: k² ≡ 2^m (mod 5) must be 1 or 4 …"],
          [r`2^1\bmod 5 = 2,\quad 2^2\bmod 5 = 4,\quad 2^3\bmod 5 = 3,\quad 2^4\bmod 5 = 1`, "… and 2^m mod 5 cycles 2, 4, 3, 1, so m is even."],
          [r`(1+(-1)^2)\bmod 3 = 2`, "Mod 3 with m even: 2^m + 5^n ≡ 1 + (−1)^n. If n were even this is 2, not a square mod 3 (squares are 0, 1). So n is odd."],
          [r`5^1\bmod 8 = 5,\quad 5^3\bmod 8 = 5,\quad 5^5\bmod 8 = 5`, "Mod 8 with m ≥ 3 and n odd: 2^m + 5^n ≡ 5, but squares mod 8 are 0, 1, 4. So m ∈ {0, 2}."],
          [r`(k-1)(k+1) = 5^n`, "m = 0: both factors would be powers of 5 differing by 2. Impossible (5^a − 5^b is a multiple of 4, or 0)."],
          [r`(3-2)(3+2) = 5^1`, "m = 2: (k − 2)(k + 2) = 5^n; powers of 5 differing by 4 are 1 and 5, so k = 3, n = 1."],
          [r`2^2+5^1 = 3^2`, "So (m, n) = (2, 1) is a solution."],
        ],
        answer: r`(m,n)=(3,0)\ \text{and}\ (2,1),\ \text{both giving } 9;\ \text{no others}`,
      }, L.sol),
      desmos("q7-search", "Brute-force search (m ≤ 50, n ≤ 22)", L.rightFull, {
        viewport: { xmin: -1.5, xmax: 51, ymin: -1.5, ymax: 23 },
        list: [
          { latex: r`P=\left[(m,n)\operatorname{for}m=[0...50],n=[0...22]\right]`, color: COL.gray, pointSize: "4" },
          r`f(m,n)=\operatorname{mod}\left(\sqrt{2^{m}+5^{n}},1\right)`,
          { latex: r`Q=P\left[f(P.x,P.y)=0\right]`, color: COL.red, pointSize: "14" },
          r`\operatorname{length}(Q)`,
          { latex: r`(3,0)`, color: COL.red, showLabel: true, label: "(3,0): 8 + 1 = 9", labelOrientation: "above_right" },
          { latex: r`(2,1)`, color: COL.red, showLabel: true, label: "(2,1): 4 + 5 = 9", labelOrientation: "above_right" },
          { latex: r`(25,21)`, hidden: true, showLabel: true, label: "large points: 2^m + 5^n is a perfect square (${n_Q} of 1173 pairs)", color: COL.gray },
          r`n_{Q}=\operatorname{length}(Q)`,
        ],
      }),
    ],
  };
}

// ---------------------------------------------------------------- Q8
{
  const s5 = Math.sqrt(5);
  const geometry = [
    r`a_{x}=2`,
    r`a_{y}=6.7082039325`,
    { latex: r`(a_{x},a_{y})`, color: COL.black, dragMode: "XY", pointSize: "14", showLabel: true, label: "A (drag): IN = ${d_IN}, R/2 − r = ${f_R}", labelOrientation: "above" },
    r`A=(a_{x},a_{y})`,
    { latex: r`B=(0,0)`, color: COL.black, showLabel: true, label: "B", labelOrientation: "below_left" },
    { latex: r`C=(8,0)`, color: COL.black, showLabel: true, label: "C", labelOrientation: "below_right" },
    { latex: r`\operatorname{polygon}(A,B,C)`, color: COL.black, fillOpacity: "0.04" },
    r`a=\operatorname{distance}(B,C)`,
    r`b=\operatorname{distance}(C,A)`,
    r`c=\operatorname{distance}(A,B)`,
    r`s=\frac{a+b+c}{2}`,
    r`r_{i}=\frac{4a_{y}}{s}`,
    { latex: r`I=\frac{aA+bB+cC}{a+b+c}`, color: COL.blue, showLabel: true, label: "I", labelOrientation: "left" },
    { latex: r`O=\left(4,\frac{a_{x}^{2}+a_{y}^{2}-8a_{x}}{2a_{y}}\right)`, color: COL.green, showLabel: true, label: "O", labelOrientation: "right" },
    r`R=\operatorname{distance}(O,B)`,
    { latex: r`H=A+B+C-2O`, color: COL.red, showLabel: true, label: "H", labelOrientation: "left" },
    { latex: r`N=\frac{O+H}{2}`, color: COL.purple, showLabel: true, label: "N", labelOrientation: "right" },
    { latex: r`(x-I.x)^{2}+(y-I.y)^{2}=r_{i}^{2}`, color: COL.blue },
    { latex: r`(x-N.x)^{2}+(y-N.y)^{2}=\left(\frac{R}{2}\right)^{2}`, color: COL.purple },
    { latex: r`(x-O.x)^{2}+(y-O.y)^{2}=R^{2}`, color: COL.green, lineStyle: "DASHED", lineWidth: "1.5" },
    { latex: r`O+t(H-O)`, color: COL.orange, lineWidth: "2", parametricDomain: { min: "0", max: "1" } },
    { latex: r`A+t\left((a_{x},0)-A\right)`, color: COL.red, lineStyle: "DOTTED", parametricDomain: { min: "0", max: "1" } },
    { latex: r`F=N+\frac{R}{2}\cdot\frac{I-N}{\operatorname{distance}(I,N)}`, color: COL.pink, showLabel: true, label: "Feuerbach point", labelOrientation: "above_right" },
    { latex: r`I+t(N-I)`, color: COL.pink, lineWidth: "4", parametricDomain: { min: "0", max: "1" } },
    r`d_{IN}=\operatorname{distance}(I,N)`,
    r`f_{R}=\frac{R}{2}-r_{i}`,
  ];
  boards[8] = {
    title: "Q8 Incenter to nine-point center",
    subject: "Math",
    modules: [
      solution("q8-sol", {
        title: "Q8 · Distance IN (Feuerbach)",
        problem: r`Triangle with $AB=7$, $BC=8$, $CA=9$. $I$ = incenter, $N$ = nine-point center (midpoint of $OH$). Find $IN$ exactly.`,
        steps: [
          [r`2^2+(3\sqrt5)^2 = 7^2,\quad (2-8)^2+(3\sqrt5)^2 = 9^2`, "Coordinates B = (0,0), C = (8,0), A = (2, 3√5) give AB = 7 and AC = 9."],
          [r`\sqrt{12\cdot(12-8)(12-9)(12-7)} = 12\sqrt5`, "Heron: s = 12, area K = 12√5."],
          [r`\frac{12\sqrt5}{12} = \sqrt5`, "Inradius r = K/s."],
          [r`\frac{7\cdot8\cdot9}{4\cdot12\sqrt5} = \frac{21\sqrt5}{10}`, "Circumradius R = abc/(4K)."],
          [r`4^2+\left(\frac{11\sqrt5}{10}\right)^2 = \left(\frac{21\sqrt5}{10}\right)^2`, "O = (4, 11√5/10) is at distance R from B …"],
          [r`(4-2)^2+\left(\frac{11\sqrt5}{10}-3\sqrt5\right)^2 = \left(\frac{21\sqrt5}{10}\right)^2`, "… and from A."],
          [r`3\sqrt5-2\cdot\frac{11\sqrt5}{10} = \frac{4\sqrt5}{5},\quad 2+0+8-2\cdot4 = 2`, "H = A + B + C − 2O = (2, 4√5/5), on the altitude x = 2."],
          [r`\frac12\left(\frac{11\sqrt5}{10}+\frac{4\sqrt5}{5}\right) = \frac{19\sqrt5}{20},\quad \frac{4+2}{2} = 3`, "N = (O + H)/2 = (3, 19√5/20)."],
          [r`\frac{8\cdot2+9\cdot0+7\cdot8}{24} = 3,\quad \frac{8\cdot3\sqrt5}{24} = \sqrt5`, "I = (aA + bB + cC)/(a + b + c) = (3, √5), with a = BC = 8, b = CA = 9, c = AB = 7."],
          [r`\sqrt5-\frac{19\sqrt5}{20} = \frac{\sqrt5}{20}`, "I and N both lie on x = 3, so IN is the difference of the y-coordinates."],
          [r`\frac12\cdot\frac{21\sqrt5}{10}-\sqrt5 = \frac{\sqrt5}{20}`, "Feuerbach check: the incircle is internally tangent to the nine-point circle, so IN = R/2 − r."],
          [r`(4-3)^2+\left(\frac{11\sqrt5}{10}-\sqrt5\right)^2 = \frac{21\sqrt5}{10}\left(\frac{21\sqrt5}{10}-2\sqrt5\right)`, "Side check, Euler: OI² = R(R − 2r) = 21/20."],
          [r`\frac{\sqrt5}{20} \approx ${fmt(s5 / 20)}`, "Decimal value."],
        ],
        answer: r`IN=\dfrac{\sqrt5}{20}\approx ${fmt(s5 / 20)}`,
      }, L.sol),
      desmos("q8-construction", "Construction: incircle, nine-point circle, Euler line", { x: 580, y: 0, width: 760, height: 500 }, {
        viewport: { xmin: -2.5, xmax: 10.5, ymin: -1.2, ymax: 7.8 },
        list: geometry,
      }),
      desmos("q8-inset", "Zoomed inset: the segment IN", { x: 580, y: 520, width: 760, height: 244 }, {
        viewport: { xmin: 2.55, xmax: 3.45, ymin: 2.05, ymax: 2.31 },
        list: [
          r`I=(3,\sqrt{5})`,
          r`N=\left(3,\frac{19\sqrt{5}}{20}\right)`,
          { latex: r`I`, color: COL.blue, showLabel: true, label: "I = (3, √5)", labelOrientation: "right" },
          { latex: r`N`, color: COL.purple, showLabel: true, label: "N = (3, 19√5/20)", labelOrientation: "right" },
          { latex: r`I+t(N-I)`, color: COL.pink, lineWidth: "4", parametricDomain: { min: "0", max: "1" } },
          { latex: r`\left(3,\frac{39\sqrt{5}}{40}\right)`, hidden: true, showLabel: true, label: "IN = √5/20 ≈ 0.1118", labelOrientation: "left", color: COL.pink },
        ],
      }),
    ],
  };
}
