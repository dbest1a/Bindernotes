import { describe, expect, it } from "vitest";
import { historyPresetDefinitions } from "@/lib/history-suite-seeds";
import { buildWorkspacePresetDefinitionsFromRows } from "@/services/workspace-preset-service";

describe("workspace-preset-service", () => {
  it("builds validated suite-specific preset definitions from seeded rows", () => {
    const guidedDesktop = historyPresetDefinitions.find((preset) => preset.id === "history-guided")?.breakpoints
      .desktop;
    expect(guidedDesktop).toBeTruthy();

    const definitions = buildWorkspacePresetDefinitionsFromRows("suite-rise-of-rome", [
      {
        suite_template_id: "suite-rise-of-rome",
        preset_id: "history-guided",
        breakpoint: "desktop",
        is_default: true,
        layout_json: guidedDesktop!,
      },
    ]);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].suiteTemplateId).toBe("suite-rise-of-rome");
    expect(definitions[0].breakpoints.desktop?.items).toHaveLength(6);
    expect(definitions[0].requiredPanels).toContain("lesson");
    expect(definitions[0].requiredPanels).toContain("private-notes");
    expect(definitions[0].requiredPanels).toContain("history-timeline");
  });
});
