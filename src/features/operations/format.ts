import type { JobInstanceStatus } from "../../lib/api";

/** Today as YYYY-MM-DD in the browser's local zone (not UTC). */
export function localToday(): string {
  const now = new Date();
  return toDateInput(now);
}

export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return toDateInput(new Date(y, m - 1, d + days));
}

/** ISO instant -> value for <input type="datetime-local"> in local time. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${toDateInput(date)}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/** <input type="datetime-local"> value -> ISO instant (local time -> UTC). */
export function fromDateTimeInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatTimeOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWindow(start: string | null, end: string | null): string {
  if (!start) return "Not scheduled";
  const s = new Date(start);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (!end) return formatDateTime(start);
  const e = new Date(end);
  return sameDay(s, e)
    ? `${formatDateTime(start)} – ${formatTimeOnly(end)}`
    : `${formatDateTime(start)} – ${formatDateTime(end)}`;
}

export function formatDateLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatPercent(rate: number | null): string {
  return rate === null ? "—" : `${rate.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const JOB_STATUS_LABEL: Record<JobInstanceStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function fuelLabel(fuel: string): string {
  switch (fuel) {
    case "ev":
      return "Electric";
    case "cng":
    case "lpg":
      return fuel.toUpperCase();
    default:
      return humanize(fuel);
  }
}

export function plural(count: number, one: string, many?: string): string {
  return `${count.toLocaleString()} ${count === 1 ? one : (many ?? `${one}s`)}`;
}
