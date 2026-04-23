import { isSupabaseConfigured } from "@/lib/supabase";
import {
  SYSTEM_BINDER_IDS,
  SYSTEM_SEED_VERSION,
  SYSTEM_SUITE_IDS,
  systemSuiteTemplates,
} from "@/lib/history-suite-seeds";
import type { SeedHealth, SuiteTemplate } from "@/types";

const strictSeedFlag = import.meta.env.VITE_STRICT_SEEDED_CONTENT;

export const strictSeedHealthMode =
  Boolean(isSupabaseConfigured) && strictSeedFlag !== "false";

export class MissingSeedError extends Error {
  readonly suiteTemplateId: string;
  readonly binderId: string;
  readonly expectedVersion: string;
  readonly seedHealth: SeedHealth;

  constructor(input: {
    binderId: string;
    suite: SuiteTemplate;
    actualVersion?: string | null;
    missingBinders?: string[];
  }) {
    const seedHealth: SeedHealth = {
      suiteTemplateId: input.suite.id,
      suiteSlug: input.suite.slug,
      suiteTitle: input.suite.title,
      status: "missing",
      expectedVersion: SYSTEM_SEED_VERSION,
      actualVersion: input.actualVersion ?? null,
      message: `${input.suite.title} is not seeded in this environment yet.`,
      missingBinders: input.missingBinders ?? [input.binderId],
    };

    super(seedHealth.message);
    this.name = "MissingSeedError";
    this.suiteTemplateId = input.suite.id;
    this.binderId = input.binderId;
    this.expectedVersion = SYSTEM_SEED_VERSION;
    this.seedHealth = seedHealth;
  }
}

export function isSystemBinderId(binderId: string) {
  return Object.values(SYSTEM_BINDER_IDS).includes(
    binderId as (typeof SYSTEM_BINDER_IDS)[keyof typeof SYSTEM_BINDER_IDS],
  );
}

export function isSystemSuiteId(suiteTemplateId: string) {
  return Object.values(SYSTEM_SUITE_IDS).includes(
    suiteTemplateId as (typeof SYSTEM_SUITE_IDS)[keyof typeof SYSTEM_SUITE_IDS],
  );
}

export function findSystemSuiteByBinderId(binderId: string) {
  const suiteId =
    binderId === SYSTEM_BINDER_IDS.algebra
      ? SYSTEM_SUITE_IDS.algebra
      : binderId === SYSTEM_BINDER_IDS.riseOfRome
        ? SYSTEM_SUITE_IDS.riseOfRome
        : binderId === SYSTEM_BINDER_IDS.frenchRevolution
          ? SYSTEM_SUITE_IDS.historyDemo
          : null;

  return suiteId ? systemSuiteTemplates.find((suite) => suite.id === suiteId) ?? null : null;
}

export function createHealthySeedHealth(suite: SuiteTemplate): SeedHealth {
  return {
    suiteTemplateId: suite.id,
    suiteSlug: suite.slug,
    suiteTitle: suite.title,
    status: "healthy",
    expectedVersion: SYSTEM_SEED_VERSION,
    actualVersion: SYSTEM_SEED_VERSION,
    message: `${suite.title} seed is present.`,
  };
}

export function createLegacySeedHealth(
  suite: SuiteTemplate,
  message = `${suite.title} legacy system content is available in this environment.`,
): SeedHealth {
  return {
    suiteTemplateId: suite.id,
    suiteSlug: suite.slug,
    suiteTitle: suite.title,
    status: "healthy",
    expectedVersion: SYSTEM_SEED_VERSION,
    actualVersion: SYSTEM_SEED_VERSION,
    message,
  };
}

export function createMissingSeedError(binderId: string, actualVersion?: string | null) {
  const suite = findSystemSuiteByBinderId(binderId);
  if (!suite) {
    return new Error("This system binder is missing its backend seed data.");
  }

  return new MissingSeedError({
    binderId,
    suite,
    actualVersion,
  });
}

export function isMissingSeedError(error: unknown): error is MissingSeedError {
  return error instanceof MissingSeedError;
}
