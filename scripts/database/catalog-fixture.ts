import { buildSystemSeedPayload } from "../../src/services/system-seed-service";
import { mathSeedChoices, mathSeedCourses, mathSeedModules, mathSeedQuestions, mathSeedTopics } from "../../src/lib/math-learning-seeds";

// Deterministic repository content only. No environment loading or remote calls.
const operatorId = process.argv[2] ?? "10000000-0000-4000-8000-000000000004";
if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(operatorId)) throw new Error("Expected disposable operator UUID");
const payload = buildSystemSeedPayload({
  id: operatorId, email: "admin@disposable.invalid",
  full_name: "Disposable operator", role: "admin", created_at: "2026-09-17T00:00:00Z", updated_at: "2026-09-17T00:00:00Z",
});
process.stdout.write(JSON.stringify({
  suite_templates: payload.suites, folders: payload.folders, binders: payload.binders,
  binder_lessons: payload.lessons, folder_binders: payload.folderBinders,
  concept_nodes: payload.conceptNodes, concept_edges: payload.conceptEdges,
  workspace_presets: payload.workspacePresets, history_event_templates: payload.historyEventTemplates,
  history_source_templates: payload.historySourceTemplates, history_myth_check_templates: payload.historyMythCheckTemplates,
  seed_versions: payload.seedVersions, math_courses: mathSeedCourses, math_topics: mathSeedTopics,
  math_modules: mathSeedModules, question_bank: mathSeedQuestions, question_choices: mathSeedChoices,
}));
