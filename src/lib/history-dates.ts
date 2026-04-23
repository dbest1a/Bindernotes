import type {
  HistoryDateEra,
  HistoryDatePrecision,
  HistoryEvent,
  HistoryEventTemplate,
  HistoryTimelineEvent,
} from "@/types";

export type HistoricalDateParts = {
  sort_year: number;
  sort_month: number | null;
  sort_day: number | null;
  era: HistoryDateEra;
  precision: HistoryDatePrecision;
  approximate: boolean;
};

export function compareHistoricalDates(left: HistoricalDateParts, right: HistoricalDateParts) {
  const leftEraYear = left.era === "bce" ? -Math.abs(left.sort_year) : left.sort_year;
  const rightEraYear = right.era === "bce" ? -Math.abs(right.sort_year) : right.sort_year;

  if (leftEraYear !== rightEraYear) {
    return leftEraYear - rightEraYear;
  }

  const leftMonth = left.sort_month ?? 0;
  const rightMonth = right.sort_month ?? 0;
  if (leftMonth !== rightMonth) {
    return leftMonth - rightMonth;
  }

  const leftDay = left.sort_day ?? 0;
  const rightDay = right.sort_day ?? 0;
  if (leftDay !== rightDay) {
    return leftDay - rightDay;
  }

  return Number(left.approximate) - Number(right.approximate);
}

export function sortHistoryEvents<T extends HistoryEventTemplate | HistoryEvent | HistoryTimelineEvent>(events: T[]) {
  return [...events].sort((left, right) => {
    const dateDelta = compareHistoricalDates(left, right);
    if (dateDelta !== 0) {
      return dateDelta;
    }

    return left.title.localeCompare(right.title);
  });
}

export function formatHistoricalDateLabel(input: HistoricalDateParts & { date_label?: string }) {
  if (input.date_label && input.date_label.trim().length > 0) {
    return input.date_label;
  }

  const year = `${Math.abs(input.sort_year)} ${input.era === "bce" ? "BCE" : "CE"}`;
  if (input.precision === "year" || !input.sort_month) {
    return input.approximate ? `c. ${year}` : year;
  }

  const month = monthLabels[input.sort_month - 1] ?? "";
  if (!input.sort_day) {
    return input.approximate ? `c. ${month} ${year}` : `${month} ${year}`;
  }

  return input.approximate ? `c. ${month} ${input.sort_day}, ${year}` : `${month} ${input.sort_day}, ${year}`;
}

const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
