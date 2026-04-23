// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceDiagnosticsPanel } from "@/components/ui/workspace-diagnostics-panel";

describe("WorkspaceDiagnosticsPanel", () => {
  it("renders actionable diagnostic details", () => {
    render(
      <WorkspaceDiagnosticsPanel
        diagnostics={[
          {
            code: "missing_table",
            scope: "suite_templates",
            severity: "error",
            title: "Missing table or view: public.suite_templates",
            message: "The configured Supabase project is missing public.suite_templates.",
            hint: "Run the latest Supabase migrations against the same project this app is using.",
          },
        ]}
      />,
    );

    expect(screen.getByText("Workspace diagnostics")).toBeTruthy();
    expect(screen.getByText("suite_templates")).toBeTruthy();
    expect(screen.getByText(/missing public\.suite_templates/i)).toBeTruthy();
    expect(screen.getByText(/run the latest supabase migrations/i)).toBeTruthy();
  });
});
