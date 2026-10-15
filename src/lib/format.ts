const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from now until the given date string (negative = past). */
export function daysUntil(date: string | null | undefined, now = new Date()): number | null {
  if (!date) return null;

  const target = new Date(`${date}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;

  return Math.floor((target.getTime() - now.getTime()) / DAY_MS);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(date: Date | null): string {
  if (!date) return "—";

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
