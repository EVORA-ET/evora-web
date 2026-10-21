/** Chart colours (CSS variables defined in charts.css). EV is always green, ICE amber. */
export const SERIES = {
  ev: "var(--chart-ev)",
  ice: "var(--chart-ice)",
  maintenance: "var(--chart-maint)",
  unknown: "var(--chart-unknown)",
  danger: "var(--chart-danger)",
  warn: "var(--chart-warn)",
  ok: "var(--chart-ok)",
} as const;
