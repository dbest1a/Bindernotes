"""Q12 - Ag|AgCl|Cl-(0.0250 M) || MnO4-(0.0100 M), Mn2+(0.00200 M), pH 2.30 | Pt at 298.15 K."""
import mpmath as mp

mp.mp.dps = 30
R, F, T = mp.mpf('8.314462'), mp.mpf('96485.33'), mp.mpf('298.15')
k = R * T / F * mp.log(10)   # V per decade
E_Mn0, E_Ag0, Ksp = mp.mpf('1.512'), mp.mpf('0.7996'), mp.mpf('1.80e-10')
Cl, MnO4, Mn2, pH = mp.mpf('0.0250'), mp.mpf('0.0100'), mp.mpf('0.00200'), mp.mpf('2.30')
H = mp.mpf(10) ** (-pH)
E_AgCl0 = E_Ag0 + k * mp.log10(Ksp)
print("(RT/F) ln10 = %.6f V" % float(k))
print("E°(AgCl/Ag) = %.4f V" % float(E_AgCl0))
E_right = E_Mn0 - k / 5 * mp.log10(Mn2 / (MnO4 * H**8))
E_left = E_AgCl0 - k * mp.log10(Cl)
# same left electrode via Ag+/Ag with [Ag+] = Ksp/[Cl-]
E_left2 = E_Ag0 + k * mp.log10(Ksp / Cl)
Ecell = E_right - E_left
print("E(cathode, MnO4-/Mn2+) = %.5f V" % float(E_right))
print("E(anode, AgCl/Ag)      = %.5f V  (check via Ag+/Ag: %.5f V)" % (float(E_left), float(E_left2)))
print("E°cell = %.4f V" % float(E_Mn0 - E_AgCl0))
# Overall: MnO4- + 8H+ + 5Ag + 5Cl- -> Mn2+ + 5AgCl + 4H2O,  n = 5,  Q = [Mn2+]/([MnO4-][H+]^8[Cl-]^5)
Q = Mn2 / (MnO4 * H**8 * Cl**5)
Ecell2 = (E_Mn0 - E_AgCl0) - k / 5 * mp.log10(Q)
print("Ecell = %.5f V  (from overall Q: %.5f V)" % (float(Ecell), float(Ecell2)))
dG = -5 * F * Ecell / 1000
print("dG = %.2f kJ per mol reaction (n = 5)" % float(dG))
logK = 5 * (E_Mn0 - E_AgCl0) / k
print("log10 K = %.2f" % float(logK))
k2 = mp.mpf("0.05916")
Ec_alt = (E_Mn0 - (E_Ag0 + k2 * mp.log10(Ksp))) - k2 / 5 * mp.log10(Q)
print("sensitivity: with 0.05916 V instead of exact RT ln10/F, Ecell = %.5f V" % float(Ec_alt))
assert abs(Ecell - Ecell2) < 1e-20 and f"{float(Ecell):.3f}" == "0.985" and f"{float(dG):.0f}" == "-475"
print("FINAL: Ecell = %.3f V; dG = %.0f kJ/mol (per 5 e-, reaction as written)" % (float(Ecell), float(dG)))
