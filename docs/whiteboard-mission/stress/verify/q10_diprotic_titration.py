"""Q10 - 25.00 mL 0.0800 M H2A (pKa1 3.40, pKa2 7.85) titrated with 0.1000 M NaOH; exact charge balance."""
import mpmath as mp

mp.mp.dps = 40
Va, Ca, Cb = mp.mpf('25.00'), mp.mpf('0.0800'), mp.mpf('0.1000')
K1, K2, Kw = mp.mpf(10) ** mp.mpf('-3.40'), mp.mpf(10) ** mp.mpf('-7.85'), mp.mpf('1e-14')

def pH_at(Vb):
    Vb = mp.mpf(Vb)
    CA = Ca * Va / (Va + Vb); Na = Cb * Vb / (Va + Vb)
    def f(pH):
        h = mp.mpf(10) ** (-pH)
        D = h * h + K1 * h + K1 * K2
        return Na + h - CA * (K1 * h + 2 * K1 * K2) / D - Kw / h
    lo, hi = mp.mpf(0), mp.mpf(14)
    for _ in range(200):
        mid = (lo + hi) / 2
        if f(lo) * f(mid) <= 0: hi = mid
        else: lo = mid
    return lo

print("Veq1 = %.2f mL, Veq2 = %.2f mL" % (float(Ca * Va / Cb), float(2 * Ca * Va / Cb)))
results = {}
for V in ('0', '10.00', '20.00', '30.00', '40.00', '45.00'):
    p = pH_at(V); results[V] = p
    print(f"V = {V:>6} mL  pH = {mp.nstr(p, 8)}  -> {float(p):.2f}")
# simple-approximation comparison (what a shortcut gives)
print("shortcut checks: V=10 Henderson pKa1 = 3.40; V=20 (pKa1+pKa2)/2 = 5.625; V=30 pKa2 = 7.85")
# derivative curve sample for plotting
pts = [(v, float(pH_at(v))) for v in [i * 2.5 for i in range(0, 21)]]
print("curve samples (mL, pH):", ", ".join(f"({v:g},{p:.2f})" for v, p in pts))
key = {'0': '2.26', '10.00': '3.41', '20.00': '5.63', '30.00': '7.85', '40.00': '10.17', '45.00': '11.85'}
for V, s in key.items():
    assert f"{float(results[V]):.2f}" == s, (V, float(results[V]))
print("FINAL: pH(0, 10, 20, 30, 40, 45 mL) =", ", ".join(f"{float(results[V]):.2f}" for V in key))
