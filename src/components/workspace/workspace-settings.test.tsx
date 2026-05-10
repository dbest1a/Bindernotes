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
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-enhanced-mode");
  document.documentElement.removeAttribute("data-enhanced-visuals");
  document.documentElement.removeAttribute("data-performance-mode");
  cleanup();
});

describe("WorkspaceSettings appearance scope", () => {
  it("shows exactly Canvas, Simple, Facelift, and Study Panels workspace view choices with Facelift-specific settings", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const onChange = vi.fn();
    const { rerender } = render(
      <WorkspaceSettings onChange={onChange} preferences={preferences} mode="layout" />,
    );

    expect(screen.getAllByRole("button", { name: /Workspace view / }).map((button) => button.textContent)).toEqual([
      expect.stringContaining("Canvas"),
      expect.stringContaining("Simple"),
      expect.stringContaining("Facelift"),
      expect.stringContaining("Study Panels"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Workspace view Facelift" }));
    const faceliftPreferences = onChange.mock.calls.at(-1)?.[0];

    expect(faceliftPreferences).toEqual(
      expect.objectContaining({
        workspacePresentationMode: "facelift",
        activeMode: "simple",
      }),
    );

    rerender(
      <WorkspaceSettings
        onChange={onChange}
        preferences={faceliftPreferences}
        mode="layout"
      />,
    );

    expect(screen.getByText("Facelift surface")).toBeTruthy();
    expect(
      screen
        .getAllByRole("button", { name: /Facelift Simple/i })
        .some((button) => button.textContent?.trim() === "Facelift Simple"),
    ).toBe(true);
    expect(
      screen
        .getAllByRole("button", { name: /Facelift Canvas/i })
        .some((button) => button.textContent?.trim() === "Facelift Canvas"),
    ).toBe(true);
    expect(screen.getByText("Facelift density")).toBeTruthy();
    expect(screen.getByText("Navigation behavior")).toBeTruthy();
    expect(screen.getByText("Module header mode")).toBeTruthy();
  });

  it("finds Facelift settings through workspace, hierarchy, mobile, and compact searches", () => {
    const preferences = {
      ...createDefaultWorkspacePreferences("user-1", "binder-1"),
      workspacePresentationMode: "facelift" as const,
    };

    render(
      <WorkspaceSettings
        onChange={vi.fn()}
        preferences={preferences}
        mode="layout"
        revampBetaEnabled
      />,
    );

    for (const query of ["facelift", "workspace", "folder", "document", "mobile", "compact"]) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });
      const faceliftFolder = screen
        .getAllByRole("button", { name: /facelift/i })
        .find((button) => button.getAttribute("aria-controls") === "workspace-settings-folder-facelift");
      expect(faceliftFolder?.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("Facelift surface")).toBeTruthy();
    }
  });

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

  it("renders organized settings folders that can expand and collapse", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    const { container } = render(
      <WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />,
    );

    expect(screen.getByRole("button", { name: /layout & presets/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /colors & study surface/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /edit layout/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /snapping & canvas/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /module display/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /motion & performance/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /tools & modules/i })).toBeTruthy();
    const advancedFolder = container.querySelector('[data-settings-folder="advanced"] button');
    expect(advancedFolder?.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: /colors & study surface/i }));

    expect(screen.getByRole("button", { name: /colors & study surface/i }).getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("App Theme")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /colors & study surface/i }));

    expect(screen.getByText("App Theme")).toBeTruthy();
  });

  it("auto-expands matching folders and hides non-matching folders while searching", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "hover" },
    });

    expect(screen.getByRole("button", { name: /motion & performance/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Hover motion")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /colors & study surface/i })).toBeNull();
  });

  it("finds settings by folder labels and setting descriptions", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "colors" },
    });
    expect(screen.getByRole("button", { name: /colors & study surface/i })).toBeTruthy();
    expect(screen.getByText("Workspace colors")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "edge margin" },
    });
    expect(screen.getByText(/Safe Edge Padding/i)).toBeTruthy();
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

    expect(screen.getByText(/Safe Edge Padding/i)).toBeTruthy();
    expect(screen.queryByText("Presets")).toBeNull();
  });

  it("finds graph and responsive settings through required aliases", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />);

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "graph" },
    });
    expect(screen.getByRole("button", { name: /tools & modules/i }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Graph appearance")).toBeTruthy();

    for (const query of ["phone", "mobile", "tablet"]) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });
      expect(screen.getByText("Responsive layout")).toBeTruthy();
    }
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

    expect(screen.getAllByText("Whiteboard").length).toBeGreaterThan(0);
  });

  it("surfaces Enhanced Visuals from workspace search while Performance Mode stays default", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(
      <WorkspaceSettings
        mode="layout"
        onChange={vi.fn()}
        preferences={preferences}
        revampBetaEnabled
      />,
    );

    for (const query of ["performance", "lag", "smooth", "animation", "tool menu"]) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });

      expect(screen.getByRole("button", { name: /motion & performance/i }).getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(screen.getByText("Enhanced Visuals")).toBeTruthy();
      expect(screen.getByRole("button", { name: /enhanced visuals/i }).getAttribute("aria-pressed")).toBe(
        "false",
      );
      expect(document.documentElement.getAttribute("data-performance-mode")).toBe("true");
    }
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

  it("does not mutate workspace layout or lose unsaved setting changes while searching", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const onChange = vi.fn();
    const { rerender } = render(
      <WorkspaceSettings onChange={onChange} preferences={preferences} mode="layout" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Safe Edge Padding/i }));
    const changedPreferences = onChange.mock.calls.at(-1)?.[0];
    const nextSafeEdgePadding = !preferences.canvas.safeEdgePadding;
    expect(changedPreferences).toEqual(
      expect.objectContaining({
        canvas: expect.objectContaining({ safeEdgePadding: nextSafeEdgePadding }),
      }),
    );

    onChange.mockClear();
    rerender(<WorkspaceSettings onChange={onChange} preferences={changedPreferences} mode="layout" />);
    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "bezel" },
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", {
        name: nextSafeEdgePadding ? /Safe Edge Padding On/i : /Safe Edge Padding Off/i,
      }),
    ).toBeTruthy();
    expect(changedPreferences.canvas.panelPositions).toEqual(preferences.canvas.panelPositions);
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

  it("keeps the canvas module launcher off by default and exposes a layout setting to show it", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const onChange = vi.fn();

    render(<WorkspaceSettings onChange={onChange} preferences={preferences} mode="layout" />);

    expect(preferences.theme.showUtilityUi).toBe(false);

    const toggle = screen.getByRole("button", { name: /canvas launcher hidden/i });
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: expect.objectContaining({ showUtilityUi: true }),
      }),
    );
  });

  it("finds the canvas launcher setting through launcher and side menu search", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    render(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />);

    for (const query of ["launcher", "side menu"]) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });
      expect(screen.getByRole("button", { name: /canvas launcher hidden/i })).toBeTruthy();
    }
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

  it("keeps exact settings searches narrow so maximize and whiteboard do not surface unrelated folders first", () => {
    const preferences = {
      ...applyWorkspaceMode(createDefaultWorkspacePreferences("user-1", "binder-1"), "canvas"),
      workspacePresentationMode: "facelift" as const,
    };

    render(
      <WorkspaceSettings
        onChange={vi.fn()}
        preferences={preferences}
        mode="layout"
        revampBetaEnabled
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "maximize" },
    });

    expect(screen.getByRole("button", { name: /maximize module space/i })).toBeTruthy();
    expect(screen.queryByText("Facelift surface")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "whiteboard" },
    });

    expect(screen.getAllByText("Whiteboard").length).toBeGreaterThan(0);
    expect(screen.queryByText("Enhanced Visuals")).toBeNull();
  });

  it("finds required Revamp settings aliases in regular settings and edit-layout settings", () => {
    const canvasPreferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );
    const aliasExpectations: Array<[string, RegExp]> = [
      ["snap", /Snap mode/i],
      ["safe", /Safe Edge Padding/i],
      ["padding", /Safe Edge Padding/i],
      ["bezel", /Safe Edge Padding/i],
      ["fit", /Fit to viewport height/i],
      ["tidy", /Presets/i],
      ["preset", /Presets/i],
      ["theme", /App Theme/i],
      ["surface", /Color Settings/i],
      ["graph", /Graph appearance/i],
      ["whiteboard", /Whiteboard/i],
      ["board", /Whiteboard/i],
      ["mobile", /Responsive layout/i],
      ["phone", /Responsive layout/i],
      ["compact", /Maximize module space/i],
      ["maximize", /Maximize module space/i],
      ["header", /Maximize module space/i],
      ["source", /Maximize module space/i],
      ["lesson", /Maximize module space/i],
      ["notes", /Maximize module space/i],
      ["save", /Save color scheme/i],
    ];

    const { rerender } = render(
      <WorkspaceSettings
        onChange={vi.fn()}
        preferences={canvasPreferences}
        mode="preferences"
        revampBetaEnabled
      />,
    );

    for (const [query, expected] of aliasExpectations) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
    }

    rerender(
      <WorkspaceSettings
        onChange={vi.fn()}
        preferences={canvasPreferences}
        mode="layout"
        revampBetaEnabled
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
      target: { value: "snap" },
    });
    expect(screen.getByText("Snap mode")).toBeTruthy();
  });

  it("closes preference settings after applying a workspace mode or preset", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const onClose = vi.fn();
    const onChange = vi.fn();

    const { rerender } = render(
      <WorkspaceSettings
        mode="preferences"
        onChange={onChange}
        onClose={onClose}
        preferences={preferences}
        revampBetaEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Workspace view Canvas" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    rerender(
      <WorkspaceSettings
        mode="preferences"
        onChange={onChange}
        onClose={onClose}
        preferences={preferences}
        revampBetaEnabled
      />,
    );

    fireEvent.click(screen.getByText("Split Study"));
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    const historyPreferences = applyWorkspaceMode(preferences, "modular");
    rerender(
      <WorkspaceSettings
        historyEnabled
        mode="preferences"
        onChange={onChange}
        onClose={onClose}
        preferences={historyPreferences}
        revampBetaEnabled
      />,
    );

    fireEvent.click(screen.getByText("History Guided"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("preserves the previous settings apply behavior when Revamp Beta is off", () => {
    const preferences = createDefaultWorkspacePreferences("user-1", "binder-1");
    const onClose = vi.fn();

    render(
      <WorkspaceSettings
        mode="preferences"
        onChange={vi.fn()}
        onClose={onClose}
        preferences={preferences}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Workspace view Canvas" }));

    expect(onClose).not.toHaveBeenCalled();
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

  it("finds and persists the secondary preset strip setting from search", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "modular",
    );
    const onChange = vi.fn();

    render(<WorkspaceSettings onChange={onChange} preferences={preferences} />);

    expect(screen.getByRole("button", { name: /show secondary preset strip/i }).textContent).toContain("Hidden");

    for (const query of ["selector", "preset", "strip", "secondary"]) {
      fireEvent.change(screen.getByPlaceholderText(/search settings/i), {
        target: { value: query },
      });
      expect(screen.getByRole("button", { name: /show secondary preset strip/i })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: /show secondary preset strip/i }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        modular: expect.objectContaining({ showSecondaryPresetStrip: true }),
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

    expect(screen.getByText("Workspace view")).toBeTruthy();
    expect(screen.getByText("Layout")).toBeTruthy();
    expect(screen.getByText("Math Graph Lab")).toBeTruthy();
    expect(screen.queryByText("Recommended")).toBeNull();
    expect(screen.queryByRole("button", { name: /show all presets/i })).toBeNull();
    expect(container.querySelectorAll("[data-workspace-preset-option='true']")).toHaveLength(0);
  });

  it("keeps settings folders usable on phone and tablet widths", () => {
    const preferences = applyWorkspaceMode(
      createDefaultWorkspacePreferences("user-1", "binder-1"),
      "canvas",
    );

    setViewportWidth(390);
    const { rerender } = render(
      <WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="preferences" />,
    );

    expect(screen.getByRole("button", { name: /layout & presets/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/search settings/i)).toBeTruthy();

    setViewportWidth(820);
    rerender(<WorkspaceSettings onChange={vi.fn()} preferences={preferences} mode="layout" />);

    expect(screen.getByRole("button", { name: /edit layout/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /snapping & canvas/i })).toBeTruthy();
  });
});

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
}
