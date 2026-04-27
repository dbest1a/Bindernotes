// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";
import {
  applyWorkspaceMode,
  applyWorkspaceStyle,
  createDefaultWorkspacePreferences,
} from "@/lib/workspace-preferences";

afterEach(() => {
  window.sessionStorage.clear();
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
    const preferences = applyWorkspaceStyle(
      applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      "full-studio",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} />);

    expect(screen.queryByText("Study Surface")).toBeNull();
    expect(screen.getByText("App Theme")).toBeTruthy();
    expect(screen.getByText("Accent")).toBeTruthy();
  });

  it("filters settings by label and description while keeping matching controls visible", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "snap" },
    });

    expect(screen.getByText("Snap mode")).toBeTruthy();
    expect(screen.queryByText("App Theme")).toBeNull();
  });

  it("filters regular preference settings without losing appearance controls", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="preferences" />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "theme" },
    });

    expect(screen.getByText("App Theme")).toBeTruthy();
    expect(screen.queryByText("Snap mode")).toBeNull();
  });

  it("filters settings by aliases such as bezel for Safe Edge Padding", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "bezel" },
    });

    expect(screen.getByText("Safe edge padding")).toBeTruthy();
    expect(screen.queryByText("Presets")).toBeNull();
  });

  it("finds whiteboard controls through board and sketch aliases", () => {
    const preferences = applyWorkspaceStyle(
      applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      "full-studio",
    );

    render(
      <WorkspaceSettings
        binderSubject="Math"
        mode="layout"
        onChange={vi.fn()}
        preferences={preferences}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "sketch" },
    });

    expect(screen.getByText("Whiteboard")).toBeTruthy();
  });

  it("shows an empty state when settings search has no matches", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "does-not-exist" },
    });

    expect(screen.getByText("No settings found.")).toBeTruthy();
  });

  it("defaults maximize module space on and lets users restore the richer module headers", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const onChange = vi.fn();

    render(<WorkspaceSettings onChange={onChange} preferences={preferences} />);

    const toggle = screen.getByRole("button", { name: /maximize module space/i });
    fireEvent.click(toggle);

    expect(toggle).toBeTruthy();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: expect.objectContaining({ compactMode: false }),
      }),
    );
  });

  it("finds the maximize module space toggle through source, lesson, notes, header, space, compact, and maximize searches", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const { unmount } = render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} />);

    for (const query of ["source", "lesson", "notes", "header", "space", "compact", "maximize"]) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });
      expect(screen.getByRole("button", { name: /maximize module space/i })).toBeTruthy();
    }

    unmount();
  });

  it("keeps panel density separate from the maximize module space toggle", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "modular",
    );
    const onChange = vi.fn();

    render(<WorkspaceSettings onChange={onChange} preferences={preferences} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^Compact$/ })[0]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        modular: expect.objectContaining({ panelDensity: "compact" }),
        theme: expect.objectContaining({ compactMode: true }),
      }),
    );
  });

  it("auto-fits when a workspace mode choice reapplies a preset from settings", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const onChange = vi.fn();

    render(<WorkspaceSettings onChange={onChange} preferences={preferences} />);

    const canvasModeButton = screen.getByText("Canvas").closest("button");
    expect(canvasModeButton).toBeTruthy();
    fireEvent.click(canvasModeButton!);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        activeMode: "canvas",
        viewportFit: expect.objectContaining({
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      }),
    );
  });

  it("keeps the full layout setup controls visible without recommended preset disclosure", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    const { container } = render(
      <WorkspaceSettings
        binderSubject="math"
        onChange={vi.fn()}
        preferences={preferences}
        mode="layout"
      />,
    );

    expect(screen.getByText("Study mode")).toBeTruthy();
    expect(screen.getByText("Layout")).toBeTruthy();
    expect(screen.getByText("Math Graph Lab")).toBeTruthy();
    expect(screen.queryByText("Recommended")).toBeNull();
    expect(screen.queryByRole("button", { name: /show all presets/i })).toBeNull();
    expect(container.querySelectorAll("[data-workspace-preset-option='true']")).toHaveLength(0);
  });
});
