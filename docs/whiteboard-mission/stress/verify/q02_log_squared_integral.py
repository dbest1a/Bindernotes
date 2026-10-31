"""Q02 - I = int_0^inf (ln x)^2 / (x^2 + 2x + 4) dx."""
import mpmath as mp
import sympy as sp

mp.mp.dps = 40
num = mp.quad(lambda x: mp.log(x) ** 2 / (x * x + 2 * x + 4), [0, 1, 2, 10, mp.inf])
# Pieces after x = 2t: I = 1/2 [ ln^2 2 * J0 + 2 ln2 * J1 + J2 ],  J_k = int_0^inf (ln t)^k/(t^2+t+1) dt
J0 = mp.quad(lambda t: 1 / (t * t + t + 1), [0, 1, mp.inf])
J1 = mp.quad(lambda t: mp.log(t) / (t * t + t + 1), [0, 1, mp.inf])
J2 = mp.quad(lambda t: mp.log(t) ** 2 / (t * t + t + 1), [0, 1, mp.inf])
print("J0 =", mp.nstr(J0, 20), " vs 2pi/(3sqrt3) =", mp.nstr(2 * mp.pi / (3 * mp.sqrt(3)), 20))
print("J1 =", mp.nstr(J1, 5), " (t -> 1/t antisymmetry => 0)")
print("J2 =", mp.nstr(J2, 20), " vs 16pi^3/(81sqrt3) =", mp.nstr(16 * mp.pi ** 3 / (81 * mp.sqrt(3)), 20))
closed = mp.pi * mp.log(2) ** 2 / (3 * mp.sqrt(3)) + 8 * mp.pi ** 3 / (81 * mp.sqrt(3))
print("direct quadrature :", mp.nstr(num, 20))
print("closed form       :", mp.nstr(closed, 20))
assert abs(num - closed) < 1e-25
# symbolic simplification of closed form
s = sp.pi * sp.log(2) ** 2 / (3 * sp.sqrt(3)) + 8 * sp.pi ** 3 / (81 * sp.sqrt(3))
print("sympy form:", sp.simplify(s * 81 * sp.sqrt(3)), "/ (81 sqrt3)")
print("FINAL: I = pi*ln(2)^2/(3*sqrt3) + 8*pi^3/(81*sqrt3) = sqrt3*pi*(27 ln^2 2 + 8 pi^2)/243 =", mp.nstr(closed, 6))
assert abs(closed - mp.sqrt(3) * mp.pi * (27 * mp.log(2) ** 2 + 8 * mp.pi ** 2) / 243) < 1e-30
# Analytic route for J0, J1, J2: Mellin transform F(s) = int_0^inf t^(s-1)/(t^2+t+1) dt
#   = pi sin((1-s) pi/3) / (sin(pi/3) sin(pi s)),  J_k = F^(k)(1)
s_ = sp.symbols('s')
Fs = sp.pi * sp.sin((1 - s_) * sp.pi / 3) / (sp.sin(sp.pi / 3) * sp.sin(sp.pi * s_))
ser = sp.series(Fs, s_, 1, 3).removeO()
J0s, J1s, J2s = [sp.simplify(sp.diff(ser, s_, k).subs(s_, 1)) for k in range(3)]
print("Mellin route: J0 =", J0s, " J1 =", J1s, " J2 =", J2s)
assert sp.simplify(J2s - 16 * sp.pi**3 / (81 * sp.sqrt(3))) == 0 and J1s == 0
assert abs(mp.quad(lambda t: t ** mp.mpf('0.3') / (t * t + t + 1), [0, 1, mp.inf]) - mp.mpf(str(sp.N(Fs.subs(s_, sp.Rational(13, 10)), 30)))) < 1e-20
