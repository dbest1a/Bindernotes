"""Q16 - C8H14O2 structure elucidation: formula, DoU, symmetry classes and first-order multiplicities
for the key candidate isomers; only isobutyl (E)-but-2-enoate fits every datum."""
from collections import Counter, defaultdict

OBS_H = [  # (shift, nH, observed pattern, 3J-coupled H count implied by pattern)
    (6.97, 1, "dq J=15.5, 6.9", 4), (5.86, 1, "dq J=15.5, 1.7 (1.7 Hz = 4J allylic)", 1),
    (3.92, 2, "d J=6.7", 1), (1.95, 1, "m, apparent nonet J~6.7", 8),
    (1.88, 3, "dd J=6.9, 1.7 (1.7 Hz = 4J allylic)", 1), (0.94, 6, "d J=6.7", 1)]
OBS_C = 7

def build(spec):
    """spec: list of (atom_id, element, nH, [neighbour ids])."""
    atoms = {a: (el, h) for a, el, h, _ in spec}
    nbr = defaultdict(set)
    for a, _, _, ns in spec:
        for n in ns:
            nbr[a].add(n); nbr[n].add(a)
    return atoms, nbr

def classes(atoms, nbr, rounds=8):
    lab = {a: (el, h) for a, (el, h) in atoms.items()}
    for _ in range(rounds):
        lab = {a: (lab[a], tuple(sorted(lab[n] for n in nbr[a]))) for a in atoms}
    groups = defaultdict(list)
    for a, l in lab.items():
        groups[l].append(a)
    return list(groups.values())

def analyse(name, spec, notes):
    atoms, nbr = build(spec)
    C = sum(1 for el, _ in atoms.values() if el == "C"); H = sum(h for _, h in atoms.values())
    O = sum(1 for el, _ in atoms.values() if el == "O")
    cls = classes(atoms, nbr)
    cC = [g for g in cls if atoms[g[0]][0] == "C"]
    hEnv = []
    for g in cC:
        nH = atoms[g[0]][1] * len(g)
        if nH == 0:
            continue
        a = g[0]
        partners = sum(atoms[n][1] for n in nbr[a] if atoms[n][0] == "C" and n not in g)
        hEnv.append((nH, partners, notes.get(a, "")))
    print(f"--- {name}: C{C}H{H}O{O}, DoU = {(2*C+2-H)//2}, 13C signals = {len(cC)}, 1H environments = {len(hEnv)}")
    for nH, p, note in sorted(hEnv, key=lambda x: (-x[1], x[0])):
        print(f"    {nH}H  3J partners = {p:>2}  -> {p+1}-line envelope   {note}")
    return (C, H, O), len(cC), sorted((n, p) for n, p, _ in hEnv)

target = sorted((n, p) for _, n, _, p in OBS_H)
print("observed (nH, 3J partners):", target, "; observed 13C count:", OBS_C)
# vinyl-H partner counts: H-beta (6.97) couples to H-alpha + CH3 = 4; H-alpha couples (3J) to H-beta only = 1.

cands = {
 "isobutyl (E)-but-2-enoate  CH3-CH=CH-CO-O-CH2-CH(CH3)2": ([
    ("c4", "C", 3, ["c3"]), ("c3", "C", 1, ["c2"]), ("c2", "C", 1, ["c1"]), ("c1", "C", 0, ["o1", "o2"]),
    ("o1", "O", 0, []), ("o2", "O", 0, ["ca"]), ("ca", "C", 2, ["cb"]), ("cb", "C", 1, ["cm1", "cm2"]),
    ("cm1", "C", 3, []), ("cm2", "C", 3, [])],
    {"c3": "H-beta ~6.9-7.0 (deshielded beta-H of enoate)", "c2": "H-alpha ~5.8", "ca": "OCH2 ~3.9", "cb": "CH ~1.9-2.0 (8 neighbours)"}),
 "(E)-but-2-enyl 2-methylpropanoate (crotyl isobutyrate)": ([
    ("c4", "C", 3, ["c3"]), ("c3", "C", 1, ["c2"]), ("c2", "C", 1, ["c1"]), ("c1", "C", 2, ["o2"]),
    ("o2", "O", 0, ["cx"]), ("cx", "C", 0, ["o1", "ch"]), ("o1", "O", 0, []), ("ch", "C", 1, ["m1", "m2"]),
    ("m1", "C", 3, []), ("m2", "C", 3, [])],
    {"c1": "OCH2 ~4.5 (allylic)", "ch": "CH ~2.55 septet", "c3": "vinyl ~5.8", "c2": "vinyl ~5.6"}),
 "sec-butyl (E)-but-2-enoate": ([
    ("c4", "C", 3, ["c3"]), ("c3", "C", 1, ["c2"]), ("c2", "C", 1, ["c1"]), ("c1", "C", 0, ["o1", "o2"]),
    ("o1", "O", 0, []), ("o2", "O", 0, ["s1"]), ("s1", "C", 1, ["s2", "s4"]), ("s2", "C", 2, ["s3"]),
    ("s3", "C", 3, []), ("s4", "C", 3, [])], {"s1": "OCH ~4.9 sextet"}),
 "isobutyl 2-methylprop-2-enoate (isobutyl methacrylate)": ([
    ("cv", "C", 2, ["c2"]), ("c2", "C", 0, ["me", "c1"]), ("me", "C", 3, []), ("c1", "C", 0, ["o1", "o2"]),
    ("o1", "O", 0, []), ("o2", "O", 0, ["ca"]), ("ca", "C", 2, ["cb"]), ("cb", "C", 1, ["cm1", "cm2"]),
    ("cm1", "C", 3, []), ("cm2", "C", 3, [])], {"cv": "=CH2 (two 1H singlets ~6.1/5.5)"}),
 "isobutyl but-3-enoate": ([
    ("c4", "C", 2, ["c3"]), ("c3", "C", 1, ["c2"]), ("c2", "C", 2, ["c1"]), ("c1", "C", 0, ["o1", "o2"]),
    ("o1", "O", 0, []), ("o2", "O", 0, ["ca"]), ("ca", "C", 2, ["cb"]), ("cb", "C", 1, ["cm1", "cm2"]),
    ("cm1", "C", 3, []), ("cm2", "C", 3, [])], {"c2": "CH2 ~3.1 d"}),
}
matches = []
for name, (spec, notes) in cands.items():
    formula, nC, env = analyse(name, spec, notes)
    ok = formula == (8, 14, 2) and nC == OBS_C and env == target
    print("    matches every integration + multiplicity + 13C count:", ok)
    if ok:
        matches.append(name)
print("candidates consistent with the data:", matches)
assert matches == ["isobutyl (E)-but-2-enoate  CH3-CH=CH-CO-O-CH2-CH(CH3)2"]
print("3J(H-alpha,H-beta) = 15.5 Hz -> trans (E); a Z-enoate shows ~11.5 Hz. IR 968 cm-1 (trans CH=CH wag) agrees.")
print("FINAL: 2-methylpropyl (E)-but-2-enoate (isobutyl (E)-crotonate), C8H14O2, DoU 2")
