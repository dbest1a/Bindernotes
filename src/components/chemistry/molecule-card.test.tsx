// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RDKitModule } from "@/lib/chemistry/rdkit-loader";
import { createMolecule, type MoleculeDocument } from "@/lib/chemistry/molecule-types";

const { loadRDKit } = vi.hoisted(() => ({ loadRDKit: vi.fn() }));

vi.mock("@/lib/chemistry/rdkit-loader", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/chemistry/rdkit-loader")>();
  return { ...original, loadRDKit };
});

import { MoleculeCard, clearMoleculeSvgCache, parseAtomNumberList } from "./molecule-card";

// A stand-in for the WASM module: it answers for the handful of SMILES these tests use.
const FIXTURES: Record<string, { atoms: { z?: number; impHs?: number; chg?: number }[]; amw: number; stereo?: unknown }> = {
  CCO: { atoms: [{ impHs: 3 }, { impHs: 2 }, { z: 8, impHs: 1 }], amw: 46.069 },
  "C[C@H](O)C(=O)O": {
    atoms: [{ impHs: 3 }, { impHs: 1 }, { z: 8, impHs: 1 }, {}, { z: 8 }, { z: 8, impHs: 1 }],
    amw: 90.078,
    stereo: { CIP_atoms: [[1, "(S)"]], CIP_bonds: [] },
  },
  "C=CC=C": { atoms: [{ impHs: 2 }, { impHs: 1 }, { impHs: 1 }, { impHs: 2 }], amw: 54.092 },
  C: { atoms: [{ impHs: 4 }], amw: 16.043 },
};

const drawCalls = vi.fn();

// A straight chain with 1.5 unit bonds: enough for the card to measure and scale the layout.
function molblockFor(atomCount: number) {
  const atoms = Array.from({ length: atomCount }, (_, index) => `${(index * 1.5).toFixed(4).padStart(10)}${(0).toFixed(4).padStart(10)}${(0).toFixed(4).padStart(10)} C   0  0`);
  const bonds = Array.from({ length: Math.max(0, atomCount - 1) }, (_, index) => `${String(index + 1).padStart(3)}${String(index + 2).padStart(3)}  1  0`);
  const counts = `${String(atomCount).padStart(3)}${String(bonds.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`;
  return ["", "  fake", "", counts, ...atoms, ...bonds, "M  END"].join("\n");
}

function makeFakeRdkit(): RDKitModule {
  const svgFor = (smiles: string, details: string) => {
    drawCalls(smiles, details);
    return `<?xml version='1.0'?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 240" width="300px" height="240px"><path d="M0 0L10 10" onclick="alert(1)"/><script>alert(2)</script><a href="javascript:alert(3)"><rect width="1" height="1"/></a></svg>`;
  };
  return {
    prefer_coordgen: vi.fn(),
    get_mol: (smiles: string) => {
      const base = smiles.split(/\s/)[0];
      const fixture = FIXTURES[base];
      if (!fixture) return null;
      return {
        delete: vi.fn(),
        add_hs_in_place: vi.fn(() => true),
        set_new_coords: vi.fn(() => true),
        get_molblock: () => molblockFor(fixture.atoms.length),
        get_num_atoms: () => fixture.atoms.length,
        get_json: () => JSON.stringify({ defaults: { atom: { z: 6, impHs: 0, chg: 0 } }, molecules: [{ atoms: fixture.atoms }] }),
        get_descriptors: () => JSON.stringify({ amw: fixture.amw, exactmw: fixture.amw }),
        get_stereo_tags: () => JSON.stringify(fixture.stereo ?? { CIP_atoms: [], CIP_bonds: [] }),
        get_svg_with_highlights: (details: string) => svgFor(smiles, details),
      };
    },
  } as unknown as RDKitModule;
}

function setup(value: MoleculeDocument | undefined, props: { readOnly?: boolean } = {}) {
  const onChange = vi.fn();
  const view = render(<MoleculeCard value={value} onChange={onChange} {...props} />);
  return { onChange, ...view };
}

describe("MoleculeCard", () => {
  beforeEach(() => {
    drawCalls.mockClear();
    clearMoleculeSvgCache();
    loadRDKit.mockReset();
    loadRDKit.mockResolvedValue(makeFakeRdkit());
  });
  afterEach(() => cleanup());

  it("draws the structure, formula, weight and an accessible label", async () => {
    setup(createMolecule("CCO", "Ethanol"));
    const drawing = await screen.findByRole("img", { name: "Structure of Ethanol, C₂H₆O" });
    expect(drawing.querySelector("svg")).not.toBeNull();
    expect(screen.getByLabelText("Formula C₂H₆O")).toBeTruthy();
    expect(screen.getByLabelText("Molecular weight 46.07 g/mol")).toBeTruthy();
    // Cards start compact (no layout in jsdom), where the name lives in the input instead of a heading.
    expect((screen.getByRole("combobox", { name: "Molecule name or SMILES" }) as HTMLInputElement).value).toBe("Ethanol");
  });

  it("asks RDKit for stereo annotation, a transparent background and a size that fits the tile", async () => {
    setup(createMolecule("CCO", "Ethanol"));
    await screen.findByRole("img");
    const details = JSON.parse(drawCalls.mock.calls[0][1] as string);
    expect(details).toMatchObject({ addStereoAnnotation: true, clearBackground: false, backgroundColour: [1, 1, 1, 0] });
    expect(details.width).toBeLessThanOrEqual(320);
    expect(details.height).toBeLessThanOrEqual(240);
    expect(details.bondLineWidth).toBeGreaterThanOrEqual(1.8);
  });

  it("strips scripts, event handlers and links from the injected SVG", async () => {
    setup(createMolecule("CCO"));
    const drawing = await screen.findByRole("img");
    expect(drawing.innerHTML).not.toMatch(/script|onclick|javascript:|<a[\s>]|href/i);
    expect(drawing.querySelector("path")).not.toBeNull();
    // A link and everything inside it is dropped rather than left half-sanitised.
    expect(drawing.querySelector("rect")).toBeNull();
  });

  it("shows stereo labels", async () => {
    setup(createMolecule("C[C@H](O)C(=O)O", "(S)-Lactic acid"));
    expect(await screen.findByLabelText("Molecule stereochemistry: Atom 2 is S")).toBeTruthy();
  });

  it("shows a loading skeleton until the engine arrives", async () => {
    let resolve: (rdkit: RDKitModule) => void = () => undefined;
    loadRDKit.mockReturnValue(new Promise<RDKitModule>((r) => (resolve = r)));
    setup(createMolecule("CCO"));
    expect(screen.getByRole("status", { name: "Loading the chemistry engine" })).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    await act(async () => resolve(makeFakeRdkit()));
    expect(await screen.findByRole("img")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("explains a SMILES it cannot read in plain language", async () => {
    setup(createMolecule("C1CC"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't read that SMILES — check ring numbers and brackets");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("offers a retry when the engine fails to load", async () => {
    loadRDKit.mockRejectedValueOnce(new Error("The chemistry engine could not be loaded."));
    setup(createMolecule("CCO"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("img")).toBeTruthy();
    expect(loadRDKit).toHaveBeenCalledTimes(2);
  });

  it("draws a reaction and reports whether its atoms balance", async () => {
    setup(createMolecule("C=CC=C.C>>C=CC=C.C", "Test reaction"));
    expect(await screen.findByRole("img", { name: /Test reaction: C₄H₆ \+ CH₄ gives C₄H₆ \+ CH₄/ })).toBeTruthy();
    expect(screen.getByText("Atoms balanced")).toBeTruthy();
    // Each species is drawn separately at one shared bond length: butadiene, methane, butadiene, methane.
    expect(drawCalls.mock.calls.map((call) => call[0])).toEqual(["C=CC=C", "C", "C=CC=C", "C"]);
    const bondLengths = new Set(drawCalls.mock.calls.map((call) => JSON.parse(call[1] as string).fixedBondLength));
    expect(bondLengths.size).toBe(1);
  });

  it("reuses a cached drawing for the same structure, options and size", async () => {
    const doc = createMolecule("C", "Methane");
    const first = setup(doc);
    await screen.findByRole("img");
    const callsAfterFirst = drawCalls.mock.calls.length;
    first.unmount();
    setup(doc);
    await screen.findByRole("img");
    expect(drawCalls.mock.calls.length).toBe(callsAfterFirst);
  });

  it("calls onChange when the display toggles are used", async () => {
    const { onChange } = setup(createMolecule("CCO", "Ethanol"));
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: "Atom numbers" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ smiles: "CCO", showAtomNumbers: true }));
    fireEvent.click(screen.getByRole("button", { name: "Show H" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ smiles: "CCO", showHydrogens: true }));
  });

  it("passes atom numbers, hydrogens and 1-based highlights through to the drawing", async () => {
    setup({ ...createMolecule("CCO"), showAtomNumbers: true, showHydrogens: true, highlightAtoms: [1, 3, 9] });
    await screen.findByRole("img");
    const [smiles, rawDetails] = drawCalls.mock.calls[0] as [string, string];
    expect(smiles).toBe("CCO |atomProp:0.atomNote.1:1.atomNote.2:2.atomNote.3|");
    expect(JSON.parse(rawDetails).atoms).toEqual([0, 2]);
  });

  it("switches between molecule and reaction", async () => {
    const { onChange } = setup(createMolecule("CCO", "Ethanol"));
    await screen.findByRole("img");
    expect(screen.getByRole("button", { name: "Molecule" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Reaction" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "reaction", smiles: expect.stringContaining(">>") }));
  });

  it("commits typed names and SMILES, and picks from autocomplete", async () => {
    const { onChange } = setup(createMolecule("CCO", "Ethanol"));
    await screen.findByRole("img");
    const input = screen.getByRole("combobox", { name: "Molecule name or SMILES" });

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "aspi" } });
    const option = await screen.findByRole("option", { name: /Aspirin/ });
    fireEvent.click(option);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Aspirin", smiles: "CC(=O)Oc1ccccc1C(=O)O" }));

    fireEvent.change(input, { target: { value: "C=CC=C" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith({ version: 1, kind: "molecule", smiles: "C=CC=C" });
  });

  it("supports keyboard selection in the autocomplete list", async () => {
    const { onChange } = setup(undefined);
    const input = screen.getByRole("combobox", { name: "Molecule name or SMILES" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "benz" } });
    await screen.findByRole("option", { name: /Benzene/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: "Benzene", smiles: "c1ccccc1" }));
  });

  it("auto-commits a valid SMILES after typing pauses, but not an unreadable one", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { onChange } = setup(createMolecule("CCO", "Ethanol"));
      await act(async () => undefined);
      const input = screen.getByRole("combobox", { name: "Molecule name or SMILES" });
      fireEvent.change(input, { target: { value: "C1CC" } });
      await act(async () => vi.advanceTimersByTime(1000));
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.change(input, { target: { value: "C=CC=C" } });
      await act(async () => vi.advanceTimersByTime(1000));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ smiles: "C=CC=C" }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("starts empty with examples a student can click", async () => {
    const { onChange } = setup(undefined);
    fireEvent.click(await screen.findByRole("button", { name: "Ethanol" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ smiles: "CCO", name: "Ethanol" }));
  });

  it("is display-only when readOnly", async () => {
    const { onChange } = setup({ ...createMolecule("CCO", "Ethanol"), caption: "Common solvent" }, { readOnly: true });
    await screen.findByRole("img");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Atom numbers" })).toBeNull();
    expect(screen.getByText("Common solvent")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("edits the caption and highlighted atoms from the options panel", async () => {
    const { onChange } = setup(createMolecule("CCO", "Ethanol"));
    await screen.findByRole("img");
    fireEvent.click(screen.getByRole("button", { name: /More/ }));
    const caption = screen.getByLabelText("Caption");
    fireEvent.change(caption, { target: { value: "Hydroxyl on C2" } });
    fireEvent.blur(caption);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ caption: "Hydroxyl on C2" }));
    const highlights = screen.getByLabelText(/Highlight atoms/);
    fireEvent.change(highlights, { target: { value: "1, 3-4" } });
    fireEvent.blur(highlights);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ highlightAtoms: [1, 3, 4] }));
  });
});

describe("parseAtomNumberList", () => {
  it("parses numbers and ranges, ignoring junk", () => {
    expect(parseAtomNumberList("1, 3-5; 5 x 0 99999 7-6")).toEqual([1, 3, 4, 5, 6, 7]);
    expect(parseAtomNumberList("")).toEqual([]);
  });
});
