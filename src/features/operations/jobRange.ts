import { localToday, shiftDate } from "./format";

export type JobRange = "day" | "week" | "upcoming" | "all";

export const RANGE_OPTIONS: { value: JobRange; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
];

/** Date filters for the jobs API. Dates are interpreted in the browser's zone (`tz`). */
export function rangeParams(range: string, date: string): Record<string, string> {
  switch (range) {
    case "day":
      return { date };
    case "week":
      return { date_from: date, date_to: shiftDate(date, 6) };
    case "upcoming":
      return { date_from: localToday() };
    default:
      return {};
  }
}
