"""Q07 - all nonnegative integers m, n with 2^m + 5^n a perfect square."""
from math import isqrt

sols = []
for m in range(0, 400):
    for n in range(0, 200):
        v = 2**m + 5**n
        k = isqrt(v)
        if k * k == v:
            sols.append((m, n, k))
print("brute force m<400, n<200:", sols)
# Residue facts used in the proof
print("squares mod 3:", sorted({k*k % 3 for k in range(3)}), " mod 4:", sorted({k*k % 4 for k in range(4)}),
      " mod 5:", sorted({k*k % 5 for k in range(5)}), " mod 8:", sorted({k*k % 8 for k in range(8)}))
print("2^m mod 5 cycle:", [pow(2, m, 5) for m in range(4)], "(square residues only for m even)")
print("5^n mod 8 for odd n:", sorted({pow(5, n, 8) for n in range(1, 40, 2)}))
print("(m even, n even, n>=1) -> 2^m+5^n mod 3:", sorted({(2**m + 5**n) % 3 for m in range(0, 20, 2) for n in range(2, 20, 2)}))
assert sols == [(2, 1, 3), (3, 0, 3)]
print("FINAL: (m, n) = (2, 1) [4+5=9] and (3, 0) [8+1=9]; no others")
