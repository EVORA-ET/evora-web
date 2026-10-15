import {
  CircleCheck,
  Bell,
  Info,
  LocateFixed,
  Route,
  ShieldAlert,
  TriangleAlert,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { AlertCategory, AlertSeverity } from "../dashboard/model/alerts";

const CATEGORY_ICON: Record<AlertCategory, LucideIcon> = {
  Maintenance: Wrench,
  Insurance: ShieldAlert,
  "Driver licence": UserRound,
  Route: Route,
  Telemetry: LocateFixed,
  Notifications: Bell,
};

const SEVERITY_ICON: Record<AlertSeverity, LucideIcon> = {
  critical: TriangleAlert,
  warning: TriangleAlert,
  info: Info,
  positive: CircleCheck,
};

interface AlertIconProps {
  category: AlertCategory;
  severity: AlertSeverity;
  size?: number;
}

export function AlertIcon({ category, severity, size = 18 }: AlertIconProps) {
  const Icon: LucideIcon =
    severity === "positive"
      ? SEVERITY_ICON.positive
      : (CATEGORY_ICON[category] ?? SEVERITY_ICON[severity]);

  return <Icon size={size} strokeWidth={1.8} />;
}
