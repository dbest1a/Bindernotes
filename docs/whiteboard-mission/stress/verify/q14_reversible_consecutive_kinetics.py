"""Q14 - A <=> B (k1 = 0.120 s^-1, k-1 = 0.0300 s^-1), B -> C (k2 = 0.0450 s^-1), [A]0 = 0.500 M."""
import sympy as sp
import mpmath as mp
import numpy as np
from scipy.integrate import solve_ivp

mp.mp.dps = 40
k1, km1, k2, A0 = sp.Rational(12, 100), sp.Rational(3, 100), sp.Rational(45, 1000), sp.Rational(1, 2)
t = sp.symbols('t', positive=True)
M = sp.Matrix([[-k1, km1], [k1, -(km1 + k2)]])
lams = sorted(M.eigenvals(), key=lambda v: float(v))
print("eigenvalues:", [sp.nsimplify(v) for v in lams], "=", [float(v) for v in lams])
X = (M * t).exp() * sp.Matrix([A0, 0])
A = sp.simplify(X[0]); B = sp.simplify(X[1]); C = sp.simplify(A0 - A - B)
lp, lm = [-v for v in lams]   # positive decay constants, lp > lm
print("[B](t) =", sp.simplify(B))
tmax = sp.log(lp / lm) / (lp - lm)
Bmax = B.subs(t, tmax)
print("t_max = ln(l+/l-)/(l+ - l-) =", sp.nsimplify(tmax), "=", float(tmax), "s")
print("[B]max =", float(Bmax), "M")
fC = sp.lambdify(t, C - sp.Rational(1, 4), 'mpmath')
tC = mp.findroot(fC, 30)
print("t([C] = 0.250 M) =", mp.nstr(tC, 10), "s")
# numerical ODE cross-check
def rhs(_, y):
    a, b, c = y
    return [-0.12 * a + 0.03 * b, 0.12 * a - 0.075 * b, 0.045 * b]
sol = solve_ivp(rhs, [0, 200], [0.5, 0, 0], rtol=1e-12, atol=1e-14, dense_output=True)
ts = np.linspace(0, 200, 2000001); ys = sol.sol(ts)
i = ys[1].argmax(); j = np.argmax(ys[2] >= 0.25)
print("ODE check: t_max ~ %.4f s, [B]max ~ %.6f M, t(C=0.25) ~ %.4f s" % (ts[i], ys[1][i], ts[j]))
# steady-state approximation for B (for comparison: invalid here)
kss = 0.12 * 0.045 / (0.03 + 0.045)
print("SSA effective k = %.4f s^-1 -> SSA t(C=0.25) = %.2f s (badly off)" % (kss, np.log(2) / kss))
print("Vieta check: l+ * l- = k1*k2 =", float(lp * lm), "; l+ + l- = k1+k-1+k2 =", float(lp + lm))
print("closed form: [B] = k1[A]0/(l+ - l-) * (exp(-l- t) - exp(-l+ t))")
assert abs(float(B.subs(t, 7)) - 0.06 / float(lp - lm) * (mp.e ** (-float(lm) * 7) - mp.e ** (-float(lp) * 7))) < 1e-12
assert abs(ts[i] - float(tmax)) < 1e-3 and abs(ys[1][i] - float(Bmax)) < 1e-9 and abs(ts[j] - float(tC)) < 1e-3
print("FINAL: t_max = %.3g s, [B]max = %.3g M, t(C=0.250 M) = %.3g s" % (float(tmax), float(Bmax), float(tC)))
