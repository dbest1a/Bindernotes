import { describe, expect, it } from "vitest";
import { createHealthySeedHealth, createMissingSeedError } from "@/lib/seed-health";
import { buildSystemFolderFromSuite, systemSuiteTemplates } from "@/lib/history-suite-seeds";
import {
  buildLearnerWorkspaceMessage,
  buildWorkspaceDiagnostics,
  buildSeedHealthFromCounts,
  classifyQueryError,
  classifyRuntimeError,
} from "@/lib/workspace-diagnostics";

describe("workspace diagnostics", () => {
  it("classifies schema-cache missing table errors as missing tables", () => {
    const diagnostic = classifyQueryError("suite_templates", {
      code: "PGRST205",
      message: "Could not find the table 'public.suite_templates' in the schema cache",
    });

    expect(diagnostic).toMatchObject({
      code: "missing_table",
      scope: "suite_templates",
      severity: "error",
    });
  });

  it("builds missing seed health instead of pretending the seed is healthy", () => {
    const seedHealth = buildSeedHealthFromCounts({
      suites: [],
      currentSeedVersions: [],
      binders: [],
      diagnostics: [
        {
          code: "missing_table",
          scope: "suite_templates",
          severity: "error",
          title: "Missing table",
          message: "suite_templates is missing.",
        },
      ],
      fallbackSeedHealth: systemSuiteTemplates.map((suite) => createHealthySeedHealth(suite)),
    });

    expect(seedHealth).toHaveLength(systemSuiteTemplates.length);
    expect(seedHealth.every((item) => item.status === "missing")).toBe(true);
  });

  it("turns a missing seed error into a runtime diagnostic", () => {
    const diagnostics = classifyRuntimeError(
      "workspace",
      createMissingSeedError("binder-rise-of-rome"),
    );

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: "missing_seed_version",
      severity: "error",
      scope: "suite-rise-of-rome",
    });
  });

  it("gives learners a cleaner environment mismatch message", () => {
    const message = buildLearnerWorkspaceMessage([
      {
        code: "env_mismatch",
        scope: "supabase",
        severity: "warning",
        title: "Mismatch",
        message: "Wrong project.",
      },
    ]);

    expect(message).toContain("Supabase project");
  });

  it("recognizes system binders and folders by stable ids even before suite columns exist", () => {
    const riseOfRomeSuite = systemSuiteTemplates.find((suite) => suite.id === "suite-rise-of-rome");
    expect(riseOfRomeSuite).toBeTruthy();

    const diagnostics = buildWorkspaceDiagnostics({
      suites: [riseOfRomeSuite!],
      currentSeedVersions: [{ suite_template_id: riseOfRomeSuite!.id, version: riseOfRomeSuite!.updated_at }],
      workspacePresetRows: [{ suite_template_id: riseOfRomeSuite!.id }],
      binders: [
        {
          id: "binder-rise-of-rome",
          owner_id: "system",
          title: "Rise of Rome",
          slug: "rise-of-rome",
          description: "Rome",
          subject: "History",
          level: "Foundations",
          status: "published",
          price_cents: 0,
          cover_url: null,
          pinned: true,
          created_at: riseOfRomeSuite!.created_at,
          updated_at: riseOfRomeSuite!.updated_at,
        },
      ],
      folders: [{ id: buildSystemFolderFromSuite(riseOfRomeSuite!).id }],
      lessonsByBinderId: {
        "binder-rise-of-rome": 8,
      },
    });

    expect(diagnostics.some((diagnostic) => diagnostic.code === "missing_public_binder")).toBe(false);
    expect(diagnostics.some((diagnostic) => diagnostic.code === "missing_folder")).toBe(false);
  });
});
