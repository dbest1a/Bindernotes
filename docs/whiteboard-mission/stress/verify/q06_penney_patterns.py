"""Q06 - Penney-type race: Alice HTHT vs Bob THTT on one sequence of fair-coin tosses."""
from fractions import Fraction as Fr
import itertools, random
import sympy as sp

A, B = "HTHT", "THTT"

def solve_chain(patterns):
    """Exact absorbing-chain solve on prefix states. Returns (expected length, {pattern: P(first)})."""
    states = sorted({p[:k] for p in patterns for k in range(len(p))}, key=len)
    idx = {s: i for i, s in enumerate(states)}
    def step(s, c):
        w = s + c
        for p in patterns:
            if w.endswith(p):
                return p
        while w not in idx:
            w = w[1:]
        return w
    n = len(states)
    M = sp.zeros(n, n); rhsE = sp.zeros(n, 1); rhsP = {p: sp.zeros(n, 1) for p in patterns}
    for s, i in idx.items():
        M[i, i] += 1; rhsE[i] = 1
        for c in "HT":
            nx = step(s, c)
            if nx in patterns:
                rhsP[nx][i] += sp.Rational(1, 2)
            else:
                M[i, idx[nx]] -= sp.Rational(1, 2)
    E = M.LUsolve(rhsE)[0]
    P = {p: M.LUsolve(rhsP[p])[0] for p in patterns}
    return E, P

def conway(a, b):
    return sum(2**k for k in range(1, len(a) + 1) if a[-k:] == b[:k])

EA, _ = solve_chain([A]); EB, _ = solve_chain([B]); EG, P = solve_chain([A, B])
print(f"E[wait for {A}] = {EA}   (Conway AA = {conway(A, A)})")
print(f"E[wait for {B}] = {EB}   (Conway BB = {conway(B, B)})")
print(f"P({A} first) = {P[A]},  P({B} first) = {P[B]}")
oddsA = conway(B, B) - conway(B, A); oddsB = conway(A, A) - conway(A, B)
print(f"Conway odds A:B = {oddsA}:{oddsB} -> P(A) = {Fr(oddsA, oddsA + oddsB)}")
print(f"E[game length] = {EG} = {float(EG):.6f}")
random.seed(12345)
N = 200000; winsA = 0; total = 0
for _ in range(N):
    s = ""
    while True:
        s += random.choice("HT")
        if s.endswith(A): winsA += 1; break
        if s.endswith(B): break
    total += len(s)
print(f"Monte Carlo ({N}): P(A) ~ {winsA/N:.4f}, E[len] ~ {total/N:.3f}")
AA, BB, AB, BA = conway(A, A), conway(B, B), conway(A, B), conway(B, A)
print(f"Conway game length (AA*BB-AB*BA)/(AA+BB-AB-BA) = {Fr(AA*BB-AB*BA, AA+BB-AB-BA)}  [AA={AA}, BB={BB}, AB={AB}, BA={BA}]")
assert (EA, EB, P[A], EG) == (20, 18, sp.Rational(9, 14), sp.Rational(90, 7))
print(f"FINAL: E[HTHT]=20, E[THTT]=18, P(Alice/HTHT first)=9/14, E[game length]={EG}")
