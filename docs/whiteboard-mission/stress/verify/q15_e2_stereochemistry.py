"""Q15 - E2 (anti-periplanar) product geometry from R/S descriptors, by explicit 3D construction.

Convention: for a stereocentre with bond vectors v1, v2, v3 to the CIP priority-1, -2, -3 groups,
the centre is R when det[v1, v2, v3] < 0 (priority-4 group pointing away, 1->2->3 clockwise).
"""
import itertools
import numpy as np

TH = np.deg2rad(109.4712)

def dirs(axis_sign, azimuths):
    th = TH if axis_sign < 0 else np.pi - TH  # substituents on C1 lean to -z, on C2 to +z
    return [np.array([np.sin(th) * np.cos(np.deg2rad(a)), np.sin(th) * np.sin(np.deg2rad(a)), np.cos(th)]) for a in azimuths]

def chirality(vecs, priority):
    d = np.linalg.det(np.array([vecs[p] for p in priority[:3]]))
    return "R" if d < 0 else "S"

def e2_product(c1, c2):
    """c1/c2: dict(name, groups (3 non-backbone groups), priority (4 incl. backbone 'C2'/'C1'), desc,
    anti (group placed at azimuth 0 on C1 / 180 on C2), alkene_rank (groups ranked for E/Z))."""
    out = {}
    for centre, sign, anti_az, nb in ((c1, -1, 0, "C2"), (c2, +1, 180, "C1")):
        others = [g for g in centre["groups"] if g != centre["anti"]]
        for perm in itertools.permutations(others):
            az = [anti_az, anti_az + 120, anti_az + 240]
            names = [centre["anti"], *perm]
            v = dict(zip(names, dirs(sign, az)))
            v[nb] = np.array([0, 0, 1.0]) * (1 if sign < 0 else -1)   # C1 at origin, C2 on +z
            if chirality(v, centre["priority"]) == centre["desc"]:
                out[centre["label"]] = {n: a % 360 for n, a in zip(names, az)}
                break
    a1, a2 = out["C1"], out["C2"]
    cis = []
    for g1, az1 in a1.items():
        if g1 == c1["anti"]:
            continue
        for g2, az2 in a2.items():
            if g2 == c2["anti"]:
                continue
            dihed = (az2 - az1 + 180) % 360 - 180
            if abs(abs(dihed) - 60) < 1e-6:
                cis.append((g1, g2))
    top1 = c1["alkene_rank"][0]; top2 = c2["alkene_rank"][0]
    geo = "Z" if (top1, top2) in cis else "E"
    return out, cis, geo

# Calibration: textbook result (McMurry, Organic Chemistry, Sec. 11.8): (1R,2R)-1-bromo-1,2-diphenylpropane -> (Z)-1,2-diphenylpropene
cal1 = dict(label="C1", groups=["Br", "Ph", "H"], priority=["Br", "Ph", "C2", "H"], desc="R", anti="Br", alkene_rank=["Ph", "H"])
cal2 = dict(label="C2", groups=["H", "Ph", "CH3"], priority=["C1", "Ph", "CH3", "H"], desc="R", anti="H", alkene_rank=["Ph", "CH3"])
az, cis, geo = e2_product(cal1, cal2)
print("calibration (1R,2R)-1-bromo-1,2-diphenylpropane: Newman azimuths", az, "cis pairs", cis, "->", geo)
assert geo == "Z"

# Question substrate: (1S,2R)-1-bromo-2-methyl-1-phenylbutane, PhCH(Br)-CH(CH3)CH2CH3
q1 = dict(label="C1", groups=["Br", "Ph", "H"], priority=["Br", "Ph", "C2", "H"], desc="S", anti="Br", alkene_rank=["Ph", "H"])
q2 = dict(label="C2", groups=["H", "Et", "CH3"], priority=["C1", "Et", "CH3", "H"], desc="R", anti="H", alkene_rank=["Et", "CH3"])
results = {}
for d1, d2 in (("S", "R"), ("R", "S"), ("S", "S"), ("R", "R")):
    q1["desc"], q2["desc"] = d1, d2
    az, cis, geo = e2_product(q1, q2)
    results[(d1, d2)] = geo
    print(f"(1{d1},2{d2})-1-bromo-2-methyl-1-phenylbutane: Newman azimuths {az}, cis pairs {cis} -> ({geo})-2-methyl-1-phenylbut-1-ene")
assert results[("S", "R")] == results[("R", "S")] and results[("S", "S")] == results[("R", "R")] != results[("S", "R")]

# Formula / unsaturation bookkeeping
def dou(C, H, X=0, N=0):
    return (2 * C + 2 + N - H - X) / 2
print("substrate C11H15Br: DoU =", dou(11, 15, X=1), "; product C11H14: DoU =", dou(11, 14))
print("beta-carbons of C1: C2 (one H) and phenyl ipso C (no H) -> exactly one E2 product; no regiochemistry choice")
print("FINAL: (1S,2R) substrate gives (%s)-2-methyl-1-phenylbut-1-ene, i.e. [(%s)-2-methylbut-1-en-1-yl]benzene"
      % (results[("S", "R")], results[("S", "R")]))
