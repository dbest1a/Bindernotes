// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SaveStatusPill } from "./save-status-pill";

afterEach(cleanup);
it("announces status and makes offline retry reachable", () => {
  const retry = vi.fn();
  render(<SaveStatusPill snapshot={{ state: "offline", detail: "Offline - keep this tab open", error: null, lastSavedAt: null }} onRetry={retry} />);
  expect(screen.getByRole("status").textContent).toContain("keep this tab open");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(retry).toHaveBeenCalledOnce();
});
