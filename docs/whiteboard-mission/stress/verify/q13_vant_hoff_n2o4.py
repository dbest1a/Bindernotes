"""Q13 - N2O4 <=> 2 NO2: K(298.15 K) = 0.1420, dH = +58.30 kJ/mol (constant), P° = 1 bar."""
import mpmath as mp

mp.mp.dps = 30
R = mp.mpf('8.314462'); K1 = mp.mpf('0.1420'); T1 = mp.mpf('298.15'); dH = mp.mpf('58300')
# (a) T where K = 1:  ln(1/K1) = -dH/R (1/T - 1/T1)
T_K1 = 1 / (1 / T1 - R * mp.log(1 / K1) / dH)
print("(a) T(K=1) = %.3f K" % float(T_K1))
# (b) K at 340.0 K
T2 = mp.mpf('340.0')
K2 = K1 * mp.exp(-dH / R * (1 / T2 - 1 / T1))
print("(b) K(340.0 K) = %.5f" % float(K2))
# (c) rigid vessel, pure N2O4 at 0.400 bar (340 K):  K = (2x)^2/(P0 - x), P in bar
P0 = mp.mpf('0.400')
x = (-K2 + mp.sqrt(K2**2 + 16 * K2 * P0)) / 8
Ptot = P0 + x
print("(c) x = %.5f bar, P(N2O4) = %.5f bar, P(NO2) = %.5f bar, P_total = %.5f bar, alpha = %.5f"
      % (float(x), float(P0 - x), float(2 * x), float(Ptot), float(x / P0)))
assert abs((2 * x) ** 2 / (P0 - x) - K2) < 1e-25
dS = (dH + R * T1 * mp.log(K1)) / T1
print("implied dS° = %.3f J/(mol K); dH/dS = %.3f K (same as (a))" % (float(dS), float(dH / dS)))
print("FINAL: T(K=1) = %.1f K; K(340.0 K) = %.3f; P_total = %.3f bar; alpha = %.3f"
      % (float(T_K1), float(K2), float(Ptot), float(x / P0)))
