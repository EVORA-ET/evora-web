/** Number formatting that never turns a missing value into zero. */

export function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatValue(
  value: number | string | null | undefined,
  unit?: string,
  maximumFractionDigits = 2,
): string {
  const n = num(value);
  if (n === null) return "—";
  const text = n.toLocaleString(undefined, { maximumFractionDigits });
  return unit ? `${text} ${unit}` : text;
}

export function formatMoney(
  value: number | string | null | undefined,
  currency: string | null | undefined,
  maximumFractionDigits = 0,
): string {
  const n = num(value);
  if (n === null) return "—";
  if (currency) {
    try {
      return n.toLocaleString(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits,
      });
    } catch {
      /* Unknown ISO code: fall back to plain number + code. */
    }
  }
  return `${n.toLocaleString(undefined, { maximumFractionDigits })}${currency ? ` ${currency}` : ""}`;
}

export function formatPct(fraction: number | null | undefined, digits = 1): string {
  if (fraction === null || fraction === undefined) return "—";
  return `${(fraction * 100).toLocaleString(undefined, { maximumFractionDigits: digits })}%`;
}

export function formatKg(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO₂e`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today in the browser's zone as YYYY-MM-DD. */
export function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
