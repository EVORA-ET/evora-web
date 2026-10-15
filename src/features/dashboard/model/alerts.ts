import { daysUntil, pluralize } from "../../../lib/format";
import {
  DELAY_ALERT_MINUTES,
  LICENSE_WARNING_DAYS,
  isOperational,
  vehicleIssues,
  type FleetIndex,
  type FleetSnapshot,
} from "./fleetModel";

export type AlertSeverity = "critical" | "warning" | "info" | "positive";

export type AlertCategory =
  | "Maintenance"
  | "Insurance"
  | "Driver licence"
  | "Route"
  | "Telemetry"
  | "Notifications";

export interface FleetAlert {
  /** Stable across polls so read / shown state survives refreshes. */
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  /** Short subject, e.g. a registration number or route name. */
  subject: string;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
}

export const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Information",
  positive: "Positive",
};

const RECENT_COMPLETION_HOURS = 24;

function minutesBetween(later: string, earlier: string): number | null {
  const a = new Date(later).getTime();
  const b = new Date(earlier).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 60000);
}

/**
 * Alerts are derived from data the backend already stores. There is no
 * alerts table yet, so nothing here is invented: every alert points at a
 * real vehicle, driver, route or trip row.
 */
export function buildAlerts(
  snapshot: FleetSnapshot,
  index: FleetIndex,
  now = new Date(),
): FleetAlert[] {
  const alerts: FleetAlert[] = [];

  /* Vehicles */
  for (const vehicle of snapshot.vehicles) {
    for (const issue of vehicleIssues(vehicle, now)) {
      const href = `/fleets?vehicle=${vehicle.id}`;

      if (issue.kind === "maintenance") {
        alerts.push({
          id: `maintenance:${vehicle.id}`,
          severity: "warning",
          category: "Maintenance",
          subject: vehicle.registration_number,
          title: "Under maintenance",
          detail: `${vehicle.registration_number} is marked as under maintenance and is unavailable for trips.`,
          href,
          actionLabel: "View vehicle",
        });
      }

      if (issue.kind === "insurance_expired") {
        alerts.push({
          id: `insurance-expired:${vehicle.id}:${vehicle.insurance_expiry}`,
          severity: "critical",
          category: "Insurance",
          subject: vehicle.registration_number,
          title: "Insurance expired",
          detail: `Insurance for ${vehicle.registration_number} expired ${pluralize(
            Math.abs(issue.days),
            "day",
          )} ago.`,
          href,
          actionLabel: "View vehicle",
        });
      }

      if (issue.kind === "insurance_soon") {
        alerts.push({
          id: `insurance-soon:${vehicle.id}:${vehicle.insurance_expiry}`,
          severity: "warning",
          category: "Insurance",
          subject: vehicle.registration_number,
          title: "Insurance expiring soon",
          detail:
            issue.days <= 0
              ? `Insurance for ${vehicle.registration_number} expires today.`
              : `Insurance for ${vehicle.registration_number} expires in ${pluralize(issue.days, "day")}.`,
          href,
          actionLabel: "View vehicle",
        });
      }
    }
  }

  /* Drivers */
  for (const driver of snapshot.drivers) {
    if (driver.status !== "active") continue;

    const days = daysUntil(driver.license_expiry, now);
    if (days === null) continue;

    const href = `/fleets?driver=${driver.id}`;

    if (days < 0) {
      alerts.push({
        id: `licence-expired:${driver.id}:${driver.license_expiry}`,
        severity: "critical",
        category: "Driver licence",
        subject: driver.name,
        title: "Licence expired",
        detail: `${driver.name}'s licence expired ${pluralize(Math.abs(days), "day")} ago.`,
        href,
        actionLabel: "View driver",
      });
    } else if (days <= LICENSE_WARNING_DAYS) {
      alerts.push({
        id: `licence-soon:${driver.id}:${driver.license_expiry}`,
        severity: "warning",
        category: "Driver licence",
        subject: driver.name,
        title: "Licence expiring soon",
        detail:
          days === 0
            ? `${driver.name}'s licence expires today.`
            : `${driver.name}'s licence expires in ${pluralize(days, "day")}.`,
        href,
        actionLabel: "View driver",
      });
    }
  }

  /* Trips in progress that are running late */
  for (const trip of snapshot.trips) {
    if (trip.status !== "IN_PROGRESS") continue;

    const delay = index.maxDelayByTrip.get(trip.id) ?? 0;
    if (delay < DELAY_ALERT_MINUTES) continue;

    const route = index.routeById.get(trip.job_template_id);
    const vehicle = index.vehicleById.get(trip.vehicle_id);
    const routeName = route?.name ?? "A route";

    alerts.push({
      id: `delay:${trip.id}`,
      severity: "warning",
      category: "Route",
      subject: routeName,
      title: "Running late",
      detail: `${routeName}${vehicle ? ` (${vehicle.registration_number})` : ""} is ${delay} min behind at a stop.`,
      href: `/fleets?route=${trip.job_template_id}`,
      actionLabel: "View route",
    });
  }

  /* Recently completed trips */
  for (const trip of snapshot.trips) {
    if (trip.status !== "COMPLETED" || !trip.actual_end_at) continue;

    const finishedAt = new Date(trip.actual_end_at).getTime();
    if (Number.isNaN(finishedAt)) continue;
    if (now.getTime() - finishedAt > RECENT_COMPLETION_HOURS * 3600 * 1000) continue;

    const route = index.routeById.get(trip.job_template_id);
    const routeName = route?.name ?? "A route";

    let detail = `${routeName} finished its trip.`;
    if (trip.scheduled_end_at) {
      const diff = minutesBetween(trip.scheduled_end_at, trip.actual_end_at);
      if (diff !== null && diff > 0) detail = `${routeName} finished ${diff} min ahead of schedule.`;
      else if (diff !== null && diff < 0) detail = `${routeName} finished ${Math.abs(diff)} min behind schedule.`;
      else if (diff === 0) detail = `${routeName} finished right on schedule.`;
    }

    alerts.push({
      id: `completed:${trip.id}`,
      severity: "positive",
      category: "Route",
      subject: routeName,
      title: "Trip completed",
      detail,
      href: `/fleets?route=${trip.job_template_id}`,
      actionLabel: "View route",
    });
  }

  /* Telemetry gaps */
  const silent = snapshot.vehicles.filter(
    (vehicle) =>
      isOperational(vehicle) &&
      !vehicle.current_location,
  ).length;

  if (silent > 0) {
    alerts.push({
      id: `no-location:${silent}`,
      severity: "info",
      category: "Telemetry",
      subject: "Fleet map",
      title: "Vehicles not reporting a location",
      detail: `${pluralize(silent, "operational vehicle")} ${silent === 1 ? "has" : "have"} no location yet, so ${
        silent === 1 ? "it" : "they"
      } can't appear on the map.`,
      href: "/fleets",
      actionLabel: "Manage fleet",
    });
  }

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
