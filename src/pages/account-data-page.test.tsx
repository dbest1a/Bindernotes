// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { archiveFixture } from "@/test-utils/portable-archive-fixture";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), restore: vi.fn(), export: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ profile: { id: "10000000-0000-4000-8000-000000000001" } }) }));
vi.mock("@/services/portable-archive-service", () => ({ prepareArchiveImport: mocks.prepare, importPortableArchive: mocks.restore, exportPortableArchive: mocks.export, restoreImportedMath: vi.fn() }));
import { AccountDataPage } from "./account-data-page";
beforeEach(() => { mocks.prepare.mockReset(); mocks.restore.mockReset(); mocks.export.mockReset(); });
afterEach(cleanup);
function view() { render(<QueryClientProvider client={new QueryClient()}><AccountDataPage /></QueryClientProvider>); }
describe("Data & backups", () => {
  it("previews a validated archive before import and retains the same preview after an uncertain failure", async () => {
    const prepared = { ownerId: archiveFixture().ownerId, archive: archiveFixture(), digest: "digest", batchId: "batch" };
    mocks.prepare.mockResolvedValue(prepared);
    mocks.restore.mockRejectedValueOnce(new Error("Import not confirmed; retry this archive.")).mockResolvedValueOnce({ counts: {}, deviceMathReady: true, batchId: "batch" });
    view();
    fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), { target: { files: [new File(["{}"], "archive.json")] } });
    await screen.findByText("Archive validated. Review its contents before importing.");
    expect(screen.getByText("Personal notes: 1")).toBeTruthy();
    expect(mocks.restore).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import into this account" }));
    await screen.findByText("Import not confirmed; retry this archive.");
    fireEvent.click(screen.getByRole("button", { name: "Import into this account" }));
    await screen.findByText("All workspace records were imported. Device Math work is ready.");
    expect(mocks.restore.mock.calls.map(([value]) => value)).toEqual([prepared, prepared]);
  });
  it("does not offer import after validation fails", async () => {
    mocks.prepare.mockRejectedValue(new Error("Unsupported archive version")); view();
    fireEvent.change(screen.getByLabelText("Choose a BinderNotes JSON archive"), { target: { files: [new File(["{}"], "bad.json")] } });
    await waitFor(() => expect(screen.getByText("Unsupported archive version")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Import into this account" })).toBeNull();
    expect(mocks.restore).not.toHaveBeenCalled();
  });
});
