// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuizAttemptResults } from "@/hooks/use-quiz-attempt-results";

const load = vi.hoisted(() => vi.fn());
vi.mock("@/services/quiz-attempt-results-service", () => ({ getQuizAttemptResults: load }));
afterEach(() => { cleanup(); load.mockReset(); });

describe("account-scoped quiz result queries", () => {
  it("cancels an old account request and does not reuse its cached or late data", async () => {
    let resolveOld: (value: { account: string }) => void = () => { throw new Error("Old request has not started"); };
    load.mockImplementation(({ ownerId }: { ownerId: string }) => ownerId === "a" ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve({ account: "b" }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const hook = renderHook(({ owner }) => useQuizAttemptResults("same-quiz", "same-attempt", owner), { initialProps: { owner: "a" }, wrapper });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    const oldSignal: AbortSignal = load.mock.calls[0][0].signal;
    hook.rerender({ owner: "b" });
    await waitFor(() => expect(hook.result.current.data).toEqual({ account: "b" }));
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld({ account: "a" }));
    expect(hook.result.current.data).toEqual({ account: "b" });
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ ownerId: "b", quizId: "same-quiz", attemptId: "same-attempt" }));
    client.clear();
  });
});
