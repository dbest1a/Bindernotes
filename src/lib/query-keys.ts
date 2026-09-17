import type { QueryClient } from "@tanstack/react-query";
import type { Role } from "@/types";

type OptionalId = string | undefined;
type TutorialQueryScope = "admin" | "published" | "published-prompts";

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    forProfile: (profileId: OptionalId) => ["dashboard", profileId] as const,
    forProfileRole: (profileId: OptionalId, role: Role | undefined) =>
      ["dashboard", profileId, role] as const,
    detail: (profileId: OptionalId, role: Role | undefined, includeSystemStatus: boolean) =>
      ["dashboard", profileId, role, includeSystemStatus] as const,
  },
  binder: {
    all: ["binder"] as const,
    detail: (binderId: OptionalId, profileId: OptionalId) =>
      ["binder", binderId, profileId] as const,
  },
  binderOverview: {
    all: ["binder-overview"] as const,
    detail: (binderId: OptionalId, profileId: OptionalId) =>
      ["binder-overview", binderId, profileId] as const,
  },
  folder: {
    all: ["folder"] as const,
    detail: (folderId: OptionalId, profileId: OptionalId) =>
      ["folder", folderId, profileId] as const,
  },
  personalNotes: {
    all: ["personal-notes"] as const,
    forProfile: (profileId: OptionalId) => ["personal-notes", profileId] as const,
  },
  historySuite: {
    all: ["history-suite"] as const,
    forBinder: (binderId: OptionalId) => ["history-suite", binderId] as const,
    detail: (binderId: OptionalId, suiteTemplateId: string | null | undefined, profileId: OptionalId) =>
      ["history-suite", binderId, suiteTemplateId, profileId] as const,
  },
  math: {
    all: ["math"] as const,
    courses: ["math", "courses"] as const,
    coursesForProfile: (profileId: OptionalId) => ["math", "courses", profileId] as const,
    course: (courseSlug: OptionalId, profileId?: string) => ["math", "course", courseSlug, profileId] as const,
    modules: ["math", "modules"] as const,
    modulesForProfile: (profileId: OptionalId) => ["math", "modules", profileId] as const,
    moduleBundles: ["math", "module"] as const,
    module: (moduleSlug: OptionalId, userId: string) =>
      ["math", "module", moduleSlug, userId] as const,
    questionBanks: ["math", "questions"] as const,
    questions: <Filters>(filters: Filters, profileId?: string) => ["math", "questions", filters, profileId] as const,
    quizzes: ["math", "quiz"] as const,
    quiz: (quizId: OptionalId, profileId?: string) => ["math", "quiz", quizId, profileId] as const,
    graphStates: (moduleId: string | null | undefined, profileId?: string) =>
      ["math", "graph-states", moduleId, profileId] as const,
  },
  tutorials: {
    all: ["tutorial-entries"] as const,
    list: (scope: TutorialQueryScope) => ["tutorial-entries", scope] as const,
  },
} as const;

/**
 * Updates every cached dashboard variant for one profile without creating a
 * synthetic prefix entry. Dashboard data is keyed by role and status mode, so
 * a three-part setQueryData call would otherwise miss the real four-part keys.
 */
export function updateDashboardQueriesData<T>(
  queryClient: QueryClient,
  profileId: string | undefined,
  updater: (current: T) => T,
): void {
  if (!profileId) {
    return;
  }

  queryClient.setQueriesData<T | undefined>(
    { queryKey: queryKeys.dashboard.forProfile(profileId), exact: false },
    (current) => (current === undefined ? current : updater(current)),
  );
}
