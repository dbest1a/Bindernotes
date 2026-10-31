"""Q11 - solubility of AgCl in 0.250 M (total) NH3 + 0.0100 M NaCl. Ksp 1.9e-10, log b1 3.25, log b2 7.10."""
import mpmath as mp
from scipy.optimize import fsolve

mp.mp.dps = 40
Ksp = mp.mpf('1.9e-10'); b1 = mp.mpf(10) ** mp.mpf('3.25'); b2 = mp.mpf(10) ** mp.mpf('7.10')
NH3T = mp.mpf('0.250'); Cl0 = mp.mpf('0.0100')

def eqs(S, L):
    Ag = Ksp / (Cl0 + S)
    return [S - Ag * (1 + b1 * L + b2 * L * L),          # silver mass balance (S = all dissolved Ag)
            NH3T - L - Ag * (b1 * L + 2 * b2 * L * L)]   # ammonia mass balance

S, L = mp.findroot(eqs, (mp.mpf('0.008'), mp.mpf('0.23')))
Ag = Ksp / (Cl0 + S)
print("S = %.6e M,  free [NH3] = %.6f M,  [Ag+] = %.4e M,  [Cl-] = %.6f M" % (float(S), float(L), float(Ag), float(Cl0 + S)))
fr = [Ag / S, Ag * b1 * L / S, Ag * b2 * L * L / S]
print("fractions Ag+ / AgNH3+ / Ag(NH3)2+ = %.3e / %.3e / %.6f" % tuple(float(v) for v in fr))
# independent numeric solve with scipy in log space
def g(v):
    s, l = v
    a = 1.9e-10 / (0.01 + s)
    return [s - a * (1 + 10**3.25 * l + 10**7.10 * l * l), 0.25 - l - a * (10**3.25 * l + 2 * 10**7.10 * l * l)]
s2, l2 = fsolve(g, [0.01, 0.2], xtol=1e-12)
print("scipy fsolve: S = %.6e, [NH3] = %.6f" % (s2, l2))
# naive answers for comparison
Sn = (-0.01 + mp.sqrt(0.0001 + 4 * Ksp * b2 * NH3T**2)) / 2
print("naive (no NH3 depletion, beta2 only) S = %.4e" % float(Sn))
Snocl = mp.findroot(lambda s: s - (Ksp / s) * (1 + b1 * (NH3T - 2 * s) + b2 * (NH3T - 2 * s) ** 2), mp.mpf('0.01'))
print("for comparison, no added NaCl: S = %.4e" % float(Snocl))
assert abs(S - s2) < 1e-10 and mp.nstr(S, 3) == '0.00753'
print("FINAL: S = %.3g mol/L (7.53e-3 M); [Ag(NH3)2+]/S = %.4f" % (float(S), float(fr[2])))
