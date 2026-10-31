"""Q08 - triangle AB=7, BC=8, CA=9: distance from incenter I to nine-point center N."""
import sympy as sp

a, b, c = 8, 9, 7  # a=BC, b=CA, c=AB
B = sp.Matrix([0, 0]); C = sp.Matrix([a, 0])
xA = sp.Rational(a**2 + c**2 - b**2, 2 * a)
yA = sp.sqrt(c**2 - xA**2)
A = sp.Matrix([xA, yA])
print("A =", list(A), " (B=(0,0), C=(8,0))")
assert sp.simplify((A - C).norm() - b) == 0
# circumcenter
ox = sp.Rational(a, 2)
oy = sp.symbols('oy')
oy = sp.solve(sp.Eq((A[0] - ox)**2 + (A[1] - oy)**2, ox**2 + oy**2), oy)[0]
O = sp.Matrix([ox, sp.simplify(oy)])
H = sp.simplify(A + B + C - 2 * O)    # Euler: OH = OA+OB+OC
N = sp.simplify((O + H) / 2)
I = sp.simplify((a * A + b * B + c * C) / (a + b + c))
R = sp.simplify((A - O).norm())
r = sp.simplify(I[1])
print("O =", list(O), " H =", list(H), " N =", list(N), " I =", list(I))
# altitude check: H lies on altitude from A (x = xA) and BH perpendicular to CA
assert H[0] == xA and sp.simplify((H - B).dot(A - C)) == 0
print("R =", R, " r =", r)
IN = sp.nsimplify(sp.simplify((I - N).norm()))
OI = sp.simplify((I - O).norm())
print("IN =", IN, "=", sp.N(IN, 10), "  R/2 - r =", sp.simplify(R / 2 - r))
print("OI =", OI, " check R(R-2r) =", sp.simplify(R * (R - 2 * r)), " OI^2 =", sp.simplify(OI**2))
print("OH =", sp.simplify((O - H).norm()), " nine-point radius R/2 =", sp.simplify(R / 2))
# tangency point of incircle and nine-point circle: on ray N->I at distance R/2 from N
T = sp.simplify(N + (I - N) / IN * R / 2)
print("Feuerbach point F =", [sp.N(v, 8) for v in T])
assert sp.simplify(IN - sp.sqrt(5) / 20) == 0
print("FINAL: IN = sqrt(5)/20 =", sp.N(IN, 6))
