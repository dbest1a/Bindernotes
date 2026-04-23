import { describe, expect, it } from "vitest";
import { shouldBlockAuthHydration, shouldRefreshProfile } from "@/hooks/use-auth";

describe("auth hydration helpers", () => {
  it("keeps token refresh events off the full-page loading path", () => {
    expect(shouldBlockAuthHydration("TOKEN_REFRESHED")).toBe(false);
    expect(shouldRefreshProfile("TOKEN_REFRESHED")).toBe(false);
  });

  it("still treats true auth transitions as foreground work", () => {
    expect(shouldBlockAuthHydration("SIGNED_IN")).toBe(true);
    expect(shouldBlockAuthHydration("SIGNED_OUT")).toBe(true);
    expect(shouldRefreshProfile("SIGNED_IN")).toBe(true);
    expect(shouldRefreshProfile("USER_UPDATED")).toBe(true);
  });
});
