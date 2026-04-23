import { describe, expect, it } from "vitest";
import { buildWorkspacePresetDefinitionsFromRows } from "@/services/workspace-preset-service";

describe("workspace-preset-service", () => {
  it("builds validated suite-specific preset definitions from seeded rows", () => {
    const definitions = buildWorkspacePresetDefinitionsFromRows("suite-rise-of-rome", [
      {
        suite_template_id: "suite-rise-of-rome",
        preset_id: "history-guided",
        breakpoint: "desktop",
        is_default: true,
        layout_json: {
          columns: 12,
          rowHeight: 84,
          gap: 16,
          items: [
            {
              panelId: "history-timeline",
              panelType: "history-timeline",
              x: 0,
              y: 0,
              w: 7,
              h: 8,
              minW: 4,
              minH: 4,
            },
            {
              panelId: "history-evidence",
              panelType: "history-evidence",
              x: 7,
              y: 0,
              w: 5,
              h: 5,
              minW: 3,
              minH: 3,
            },
            {
              panelId: "history-argument",
              panelType: "history-argument",
              x: 0,
              y: 8,
              w: 8,
              h: 6,
              minW: 4,
              minH: 4,
            },
            {
              panelId: "history-myth-checks",
              panelType: "history-myth-checks",
              x: 8,
              y: 8,
              w: 4,
              h: 6,
              minW: 3,
              minH: 3,
            },
          ],
        },
      },
    ]);

    expect(definitions).toHaveLength(1);
    expect(definitions[0].suiteTemplateId).toBe("suite-rise-of-rome");
    expect(definitions[0].breakpoints.desktop?.items).toHaveLength(4);
    expect(definitions[0].requiredPanels).toContain("history-timeline");
  });
});
