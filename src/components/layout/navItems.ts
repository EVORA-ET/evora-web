import {
  Activity,
  Leaf,
  LayoutDashboard,
  Settings,
  Truck,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/fleets", label: "Operations", icon: Truck },
  { to: "/ev-migration", label: "EV Migration", icon: Zap },
  { to: "/health", label: "Health & Maintenance", icon: Activity },
  { to: "/reports", label: "Carbon Footprints & Reports", icon: Leaf },
  { to: "/settings", label: "Settings", icon: Settings },
];
