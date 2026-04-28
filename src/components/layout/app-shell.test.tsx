// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { tutorialPromptPreferenceStorageKey } from "@/lib/tutorials/tutorial-preferences";

const authMock = vi.hoisted(() => ({
  profile: {
    id: "user-1",
    email: "kai@example.com",
    full_name: "Kai Chen",
    role: "admin",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as {
    id: string;
    email: string;
    full_name: string | null;
    role: string | null;
    created_at: string;
    updated_at: string;
  } | null,
  signOut: vi.fn(),
}));

const themeMock = vi.hoisted(() => ({
  setThemeId: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    profile: authMock.profile,
    signOut: authMock.signOut,
  }),
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    globalTheme: { id: "space" },
    setThemeId: themeMock.setThemeId,
  }),
}));

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route element={<AppShell />} path="/">
          <Route element={<div>Workspace body</div>} path="dashboard" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppShell profile settings", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-admin-motion");
    document.documentElement.removeAttribute("data-admin-dashboard");
    document.documentElement.removeAttribute("data-motion-intensity");
    document.documentElement.removeAttribute("data-motion-speed");
    document.documentElement.removeAttribute("data-premium-color-mode");
    document.documentElement.removeAttribute("data-page-transition");
    authMock.profile = {
      id: "user-1",
      email: "kai@example.com",
      full_name: "Kai Chen",
      role: "admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  it("shows Admin Motion Lab controls only for admins", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("admin-motion-lab")).toBeTruthy();

    cleanup();
    authMock.profile = {
      id: "user-2",
      email: "learner@example.com",
      full_name: "Learner Person",
      role: "learner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    renderShell();
    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.queryByTestId("admin-motion-lab")).toBeNull();
  });

  it("shows dashboard appearance controls only for admins", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("admin-dashboard-appearance")).toBeTruthy();
    expect(screen.getByTestId("admin-dashboard-view-mode")).toBeTruthy();

    cleanup();
    authMock.profile = {
      id: "user-2",
      email: "learner@example.com",
      full_name: "Learner Person",
      role: "learner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    renderShell();
    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.queryByTestId("admin-dashboard-appearance")).toBeNull();
  });

  it("persists admin dashboard view mode and mirrors it to root data attributes", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.change(screen.getByTestId("admin-dashboard-view-mode"), {
      target: { value: "admin-makeover" },
    });

    expect(document.documentElement.getAttribute("data-admin-dashboard")).toBe("makeover");
    expect(window.localStorage.getItem("binder-notes:admin-dashboard-view")).toContain(
      "admin-makeover",
    );
  });

  it("shows tutorial prompt controls in the profile menu for admins and learners", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("tutorial-prompts-section")).toBeTruthy();
    expect(screen.getByTestId("tutorial-prompts-toggle")).toBeTruthy();

    cleanup();
    authMock.profile = {
      id: "user-2",
      email: "learner@example.com",
      full_name: "Learner Person",
      role: "learner",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    renderShell();
    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("tutorial-prompts-section")).toBeTruthy();
    expect(screen.queryByTestId("admin-motion-lab")).toBeNull();
  });

  it("persists tutorial prompt preference from the profile menu", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("tutorial-prompts-toggle"));

    expect(screen.getByTestId("tutorial-prompts-section")).toBeTruthy();
    expect(screen.getByTestId("tutorial-prompts-toggle")).toBeTruthy();
    expect(window.localStorage.getItem(tutorialPromptPreferenceStorageKey("user-1"))).toContain(
      '"promptsEnabled":false',
    );
  });

  it("persists admin motion settings and mirrors them to root data attributes", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("admin-motion-toggle"));
    fireEvent.change(screen.getByTestId("admin-motion-intensity"), { target: { value: "party" } });
    fireEvent.change(screen.getByTestId("admin-motion-speed"), { target: { value: "quick" } });

    expect(document.documentElement.getAttribute("data-admin-motion")).toBe("on");
    expect(document.documentElement.getAttribute("data-motion-intensity")).toBe("party");
    expect(document.documentElement.getAttribute("data-motion-speed")).toBe("quick");
    expect(window.localStorage.getItem("bindernotes:admin-motion:v1")).toContain('"enabled":true');
  });

  it("closes the profile settings popover with Escape", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    expect(screen.getByTestId("profile-settings-popover")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("profile-settings-popover")).toBeNull();
  });
});
