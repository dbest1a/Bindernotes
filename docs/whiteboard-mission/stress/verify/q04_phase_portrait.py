"""Q04 - x' = x(4 - x - 2y), y' = y(3 - x - y): equilibria, types, separatrix, fates."""
import sympy as sp
import numpy as np
from scipy.integrate import solve_ivp

x, y = sp.symbols('x y', real=True)
f = sp.Matrix([x * (4 - x - 2 * y), y * (3 - x - y)])
Jm = f.jacobian([x, y])
eqs = sp.solve(list(f), [x, y], dict=True)
for e in sorted(eqs, key=lambda d: (d[x], d[y])):
    Je = Jm.subs(e)
    evs = list(Je.eigenvals())
    vals = [complex(sp.N(v)) for v in evs]
    tr, det = Je.trace(), Je.det()
    if det < 0:
        kind = "saddle"
    elif all(v.real < 0 for v in vals):
        kind = "stable node" if tr**2 - 4 * det >= 0 else "stable focus"
    else:
        kind = "unstable node" if tr**2 - 4 * det >= 0 else "unstable focus"
    print(f"({e[x]},{e[y]}): J={Je.tolist()} eigenvalues={evs} -> {kind}")
Js = Jm.subs({x: 2, y: 1})
for val, mult, vecs in Js.eigenvects():
    v = vecs[0] / vecs[0][0]
    print("saddle eigenvalue", sp.simplify(val), "~", sp.N(val, 6),
          "eigenvector (1, %s), slope %s" % (sp.simplify(v[1]), sp.N(v[1], 6)))


def rhs(t, s):
    X, Y = s
    return [X * (4 - X - 2 * Y), Y * (3 - X - Y)]


# Stable manifold (separatrix) of the saddle: integrate backward from points just off the saddle
lam_s = (-3 - np.sqrt(17)) / 2
slope = (-2 - lam_s) / 4
sep = {}
for sgn, xs in ((+1, 3.0), (-1, 1.0), (-1, 0.5)):
    p0 = np.array([2.0, 1.0]) + sgn * 1e-7 * np.array([1, slope]) / np.hypot(1, slope)
    ev = lambda t, s, xs=xs: s[0] - xs
    sol = solve_ivp(rhs, [0, -8], p0, rtol=1e-11, atol=1e-13, events=ev)
    sep[xs] = float(sol.y_events[0][0][1])
    print(f"separatrix crosses x = {xs}: y = {sep[xs]:.6f}")
print("upper separatrix branch comes in from infinity; lower branch emanates from the unstable node (0,0)")

fates = {}
for p in [(3.0, 1.5), (1.0, 0.5), (0.5, 0.5)]:
    sol = solve_ivp(rhs, [0, 200], p, rtol=1e-11, atol=1e-13)
    end = (round(float(sol.y[0, -1]), 6) + 0.0, round(float(sol.y[1, -1]), 6) + 0.0)
    fates[p] = end
    side = "above" if p[1] > sep[p[0]] else "below"
    print(f"trajectory from {p} -> {end}   (start lies {side} the separatrix, which is at y={sep[p[0]]:.4f})")
assert fates[(3.0, 1.5)] == (0.0, 3.0)
assert fates[(1.0, 0.5)] == (4.0, 0.0)
print("FINAL: (0,0) unstable node [4,3]; (4,0) stable node [-4,-1]; (0,3) stable node [-2,-3];"
      " (2,1) saddle [(-3+sqrt17)/2, (-3-sqrt17)/2]; (3,1.5)->(0,3); (1,0.5)->(4,0)")
