// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ list: vi.fn(), change: vi.fn() }));
vi.mock("@/services/personal-trash-service", () => ({ listPersonalTrash: mocks.list, setPersonalTrash: mocks.change }));
import { PersonalNotesTrash } from "./personal-notes-trash";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup(dirty = false) {
  mocks.list.mockResolvedValue([{ kind: "binder", id: "course", title: "Chemistry", archived_at: "today" }]);
  mocks.change.mockResolvedValue(undefined);
  const view = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><PersonalNotesTrash ownerId="owner" data={undefined} hasUnsavedChanges={dirty} /></QueryClientProvider>);
  const details = view.container.querySelector("details")!; details.open = true; fireEvent(details, new Event("toggle"));
}
describe("Personal Notes trash controls", () => {
  it("restores directly but requires typed intent for permanent deletion", async () => {
    setup(); await screen.findByText("Chemistry");
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.change).toHaveBeenCalledWith("binder", "course", "restore", undefined));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    const confirm = screen.getByRole("button", { name: "Confirm permanent deletion" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Permanent deletion confirmation"), { target: { value: "DELETE" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.change).toHaveBeenCalledWith("binder", "course", "delete", "DELETE"));
  });
  it("prevents destructive actions while an unsaved draft needs attention", async () => {
    setup(true); await screen.findByText("Chemistry");
    expect((screen.getByRole("button", { name: "Delete permanently" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Restore" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
