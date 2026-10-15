import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export type WidgetCategory =
  | "Fleet"
  | "Operations"
  | "EV Migration"
  | "Health & Maintenance"
  | "Battery Health"
  | "Insights";

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  "Fleet",
  "Operations",
  "EV Migration",
  "Health & Maintenance",
  "Battery Health",
  "Insights",
];

/** How the widget presents its answer — shown as a tag in the library. */
export type WidgetStyle = "Number" | "Donut" | "Bars" | "Line" | "List" | "Ring" | "Insight";

/** Grid units: 12 columns, 24px rows. */
export interface WidgetSize {
  w: number;
  h: number;
}

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  style: WidgetStyle;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  /** "brand" renders the widget on the forest-green surface. */
  tone?: "default" | "brand";
  keywords?: string[];

  /** Widgets with a Component are live; others are listed as coming soon. */
  Component?: ComponentType;
  /** For coming-soon widgets: what data the widget is waiting for. */
  needs?: string;
}

export const SIZE_PRESETS: { key: string; label: string; size: WidgetSize }[] = [
  { key: "small", label: "Small", size: { w: 4, h: 6 } },
  { key: "medium", label: "Medium", size: { w: 6, h: 8 } },
  { key: "large", label: "Large", size: { w: 8, h: 10 } },
  { key: "wide", label: "Wide", size: { w: 12, h: 8 } },
];
