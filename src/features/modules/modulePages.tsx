import { Activity, Leaf, Settings, Truck, Zap } from "lucide-react";

import ModulePage from "./ModulePage";

export function ManageFleetsPage() {
  return (
    <ModulePage
      icon={Truck}
      title="Manage Fleets"
      description="Add, import and update your vehicles, drivers, depots and routes. This page is next on the build list."
    />
  );
}

export function EvMigrationPage() {
  return (
    <ModulePage
      icon={Zap}
      title="EV Migration"
      description="Readiness scores, transition candidates and migration reports will live here."
    />
  );
}

export function HealthMaintenancePage() {
  return (
    <ModulePage
      icon={Activity}
      title="Health & Maintenance"
      description="Maintenance schedules, vehicle health and battery status will live here."
    />
  );
}

export function ReportsPage() {
  return (
    <ModulePage
      icon={Leaf}
      title="Carbon Footprints & Reports"
      description="Emissions, savings and exportable reports will live here."
    />
  );
}

export function SettingsPage() {
  return (
    <ModulePage
      icon={Settings}
      title="Settings"
      description="Profile, account and organisation settings will live here."
    />
  );
}
