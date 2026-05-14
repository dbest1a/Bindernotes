import { describe, expect, it } from "vitest";
import {
  buildAtomModel,
  elementCategories,
  findElement,
  getTrendDisplay,
  periodicTableDataLedger,
  periodicTableElements,
  searchElements,
} from "@/lib/chemistry/periodic-table-data";

describe("periodic table data model", () => {
  it("contains a complete, unique 118 element table", () => {
    expect(periodicTableElements).toHaveLength(118);
    expect(new Set(periodicTableElements.map((element) => element.atomicNumber)).size).toBe(118);
    expect(new Set(periodicTableElements.map((element) => element.symbol)).size).toBe(118);
    expect(periodicTableElements.map((element) => element.atomicNumber).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 118 }, (_, index) => index + 1),
    );
  });

  it("validates layout fields, groups, periods, blocks, and f-block positioning", () => {
    periodicTableElements.forEach((element) => {
      expect(element.name.trim()).not.toBe("");
      expect(element.symbol.trim()).not.toBe("");
      expect(element.group).toBeGreaterThanOrEqual(1);
      expect(element.group).toBeLessThanOrEqual(18);
      expect(element.period).toBeGreaterThanOrEqual(1);
      expect(element.period).toBeLessThanOrEqual(7);
      expect(["s", "p", "d", "f"]).toContain(element.block);
      expect(Object.keys(elementCategories)).toContain(element.category);
      expect(element.tableColumn).toBeGreaterThanOrEqual(1);
      expect(element.tableColumn).toBeLessThanOrEqual(18);
      expect(element.tableRow).toBeGreaterThanOrEqual(2);
      expect(element.tableRow).toBeLessThanOrEqual(10);
    });

    expect(findElement("La")?.tableRow).toBe(9);
    expect(findElement("Lu")?.tableColumn).toBe(18);
    expect(findElement("Ac")?.tableRow).toBe(10);
    expect(findElement("Lr")?.tableColumn).toBe(18);
  });

  it("passes common chemistry sanity checks", () => {
    expect(findElement("Carbon")?.atomicNumber).toBe(6);
    expect(findElement("Na")?.commonIonCharges).toContain(1);
    expect(findElement("Cl")?.commonIonCharges).toContain(-1);
    expect(findElement("F")?.group).toBe(17);
    expect(findElement("Cl")?.category).toBe("halogen");
    expect(findElement("Ne")?.category).toBe("noble-gas");
    expect(findElement("Ar")?.group).toBe(18);
    expect(findElement("Li")?.category).toBe("alkali-metal");
    expect(findElement("H")?.category).not.toBe("alkali-metal");
  });

  it("does not contain placeholders or fake numeric values for unknowns", () => {
    const serialized = JSON.stringify(periodicTableElements).toLowerCase();
    expect(serialized).not.toContain("todo");
    expect(serialized).not.toContain("lorem");
    expect(serialized).not.toContain("sample element");

    periodicTableElements.forEach((element) => {
      [element.atomicRadiusPm, element.electronegativity, element.firstIonizationEnergyEv, element.densityGPerCm3].forEach(
        (value) => {
          if (value !== null) {
            expect(value).toBeGreaterThan(0);
          }
        },
      );
      expect(element.shells.reduce((sum, count) => sum + count, 0)).toBe(element.atomicNumber);
    });

    expect(getTrendDisplay(findElement("He")!, "electronegativity")).toBe("unknown");
  });

  it("searches by chemistry language and builds atoms, isotopes, and ions", () => {
    expect(searchElements("carbon")[0]?.symbol).toBe("C");
    expect(searchElements("C").some((element) => element.symbol === "C")).toBe(true);
    expect(searchElements("6").some((element) => element.symbol === "C")).toBe(true);
    expect(searchElements("halogen").some((element) => element.symbol === "Cl")).toBe(true);
    expect(searchElements("group 17").every((element) => element.group === 17)).toBe(true);
    expect(searchElements("2p").some((element) => element.symbol === "C")).toBe(true);
    expect(searchElements("forms 2+").some((element) => element.symbol === "Ca")).toBe(true);

    expect(buildAtomModel(6, 8, 6).isotopeNotation).toContain("Carbon-14");
    expect(buildAtomModel(11, 12, 10).charge).toBe(1);
    expect(buildAtomModel(17, 18, 18).charge).toBe(-1);
  });

  it("documents data provenance and copyright hygiene", () => {
    expect(periodicTableDataLedger[0].license).toBe("MIT");
    expect(periodicTableDataLedger[0].directTextCopied.toLowerCase()).toContain("no");
    expect(periodicTableDataLedger[0].lastChecked).toBe("2026-05-10");
  });
});
