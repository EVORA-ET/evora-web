import type { JobInstanceStatus } from "../../../lib/api";
import type { Tone } from "./Pill";

export function jobTone(status: JobInstanceStatus): Tone {
  switch (status) {
    case "COMPLETED":
      return "ok";
    case "IN_PROGRESS":
      return "info";
    case "ASSIGNED":
      return "neutral";
    case "CANCELLED":
      return "danger";
    default:
      return "warn";
  }
}

export function vehicleTone(status: string): Tone {
  if (status === "active") return "ok";
  if (status === "under_maintenance") return "warn";
  if (status === "inactive") return "neutral";
  return "danger";
}

export function driverTone(status: string): Tone {
  if (status === "active") return "ok";
  if (status === "on_leave" || status === "inactive") return "warn";
  return "danger";
}

export function routeTone(status: string): Tone {
  if (status === "ACTIVE") return "ok";
  if (status === "PAUSED") return "warn";
  return "neutral";
}
