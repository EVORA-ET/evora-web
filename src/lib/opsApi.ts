/**
 * Typed calls for the Operations workspaces.
 *
 * Reuses `apiFetch` from ./api (auth, base URL, error handling); nothing here
 * talks to the network directly. Every list call goes through the backend's
 * opt-in pagination (`page`/`page_size`), so lists stay fast as data grows.
 */
import {
  apiFetch,
  type Depot,
  type Driver,
  type GeoPoint,
  type JobInstance,
  type JobInstanceStatus,
  type JobTemplate,
  type JobTemplateStatus,
  type Vehicle,
} from "./api";

/* ------------------------------------------------------------------ */
/* Query helpers                                                       */
/* ------------------------------------------------------------------ */

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

/** The browser's IANA zone: what the Dashboard already uses for "today". */
export const BROWSER_TZ: string =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function qs(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export interface Paged<T> {
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
  results: T[];
}

export interface ListParams extends Query {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
}

function body(input: unknown): RequestInit["body"] {
  return JSON.stringify(input);
}

/* ------------------------------------------------------------------ */
/* Depots                                                              */
/* ------------------------------------------------------------------ */

export interface OpsDepot extends Depot {
  vehicle_count: number;
  ev_count: number;
  fleet_count: number;
  route_count: number;
}

export interface DepotInput {
  name: string;
  address: string;
  location?: { type: "Point"; coordinates: [number, number] } | null;
  parking_capacity?: number;
  workshop_available?: boolean;
  fuel_station_available?: boolean;
  charging_available?: boolean;
  charger_count?: number;
  maintenance_bays?: number;
  depot_manager_name?: string;
  depot_manager_contact?: string;
}

export const listDepotsPage = (p: ListParams) =>
  apiFetch<Paged<OpsDepot>>(`/depot${qs({ page: 1, ...p })}`);
export const getDepot = (id: string) => apiFetch<OpsDepot>(`/depot/${id}`);
export const createDepotRecord = (input: DepotInput) =>
  apiFetch<Depot>("/depot", { method: "POST", body: body(input) });
export const updateDepot = (id: string, input: Partial<DepotInput>) =>
  apiFetch<OpsDepot>(`/depot/${id}`, { method: "PATCH", body: body(input) });
export const deleteDepot = (id: string) =>
  apiFetch<void>(`/depot/${id}`, { method: "DELETE" });

/* ------------------------------------------------------------------ */
/* Fleets                                                              */
/* ------------------------------------------------------------------ */

export interface Fleet {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  vehicle_count: number;
  ev_count: number;
  ice_count: number;
  active_count: number;
  created_at: string;
  updated_at: string;
}

export interface FleetDetail extends Fleet {
  depots: { depot_id: string | null; depot_name: string | null; vehicle_count: number }[];
  status_counts: Record<string, number>;
}

export interface FleetInput {
  name: string;
  description?: string;
}

export const listFleetsPage = (p: ListParams) =>
  apiFetch<Paged<Fleet>>(`/fleet${qs({ page: 1, ...p })}`);
export const getFleet = (id: string) => apiFetch<FleetDetail>(`/fleet/${id}`);
export const createFleet = (input: FleetInput) =>
  apiFetch<Fleet>("/fleet", { method: "POST", body: body(input) });
export const updateFleet = (id: string, input: Partial<FleetInput>) =>
  apiFetch<FleetDetail>(`/fleet/${id}`, { method: "PATCH", body: body(input) });
export const deleteFleet = (id: string) =>
  apiFetch<void>(`/fleet/${id}`, { method: "DELETE" });
export const changeFleetVehicles = (
  id: string,
  change: { add?: string[]; remove?: string[] },
) =>
  apiFetch<FleetDetail>(`/fleet/${id}/vehicles`, {
    method: "POST",
    body: body(change),
  });

/* ------------------------------------------------------------------ */
/* Vehicles                                                            */
/* ------------------------------------------------------------------ */

export interface CurrentJob {
  id: string;
  status: JobInstanceStatus;
  job_template_id: string;
  job_template_name: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
}

export interface OpsVehicle extends Vehicle {
  fleet_name: string | null;
  depot_name: string | null;
  open_job_count?: number;
  current_job?: CurrentJob | null;
}

export interface VehicleInput {
  registration_number: string;
  manufacturer: string;
  model: string;
  variant?: string | null;
  manufacture_year: number;
  purchase_date: string;
  vehicle_type: string;
  fuel_type: string;
  vin?: string | null;
  chassis_number?: string | null;
  engine_cc?: number | null;
  fuel_tank_capacity?: string | null;
  battery_capacity_kwh?: string | null;
  mileage_kmpl: string;
  payload_kg: string;
  seating_capacity: number;
  gvw_kg: string;
  status?: string;
  insurance_expiry?: string | null;
  fleet_id?: string | null;
  depot_id?: string | null;
}

export const listVehiclesPage = (p: ListParams) =>
  apiFetch<Paged<OpsVehicle>>(
    `/vehicle${qs({ page: 1, tz: BROWSER_TZ, ...p })}`,
  );
export const getVehicle = (id: string) =>
  apiFetch<OpsVehicle>(`/vehicle/${id}`);
export const createVehicleRecord = (input: VehicleInput) =>
  apiFetch<OpsVehicle>("/vehicle", { method: "POST", body: body(input) });
export const updateVehicle = (id: string, input: Partial<VehicleInput>) =>
  apiFetch<OpsVehicle>(`/vehicle/${id}`, { method: "PATCH", body: body(input) });
export const deleteVehicle = (id: string) =>
  apiFetch<void>(`/vehicle/${id}`, { method: "DELETE" });

/* ------------------------------------------------------------------ */
/* Drivers                                                             */
/* ------------------------------------------------------------------ */

export interface OpsDriver extends Driver {
  date_of_birth: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  languages: string[];
  open_job_count?: number;
  current_job?: CurrentJob | null;
}

export interface DriverInput {
  driver_code: string;
  name: string;
  date_of_birth: string;
  license_number: string;
  license_class: string;
  license_expiry: string;
  experience_years: string;
  status?: string;
  shift?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  languages?: string[];
}

export const listDriversPage = (p: ListParams) =>
  apiFetch<Paged<OpsDriver>>(`/driver${qs({ page: 1, tz: BROWSER_TZ, ...p })}`);
export const getDriver = (id: string) => apiFetch<OpsDriver>(`/driver/${id}`);
export const createDriverRecord = (input: DriverInput) =>
  apiFetch<OpsDriver>("/driver", { method: "POST", body: body(input) });
export const updateDriver = (id: string, input: Partial<DriverInput>) =>
  apiFetch<OpsDriver>(`/driver/${id}`, { method: "PATCH", body: body(input) });
export const deleteDriver = (id: string) =>
  apiFetch<void>(`/driver/${id}`, { method: "DELETE" });

/* ------------------------------------------------------------------ */
/* Routes (job templates)                                              */
/* ------------------------------------------------------------------ */

export interface Route extends JobTemplate {
  source_depot_name: string;
  destination_depot_name: string | null;
  job_count?: number;
  upcoming_job_count?: number;
}

export interface RouteInput {
  name: string;
  source_depot_id: string;
  destination_depot_id?: string | null;
  description?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  is_permanent?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  estimated_duration_minutes?: number | null;
  estimated_distance_km?: string | null;
  estimated_energy_kwh?: string | null;
  status?: JobTemplateStatus;
}

export const listRoutesPage = (p: ListParams) =>
  apiFetch<Paged<Route>>(`/job-template${qs({ page: 1, ...p })}`);
export const getRoute = (id: string) => apiFetch<Route>(`/job-template/${id}`);
export const createRouteRecord = (input: RouteInput) =>
  apiFetch<Route>("/job-template", { method: "POST", body: body(input) });
export const updateRoute = (id: string, input: Partial<RouteInput>) =>
  apiFetch<Route>(`/job-template/${id}`, { method: "PATCH", body: body(input) });
export const deleteRoute = (id: string) =>
  apiFetch<void>(`/job-template/${id}`, { method: "DELETE" });

/* ------------------------------------------------------------------ */
/* Jobs (job instances) and assignment                                 */
/* ------------------------------------------------------------------ */

export type AssignmentState =
  | "assigned"
  | "unassigned"
  | "missing_vehicle"
  | "missing_driver";

export interface Job extends JobInstance {
  job_template_name: string;
  source_depot_id: string;
  source_depot_name: string;
  destination_depot_id: string | null;
  destination_depot_name: string | null;
  vehicle_registration_number: string | null;
  vehicle_label: string | null;
  driver_name: string | null;
  driver_code: string | null;
  assignment_state: AssignmentState;
}

export interface JobStopRow {
  id: string;
  stop_id: string;
  stop_name: string;
  stop_address: string;
  stop_type: string;
  sequence_number: number;
  status: string;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  actual_departure: string | null;
  delay_minutes: number | null;
  notes: string;
}

export interface JobDetail extends Job {
  template: {
    id: string;
    name: string;
    description: string;
    status: JobTemplateStatus;
    is_recurring: boolean;
    estimated_duration_minutes: number | null;
    estimated_distance_km: string | null;
    estimated_energy_kwh: string | null;
  };
  stops: JobStopRow[];
}

export interface JobInput {
  job_template_id: string;
  scheduled_start_at: string;
  scheduled_end_at?: string | null;
  vehicle_id?: string | null;
  driver_id?: string | null;
}

export const listJobsPage = (p: ListParams) =>
  apiFetch<Paged<Job>>(`/job-instance${qs({ page: 1, tz: BROWSER_TZ, ...p })}`);
export const getJob = (id: string) => apiFetch<JobDetail>(`/job-instance/${id}`);
export const createJob = (input: JobInput) =>
  apiFetch<Job>(`/job-instance${qs({ tz: BROWSER_TZ })}`, {
    method: "POST",
    body: body(input),
  });
export const updateJob = (
  id: string,
  input: {
    job_template_id?: string;
    scheduled_start_at?: string;
    scheduled_end_at?: string;
    completion_percentage?: number;
  },
) =>
  apiFetch<JobDetail>(`/job-instance/${id}${qs({ tz: BROWSER_TZ })}`, {
    method: "PATCH",
    body: body(input),
  });
export const deleteJob = (id: string) =>
  apiFetch<void>(`/job-instance/${id}`, { method: "DELETE" });

/** Omit a key to leave it unchanged; send null to unassign. */
export const assignJob = (
  id: string,
  change: { vehicle_id?: string | null; driver_id?: string | null },
) =>
  apiFetch<JobDetail>(`/job-instance/${id}/assign${qs({ tz: BROWSER_TZ })}`, {
    method: "POST",
    body: body(change),
  });

export const setJobStatus = (id: string, status: JobInstanceStatus) =>
  apiFetch<JobDetail>(`/job-instance/${id}/status${qs({ tz: BROWSER_TZ })}`, {
    method: "POST",
    body: body({ status }),
  });

export interface EligibleVehicle {
  id: string;
  registration_number: string;
  manufacturer: string;
  model: string;
  vehicle_type: string;
  fuel_type: string;
  status: string;
  depot_id: string | null;
  depot_name: string | null;
  fleet_name: string | null;
  battery_capacity_kwh: string | null;
  at_source_depot: boolean;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface EligibleDriver {
  id: string;
  driver_code: string;
  name: string;
  status: string;
  shift: string | null;
  license_class: string;
  license_expiry: string | null;
  experience_years: string | null;
  eligible: boolean;
  reasons: string[];
  warnings: string[];
}

export interface EligibleResources {
  scheduled: boolean;
  window_start: string | null;
  window_end: string | null;
  vehicles: EligibleVehicle[];
  drivers: EligibleDriver[];
  vehicle_total: number;
  driver_total: number;
}

export const getEligibleResources = (
  jobId: string,
  p: { search?: string } = {},
) =>
  apiFetch<EligibleResources>(
    `/job-instance/${jobId}/eligible-resources${qs({ tz: BROWSER_TZ, ...p })}`,
  );


/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface Rate {
  numerator: number;
  denominator: number;
  rate: number | null;
}

export interface Partition {
  total: number;
  available: number;
  assigned: number;
  unavailable: number;
  usable: number;
  in_use_now?: number;
}

export interface OverviewSummary {
  date: string;
  timezone: string;
  generated_at: string;
  vehicles: Partition;
  drivers: Partition;
  jobs: {
    total: number;
    pending: number;
    assigned: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    requiring_attention: number;
  };
  resources: {
    depots: number;
    fleets: number;
    vehicles: number;
    drivers: number;
    routes: { total: number; by_status: Record<string, number> };
    vehicles_by_status: Record<string, number>;
    drivers_by_status: Record<string, number>;
    vehicles_by_powertrain: { ev: number; ice: number };
  };
  performance: {
    period_days: number;
    period_from: string;
    period_to: string;
    completion_rate: Rate;
    assignment_coverage: Rate;
    fleet_utilisation: Rate;
  };
}

export type AttentionKind =
  | "unassigned_job"
  | "missing_vehicle"
  | "missing_driver"
  | "vehicle_unavailable"
  | "driver_unavailable"
  | "vehicle_conflict"
  | "driver_conflict"
  | "late_start"
  | "running_over";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  severity: "critical" | "warning";
  job_id: string;
  job_name: string;
  scheduled_start_at: string | null;
  message: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  action: {
    type: "assign_job" | "open_vehicle" | "open_driver" | "open_job";
    label: string;
  };
}

export interface AttentionResult {
  date: string;
  timezone: string;
  total: number;
  jobs_flagged: number;
  truncated: boolean;
  items: AttentionItem[];
}

export const getOverviewSummary = (p: { date: string }) =>
  apiFetch<OverviewSummary>(`/operations/summary${qs({ tz: BROWSER_TZ, ...p })}`);
export const getAttention = (p: { date: string }) =>
  apiFetch<AttentionResult>(`/operations/attention${qs({ tz: BROWSER_TZ, ...p })}`);

export type { GeoPoint };
