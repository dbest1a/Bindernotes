// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OgreDungeonRunnerPage } from "@/pages/ogre-dungeon-runner-page";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OgreDungeonRunnerPage", () => {
  it("renders the hidden dungeon runner with bottom art", () => {
    render(
      <MemoryRouter>
        <OgreDungeonRunnerPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "The Hollow Under BinderNotes" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to BinderNotes/i }).getAttribute("href")).toBe("/");
    expect(screen.getByText("Danger 1/6")).toBeTruthy();
    expect(screen.getByText("Loose-stone rookie")).toBeTruthy();
    expect(screen.getByText("None yet")).toBeTruthy();
    expect(screen.getByRole("img", { name: /Goblin scout illustration/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Ogre gate illustration/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: /Mushroom vault illustration/i })).toBeTruthy();
  });

  it("advances the text runner when a player takes an action", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    render(
      <MemoryRouter>
        <OgreDungeonRunnerPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Sneak forward/i }));

    expect(screen.getByText("Depth 1")).toBeTruthy();
    expect(screen.getByText("Torch 5")).toBeTruthy();
    expect(screen.getByText("Score 52")).toBeTruthy();
    expect(screen.getByText("Clues 1/3")).toBeTruthy();
    expect(screen.getByText(/Turn 1:/)).toBeTruthy();
    expect(screen.getAllByText(/trail sign scratched/i).length).toBeGreaterThan(1);
  });

  it("rewards high-value bargains with relics and score", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.8);

    render(
      <MemoryRouter>
        <OgreDungeonRunnerPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Trade riddle/i }));

    expect(screen.getByText("Coins 1")).toBeTruthy();
    expect(screen.getByText("Score 52")).toBeTruthy();
    expect(screen.getByText("Ogre Badge")).toBeTruthy();
    expect(screen.getAllByText(/stamped ogre badge/i).length).toBeGreaterThan(1);
  });
});
