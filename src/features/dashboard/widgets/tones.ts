export type Tone = "primary" | "green" | "mint" | "amber" | "slate" | "error" | "muted";

export const TONE_VAR: Record<Tone, string> = {
  primary: "var(--color-primary)",
  green: "var(--color-primary-container)",
  mint: "var(--color-on-primary-container)",
  amber: "var(--color-amber)",
  slate: "var(--color-tertiary)",
  error: "var(--color-error)",
  muted: "var(--color-outline-variant)",
};
