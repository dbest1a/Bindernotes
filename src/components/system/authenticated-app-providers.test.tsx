// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedAppProviders } from "@/components/system/authenticated-app-providers";

vi.mock("@/components/theme/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/theme/user-appearance-sync", () => ({ UserAppearanceSync: () => null }));
vi.mock("@/components/system/sync-recovery-bridge", () => ({ SyncRecoveryBridge: () => null }));

let client: QueryClient;
function Probe() {
  client = useQueryClient();
  return null;
}
const tree = (owner: string) => (
  <AuthenticatedAppProviders key={owner}>
    <Probe />
  </AuthenticatedAppProviders>
);

describe("authenticated query lifecycle", () => {
  afterEach(cleanup);

  it("loads the current account normally under StrictMode effect replay", async () => {
    const read = vi.fn().mockResolvedValue("Current account loaded");
    function QueryProbe() {
      const query = useQuery({ queryKey: ["initial"], queryFn: read });
      return <p>{query.data ?? "Loading"}</p>;
    }
    render(
      <StrictMode>
        <AuthenticatedAppProviders>
          <QueryProbe />
        </AuthenticatedAppProviders>
      </StrictMode>,
    );
    await screen.findByText("Current account loaded");
  });

  it("cancels old queries and isolates late query and mutation results after account change", async () => {
    const view = render(tree("A"));
    const oldClient = client;
    let resolveQuery!: (value: string) => void;
    let resolveMutation!: (value: string) => void;
    oldClient.setQueryData(["existing-private"], "A cached note");
    const pendingQuery = oldClient
      .fetchQuery({
        queryKey: ["late-private"],
        queryFn: () =>
          new Promise<string>((resolve) => {
            resolveQuery = resolve;
          }),
      })
      .catch(() => undefined);
    const mutation = oldClient.getMutationCache().build(oldClient, {
      mutationFn: () =>
        new Promise<string>((resolve) => {
          resolveMutation = resolve;
        }),
      onSuccess: (value) => {
        oldClient.setQueryData(["late-mutation"], value);
      },
    });
    const pendingMutation = mutation.execute(undefined);
    await act(async () => {
      await Promise.resolve();
    });
    view.rerender(tree("B"));
    expect(client).not.toBe(oldClient);
    expect(oldClient.getQueryData(["existing-private"])).toBeUndefined();
    await act(async () => {
      resolveQuery("A fetched note");
      resolveMutation("A saved note");
      await Promise.all([pendingQuery, pendingMutation]);
    });
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(oldClient.getQueryData(["late-private"])).toBeUndefined();
  });
});
