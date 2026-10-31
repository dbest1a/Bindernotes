// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeForScreenReader,
  drawOptionsKey,
  elementSymbol,
  formatChargeUnicode,
  formatFormulaUnicode,
  hillFormula,
  measureMolblock,
  sanitizeSvg,
  splitReactionSmiles,
} from "./molecule-render";
import { createMolecule } from "./molecule-types";

const HOSTILE = `<?xml version='1.0' encoding='iso-8859-1'?>
<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='300px' height='240px' viewBox='0 0 300 240' onload='alert(1)'>
<!-- END OF HEADER -->
<script>alert(2)</script>
<style>@import url(https://evil.example/x.css);</style>
<foreignObject><div xmlns='http://www.w3.org/1999/xhtml'>hi</div></foreignObject>
<a xlink:href='javascript:alert(3)'><circle r='3'/></a>
<use xlink:href='#x'/>
<image href='https://evil.example/p.png'/>
<animate attributeName='href' to='javascript:alert(4)'/>
<path class='bond-0' d='M 1,1 L 2,2' style='fill:none;stroke:#000000;stroke-width:2.0px' onclick='alert(5)'/>
<path d='M 3,3 L 4,4' style='fill:url(javascript:alert(6))' xlink:href='https://evil.example'/>
<ellipse cx='5' cy='5' rx='1' ry='1' onmouseover="alert(7)"/>
</svg>`;

describe("sanitizeSvg", () => {
  afterEach(() => vi.unstubAllGlobals());

  const assertClean = (svg: string | null) => {
    expect(svg).not.toBeNull();
    expect(svg).not.toMatch(/<script|<style|foreignObject|<a[\s>]|<use|<image|<animate|\son[a-z]+=|javascript:|evil\.example|href=|<\?xml/i);
    expect(svg).toContain("bond-0");
    expect(svg).toContain("<ellipse");
  };

  it("strips scripts, handlers, links and external references (DOM path)", () => {
    const svg = sanitizeSvg(HOSTILE, 320, 200);
    assertClean(svg);
    expect(svg).toMatch(/width="320"/);
    expect(svg).toMatch(/height="200"/);
    expect(svg).toMatch(/aria-hidden="true"/);
    expect(svg).toContain("stroke-width:2.0px");
  });

  it("still strips them when no DOM parser exists (fallback path)", () => {
    vi.stubGlobal("DOMParser", undefined);
    assertClean(sanitizeSvg(HOSTILE));
  });

  it("rejects markup that is not an SVG", () => {
    expect(sanitizeSvg("<html><body>nope</body></html>")).toBeNull();
    expect(sanitizeSvg("not xml at all <<<")).toBeNull();
    expect(sanitizeSvg("")).toBeNull();
  });
});

describe("measureMolblock", () => {
  // Ethanol-like zig-zag with 1.5 unit bonds.
  const block = [
    "",
    "  RDKit          2D",
    "",
    "  3  2  0  0  0  0  0  0  0  0999 V2000",
    "    0.0000    0.0000    0.0000 C   0  0",
    "    1.5000    0.0000    0.0000 C   0  0",
    "    3.0000    0.0000    0.0000 O   0  0",
    "  1  2  1  0",
    "  2  3  1  0",
    "M  END",
  ].join("\n");

  it("scales the layout to the requested bond length and pads for labels", () => {
    const size = measureMolblock(block, 40);
    expect(size?.width).toBeCloseTo(80 + 80, 5); // two 40 px bonds plus a bond length of room each side
    expect(size?.height).toBeCloseTo(1 + 68, 5);
  });

  it("returns null for blocks it cannot read", () => {
    expect(measureMolblock("", 40)).toBeNull();
    expect(measureMolblock(block.replace("  3  2", "  0  0"), 40)).toBeNull();
    expect(measureMolblock(block.replace("    1.5000    0.0000", "    abc       0.0000"), 40)).toBeNull();
  });
});

describe("formulas and labels", () => {
  it("covers every element symbol", () => {
    expect(elementSymbol(1)).toBe("H");
    expect(elementSymbol(6)).toBe("C");
    expect(elementSymbol(118)).toBe("Og");
    expect(elementSymbol(0)).toBe("*");
  });

  it("writes Hill formulas", () => {
    expect(hillFormula({ H: 6, C: 2, O: 1 })).toBe("C2H6O");
    expect(hillFormula({ H: 4, N: 1, Cl: 1 })).toBe("ClH4N");
    expect(hillFormula({ Br: 1, C: 6, H: 13 })).toBe("C6H13Br");
    expect(hillFormula({ H: 2, O: 1 })).toBe("H2O");
  });

  it("formats subscripts and charges", () => {
    expect(formatFormulaUnicode("C12H22O11")).toBe("C₁₂H₂₂O₁₁");
    expect(formatChargeUnicode(-1)).toBe("⁻");
    expect(formatChargeUnicode(2)).toBe("²⁺");
    expect(formatChargeUnicode(0)).toBe("");
  });

  it("splits reaction SMILES into reactants, agents and products", () => {
    expect(splitReactionSmiles("A.B>>C")).toEqual({ reactants: ["A", "B"], agents: [], products: ["C"] });
    expect(splitReactionSmiles("CCO.CC(=O)O>[H+]>CC(=O)OCC.O |$;;$|")).toEqual({
      reactants: ["CCO", "CC(=O)O"],
      agents: ["[H+]"],
      products: ["CC(=O)OCC", "O"],
    });
    expect(splitReactionSmiles("A>>")).toBeNull();
    expect(splitReactionSmiles(">>B")).toBeNull();
    expect(splitReactionSmiles("A>B")).toBeNull();
  });

  it("describes the drawing for screen readers", () => {
    expect(describeForScreenReader(createMolecule("CCO", "Ethanol"), null)).toBe("Structure of Ethanol");
    expect(describeForScreenReader(createMolecule("CCO"), null)).toBe("Chemical structure");
  });

  it("keys the cache by structure, options and size", () => {
    const base = createMolecule("CCO");
    const key = (doc: typeof base, width = 320, height = 240) => drawOptionsKey(doc, { width, height });
    expect(key(base)).toBe(key({ ...base, name: "Ethanol", caption: "ignored" }));
    expect(new Set([key(base), key({ ...base, showAtomNumbers: true }), key({ ...base, showHydrogens: true }), key({ ...base, highlightAtoms: [1] }), key(base, 336), key(base, 320, 256), key(createMolecule("CCN"))]).size).toBe(7);
  });
});
