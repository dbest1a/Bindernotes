// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { betaFeaturesStorageKeyForUser } from "@/lib/beta-features";
import { HomepageBetaPage, LandingPage } from "@/pages/landing-page";

const landingProfileId = "landing-user";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: { id: landingProfileId },
  }),
}));

function setCalmStudyHomepageBeta(enabled: boolean) {
  window.localStorage.setItem(
    betaFeaturesStorageKeyForUser(landingProfileId),
    JSON.stringify({
      enabled,
      betaRevampCalmStudyHomepage: enabled,
    }),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("LandingPage", () => {
  it("renders the existing conversion-focused public homepage when the calm study homepage beta is off", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Study notes that feel like a living, premium workspace." })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Study notes that remember the source." })).toBeNull();
    expect(screen.getAllByRole("link", { name: /Start/i })[0].getAttribute("href")).toBe("/auth");
    expect(screen.getAllByText("Split Study").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Math Whiteboard Lab").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Desmos Graph").length).toBeGreaterThan(0);
    expect(screen.getByText("APIs + open source")).toBeTruthy();
    expect(screen.getAllByText(/Built-in Desmos graphing/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /loose stone under the footer/i }).getAttribute("href")).toBe(
      "/hidden-hollow",
    );
  });

  it("switches the product showcase without leaving the page", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Whiteboard Lab" }));

    expect(screen.getByRole("tab", { name: "Whiteboard Lab" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("A math whiteboard that still knows your binder.")).toBeTruthy();
  });

  it("keeps the standard homepage on / even when the calm study homepage beta is on", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Study notes that feel like a living, premium workspace." })).toBeTruthy();
    expect(screen.queryByTestId("beta-calm-homepage")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Study notes that remember the source." })).toBeNull();
  });

  it("renders the Beta Revamp calm study homepage only on the beta preview route", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter initialEntries={["/homepage-beta"]}>
        <HomepageBetaPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("beta-calm-homepage").getAttribute("data-beta-performance-mode")).toBe("lean");
    expect(screen.getByRole("heading", { name: "Study notes that remember the source." })).toBeTruthy();
    expect(screen.getByText(/A calmer workspace for calculus notes, graphs, and review/i)).toBeTruthy();
    expect(screen.getByTestId("beta-calm-floating-modules")).toBeTruthy();
    expect(screen.queryByText(/cinematic study system/i)).toBeNull();
  });

  it("keeps the beta floating modules dynamic without React-state pointer churn", () => {
    setCalmStudyHomepageBeta(true);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={["/homepage-beta"]}>
        <HomepageBetaPage />
      </MemoryRouter>,
    );

    const hero = screen.getByTestId("beta-calm-hero");
    vi.spyOn(hero, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 1000,
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(hero, { clientX: 750, clientY: 180 });

    expect(rafSpy).toHaveBeenCalledTimes(1);
    expect(hero.style.getPropertyValue("--beta-pointer-x")).toBe("16.00px");
    expect(hero.style.getPropertyValue("--beta-pointer-y")).toBe("-11.20px");
    expect(hero.style.getPropertyValue("--beta-tilt-x")).toBe("1.60deg");
    expect(hero.style.getPropertyValue("--beta-tilt-y")).toBe("3.00deg");

    fireEvent.pointerLeave(hero);

    expect(hero.style.getPropertyValue("--beta-pointer-x")).toBe("0px");
    expect(hero.style.getPropertyValue("--beta-pointer-y")).toBe("0px");
  });

  it("shows the source-to-review workflow without generic open-ended AI tutor claims", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter initialEntries={["/homepage-beta"]}>
        <HomepageBetaPage />
      </MemoryRouter>,
    );

    const workflow = screen.getByTestId("beta-calm-study-workflow");
    expect(
      Array.from(workflow.querySelectorAll<HTMLElement>("[data-beta-workflow-step]")).map(
        (step) => step.dataset.betaWorkflowStep,
      ),
    ).toEqual(["source", "note", "graph", "review", "mistakes"]);

    expect(within(workflow).getByText("Source excerpt")).toBeTruthy();
    expect(within(workflow).getByText("Student note")).toBeTruthy();
    expect(within(workflow).getByText("Graph + formula context")).toBeTruthy();
    expect(within(workflow).getByText("Review card")).toBeTruthy();
    expect(within(workflow).getByText("Exam-ready mistake list")).toBeTruthy();
    expect(screen.getByText("AI study helpers, when enabled, work from your notes and sources.")).toBeTruthy();
    expect(screen.queryByText(/AI tutor for everything|homework outsourcing|answers your homework/i)).toBeNull();
  });

  it("keeps the beta homepage route gated until the flag is on", () => {
    render(
      <MemoryRouter initialEntries={["/homepage-beta"]}>
        <HomepageBetaPage />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("beta-calm-homepage")).toBeNull();
    expect(screen.getByRole("heading", { name: "Study notes that feel like a living, premium workspace." })).toBeTruthy();
  });

  it("surfaces the gated /homepage-beta preview route without adding demo account buttons", () => {
    setCalmStudyHomepageBeta(true);

    render(
      <MemoryRouter initialEntries={["/homepage-beta"]}>
        <Routes>
          <Route element={<HomepageBetaPage />} path="/homepage-beta" />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("beta-calm-homepage").getAttribute("data-beta-preview-route")).toBe("homepage-beta");
    expect(screen.getAllByRole("link", { name: /Start/i })[0].getAttribute("href")).toBe("/auth");
    expect(screen.queryByRole("button", { name: /demo/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/try demo|enter demo|demo sign-in/i);
  });
});
