import type { FleetMaintenanceRow } from "../../lib/intelligenceApi";

/** One non-overlapping maintenance state per vehicle, from its rule results. */
export type VehicleHealthState =
  | "overdue"
  | "due_soon"
  | "needs_info"
  | "not_due"
  | "no_requirements"
  | "not_evaluated";

export const HEALTH_STATE_LABEL: Record<VehicleHealthState, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  needs_info: "Needs information",
  not_due: "No requirement currently due",
  no_requirements: "No requirements configured",
  not_evaluated: "No maintenance records",
};

export const HEALTH_STATE_DEFINITION =
  "Each vehicle is counted once, by its most urgent requirement: overdue, then due soon, then any requirement that cannot be evaluated (missing baseline or odometer). \"No requirement currently due\" means every configured requirement is within its interval — not that the vehicle is mechanically healthy.";

export function healthStateOf(row: FleetMaintenanceRow | undefined): VehicleHealthState {
  if (!row) return "not_evaluated";
  const c = row.counts;
  if (c.overdue > 0) return "overdue";
  if (c.due_soon > 0) return "due_soon";
  if (c.undetermined > 0) return "needs_info";
  if (c.ok > 0) return "not_due";
  return "no_requirements";
}

/** The requirement that falls due first, if any has a determinable due point. */
export function nextDue(row: FleetMaintenanceRow | undefined) {
  const reqs = (row?.requirements ?? []).filter((r) => r.status !== "undetermined");
  return reqs.sort((a, b) => (a.days_remaining ?? Infinity) - (b.days_remaining ?? Infinity))[0];
}
