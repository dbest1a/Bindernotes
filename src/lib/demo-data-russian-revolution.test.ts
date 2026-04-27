import { describe, expect, it } from "vitest";
import { mergeTimelineEvents } from "@/components/history/history-suite-modules";
import { extractRenderablePlainText } from "@/lib/highlights";
import {
  demoBinders,
  demoConceptNodes,
  demoFolderBinders,
  demoFolders,
  demoLessons,
} from "@/lib/demo-data";
import {
  russianRevolutionEventTemplates,
  russianRevolutionMythCheckTemplates,
  russianRevolutionSourceTemplates,
} from "@/lib/russian-revolution-seeds";
import { buildSystemSeedPayload } from "@/services/system-seed-service";
import type { Profile } from "@/types";

describe("Russian Revolution history binder", () => {
  it("adds a public Russian Revolution set in the History folder", () => {
    const binder = demoBinders.find((candidate) => candidate.id === "binder-russian-revolution");
    expect(binder?.title).toBe("The Russian Revolution");
    expect(binder?.description).toContain("From Imperial Collapse to Bolshevik Power");
    expect(binder?.subject).toBe("History");
    expect(binder?.status).toBe("published");

    const historyFolder = demoFolders.find((folder) => folder.name === "History");
    expect(historyFolder).toBeTruthy();
    expect(demoFolderBinders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          folder_id: historyFolder!.id,
          binder_id: "binder-russian-revolution",
        }),
      ]),
    );
  });

  it("includes the requested premium section structure without placeholders", () => {
    const lessons = demoLessons.filter((lesson) => lesson.binder_id === "binder-russian-revolution");
    expect(lessons).toHaveLength(15);
    expect(lessons.map((lesson) => lesson.title)).toEqual([
      "Overview: From Imperial Collapse to Bolshevik Power",
      "Long-Term Causes: Autocracy, Land, Labor, and Ideas",
      "1905 Revolution: Rehearsal, Warning, and Missed Reform",
      "World War I and the Collapse of Tsarism",
      "February Revolution: Bread, Mutiny, Abdication, Dual Power",
      "Lenin and Bolshevik Strategy",
      "July Days and Kornilov Affair: Crisis Before October",
      "October Revolution: Coup, Revolution, or Both?",
      "Bolshevik Consolidation: Peace, Land, Assembly, Cheka",
      "Russian Civil War: Reds, Whites, War Communism, Red Terror",
      "Kronstadt, NEP, USSR, and Lenin's Death",
      "Key People Cards",
      "Maps, Geography, and Related Concepts",
      "Historiography and Comparison Cards",
      "Vocabulary, Practice, DBQ, and Why It Matters",
    ]);

    const text = lessons.map((lesson) => extractRenderablePlainText(lesson.content)).join("\n");
    for (const required of [
      "Timeline",
      "Evidence",
      "Argument builder",
      "Myth checks",
      "Nicholas II",
      "Lenin",
      "Trotsky",
      "Kerensky",
      "Kornilov",
      "Stalin",
      "DBQ-style prompt",
      "10 multiple-choice questions",
      "Answer key with explanations",
      "Was the October Revolution a popular revolution or a Bolshevik coup?",
      "Why it changed the twentieth century",
    ]) {
      expect(text).toContain(required);
    }

    expect(text.toLowerCase()).not.toContain("coming soon");
    expect(text.toLowerCase()).not.toContain("placeholder");
    expect(text.toLowerCase()).not.toContain("lorem ipsum");
  });

  it("uses the History Suite timeline with rich dated events", () => {
    expect(russianRevolutionEventTemplates.length).toBeGreaterThanOrEqual(23);

    const merged = mergeTimelineEvents(russianRevolutionEventTemplates, []);
    expect(merged.map((event) => event.title)).toEqual(
      expect.arrayContaining([
        "Emancipation of the serfs",
        "Bloody Sunday",
        "October Manifesto",
        "Russia enters World War I",
        "February Revolution",
        "Nicholas II abdicates",
        "Lenin returns and issues the April Theses",
        "July Days",
        "Kornilov Affair",
        "October Revolution",
        "Constituent Assembly dissolved",
        "Treaty of Brest-Litovsk",
        "Russian Civil War",
        "Kronstadt rebellion and NEP",
        "USSR formed",
        "Lenin dies",
      ]),
    );

    for (const event of russianRevolutionEventTemplates) {
      expect(event.summary.length).toBeGreaterThan(40);
      expect(event.significance.length).toBeGreaterThan(40);
      expect(event.themes.length).toBeGreaterThan(1);
    }

    const sorted = [...merged].sort((left, right) => left.sort_year - right.sort_year);
    expect(sorted[0].title).toBe("Emancipation of the serfs");
    expect(sorted.at(-1)?.title).toBe("Lenin dies");
  });

  it("populates source evidence, myth checks, and related concept cards", () => {
    expect(russianRevolutionSourceTemplates.length).toBeGreaterThanOrEqual(8);
    expect(russianRevolutionSourceTemplates.map((source) => source.title)).toEqual(
      expect.arrayContaining([
        "OpenStax World History: Russia and the War's End",
        "Encyclopaedia Britannica: Russian Revolution",
        "Nicholas II Abdication Manifesto",
        "Lenin's April Theses",
        "Decree on Peace",
        "Decree on Land",
        "Treaty of Brest-Litovsk",
      ]),
    );
    for (const source of russianRevolutionSourceTemplates) {
      expect(source.claim_supports).toBeTruthy();
      expect(source.reliability_note).toBeTruthy();
      if (source.citation_url) {
        expect(source.citation_url).toMatch(/^https:\/\//);
      }
    }

    expect(russianRevolutionMythCheckTemplates.map((myth) => myth.status)).toEqual(
      expect.arrayContaining(["myth", "oversimplification", "contested"]),
    );

    const conceptLabels = demoConceptNodes
      .filter((node) => node.binder_id === "binder-russian-revolution")
      .map((node) => node.label);
    expect(conceptLabels).toEqual(
      expect.arrayContaining([
        "Autocracy",
        "Dual Power",
        "Bolshevik",
        "Menshevik",
        "Cheka",
        "War Communism",
        "New Economic Policy",
        "Nicholas II",
        "Lenin",
        "Trotsky",
        "Kronstadt",
        "Brest-Litovsk",
      ]),
    );
  });

  it("is included in the system seed payload alongside existing history sets", () => {
    const profile: Profile = {
      id: "admin-test",
      email: "admin@example.test",
      full_name: "Admin",
      role: "admin",
      created_at: "2026-04-26T00:00:00.000Z",
      updated_at: "2026-04-26T00:00:00.000Z",
    };
    const payload = buildSystemSeedPayload(profile);

    expect(payload.binders.map((binder) => binder.id)).toEqual(
      expect.arrayContaining([
        "binder-rise-of-rome",
        "binder-french-revolution-history-suite",
        "binder-russian-revolution",
      ]),
    );
    expect(payload.lessons.filter((lesson) => lesson.binder_id === "binder-russian-revolution")).toHaveLength(15);
    expect(payload.historyEventTemplates.filter((event) => event.binder_id === "binder-russian-revolution")).toHaveLength(
      russianRevolutionEventTemplates.length,
    );
    expect(payload.folderBinders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          binder_id: "binder-russian-revolution",
        }),
      ]),
    );
  });
});
