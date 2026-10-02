// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PricingBetaPage, PricingPage } from "@/pages/pricing-page";
afterEach(cleanup);
describe("Current pricing offer", () => {
  it.each([PricingPage, PricingBetaPage])("keeps every pricing route honest about the available free offer", (Page) => {
    render(<MemoryRouter><Page /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Your study workspace. Free for now." })).toBeTruthy();
    expect(screen.getByText("3 saved whiteboards per account")).toBeTruthy();
    expect(screen.getByText("Up to 3 Desmos graph modules per board")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Create a free account" }).getAttribute("href")).toBe("/auth?mode=signup");
    expect(screen.queryByText(/forever|no card required|\$8|\$20|\$35/)).toBeNull();
    expect(screen.queryByRole("link", { name: /Start Plus|Start Studio|Get Everything/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Are paid plans active?" }));
    expect(screen.getByRole("button", { name: "Are paid plans active?" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/They are not available to purchase/).hidden).toBe(false);
  });
});
