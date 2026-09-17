// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChemistryLabNotebookModule, ChemistryStoichiometryCoachModule, ChemistryTitrationLabModule } from "@/components/chemistry/chemistry-workspace-modules";
import type { SavedChemistryActivity } from "@/services/chemistry-activity-service";

const test = vi.hoisted(() => ({ owner: "00000000-0000-4000-8000-000000000001" as string | null, rows: [] as SavedChemistryActivity[], save: vi.fn(), list: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ profile: test.owner ? { id: test.owner } : null }) }));
vi.mock("@/services/chemistry-activity-service", () => ({ saveChemistryActivity: test.save, listChemistryActivities: test.list }));
vi.mock("@/lib/desmos-loader", () => ({ hasDesmosApiKey: () => false }));

beforeEach(() => {
  test.owner = "00000000-0000-4000-8000-000000000001"; test.rows = [];
  test.list.mockReset().mockImplementation(async ({ ownerId, kind }) => ({ records: test.rows.filter((row) => row.ownerId === ownerId && row.snapshot.kind === kind), hasMore: false, unsupportedCount: 0 }));
  test.save.mockReset().mockImplementation(async ({ id, ownerId, snapshot }) => {
    const saved = { id, ownerId, snapshot: structuredClone(snapshot), createdAt: "2026-09-17T12:00:00Z" };
    test.rows = [...test.rows.filter((row) => row.id !== id), saved];
    return saved;
  });
});
afterEach(cleanup);

async function reopenFirst() {
  fireEvent.click(await screen.findByRole("button", { name: /^Reopen .+ · / }));
  expect(screen.getByText(/replace the current work/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reopen snapshot" }));
}

describe("chemistry save and reopen controls", () => {
  it("saves a titration and reopens its measurements and notebook after a remount", async () => {
    const view = render(<ChemistryTitrationLabModule />);
    fireEvent.click(screen.getByRole("button", { name: "Add 5.00 mL" }));
    fireEvent.change(screen.getByLabelText("Hypothesis"), { target: { value: "Expect equivalence at 25 mL." } });
    fireEvent.change(screen.getByLabelText("Conclusion"), { target: { value: "More base is needed." } });
    fireEvent.click(screen.getByRole("button", { name: "Save chemistry work" }));
    await screen.findByText("Saved to your account.");
    view.unmount();
    render(<ChemistryTitrationLabModule />);
    expect((screen.getByLabelText("Conclusion") as HTMLTextAreaElement).value).toBe("");
    await reopenFirst();
    expect((screen.getByLabelText("Hypothesis") as HTMLTextAreaElement).value).toBe("Expect equivalence at 25 mL.");
    expect((screen.getByLabelText("Conclusion") as HTMLTextAreaElement).value).toBe("More base is needed.");
    expect(screen.getByText("5.00 mL")).toBeTruthy();
    expect(screen.getByText("Saved to your account.")).toBeTruthy();
  });
  it("reopens stoichiometry original inputs and result, then computes again only after an edit", async () => {
    const view = render(<ChemistryStoichiometryCoachModule />);
    fireEvent.change(screen.getByLabelText("Given grams of H2"), { target: { value: "2.016" } });
    fireEvent.click(screen.getByRole("button", { name: "Save chemistry work" }));
    await screen.findByText("Saved to your account.");
    view.unmount();
    render(<ChemistryStoichiometryCoachModule />);
    await reopenFirst();
    expect((screen.getByLabelText("Given grams of H2") as HTMLInputElement).value).toBe("2.016");
    expect(screen.getByText(/Final answer: 18.02 g H2O/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Given grams of H2"), { target: { value: "" } });
    expect(screen.queryByText(/Final answer:/)).toBeNull();
    expect((screen.getByRole("button", { name: "Save chemistry work" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("preserves a failed notebook save and retries the same operation without duplicate snapshots", async () => {
    test.save.mockRejectedValueOnce(new Error("Network unavailable. Try again."));
    render(<ChemistryLabNotebookModule />);
    fireEvent.change(screen.getByLabelText("Data table"), { target: { value: "0 mL: pH 1" } });
    fireEvent.change(screen.getByLabelText("Conclusion"), { target: { value: "My conclusion" } });
    fireEvent.click(screen.getByRole("button", { name: "Save chemistry work" }));
    await screen.findByRole("alert");
    expect((screen.getByLabelText("Conclusion") as HTMLTextAreaElement).value).toBe("My conclusion");
    expect(screen.queryByText("Saved to your account.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save chemistry work" }));
    await screen.findByText("Saved to your account.");
    expect(test.save.mock.calls[0][0].id).toBe(test.save.mock.calls[1][0].id);
    expect(test.rows).toHaveLength(1);
    expect(test.rows[0].snapshot).toMatchObject({ notebook: { dataTable: "0 mL: pH 1", conclusion: "My conclusion" } });
  });
  it("keeps edits made during a save marked unsaved and prevents a duplicate click", async () => {
    let finish!: (value: unknown) => void;
    test.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<ChemistryLabNotebookModule />);
    fireEvent.change(screen.getByLabelText("Conclusion"), { target: { value: "First version" } });
    const save = screen.getByRole("button", { name: "Save chemistry work" });
    fireEvent.click(save); fireEvent.click(save);
    fireEvent.change(screen.getByLabelText("Conclusion"), { target: { value: "Later edit" } });
    await act(async () => finish({}));
    expect(test.save).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Unsaved changes/)).toBeTruthy();
    expect((screen.getByLabelText("Conclusion") as HTMLTextAreaElement).value).toBe("Later edit");
  });
  it("clears private draft state and ignores old save completion on account switch", async () => {
    let finish!: (value: unknown) => void;
    test.save.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<ChemistryLabNotebookModule />);
    fireEvent.change(screen.getByLabelText("Conclusion"), { target: { value: "Account A secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Save chemistry work" }));
    test.owner = "00000000-0000-4000-8000-000000000002";
    view.rerender(<ChemistryLabNotebookModule />);
    expect((screen.getByLabelText("Conclusion") as HTMLTextAreaElement).value).toBe("");
    await act(async () => finish({}));
    expect(test.save.mock.calls[0][0].signal.aborted).toBe(true);
    expect(screen.queryByText("Saved to your account.")).toBeNull();
    await waitFor(() => expect(test.list.mock.calls.at(-1)?.[0].ownerId).toBe(test.owner));
    test.owner = null; view.rerender(<ChemistryLabNotebookModule />);
    expect(screen.getByText(/Sign in to save and reopen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save chemistry work" })).toBeNull();
  });
});
