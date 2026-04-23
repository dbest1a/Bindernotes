import { describe, expect, it } from "vitest";
import { compareHistoricalDates, formatHistoricalDateLabel, sortHistoryEvents } from "@/lib/history-dates";
import type { HistoryEventTemplate } from "@/types";

const baseEvent = {
  suite_template_id: "suite-history-demo",
  binder_id: "binder-history",
  lesson_id: null,
  summary: "summary",
  significance: "significance",
  location_label: null,
  location_lat: null,
  location_lng: null,
  themes: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
} satisfies Omit<
  HistoryEventTemplate,
  "id" | "title" | "date_label" | "sort_year" | "sort_month" | "sort_day" | "era" | "precision" | "approximate"
>;

describe("history-dates", () => {
  it("sorts BCE before CE and then by month/day", () => {
    const events: HistoryEventTemplate[] = [
      {
        ...baseEvent,
        id: "ce",
        title: "Augustus becomes emperor",
        date_label: "27 BCE",
        sort_year: 27,
        sort_month: 1,
        sort_day: 16,
        era: "bce",
        precision: "day",
        approximate: false,
      },
      {
        ...baseEvent,
        id: "later-bce",
        title: "Founding myth",
        date_label: "753 BCE",
        sort_year: 753,
        sort_month: null,
        sort_day: null,
        era: "bce",
        precision: "year",
        approximate: false,
      },
      {
        ...baseEvent,
        id: "ce-2",
        title: "Edict of Milan",
        date_label: "313 CE",
        sort_year: 313,
        sort_month: null,
        sort_day: null,
        era: "ce",
        precision: "year",
        approximate: false,
      },
    ];

    expect(sortHistoryEvents(events).map((event) => event.id)).toEqual([
      "later-bce",
      "ce",
      "ce-2",
    ]);
  });

  it("treats approximate dates as later than exact dates on the same day", () => {
    expect(
      compareHistoricalDates(
        {
          sort_year: 1789,
          sort_month: 7,
          sort_day: 14,
          era: "ce",
          precision: "day",
          approximate: false,
        },
        {
          sort_year: 1789,
          sort_month: 7,
          sort_day: 14,
          era: "ce",
          precision: "approximate",
          approximate: true,
        },
      ),
    ).toBeLessThan(0);
  });

  it("formats approximate BCE labels cleanly", () => {
    expect(
      formatHistoricalDateLabel({
        sort_year: 44,
        sort_month: null,
        sort_day: null,
        era: "bce",
        precision: "year",
        approximate: true,
      }),
    ).toBe("c. 44 BCE");
  });
});
