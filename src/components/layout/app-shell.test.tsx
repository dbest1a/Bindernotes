// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import { betaFeatureFlagDefinitions } from "@/lib/beta-features";
import { loadPersonalNotesPreferences } from "@/lib/personal-notes";
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
    document.documentElement.removeAttribute("data-beta-features");
    for (const flag of betaFeatureFlagDefinitions) {
      document.documentElement.removeAttribute(flag.dataAttribute);
    }
    document.documentElement.removeAttribute("data-enhanced-mode");
    document.documentElement.removeAttribute("data-enhanced-visuals");
    document.documentElement.removeAttribute("data-performance-mode");
    document.documentElement.removeAttribute("data-motion-intensity");
    document.documentElement.removeAttribute("data-motion-speed");
    document.documentElement.removeAttribute("data-premium-color-mode");
    document.documentElement.removeAttribute("data-page-transition");
    // @ts-expect-error jsdom matchMedia is test-controlled here.
    delete window.matchMedia;
    authMock.profile = {
      id: "user-1",
      email: "kai@example.com",
      full_name: "Kai Chen",
      role: "admin",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  it("opens a full searchable settings window from the profile menu", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    expect(screen.getByTestId("app-settings-window")).toBeTruthy();
    expect(screen.getByLabelText("Search settings")).toBeTruthy();
    expect(screen.getByTestId("app-settings-section-account")).toBeTruthy();
    expect(screen.getByTestId("app-settings-section-appearance")).toBeTruthy();
    expect(screen.getByTestId("app-settings-section-learning")).toBeTruthy();
    expect(screen.getByTestId("app-settings-section-performance")).toBeTruthy();
  });

  it("searches the full settings window without leaving the profile menu overloaded", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("profile-settings-popover")).toBeTruthy();
    expect(screen.queryByTestId("tutorial-prompts-section")).toBeNull();
    expect(screen.queryByTestId("admin-motion-lab")).toBeNull();

    fireEvent.click(screen.getByTestId("profile-open-settings"));
    fireEvent.change(screen.getByLabelText("Search settings"), {
      target: { value: "motion" },
    });

    expect(screen.getByTestId("admin-motion-lab")).toBeTruthy();
    expect(screen.queryByTestId("personal-notes-quick-access-section")).toBeNull();
  });

  it("shows Admin Motion Lab controls only for admins inside the settings window", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

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
    fireEvent.click(screen.getByTestId("profile-open-settings"));

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

  it("uses the cached Minimal dashboard shell while the profile is still loading", () => {
    window.localStorage.setItem(
      "binder-notes:admin-dashboard-view",
      JSON.stringify({ viewMode: "minimal" }),
    );
    authMock.profile = null;

    renderShell();

    expect(document.documentElement.getAttribute("data-admin-dashboard")).toBe("minimal");
    expect(screen.getByText("Workspace body")).toBeTruthy();
  });

  it("offers Normal, Admin Makeover, and Minimal dashboard appearances", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    const selector = screen.getByTestId("admin-dashboard-view-mode");
    const options = Array.from(selector.querySelectorAll("option")).map((option) => ({
      label: option.textContent,
      value: option.value,
    }));

    expect(options).toEqual([
      { label: "Normal", value: "normal" },
      { label: "Admin Makeover", value: "admin-makeover" },
      { label: "Minimal", value: "minimal" },
    ]);
  });

  it("switches from Minimal back to Normal or Admin Makeover without losing the preference", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.change(screen.getByTestId("admin-dashboard-view-mode"), {
      target: { value: "minimal" },
    });

    expect(document.documentElement.getAttribute("data-admin-dashboard")).toBe("minimal");
    expect(window.localStorage.getItem("binder-notes:admin-dashboard-view")).toContain('"minimal"');

    fireEvent.change(screen.getByTestId("admin-dashboard-view-mode"), {
      target: { value: "normal" },
    });

    expect(document.documentElement.getAttribute("data-admin-dashboard")).toBe("normal");
    expect(window.localStorage.getItem("binder-notes:admin-dashboard-view")).toContain('"normal"');

    fireEvent.change(screen.getByTestId("admin-dashboard-view-mode"), {
      target: { value: "admin-makeover" },
    });

    expect(document.documentElement.getAttribute("data-admin-dashboard")).toBe("makeover");
    expect(window.localStorage.getItem("binder-notes:admin-dashboard-view")).toContain(
      '"admin-makeover"',
    );
  });

  it("shows tutorial prompt controls in the settings window for admins and learners", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

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
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    expect(screen.getByTestId("tutorial-prompts-section")).toBeTruthy();
    expect(screen.queryByTestId("admin-motion-lab")).toBeNull();
  });

  it("persists tutorial prompt preference from the settings window", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));
    fireEvent.click(screen.getByTestId("tutorial-prompts-toggle"));

    expect(screen.getByTestId("tutorial-prompts-section")).toBeTruthy();
    expect(screen.getByTestId("tutorial-prompts-toggle")).toBeTruthy();
    expect(window.localStorage.getItem(tutorialPromptPreferenceStorageKey("user-1"))).toContain(
      '"promptsEnabled":false',
    );
  });

  it("keeps a compact solid quick settings menu with account actions", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    const popover = screen.getByTestId("profile-settings-popover");
    expect(popover.className).toContain("bg-popover");
    expect(popover.className).not.toContain("backdrop-blur");
    expect(screen.getByTestId("profile-open-settings")).toBeTruthy();
    expect(screen.getByTestId("personal-notes-quick-access-section")).toBeTruthy();
    expect(screen.getByTestId("performance-mode-section")).toBeTruthy();
    expect(screen.queryByTestId("tutorial-prompts-section")).toBeNull();
    expect(screen.queryByTestId("admin-motion-lab")).toBeNull();

    fireEvent.click(screen.getByTestId("personal-notes-quick-access-toggle"));

    expect(loadPersonalNotesPreferences("user-1").showQuickAccess).toBe(false);
  });

  it("defaults to Performance Mode while the Enhanced Visuals switch controls richer visuals", async () => {
    window.localStorage.setItem("bindernotes:performance-mode:v1", '{"enabled":false}');

    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));

    expect(screen.getByTestId("performance-mode-section")).toBeTruthy();
    expect(screen.getByRole("button", { name: /enhanced visuals/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByText("Enhanced Visuals")).toBeTruthy();
    expect(document.documentElement.getAttribute("data-enhanced-mode")).toBe("false");
    expect(document.documentElement.getAttribute("data-enhanced-visuals")).toBe("false");
    expect(document.documentElement.getAttribute("data-performance-mode")).toBe("true");
    expect(window.localStorage.getItem("bindernotes:enhanced-mode:v1")).toBeNull();

    fireEvent.click(screen.getByTestId("performance-mode-toggle"));

    expect(screen.getByRole("button", { name: /enhanced visuals/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.documentElement.getAttribute("data-enhanced-mode")).toBe("true");
    expect(document.documentElement.getAttribute("data-enhanced-visuals")).toBe("true");
    expect(document.documentElement.getAttribute("data-performance-mode")).toBe("false");
    expect(window.localStorage.getItem("bindernotes:enhanced-mode:v1")).toContain(
      '"enabled":true',
    );

    fireEvent.click(screen.getByTestId("performance-mode-toggle"));

    expect(screen.getByRole("button", { name: /enhanced visuals/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(document.documentElement.getAttribute("data-enhanced-mode")).toBe("false");
    expect(document.documentElement.getAttribute("data-enhanced-visuals")).toBe("false");
    expect(document.documentElement.getAttribute("data-performance-mode")).toBe("true");
    expect(window.localStorage.getItem("bindernotes:enhanced-mode:v1")).toContain(
      '"enabled":false',
    );
  });

  it("persists admin motion settings and mirrors them to root data attributes", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));
    fireEvent.click(screen.getByTestId("performance-mode-toggle"));
    fireEvent.click(screen.getByTestId("admin-motion-toggle"));
    fireEvent.change(screen.getByTestId("admin-motion-intensity"), { target: { value: "party" } });
    fireEvent.change(screen.getByTestId("admin-motion-speed"), { target: { value: "quick" } });

    expect(document.documentElement.getAttribute("data-admin-motion")).toBe("on");
    expect(document.documentElement.getAttribute("data-motion-intensity")).toBe("party");
    expect(document.documentElement.getAttribute("data-motion-speed")).toBe("quick");
    expect(window.localStorage.getItem("bindernotes:admin-motion:v1")).toContain('"enabled":true');
  });

  it("keeps Performance Mode stronger than Admin Motion Lab", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));
    fireEvent.click(screen.getByTestId("admin-motion-toggle"));
    fireEvent.change(screen.getByTestId("admin-page-transition"), { target: { value: "slide-pop" } });

    expect(document.documentElement.getAttribute("data-performance-mode")).toBe("true");
    expect(document.documentElement.getAttribute("data-admin-motion")).toBe("off");
    expect(document.documentElement.getAttribute("data-page-transition")).toBe("off");
  });

  it("respects reduced-motion by enabling effective Performance Mode", async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    renderShell();

    expect(document.documentElement.getAttribute("data-performance-mode")).toBe("true");
    expect(document.documentElement.getAttribute("data-reduced-motion")).toBe("system");
  });

  it("closes the profile settings popover with Escape", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    expect(screen.getByTestId("profile-settings-popover")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("profile-settings-popover")).toBeNull();
  });

  it("finds drawing and whiteboard performance controls through settings search", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));
    for (const query of ["performance", "lag", "smooth", "animation", "whiteboard menu"]) {
      fireEvent.change(screen.getByLabelText("Search settings"), {
        target: { value: query },
      });

      expect(screen.getByTestId("app-settings-section-performance")).toBeTruthy();
      expect(screen.getByText(/Performance Mode active/i)).toBeTruthy();
      expect(screen.queryByTestId("app-settings-empty")).toBeNull();
    }
  });

  it("uses real settings sidebar buttons that jump to Beta Features and mark it active", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    const betaNavItem = screen.getByRole("button", { name: /^beta features$/i });
    expect(betaNavItem).toBeTruthy();

    fireEvent.click(betaNavItem);

    expect(scrollIntoView).toHaveBeenCalled();
    expect(betaNavItem.getAttribute("aria-current")).toBe("page");
    expect(screen.getByTestId("app-settings-section-beta-features")).toBeTruthy();
  });

  it("uses real settings sidebar buttons for every visible settings section", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    for (const label of [
      "Account",
      "Appearance",
      "Learning",
      "Personal Notes",
      "Performance",
      "Beta Features",
      "Admin Motion",
    ]) {
      const navItem = screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
      fireEvent.click(navItem);
      expect(navItem.getAttribute("aria-current")).toBe("page");
    }

    expect(scrollIntoView).toHaveBeenCalledTimes(7);
  });

  it("finds Beta Features through settings search aliases", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    for (const query of [
      "beta",
      "experimental",
      "preview",
      "early access",
      "revamp",
      "qa cleanup",
      "split study",
      "study panels",
      "whiteboard",
      "settings search",
      "desmos",
      "dashboard",
    ]) {
      fireEvent.change(screen.getByLabelText("Search settings"), {
        target: { value: query },
      });

      expect(screen.getByTestId("app-settings-section-beta-features")).toBeTruthy();
      expect(screen.queryByTestId("app-settings-empty")).toBeNull();
    }
  });

  it("persists the Revamp Beta toggle and only exposes the revamp marker when enabled", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    expect(screen.getByRole("button", { name: /^beta features$/i })).toBeTruthy();
    expect(screen.getAllByText("Revamp Beta").length).toBeGreaterThan(0);
    expect(screen.getByTestId("revamp-beta-toggle").getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("beta-features-active-preview")).toBeNull();
    expect(document.documentElement.getAttribute("data-beta-features")).toBe("off");
    expect(document.documentElement.getAttribute("data-revamp-beta")).toBe("false");

    fireEvent.click(screen.getByTestId("revamp-beta-toggle"));

    expect(screen.getByTestId("revamp-beta-toggle").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("beta-features-active-preview")).toBeTruthy();
    expect(document.documentElement.getAttribute("data-beta-features")).toBe("on");
    expect(document.documentElement.getAttribute("data-revamp-beta")).toBe("true");
    expect(window.localStorage.getItem("bindernotes:beta-features:user-1")).toContain('"enabled":true');
    expect(window.localStorage.getItem("bindernotes:beta-features:user-1")).toContain('"revampBeta":true');

    cleanup();
    renderShell();
    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    expect(screen.getByTestId("revamp-beta-toggle").getAttribute("aria-pressed")).toBe("true");
  });

  it("does not expose separate QA cleanup beta toggles under Revamp Beta", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    expect(betaFeatureFlagDefinitions.map((flag) => flag.key)).toEqual(["revampBeta"]);
    expect(screen.getByTestId("beta-flag-revampBeta")).toBeTruthy();
    expect(screen.queryByTestId("beta-flag-compactStudyChrome")).toBeNull();
    expect(screen.queryByTestId("beta-flag-studyPanelsV2")).toBeNull();
    expect(screen.queryByTestId("beta-flag-compactWhiteboardTools")).toBeNull();

    fireEvent.click(screen.getByTestId("revamp-beta-toggle"));

    expect(document.documentElement.getAttribute("data-revamp-beta")).toBe("true");
    expect(screen.getByTestId("app-shell-root").getAttribute("data-revamp-beta")).toBe("true");
    expect(window.localStorage.getItem("bindernotes:beta-features:user-1")).not.toContain("compactStudyChrome");

    cleanup();
    renderShell();
    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));

    expect(screen.getByTestId("revamp-beta-toggle").getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.getAttribute("data-revamp-beta")).toBe("true");
    expect(screen.queryByText(/demo mode|learner demo|admin demo/i)).toBeNull();
  });

  it("keeps Admin Studio visible for admins but not learner accounts", async () => {
    renderShell();

    expect(screen.getByRole("link", { name: /admin studio/i })).toBeTruthy();

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

    expect(screen.queryByRole("link", { name: /admin studio/i })).toBeNull();
    expect(screen.queryByText(/learner demo|admin demo|demo mode/i)).toBeNull();
  });

  it("closes the full settings window with Escape", async () => {
    renderShell();

    fireEvent.click(screen.getByTestId("profile-menu-button"));
    fireEvent.click(screen.getByTestId("profile-open-settings"));
    expect(screen.getByTestId("app-settings-window")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByTestId("app-settings-window")).toBeNull();
  });
});
