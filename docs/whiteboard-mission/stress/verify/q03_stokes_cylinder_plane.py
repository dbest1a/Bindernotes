"""Q03 - circulation of F around cylinder (x-1)^2+y^2=4 cut by plane x+y+z=3."""
import sympy as sp
import mpmath as mp

x, y, z, t, r, th = sp.symbols('x y z t r theta', real=True)
F = sp.Matrix([y - z**2, z + x**2, x - y**2])
curl = sp.Matrix([
    sp.diff(F[2], y) - sp.diff(F[1], z),
    sp.diff(F[0], z) - sp.diff(F[2], x),
    sp.diff(F[1], x) - sp.diff(F[0], y),
])
print("curl F =", list(curl))
# Direct line integral, counterclockwise seen from above
X = 1 + 2 * sp.cos(t); Y = 2 * sp.sin(t); Z = 3 - X - Y
sub = {x: X, y: Y, z: Z}
integrand = sum(F[i].subs(sub) * sp.diff(c, t) for i, c in enumerate((X, Y, Z)))
line = sp.integrate(sp.expand(integrand), (t, 0, 2 * sp.pi))
print("direct line integral   =", sp.simplify(line))
# Stokes: surface z = 3 - x - y, upward normal (1,1,1) dA
g = sp.expand((curl.dot(sp.Matrix([1, 1, 1]))).subs(z, 3 - x - y))
print("curl F . (1,1,1) on plane =", g)
surf = sp.integrate(g.subs({x: 1 + r * sp.cos(th), y: r * sp.sin(th)}) * r, (r, 0, 2), (th, 0, 2 * sp.pi))
print("surface integral       =", sp.simplify(surf))
assert sp.simplify(line - surf) == 0 and sp.simplify(line + 20 * sp.pi) == 0
print("FINAL: circulation = -20*pi =", sp.N(line, 8))
