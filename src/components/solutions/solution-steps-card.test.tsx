// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionDocument } from "@/lib/solutions/solution-types";

vi.mock("mathlive", () => Promise.reject(new Error("mathlive is not available in tests")));

vi.mock("@/lib/solutions/verify", () => ({
  checkSolution: vi.fn(async (doc: SolutionDocument) => ({
    ...doc,
    steps: doc.steps.map((step) => ({ ...step, check: { status: "verified", method: "identity", detail: "Both sides agree at 8 random points." } })),
  })),
}));

import { SolutionStepsCard } from "./solution-steps-card";
import { checkSolution } from "@/lib/solutions/verify";

const sample: SolutionDocument = {
  version: 1,
  title: "Solve for x",
  problem: "Solve $3(x-2)+4 = 2x+7$.",
  steps: [
    { id: "a", math: String.raw`3\left(x - 2\right) + 4 = 2x + 7`, note: "Given", check: { status: "unchecked", method: "given", detail: "Starting equation." } },
    { id: "b", math: "3x - 2 = 2x + 7", note: "Distribute and combine", check: { status: "verified", method: "equivalent", detail: "Same solutions." } },
    { id: "c", math: "x = 9", check: { status: "mismatch", method: "substitution", detail: "x = 9 does not satisfy this line." } },
  ],
  answer: "x = 9",
};

function setMatchMedia(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const revealedRows = () => screen.getByRole("list", { name: "Solution steps" }).querySelectorAll("li.solution-step");

describe("SolutionStepsCard", () => {
  beforeEach(() => {
    setMatchMedia(false);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("starts in present mode with every step shown and follows the scrubber", () => {
    render(<SolutionStepsCard onChange={vi.fn()} value={sample} />);
    expect(revealedRows()).toHaveLength(3);
    expect(screen.getByTestId("solution-answer")).toBeTruthy();
    const scrubber = screen.getByRole("slider", { name: "Steps revealed" }) as HTMLInputElement;
    expect(scrubber.max).toBe("3");

    fireEvent.change(scrubber, { target: { value: "1" } });
    expect(revealedRows()).toHaveLength(1);
    expect(screen.queryByTestId("solution-answer")).toBeNull();
    expect(scrubber.getAttribute("aria-valuetext")).toBe("1 of 3 steps shown");

    fireEvent.change(scrubber, { target: { value: "0" } });
    expect(revealedRows()).toHaveLength(0);
  });

  it("responds to keyboard navigation when the card has focus", () => {
    render(<SolutionStepsCard onChange={vi.fn()} value={sample} />);
    const card = screen.getByRole("region", { name: "Solve for x" });
    fireEvent.keyDown(card, { key: "Home" });
    expect(revealedRows()).toHaveLength(0);
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(revealedRows()).toHaveLength(1);
    // The newest line animates in with the writing wipe.
    expect(revealedRows()[0].getAttribute("data-entering")).toBe("true");
    fireEvent.keyDown(card, { key: "ArrowRight" });
    fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(revealedRows()).toHaveLength(1);
    fireEvent.keyDown(card, { key: "End" });
    expect(revealedRows()).toHaveLength(3);
    expect(revealedRows()[2].getAttribute("data-entering")).toBe("false");
  });

  it("skips the wipe animation when the user prefers reduced motion", () => {
    setMatchMedia(true);
    render(<SolutionStepsCard onChange={vi.fn()} value={sample} />);
    const card = screen.getByRole("region", { name: "Solve for x" });
    fireEvent.keyDown(card, { key: "Home" });
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(revealedRows()).toHaveLength(1);
    expect(revealedRows()[0].getAttribute("data-entering")).toBe("false");
  });

  it("auto-advances about every 1.2 seconds while playing", () => {
    vi.useFakeTimers();
    render(<SolutionStepsCard onChange={vi.fn()} value={sample} />);
    const card = screen.getByRole("region", { name: "Solve for x" });
    fireEvent.keyDown(card, { key: "Home" });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(revealedRows()).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(revealedRows()).toHaveLength(1);
    // Each tick re-arms the timer after React commits, so advance one interval at a time.
    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(revealedRows()).toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(1250);
    });
    expect(revealedRows()).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("shows check chips with honest labels and mismatch evidence", () => {
    render(<SolutionStepsCard onChange={vi.fn()} value={sample} />);
    expect(screen.getByRole("button", { name: /^Given/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Checked/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Doesn't match/ })).toBeTruthy();
    expect(screen.getByText("x = 9 does not satisfy this line.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Checked/ }));
    expect(screen.getByText("Same solutions.")).toBeTruthy();
  });

  it("adds a step in edit mode and calls onChange after the debounce", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<SolutionStepsCard onChange={onChange} value={sample} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit steps" }));
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    const editors = screen.getByRole("list", { name: "Edit steps" });
    expect(within(editors).getAllByRole("listitem")).toHaveLength(4);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].steps).toHaveLength(4);

    const field = within(editors).getByLabelText("Step 4 math (LaTeX)") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "x = 9" } });
    fireEvent.change(field, { target: { value: "x = 10" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0].steps[3].math).toBe("x = 10");
  });

  it("reorders and deletes steps", async () => {
    const onChange = vi.fn();
    render(<SolutionStepsCard onChange={onChange} value={sample} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit steps" }));
    fireEvent.click(screen.getByRole("button", { name: "Move step 1 down" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0].steps.map((step: { id: string }) => step.id)).toEqual(["b", "a", "c"]);
    fireEvent.click(screen.getByRole("button", { name: "Delete step 3" }));
    await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0].steps).toHaveLength(2));
  });

  it("generates steps from the free generators, asking before replacing existing steps", async () => {
    const onChange = vi.fn();
    render(<SolutionStepsCard onChange={onChange} value={sample} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit steps" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate steps" }));
    fireEvent.change(screen.getByLabelText("Problem"), { target: { value: "x^2 - 5x + 6 = 0" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByRole("alertdialog", { name: "Replace existing steps?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace steps" }));
    await waitFor(() => expect(checkSolution).toHaveBeenCalled());
    await waitFor(() => expect(onChange.mock.calls.at(-1)?.[0].source).toEqual({ kind: "generator", generator: "quadratic", input: "x^2 - 5x + 6 = 0" }));
    // Back in present mode, starting hidden so the student can step through.
    expect(screen.getByRole("list", { name: "Solution steps" })).toBeTruthy();
    expect(revealedRows()).toHaveLength(0);
  });

  it("reports unsupported generator input instead of inventing steps", () => {
    render(<SolutionStepsCard onChange={vi.fn()} value={undefined} />);
    fireEvent.change(screen.getByLabelText("Problem"), { target: { value: "x^3 - 1 = 0" } });
    fireEvent.change(screen.getByLabelText("Problem type"), { target: { value: "quadratic" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByText(/Degree 3 equations aren't supported yet/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Solution steps" })).toBeNull();
  });

  it("hides editing controls when read-only", () => {
    render(<SolutionStepsCard onChange={vi.fn()} readOnly value={sample} />);
    expect(screen.queryByRole("button", { name: "Edit steps" })).toBeNull();
    expect(screen.getByRole("slider", { name: "Steps revealed" })).toBeTruthy();
  });
});
