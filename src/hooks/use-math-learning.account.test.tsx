// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuestionBank, useQuizSet } from "@/hooks/use-math-learning";

const mocks = vi.hoisted(() => ({ owner: "A" as string | null, read: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ profile: mocks.owner ? { id: mocks.owner } : null }),
}));
vi.mock("@/services/math-learning-service", () => ({ listQuestions: mocks.read, getQuizSet: mocks.read }));

describe("private math query ownership", () => {
  let client: QueryClient;
  beforeEach(() => {
    mocks.owner = "A";
    mocks.read.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    cleanup();
    client.clear();
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  it.each(["question bank", "quiz"] as const)(
    "does not show a late A %s response after switching to B",
    async (kind) => {
      let finishA!: (data: unknown) => void;
      mocks.read.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishA = resolve;
          }),
      );
      mocks.read.mockResolvedValueOnce({ owner: "B", privateText: "B only" });
      const useSubject = kind === "question bank" ? () => useQuestionBank({}) : () => useQuizSet("quiz-1");
      const view = renderHook(() => ({ data: useSubject().data }), { wrapper });
      await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
      mocks.owner = "B";
      view.rerender();
      expect(view.result.current.data).toBeUndefined();
      await waitFor(() => expect(view.result.current.data).toEqual({ owner: "B", privateText: "B only" }));
      await act(async () => {
        finishA({ owner: "A", privateText: "A private" });
      });
      expect(view.result.current.data).toEqual({ owner: "B", privateText: "B only" });
    },
  );

  it("does not request account math data without a profile", () => {
    mocks.owner = null;
    renderHook(() => useQuestionBank({}), { wrapper });
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
