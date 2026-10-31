"""Q01 - keyhole contour: I = int_0^inf x^(1/3) / ((x+1)(x+4)) dx."""
import mpmath as mp
import sympy as sp

mp.mp.dps = 40
z = sp.symbols('z')
# Residues of z^(1/3)/((z+1)(z+4)) with branch arg in (0, 2pi): (-1)^(1/3)=e^{i pi/3}, (-4)^(1/3)=4^(1/3) e^{i pi/3}
w = sp.exp(sp.I * sp.pi / 3)
res_m1 = w / 3                       # z^(1/3)/(z+4) at z=-1
res_m4 = sp.cbrt(4) * w / (-3)       # z^(1/3)/(z+1) at z=-4
lhs_factor = 1 - sp.exp(2 * sp.pi * sp.I / 3)   # (1 - e^{2 pi i a}) with a = 1/3 exponent on upper/lower edges
I_res = sp.nsimplify(sp.simplify(2 * sp.pi * sp.I * (res_m1 + res_m4) / lhs_factor))
closed = 2 * sp.pi * (sp.cbrt(4) - 1) / (3 * sp.sqrt(3))
print("residue route        :", sp.N(I_res, 15))
print("closed form 2pi(4^(1/3)-1)/(3 sqrt3):", sp.N(closed, 15))
num = mp.quad(lambda x: mp.cbrt(x) / ((x + 1) * (x + 4)), [0, 1, 4, mp.inf])
print("direct quadrature    :", mp.nstr(num, 15))
assert abs(num - mp.mpf(str(sp.N(closed, 30)))) < 1e-25
assert abs(complex(sp.N(I_res - closed, 30))) < 1e-20
print("FINAL: I = 2*pi*(4^(1/3)-1)/(3*sqrt(3)) =", mp.nstr(num, 6))
