// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  ElementBuilderModule,
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

describe("chemistry workspace modules", () => {
  afterEach(() => cleanup());

  it("registers the P0 chemistry modules in the workspace registry", () => {
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

    expect(screen.getByText(/interactive periodic table/i)).toBeTruthy();
    expect(screen.getByText(/Build Carbon-14/i)).toBeTruthy();
    expect(screen.getAllByText(/fallback chart/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Balanced result/i)).toBeTruthy();
    expect(screen.getByText(/Effective nuclear charge/i)).toBeTruthy();
    expect(screen.getByText(/unit ladder/i)).toBeTruthy();
    expect(screen.getByText(/acid-base titration/i)).toBeTruthy();
    expect(screen.getByText(/smart lab notebook/i)).toBeTruthy();
    expect(screen.getByText(/safety check/i)).toBeTruthy();
  });
});
