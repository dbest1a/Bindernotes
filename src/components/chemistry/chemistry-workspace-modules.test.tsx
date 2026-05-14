// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ElementBuilderModule,
  ChemistryLabCoachModule,
  ChemistryLabNotebookModule,
  ChemistryConceptCardsModule,
  InteractivePeriodicTableModule,
  PeriodicTrendsGraphModule,
  ReactionBalancerModule,
  ChemistryReferenceSafetyModule,
  ChemistryStoichiometryCoachModule,
  ChemistryTitrationLabModule,
} from "@/components/chemistry/chemistry-workspace-modules";
import { workspaceModuleRegistry } from "@/components/workspace/workspace-modules";
import { getWorkspaceMobileModuleTabs, getWorkspacePresetDesign } from "@/lib/workspace-preset-designs";

vi.mock("@/lib/desmos-loader", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/desmos-loader")>();
  return {
    ...original,
    hasDesmosApiKey: vi.fn(() => false),
  };
});

describe("chemistry workspace modules", () => {
  afterEach(() => cleanup());

  it("registers the P0 chemistry modules in the workspace registry", () => {
    expect(workspaceModuleRegistry["chem-lab-coach"].title).toBe("Chemistry Lab Coach");
    expect(workspaceModuleRegistry["chem-stoichiometry-coach"].title).toBe("Chemistry Stoichiometry Coach");
    expect(workspaceModuleRegistry["chem-periodic-table"].title).toBe("Interactive periodic table");
    expect(workspaceModuleRegistry["chem-element-builder"].title).toBe("Element builder");
    expect(workspaceModuleRegistry["chem-reaction-balancer"].title).toBe("Reaction balancer");
    expect(workspaceModuleRegistry["chem-titration-lab"].title).toBe("Acid-base titration lab");
    expect(workspaceModuleRegistry["chem-lab-notebook"].title).toBe("Chemistry lab notebook");
    expect(workspaceModuleRegistry["chem-reference-safety"].title).toBe("Chemistry reference");
  });

  it("defines a chemistry preset and mobile tabs that avoid tiny desktop canvas panels", () => {
    expect(getWorkspacePresetDesign("chemistry-lab").defaultVisible).toEqual([
      "lesson",
      "chem-titration-lab",
      "chem-lab-notebook",
    ]);
    expect(
      getWorkspaceMobileModuleTabs("chemistry-lab", [
        "lesson",
        "chem-titration-lab",
        "chem-lab-notebook",
        "chem-reference-safety",
      ]).map((tab) => tab.label),
    ).toEqual(["Lesson", "Lab", "Notes", "Tools"]);
  });

  it("renders the chemistry modules as student-facing tools", () => {
    render(
      <div>
        <ChemistryLabCoachModule />
        <InteractivePeriodicTableModule />
        <ElementBuilderModule />
        <PeriodicTrendsGraphModule />
        <ReactionBalancerModule />
        <ChemistryConceptCardsModule />
        <ChemistryStoichiometryCoachModule />
        <ChemistryTitrationLabModule />
        <ChemistryLabNotebookModule />
        <ChemistryReferenceSafetyModule />
      </div>,
    );

    expect(screen.getByText(/chemistry lab coach/i)).toBeTruthy();
    expect(screen.getByText(/interactive periodic table/i)).toBeTruthy();
    expect(screen.getAllByText(/Build Carbon-14/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/fallback chart/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Balanced result/i)).toBeTruthy();
    expect(screen.getAllByText(/Effective nuclear charge/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/unit ladder/i)).toBeTruthy();
    expect(screen.getAllByText(/acid-base titration/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/smart lab notebook/i)).toBeTruthy();
    expect(screen.getByText(/safety check/i)).toBeTruthy();
  });

  it("guides a chemistry lab flow with manual progress and related tool actions", () => {
    const onOpenTool = vi.fn();

    render(<ChemistryLabCoachModule onOpenTool={onOpenTool} />);

    expect(screen.getByText(/step 1 of 8/i)).toBeTruthy();
    expect(screen.getByText(/current lab goal/i)).toBeTruthy();
    expect(screen.getByText(/next: check safety/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /next step/i }));

    expect(screen.getByText(/step 2 of 8/i)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Step complete");

    fireEvent.click(screen.getByRole("button", { name: /open titration lab/i }));
    expect(onOpenTool).toHaveBeenCalledWith("chem-titration-lab");

    fireEvent.click(screen.getByRole("button", { name: /open notes/i }));
    expect(onOpenTool).toHaveBeenCalledWith("private-notes");
  });

  it("upgrades titration into a checkpoint lab with reset, observations, endpoint hint, and compact graph fallback", () => {
    render(<ChemistryTitrationLabModule />);

    expect(screen.getByText(/simplified strong acid\/strong base model/i)).toBeTruthy();
    expect(screen.getByText(/no measurements yet/i)).toBeTruthy();
    expect(screen.getByText(/fallback chart active/i)).toBeTruthy();
    expect(screen.getByText(/hypothesis/i)).toBeTruthy();
    expect(screen.getByText(/error analysis/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /add 5.00 ml/i }));
    expect(screen.getByText("5.00 mL")).toBeTruthy();
    expect(screen.getByText(/acidic; keep adding titrant/i)).toBeTruthy();

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: /add 5.00 ml/i }));
    }

    expect(screen.getAllByText(/endpoint zone/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/equivalence point is near 25.00 ml/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(screen.getByText(/no measurements yet/i)).toBeTruthy();
    expect(screen.queryByText("25.00 mL")).toBeNull();
  });

  it("makes Element Explorer useful with complete data, search, trends, inspector, builder, and compare", () => {
    render(<InteractivePeriodicTableModule />);

    expect(screen.getByTestId("chem-element-explorer-v3").getAttribute("data-chem-layout")).toBe("flagship-periodic-table");
    expect(screen.getAllByRole("gridcell").length).toBe(118);
    expect(screen.getAllByText(/118 elements/i).length).toBeGreaterThan(0);

    const searchInput = screen.getAllByLabelText(/element search/i)[0];
    fireEvent.change(searchInput, { target: { value: "oxygen" } });
    expect(screen.getByRole("heading", { name: /^O$/i })).toBeTruthy();
    expect(screen.getByText(/valence electrons/i)).toBeTruthy();
    const detail = screen.getByLabelText(/selected element inspector/i);
    expect(within(detail).getByText(/^6$/)).toBeTruthy();
    expect(screen.getByText(/often forms two bonds/i)).toBeTruthy();
    expect(screen.getAllByText(/common trap/i).length).toBeGreaterThan(0);

    fireEvent.change(searchInput, { target: { value: "Na" } });
    expect(screen.getByRole("heading", { name: /^Na$/i })).toBeTruthy();

    expect(within(detail).getByText(/atomic weight/i)).toBeTruthy();
    expect(within(detail).getByText(/common ions/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/trend mode/i), { target: { value: "atomic-radius" } });
    expect(screen.getByText(/radius generally decreases across a period/i)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /builder/i })[0]);
    expect(screen.getByTestId("chem-atom-builder-v3")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: /build cl-/i })[0]);
    expect(screen.getByText(/Chlorine-35/i)).toBeTruthy();
    expect(screen.getByText(/anion/i)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /compare/i })[0]);
    expect(screen.getByText(/Explain why elements differ/i)).toBeTruthy();
  });
});
