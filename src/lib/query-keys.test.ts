import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { queryKeys, updateDashboardQueriesData } from "@/lib/query-keys";
import { patchHistorySuiteQuery } from "@/hooks/use-history-suite";

describe("queryKeys", () => {
  it("separates account-sensitive math caches", () => {
    expect(queryKeys.math.questions({}, "A")).not.toEqual(queryKeys.math.questions({}, "B"));
    expect(queryKeys.math.quiz("quiz-1", "A")).not.toEqual(queryKeys.math.quiz("quiz-1", "B"));
    expect(queryKeys.math.course("course-1", "A")).not.toEqual(queryKeys.math.course("course-1", "B"));
  });

  it("patches history data only for the specified owner", () => {
    const client = new QueryClient();
    const a = queryKeys.historySuite.detail("binder-1", "template-1", "A");
    const b = queryKeys.historySuite.detail("binder-1", "template-1", "B");
    client.setQueryData(a, { privateNote: "A" });
    client.setQueryData(b, { privateNote: "B" });
    patchHistorySuiteQuery(client, "binder-1", "A", (current) => ({ ...current, events: [] }));
    expect(client.getQueryData(a)).toEqual({ privateNote: "A", events: [] });
    expect(client.getQueryData(b)).toEqual({ privateNote: "B" });
  });
  it("builds stable keys and profile-scoped dashboard prefixes", () => {
    expect(queryKeys.dashboard.forProfile("learner-1")).toEqual(["dashboard", "learner-1"]);
    expect(queryKeys.dashboard.detail("learner-1", "learner", false)).toEqual([
      "dashboard",
      "learner-1",
      "learner",
      false,
    ]);
    expect(queryKeys.binder.detail("binder-1", "learner-1")).toEqual(["binder", "binder-1", "learner-1"]);
  });

  it("updates every dashboard variant without creating a stale prefix cache", () => {
    const queryClient = new QueryClient();
    const withStatusKey = queryKeys.dashboard.detail("learner-1", "learner", true);
    const withoutStatusKey = queryKeys.dashboard.detail("learner-1", "learner", false);
    const otherProfileKey = queryKeys.dashboard.detail("learner-2", "learner", true);

    queryClient.setQueryData(withStatusKey, { notes: ["old"] });
    queryClient.setQueryData(withoutStatusKey, { notes: ["old"] });
    queryClient.setQueryData(otherProfileKey, { notes: ["other"] });

    updateDashboardQueriesData<{ notes: string[] }>(queryClient, "learner-1", (current) => ({
      notes: [...current.notes, "saved"],
    }));

    expect(queryClient.getQueryData(withStatusKey)).toEqual({ notes: ["old", "saved"] });
    expect(queryClient.getQueryData(withoutStatusKey)).toEqual({ notes: ["old", "saved"] });
    expect(queryClient.getQueryData(otherProfileKey)).toEqual({ notes: ["other"] });
    expect(
      queryClient.getQueryData(queryKeys.dashboard.forProfileRole("learner-1", "learner")),
    ).toBeUndefined();
  });
});
