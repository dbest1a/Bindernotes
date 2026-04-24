// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePreferences } from "@/types";

const mocks = vi.hoisted(() => ({
  getWorkspacePreferencesRecord: vi.fn(),
  setTheme: vi.fn(),
  upsertWorkspacePreferencesRecord: vi.fn(),
}));

vi.mock("@/services/binder-service", () => ({
  getWorkspacePreferencesRecord: mocks.getWorkspacePreferencesRecord,
  upsertWorkspacePreferencesRecord: mocks.upsertWorkspacePreferencesRecord,
}));

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({
    setTheme: mocks.setTheme,
  }),
}));

import { useWorkspacePreferences } from "@/hooks/use-workspace-preferences";
import { createDefaultWorkspacePreferences } from "@/lib/workspace-preferences";

describe("useWorkspacePreferences", () => {
  beforeEach(() => {
    mocks.getWorkspacePreferencesRecord.mockReset();
    mocks.setTheme.mockReset();
    mocks.upsertWorkspacePreferencesRecord.mockReset();
  });

  it("normalizes legacy saved preferences before the document reads focus mode", async () => {
    const legacy = createDefaultWorkspacePreferences("user-1", "binder-1");
    delete (legacy as Partial<WorkspacePreferences>).simple;
    delete (legacy as Partial<WorkspacePreferences>).appearance;
    delete (legacy.theme as Partial<WorkspacePreferences["theme"]>).studySurface;

    mocks.getWorkspacePreferencesRecord.mockResolvedValueOnce(legacy);

    const { result } = renderHook(() =>
      useWorkspacePreferences("user-1", "binder-1", null),
    );

    await waitFor(() => {
      expect(result.current.active?.simple.focusMode).toBe(false);
    });

    expect(result.current.active?.appearance.studySurface).toBe("math-blue");
    expect(result.current.active?.theme.studySurface).toBe("math-blue");
    expect(mocks.setTheme).toHaveBeenCalledWith(
      expect.objectContaining({
        focusMode: false,
        studySurface: "math-blue",
      }),
    );
  });
});
