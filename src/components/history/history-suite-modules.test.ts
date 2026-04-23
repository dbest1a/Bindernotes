import { describe, expect, it } from "vitest";
import {
  mergeHistorySources,
  mergeMythChecks,
  mergeTimelineEvents,
} from "@/components/history/history-suite-modules";
import type {
  HistoryEvent,
  HistoryEventTemplate,
  HistoryMythCheck,
  HistoryMythCheckTemplate,
  HistorySource,
  HistorySourceTemplate,
} from "@/types";

const now = "2026-04-23T00:00:00.000Z";

function makeTemplateEvent(input: Partial<HistoryEventTemplate> & Pick<HistoryEventTemplate, "id" | "title" | "sort_year">): HistoryEventTemplate {
  return {
    id: input.id,
    suite_template_id: "suite-history-demo",
    binder_id: "binder-french-revolution-history-suite",
    lesson_id: null,
    title: input.title,
    summary: input.summary ?? "",
    significance: input.significance ?? "",
    location_label: input.location_label ?? null,
    location_lat: input.location_lat ?? null,
    location_lng: input.location_lng ?? null,
    date_label: input.date_label ?? "",
    sort_year: input.sort_year,
    sort_month: input.sort_month ?? null,
    sort_day: input.sort_day ?? null,
    era: input.era ?? "ce",
    precision: input.precision ?? "year",
    approximate: input.approximate ?? false,
    themes: input.themes ?? [],
    created_at: now,
    updated_at: now,
  };
}

function makeUserEvent(
  input: Partial<HistoryEvent> &
    Pick<HistoryEvent, "id" | "title" | "sort_year">,
): HistoryEvent {
  return {
    ...makeTemplateEvent(input),
    owner_id: "user-1",
    template_event_id: input.template_event_id ?? null,
    status: input.status ?? "active",
  };
}

function makeTemplateSource(
  input: Partial<HistorySourceTemplate> &
    Pick<HistorySourceTemplate, "id" | "title" | "source_type">,
): HistorySourceTemplate {
  return {
    id: input.id,
    suite_template_id: "suite-history-demo",
    binder_id: "binder-french-revolution-history-suite",
    lesson_id: null,
    title: input.title,
    source_type: input.source_type,
    author: input.author ?? null,
    date_label: input.date_label ?? "",
    audience: input.audience ?? null,
    purpose: input.purpose ?? null,
    point_of_view: input.point_of_view ?? null,
    context_note: input.context_note ?? null,
    reliability_note: input.reliability_note ?? null,
    citation_url: input.citation_url ?? null,
    quote_text: input.quote_text ?? null,
    claim_supports: input.claim_supports ?? null,
    claim_challenges: input.claim_challenges ?? null,
    created_at: now,
    updated_at: now,
  };
}

function makeUserSource(
  input: Partial<HistorySource> &
    Pick<HistorySource, "id" | "title" | "source_type">,
): HistorySource {
  return {
    ...makeTemplateSource(input),
    owner_id: "user-1",
    template_source_id: input.template_source_id ?? null,
  };
}

function makeTemplateMyth(
  input: Partial<HistoryMythCheckTemplate> &
    Pick<HistoryMythCheckTemplate, "id" | "myth_text" | "status">,
): HistoryMythCheckTemplate {
  return {
    id: input.id,
    suite_template_id: "suite-history-demo",
    binder_id: "binder-french-revolution-history-suite",
    lesson_id: null,
    myth_text: input.myth_text,
    corrected_claim: input.corrected_claim ?? "",
    status: input.status,
    explanation: input.explanation ?? "",
    created_at: now,
    updated_at: now,
  };
}

function makeUserMyth(
  input: Partial<HistoryMythCheck> &
    Pick<HistoryMythCheck, "id" | "myth_text" | "status">,
): HistoryMythCheck {
  return {
    ...makeTemplateMyth(input),
    owner_id: "user-1",
    template_myth_check_id: input.template_myth_check_id ?? null,
  };
}

describe("history-suite-modules merge helpers", () => {
  it("merges timeline templates and user events without duplicates", () => {
    const templateEvents = [
      makeTemplateEvent({
        id: "event-a",
        title: "Template A",
        sort_year: 1789,
      }),
      makeTemplateEvent({
        id: "event-b",
        title: "Template B",
        sort_year: 1790,
      }),
    ];

    const userEvents = [
      makeUserEvent({
        id: "event-a-user-old",
        template_event_id: "event-a",
        title: "User A old",
        sort_year: 1789,
        updated_at: "2026-04-20T10:00:00.000Z",
      }),
      makeUserEvent({
        id: "event-a-user-new",
        template_event_id: "event-a",
        title: "User A new",
        sort_year: 1789,
        updated_at: "2026-04-21T10:00:00.000Z",
      }),
      makeUserEvent({
        id: "event-c-user",
        title: "User C",
        sort_year: 1791,
      }),
    ];

    const merged = mergeTimelineEvents(templateEvents, userEvents);

    expect(merged).toHaveLength(3);
    expect(merged.find((event) => event.title === "User A new")).toBeTruthy();
    expect(merged.find((event) => event.title === "User A old")).toBeFalsy();
    expect(merged.find((event) => event.title === "Template B")).toBeTruthy();
    expect(merged.find((event) => event.title === "User C")).toBeTruthy();
  });

  it("merges source templates with user overrides and keeps stable ordering", () => {
    const templateSources = [
      makeTemplateSource({
        id: "source-a",
        title: "Template Primary",
        source_type: "primary",
      }),
      makeTemplateSource({
        id: "source-b",
        title: "Template Secondary",
        source_type: "secondary",
      }),
    ];

    const userSources = [
      makeUserSource({
        id: "source-a-user",
        template_source_id: "source-a",
        title: "User Primary Override",
        source_type: "primary",
        updated_at: "2026-04-21T09:00:00.000Z",
      }),
      makeUserSource({
        id: "source-c-user",
        title: "User Secondary",
        source_type: "secondary",
      }),
    ];

    const merged = mergeHistorySources(templateSources, userSources);

    expect(merged).toHaveLength(3);
    expect(merged[0].source_type).toBe("primary");
    expect(merged.find((source) => source.title === "User Primary Override")).toBeTruthy();
    expect(merged.find((source) => source.title === "Template Primary")).toBeFalsy();
  });

  it("merges myth cards with template overrides and status ordering", () => {
    const templateMyths = [
      makeTemplateMyth({
        id: "myth-a",
        myth_text: "Template myth",
        status: "myth",
      }),
      makeTemplateMyth({
        id: "myth-b",
        myth_text: "Template contested",
        status: "contested",
      }),
    ];

    const userMyths = [
      makeUserMyth({
        id: "myth-a-user",
        template_myth_check_id: "myth-a",
        myth_text: "User corrected myth",
        corrected_claim: "Correction",
        status: "evidence_supported",
        updated_at: "2026-04-22T09:00:00.000Z",
      }),
      makeUserMyth({
        id: "myth-c-user",
        myth_text: "User oversimplification",
        status: "oversimplification",
      }),
    ];

    const merged = mergeMythChecks(templateMyths, userMyths);

    expect(merged).toHaveLength(3);
    expect(merged.find((myth) => myth.myth_text === "User corrected myth")).toBeTruthy();
    expect(merged.find((myth) => myth.myth_text === "Template myth")).toBeFalsy();
    expect(merged[0].status).toBe("oversimplification");
  });
});

