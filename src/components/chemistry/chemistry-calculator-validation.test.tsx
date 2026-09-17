// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AcidBaseCalculatorModule, KineticsSimulatorModule, SolutionMixerModule, ThermochemistryModule } from "@/components/chemistry/chemistry-workspace-modules";

afterEach(cleanup);

describe("chemistry calculator input feedback", () => {
  it("replaces pH output with validation when concentration is cleared or malformed, and accepts explicit zero", () => {
    render(<AcidBaseCalculatorModule />);
    const input = screen.getByLabelText("Acid or base concentration (M)");
    expect(screen.getByText("2.00")).toBeTruthy();
    for (const value of ["", " ", "NaN", "Infinity", "-1", "0x1"]) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.queryByText("2.00")).toBeNull();
      expect(screen.queryByText("neutral")).toBeNull();
    }
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("7.00")).toHaveLength(2);
    fireEvent.change(input, { target: { value: "1e-8" } });
    expect(screen.getByText("6.98")).toBeTruthy();
  });

  it("does not invent stock concentration or recommend dilution to a stronger concentration", () => {
    render(<SolutionMixerModule />);
    expect(screen.getByText(/Use 25.00 mL stock/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Stock M"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/Use .* mL stock/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Stock M"), { target: { value: "0.01" } });
    expect(screen.getByRole("alert").textContent).toMatch(/cannot exceed/);
  });

  it("distinguishes a blank kinetic rate from a valid zero rate", () => {
    render(<KineticsSimulatorModule />);
    fireEvent.change(screen.getByLabelText("Rate constant"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("Kinetics concentration vs time")).toBeNull();
    fireEvent.change(screen.getByLabelText("Rate constant"), { target: { value: "0" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("1 M")).toHaveLength(5);
  });

  it("does not represent a blank temperature change as zero heat", () => {
    render(<ThermochemistryModule />);
    fireEvent.change(screen.getByLabelText("delta T (C)"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText(/^q = .* J$/)).toBeNull();
    fireEvent.change(screen.getByLabelText("delta T (C)"), { target: { value: "0" } });
    expect(screen.getByText("q = 0.0 J")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Water mass (g)"), { target: { value: "-1" } });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByText("q = 0.0 J")).toBeNull();
  });
});
