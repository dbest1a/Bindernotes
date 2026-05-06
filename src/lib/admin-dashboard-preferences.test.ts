// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
  loadAdminDashboardPreference,
  sanitizeAdminDashboardPreference,
  saveAdminDashboardPreference,
} from "@/lib/admin-dashboard-preferences";

describe("admin dashboard preferences", () => {
  it("keeps Minimal as a valid dashboard view mode", () => {
    expect(sanitizeAdminDashboardPreference({ viewMode: "minimal" })).toEqual({
      viewMode: "minimal",
    });
  });

  it("persists Minimal through the existing dashboard preference storage", () => {
    const storage = window.localStorage;

    saveAdminDashboardPreference({ viewMode: "minimal" }, storage);

    expect(loadAdminDashboardPreference(storage)).toEqual({ viewMode: "minimal" });
  });
});
