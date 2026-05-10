// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MathBlocks } from "@/components/math/math-blocks";
import type { MathBlock } from "@/types";

const formulaBlock: MathBlock = {
  id: "formula-rotation",
  label: "90 degree rotation rule",
  latex: "(x,y) \\to (-y,x)",
  sourceHeading: "Coordinate rules",
  type: "latex",
};

describe("MathBlocks", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows clear copy feedback after copying a formula", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<MathBlocks blocks={[formulaBlock]} />);

    fireEvent.click(screen.getByRole("button", { name: /copy formula/i }));

    expect(writeText).toHaveBeenCalledWith("(x,y) \\to (-y,x)");
    expect(await screen.findByRole("button", { name: /copied formula/i })).toBeTruthy();
  });

  it("keeps formula cards actionable with send-to-notes support", () => {
    const onSendFormulaToNotes = vi.fn();

    render(<MathBlocks blocks={[formulaBlock]} onSendFormulaToNotes={onSendFormulaToNotes} />);

    fireEvent.click(screen.getByRole("button", { name: /send formula to notes/i }));

    expect(onSendFormulaToNotes).toHaveBeenCalledWith("(x,y) \\to (-y,x)");
  });
});
