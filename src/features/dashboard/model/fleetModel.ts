import type {
  Depot,
  Driver,
  InstanceStop,
  JobInstance,
  JobInstanceStatus,
  JobTemplate,
  Vehicle,
} from "../../../lib/api";
import { daysUntil, toNumber } from "../../../lib/format";
import { pointToLatLng } from "../../../lib/geo";

/* ------------------------------------------------------------------ */
/* Raw data                                                            */
/* ------------------------------------------------------------------ */

export interface FleetSnapshot {
  vehicles: Vehicle[];
  drivers: Driver[];
  depots: Depot[];
  routes: JobTemplate[];
  trips: JobInstance[];
  stops: InstanceStop[];
}

export const EMPTY_SNAPSHOT: FleetSnapshot = {
  vehicles: [],
  drivers: [],
  depots: [],
  routes: [],
  trips: [],
  stops: [],
};

/* ------------------------------------------------------------------ */
/* Vehicle classification                                              */
/* ------------------------------------------------------------------ */

export type FleetCategory = "ev" | "ice";

/** EV or ICE. Everything that is not electric counts as ICE. */
export function fuelCategory(vehicle: Pick<Vehicle, "fuel_type">): FleetCategory {
  return vehicle.fuel_type === "ev" ? "ev" : "ice";
}

/**
 * on_trip    – has a trip in progress right now
 * idle       – operational, but not on a trip
 * attention  – under maintenance or insurance has lapsed
 * inactive   – inactive, retired or sold
 */
export type VehicleState = "on_trip" | "idle" | "attention" | "inactive";

export const VEHICLE_STATE_LABEL: Record<VehicleState, string> = {
  on_trip: "On a trip",
  idle: "Idle",
  attention: "Needs attention",
  inactive: "Inactive",
};

export const TRIP_STATUS_LABEL: Record<JobInstanceStatus, string> = {
  PENDING: "Pending",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";

  const text = value.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fuelLabel(fuelType: string): string {
  switch (fuelType) {
    case "ev":
      return "Electric";
    case "cng":
      return "CNG";
    case "lpg":
      return "LPG";
    default:
      return humanize(fuelType);
  }
}

export type VehicleIssue =
  | { kind: "maintenance" }
  | { kind: "insurance_expired"; days: number }
  | { kind: "insurance_soon"; days: number };

export const INSURANCE_WARNING_DAYS = 30;
export const LICENSE_WARNING_DAYS = 30;

const INACTIVE_STATUSES = new Set(["inactive", "retired", "sold"]);

export function isOperational(vehicle: Vehicle): boolean {
  return !INACTIVE_STATUSES.has(vehicle.status);
}

export function vehicleIssues(vehicle: Vehicle, now = new Date()): VehicleIssue[] {
  const issues: VehicleIssue[] = [];

  if (vehicle.status === "under_maintenance") {
    issues.push({ kind: "maintenance" });
  }

  if (isOperational(vehicle) || vehicle.status === "under_maintenance") {
    const days = daysUntil(vehicle.insurance_expiry, now);

    if (days !== null && days < 0) {
      issues.push({ kind: "insurance_expired", days });
    } else if (days !== null && days <= INSURANCE_WARNING_DAYS) {
      issues.push({ kind: "insurance_soon", days });
    }
  }

  return issues;
}

/* ------------------------------------------------------------------ */
/* Indexes                                                             */
/* ------------------------------------------------------------------ */

export interface FleetIndex {
  vehicleById: Map<string, Vehicle>;
  driverById: Map<string, Driver>;
  depotById: Map<string, Depot>;
  routeById: Map<string, JobTemplate>;
  tripById: Map<string, JobInstance>;
  /** Trip currently in progress for each vehicle. */
  liveTripByVehicle: Map<string, JobInstance>;
  /** Trips that are assigned or in progress, grouped by route. */
  openTripsByRoute: Map<string, JobInstance[]>;
  /** Largest stop delay (minutes) per trip, for trips with a positive delay. */
  maxDelayByTrip: Map<string, number>;
}

export function buildIndex(snapshot: FleetSnapshot): FleetIndex {
  const vehicleById = new Map(snapshot.vehicles.map((item) => [item.id, item]));
  const driverById = new Map(snapshot.drivers.map((item) => [item.id, item]));
  const depotById = new Map(snapshot.depots.map((item) => [item.id, item]));
  const routeById = new Map(snapshot.routes.map((item) => [item.id, item]));
  const tripById = new Map(snapshot.trips.map((item) => [item.id, item]));

  const liveTripByVehicle = new Map<string, JobInstance>();
  const openTripsByRoute = new Map<string, JobInstance[]>();

  for (const trip of snapshot.trips) {
    if (trip.status === "IN_PROGRESS") {
      if (trip.vehicle_id) liveTripByVehicle.set(trip.vehicle_id, trip);
    }

    if (trip.status === "IN_PROGRESS" || trip.status === "ASSIGNED") {
      const list = openTripsByRoute.get(trip.job_template_id) ?? [];
      list.push(trip);
      openTripsByRoute.set(trip.job_template_id, list);
    }
  }

  const maxDelayByTrip = new Map<string, number>();

  for (const stop of snapshot.stops) {
    const delay = stop.delay_minutes ?? 0;
    if (delay <= 0) continue;

    const current = maxDelayByTrip.get(stop.job_instance_id) ?? 0;
    if (delay > current) maxDelayByTrip.set(stop.job_instance_id, delay);
  }

  return {
    vehicleById,
    driverById,
    depotById,
    routeById,
    tripById,
    liveTripByVehicle,
    openTripsByRoute,
    maxDelayByTrip,
  };
}

export function vehicleState(
  vehicle: Vehicle,
  index: FleetIndex,
  now = new Date(),
): VehicleState {
  if (!isOperational(vehicle) && vehicle.status !== "under_maintenance") {
    return "inactive";
  }

  const blocking = vehicleIssues(vehicle, now).some(
    (issue) => issue.kind === "maintenance" || issue.kind === "insurance_expired",
  );
  if (blocking) return "attention";

  return index.liveTripByVehicle.has(vehicle.id) ? "on_trip" : "idle";
}

/* ------------------------------------------------------------------ */
/* Statistics                                                          */
/* ------------------------------------------------------------------ */

export interface DayBucket {
  key: string;
  label: string;
  trips: number;
  ev: number;
  ice: number;
  vehiclesUsed: number;
  /** Share of operational vehicles that ran at least one trip. */
  utilisation: number | null;
}

export interface CostSummary {
  vehiclesWithData: number;
  totalFuel: number;
  totalMaintenance: number;
  avgFuel: number | null;
  avgMaintenance: number | null;
  avgTotal: number | null;
}

export interface FleetStats {
  total: number;
  ev: number;
  ice: number;
  evShare: number | null;

  fuelCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  stateCounts: Record<VehicleState, number>;

  operational: number;
  activeStatus: number;
  withLocation: number;
  withoutLocation: number;

  tripCounts: Record<JobInstanceStatus, number>;
  tripsInProgress: number;
  delayedTrips: number;
  delayedStops: number;

  week: DayBucket[];
  weekAvgUtilisation: number | null;
  previousWeekAvgUtilisation: number | null;

  cost: { ev: CostSummary; ice: CostSummary };

  avgAgeYears: number | null;
  ageBuckets: { label: string; count: number }[];

  evBatteryTotalKwh: number;
  evBatteryAvgKwh: number | null;
  evBatteryCount: number;

  drivers: {
    total: number;
    active: number;
    onLeave: number;
    other: number;
    onTrip: number;
    vehiclesWithoutDriver: number;
  };
}

const TRIP_STATUSES: JobInstanceStatus[] = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const DELAY_ALERT_MINUTES = 15;

function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function tripDay(trip: JobInstance): Date | null {
  const raw = trip.actual_start_at ?? trip.scheduled_start_at;
  if (!raw) return null;

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function summariseCost(vehicles: Vehicle[]): CostSummary {
  let fuel = 0;
  let maintenance = 0;
  let count = 0;

  for (const vehicle of vehicles) {
    const fuelCost = toNumber(vehicle.fuel_cost_per_month);
    const maintenanceCost = toNumber(vehicle.maintenance_cost_per_month);

    if (fuelCost === null && maintenanceCost === null) continue;

    fuel += fuelCost ?? 0;
    maintenance += maintenanceCost ?? 0;
    count += 1;
  }

  return {
    vehiclesWithData: count,
    totalFuel: fuel,
    totalMaintenance: maintenance,
    avgFuel: count ? fuel / count : null,
    avgMaintenance: count ? maintenance / count : null,
    avgTotal: count ? (fuel + maintenance) / count : null,
  };
}

export function computeStats(
  snapshot: FleetSnapshot,
  index: FleetIndex,
  now = new Date(),
): FleetStats {
  const { vehicles, drivers, trips } = snapshot;

  const fuelCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const stateCounts: Record<VehicleState, number> = {
    on_trip: 0,
    idle: 0,
    attention: 0,
    inactive: 0,
  };

  let ev = 0;
  let withLocation = 0;
  let operational = 0;
  let activeStatus = 0;

  for (const vehicle of vehicles) {
    if (fuelCategory(vehicle) === "ev") ev += 1;

    fuelCounts[vehicle.fuel_type] = (fuelCounts[vehicle.fuel_type] ?? 0) + 1;
    typeCounts[vehicle.vehicle_type] = (typeCounts[vehicle.vehicle_type] ?? 0) + 1;
    statusCounts[vehicle.status] = (statusCounts[vehicle.status] ?? 0) + 1;
    stateCounts[vehicleState(vehicle, index, now)] += 1;

    if (pointToLatLng(vehicle.current_location)) withLocation += 1;
    if (isOperational(vehicle)) operational += 1;
    if (vehicle.status === "active") activeStatus += 1;
  }

  const total = vehicles.length;

  /* Trips */
  const tripCounts = Object.fromEntries(
    TRIP_STATUSES.map((status) => [status, 0]),
  ) as Record<JobInstanceStatus, number>;

  let delayedTrips = 0;
  for (const trip of trips) {
    tripCounts[trip.status] += 1;

    if (
      trip.status === "IN_PROGRESS" &&
      (index.maxDelayByTrip.get(trip.id) ?? 0) >= DELAY_ALERT_MINUTES
    ) {
      delayedTrips += 1;
    }
  }

  let delayedStops = 0;
  for (const stop of snapshot.stops) {
    const trip = index.tripById.get(stop.job_instance_id);
    if (trip?.status === "IN_PROGRESS" && (stop.delay_minutes ?? 0) >= DELAY_ALERT_MINUTES) {
      delayedStops += 1;
    }
  }

  /* Last 14 days, bucketed by local day (7 current + 7 previous). */
  const buckets = new Map<string, { trips: number; ev: number; ice: number; vehicles: Set<string> }>();
  const days: Date[] = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    days.push(date);
    buckets.set(dayKey(date), { trips: 0, ev: 0, ice: 0, vehicles: new Set() });
  }

  for (const trip of trips) {
    if (trip.status === "CANCELLED") continue;

    const started = tripDay(trip);
    if (!started) continue;

    const bucket = buckets.get(dayKey(started));
    if (!bucket) continue;

    bucket.trips += 1;
    if (trip.vehicle_id) bucket.vehicles.add(trip.vehicle_id);
    const vehicle = trip.vehicle_id ? index.vehicleById.get(trip.vehicle_id) : undefined;
    if (vehicle) {
      if (fuelCategory(vehicle) === "ev") bucket.ev += 1;
      else bucket.ice += 1;
    }
  }

  const allDays: DayBucket[] = days.map((date) => {
    const key = dayKey(date);
    const bucket = buckets.get(key)!;

    return {
      key,
      label: date.toLocaleDateString(undefined, { weekday: "short" }),
      trips: bucket.trips,
      ev: bucket.ev,
      ice: bucket.ice,
      vehiclesUsed: bucket.vehicles.size,
      utilisation: operational ? Math.min(100, (bucket.vehicles.size / operational) * 100) : null,
    };
  });

  const week = allDays.slice(7);
  const previous = allDays.slice(0, 7);

  const average = (list: DayBucket[]): number | null => {
    const values = list
      .map((day) => day.utilisation)
      .filter((value): value is number => value !== null);

    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const previousAverage = average(previous);
  const previousHasTrips = previous.some((day) => day.trips > 0);

  /* Costs */
  const evVehicles = vehicles.filter((vehicle) => fuelCategory(vehicle) === "ev");
  const iceVehicles = vehicles.filter((vehicle) => fuelCategory(vehicle) === "ice");

  /* Age */
  const year = now.getFullYear();
  const ages = vehicles
    .map((vehicle) => (vehicle.manufacture_year ? year - vehicle.manufacture_year : null))
    .filter((age): age is number => age !== null && age >= 0);

  const ageBuckets = [
    { label: "0–2 yrs", count: ages.filter((age) => age <= 2).length },
    { label: "3–5 yrs", count: ages.filter((age) => age >= 3 && age <= 5).length },
    { label: "6–8 yrs", count: ages.filter((age) => age >= 6 && age <= 8).length },
    { label: "9+ yrs", count: ages.filter((age) => age >= 9).length },
  ];

  /* EV batteries */
  const batteries = evVehicles
    .map((vehicle) => toNumber(vehicle.battery_capacity_kwh))
    .filter((value): value is number => value !== null);

  /* Drivers */
  const driversOnTrip = new Set(
    trips.filter((trip) => trip.status === "IN_PROGRESS").map((trip) => trip.driver_id),
  );

  return {
    total,
    ev,
    ice: total - ev,
    evShare: total ? (ev / total) * 100 : null,

    fuelCounts,
    typeCounts,
    statusCounts,
    stateCounts,

    operational,
    activeStatus,
    withLocation,
    withoutLocation: total - withLocation,

    tripCounts,
    tripsInProgress: tripCounts.IN_PROGRESS,
    delayedTrips,
    delayedStops,

    week,
    weekAvgUtilisation: average(week),
    previousWeekAvgUtilisation: previousHasTrips ? previousAverage : null,

    cost: { ev: summariseCost(evVehicles), ice: summariseCost(iceVehicles) },

    avgAgeYears: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : null,
    ageBuckets,

    evBatteryTotalKwh: batteries.reduce((sum, value) => sum + value, 0),
    evBatteryAvgKwh: batteries.length
      ? batteries.reduce((sum, value) => sum + value, 0) / batteries.length
      : null,
    evBatteryCount: batteries.length,

    drivers: {
      total: drivers.length,
      active: drivers.filter((driver) => driver.status === "active").length,
      onLeave: drivers.filter((driver) => driver.status === "on_leave").length,
      other: drivers.filter((driver) => !["active", "on_leave"].includes(driver.status)).length,
      onTrip: driversOnTrip.size,
      vehiclesWithoutDriver: vehicles.filter(
        (vehicle) => isOperational(vehicle) && !vehicle.assigned_driver_id,
      ).length,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Route helpers                                                       */
/* ------------------------------------------------------------------ */

export interface RouteSummary {
  route: JobTemplate;
  source: Depot | undefined;
  destination: Depot | undefined;
  inProgress: number;
  assigned: number;
  completed: number;
  delayed: number;
  vehicleIds: string[];
}

export function summariseRoute(
  route: JobTemplate,
  snapshot: FleetSnapshot,
  index: FleetIndex,
): RouteSummary {
  let inProgress = 0;
  let assigned = 0;
  let completed = 0;
  let delayed = 0;
  const vehicleIds = new Set<string>();

  for (const trip of snapshot.trips) {
    if (trip.job_template_id !== route.id) continue;

    if (trip.status === "IN_PROGRESS") {
      inProgress += 1;
      if (trip.vehicle_id) vehicleIds.add(trip.vehicle_id); if ((index.maxDelayByTrip.get(trip.id) ?? 0) >= DELAY_ALERT_MINUTES) delayed += 1;
    } else if (trip.status === "ASSIGNED") {
      assigned += 1;
      if (trip.vehicle_id) vehicleIds.add(trip.vehicle_id);
    } else if (trip.status === "COMPLETED") {
      completed += 1;
    }
  }

  return {
    route,
    source: index.depotById.get(route.source_depot_id),
    destination: route.destination_depot_id
      ? index.depotById.get(route.destination_depot_id)
      : undefined,
    inProgress,
    assigned,
    completed,
    delayed,
    vehicleIds: [...vehicleIds],
  };
}
