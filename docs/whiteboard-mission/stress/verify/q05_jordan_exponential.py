"""Q05 - Jordan form of a 4x4 matrix and x(1) = e^{A} x0."""
import sympy as sp
import mpmath as mp
from scipy.linalg import expm
import numpy as np

A = sp.Matrix([[1, 1, 1, -1], [-4, 2, 4, -3], [-1, 1, 3, -1], [-3, 0, 3, -1]])
t = sp.symbols('t', real=True)
lam = sp.symbols('lambda')
print("char poly:", sp.factor(A.charpoly(lam).as_expr()))
I4 = sp.eye(4)
for k in (1, 2, 3):
    print(f"rank (A-2I)^{k} =", ((A - 2 * I4) ** k).rank())
print("rank (A+I) =", (A + I4).rank())
P, J = A.jordan_form()
print("Jordan form J =", J.tolist())
expAt = sp.simplify((A * t).exp())
x0 = sp.Matrix([1, 0, 0, 0])
xt = sp.simplify(expAt * x0)
print("x(t) =", [sp.factor(c) for c in xt])
x1 = sp.simplify(xt.subs(t, 1))
print("x(1) exact =", list(x1))
x1n = [float(sp.N(c, 20)) for c in x1]
print("x(1) numeric (sympy) =", [f"{v:.6f}" for v in x1n])
xn = expm(np.array(A.tolist(), dtype=float)) @ np.array([1.0, 0, 0, 0])
print("x(1) numeric (scipy expm) =", [f"{v:.6f}" for v in xn])
assert np.allclose(xn, x1n, rtol=1e-12)
e2, em1 = sp.exp(2), sp.exp(-1)
key_t = sp.Matrix([-(t**2 + 2*t - 2) * sp.exp(2*t) / 2, sp.exp(-t) - (t + 1) * sp.exp(2*t),
                   -t * (t + 2) * sp.exp(2*t) / 2, sp.exp(-t) - sp.exp(2*t)])
assert sp.simplify(xt - key_t) == sp.zeros(4, 1)
key = sp.Matrix([-e2 / 2, em1 - 2 * e2, -3 * e2 / 2, em1 - e2])
assert sp.simplify(x1 - key) == sp.zeros(4, 1)
print("FINAL: J = diag(J_3(2), J_1(-1)); x(1) = (-e^2/2, e^-1 - 2e^2, -3e^2/2, e^-1 - e^2)"
      " ~ (-3.6945, -14.4102, -11.0836, -7.0212)")
