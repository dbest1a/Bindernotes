// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";

const authMock = vi.hoisted(() => ({
  profile: {
    id: "user-1",
    full_name: "Kai Chen",
    role: "admin",
  } as { id: string; full_name: string | null; role: string | null } | null,
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
    document.documentElement.removeAttribute("data-motion-intensity");
    document.documentElement.removeAttribute("data-motion-speed");
    document.documentElement.removeAttribute("data-premium-color-mode");
    document.documentElement.removeAttribute("data-page-transition");
    authMock.profile = {
      id: "user-1",
      full_name: "Kai Chen",
      role: "admin",
    };
  });

  it("shows Admin Motion Lab controls only for admins", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("admin-motion-lab")).toBeTruthy();

    cleanup();
    authMock.profile = {
      id: "user-2",
      full_name: "Learner Person",
      role: "learner",
    };

    renderShell();
    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.queryByTestId("admin-motion-lab")).toBeNull();
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
