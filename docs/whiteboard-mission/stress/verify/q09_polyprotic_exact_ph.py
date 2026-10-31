"""Q09 - exact pH of 2.00 mM Na2HA (pKa 2.25, 7.05, 12.05), full charge balance, Kw = 1.00e-14."""
import mpmath as mp

mp.mp.dps = 40
C = mp.mpf('2.00e-3'); Na = 2 * C; Kw = mp.mpf('1e-14')
Ka = [mp.mpf(10) ** (-mp.mpf(p)) for p in ('2.25', '7.05', '12.05')]

def fractions(h):
    K1, K2, K3 = Ka
    terms = [h**3, K1 * h**2, K1 * K2 * h, K1 * K2 * K3]
    D = sum(terms)
    return [t / D for t in terms]   # H3A, H2A-, HA2-, A3-

def cb(pH):
    h = mp.mpf(10) ** (-pH)
    a0, a1, a2, a3 = fractions(h)
    return Na + h - (C * (a1 + 2 * a2 + 3 * a3) + Kw / h)

pH = mp.findroot(cb, mp.mpf('9.3'))
h = mp.mpf(10) ** (-pH)
a = fractions(h)
print("exact pH =", mp.nstr(pH, 10))
print("species (M): H3A %.3e  H2A- %.3e  HA2- %.3e  A3- %.3e" % tuple(float(C * v) for v in a))
print("[H+] = %.3e  [OH-] = %.3e" % (float(h), float(Kw / h)))
print("naive (pKa2+pKa3)/2 =", (7.05 + 12.05) / 2)
# closed-form 'amphiprotic' formula including Kw, ignoring H3A and dilution of C-terms: h^2 = K2(K3 C + Kw)/(K2 + C)
K1, K2, K3 = Ka
hb = mp.sqrt(K2 * (K3 * C + Kw) / (K2 + C))
print("textbook improved formula pH =", mp.nstr(-mp.log10(hb), 8))
# brute-force bisection cross-check
lo, hi = mp.mpf(7), mp.mpf(12)
for _ in range(200):
    mid = (lo + hi) / 2
    if cb(lo) * cb(mid) <= 0: hi = mid
    else: lo = mid
print("bisection pH =", mp.nstr(lo, 10))
assert abs(lo - pH) < 1e-20 and mp.nstr(pH, 4) == '9.138'
print("FINAL: pH =", mp.nstr(pH, 4), "(3 d.p.; naive 9.55, improved amphiprotic formula 9.140)")
