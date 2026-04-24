// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";
import {
  applyWorkspaceMode,
  createDefaultWorkspacePreferences,
} from "@/lib/workspace-preferences";

afterEach(() => {
  cleanup();
});

describe("WorkspaceSettings appearance scope", () => {
  it("does not show Simple View Study Surface controls in Study Panels", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "modular",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} />);

    expect(screen.queryByText("Study Surface")).toBeNull();
    expect(screen.getByText("App Theme")).toBeTruthy();
    expect(screen.getByText("Accent")).toBeTruthy();
  });

  it("does not show Simple View Study Surface controls in Canvas", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} />);

    expect(screen.queryByText("Study Surface")).toBeNull();
    expect(screen.getByText("App Theme")).toBeTruthy();
    expect(screen.getByText("Accent")).toBeTruthy();
  });
});
