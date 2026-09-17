// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { archiveFixture } from "@/test-utils/portable-archive-fixture";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), restore: vi.fn(), export: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ profile: { id: "10000000-0000-4000-8000-000000000001" } }),
}));
vi.mock("@/services/portable-archive-service", () => ({
  prepareArchiveImport: mocks.prepare,
  importPortableArchive: mocks.restore,
  exportPortableArchive: mocks.export,
  restoreImportedMath: vi.fn(),
}));
import { AccountDataPage } from "./account-data-page";
beforeEach(() => {
  mocks.prepare.mockReset();
  mocks.restore.mockReset();
  mocks.export.mockReset();
});
afterEach(cleanup);
function view() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AccountDataPage />
    </QueryClientProvider>,
  );
}
describe("Data & backups", () => {
  it("previews a validated archive before import and retains the same preview after an uncertain failure", async () => {
    const prepared = {
      ownerId: archiveFixture().ownerId,
      archive: archiveFixture(),
      digest: "digest",
      batchId: "batch",
    };
    mocks.prepare.mockResolvedValue(prepared);
    mocks.restore
      .mockRejectedValueOnce(new Error("Import not confirmed; retry this archive."))
      .mockResolvedValueOnce({ counts: {}, deviceMathReady: true, batchId: "batch" });
    view();
    fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), {
      target: { files: [new File(["{}"], "archive.json")] },
    });
    await screen.findByText("Archive validated. Review its contents before importing.");
    expect(screen.getByText("Personal notes: 1")).toBeTruthy();
    expect(mocks.restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import into this account" }));
    await screen.findByText(
      "The import could not be confirmed. Keep this archive and retry the same file to check its result without duplicates.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Import into this account" }));
    await screen.findByText("All workspace records were imported. Device Math work is ready.");
    expect(mocks.restore.mock.calls.map(([value]) => value)).toEqual([prepared, prepared]);
  });
  it("does not offer import after validation fails", async () => {
    mocks.prepare.mockRejectedValue(new Error("Unsupported archive version"));
    view();
    fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), {
      target: { files: [new File(["{}"], "bad.json")] },
    });
    await waitFor(() => expect(screen.getByText(/This archive could not be validated/)).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Import into this account" })).toBeNull();
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("shows a friendly unsupported archive message without Zod paths or rejected values", async () => {
    const invalid = z
      .object({ version: z.literal(1), internal_record_payload: z.string() })
      .safeParse({ version: 999 });
    if (invalid.success) throw new Error("Expected malformed fixture");
    mocks.prepare.mockRejectedValue(invalid.error);
    view();
    fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), {
      target: { files: [new File(['{"version":999}'], "bad.json")] },
    });
    await screen.findByText(/This archive is invalid or uses an unsupported version/);
    expect(document.body.textContent).not.toMatch(
      /internal_record_payload|invalid_value|invalid_type|"path"|999/,
    );
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it("explains malformed JSON without exposing parser fragments", async () => {
    mocks.prepare.mockRejectedValue(new SyntaxError("Unexpected token PRIVATE_FRAGMENT at position 3"));
    view();
    fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), {
      target: { files: [new File(["{bad"], "bad.json")] },
    });
    await screen.findByText(/This file is not valid JSON/);
    expect(document.body.textContent).not.toContain("PRIVATE_FRAGMENT");
  });
  it.each(["export", "import"])("does not expose a raw server error during %s", async (operation) => {
    const raw = new Error("SQLSTATE 42501 secret_table.owner_id RAW_RESPONSE_BODY");
    if (operation === "export") mocks.export.mockRejectedValue(raw);
    else {
      mocks.prepare.mockResolvedValue({
        ownerId: archiveFixture().ownerId,
        archive: archiveFixture(),
        digest: "digest",
        batchId: "batch",
      });
      mocks.restore.mockRejectedValue(raw);
    }
    view();
    if (operation === "export") {
      fireEvent.click(screen.getByRole("button", { name: "Export complete archive" }));
      await screen.findByText(/The complete archive could not be prepared/);
    } else {
      fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), {
        target: { files: [new File(["{}"], "archive.json")] },
      });
      await screen.findByText("Archive validated. Review its contents before importing.");
      fireEvent.click(screen.getByRole("button", { name: "Import into this account" }));
      await screen.findByText(/The import could not be confirmed/);
    }
    expect(document.body.textContent).not.toMatch(/42501|secret_table|owner_id|RAW_RESPONSE_BODY/);
  });
});
