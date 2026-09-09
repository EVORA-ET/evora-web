import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await accessToken();

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (options.headers instanceof Headers) {
    options.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } else if (Array.isArray(options.headers)) {
    options.headers.forEach(([key, value]) => {
      headers[key] = value;
    });
  } else if (options.headers) {
    Object.assign(headers, options.headers);
  }

  if (
    !(options.body instanceof FormData) &&
    !Object.keys(headers).includes("Content-Type")
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await supabase.auth.signOut();
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.detail === "string" && body.detail) {
        message = body.detail;
      } else if (body && typeof body === "object") {
        const parts = Object.entries(body as Record<string, unknown>)
          .map(([field, value]) =>
            `${field}: ${Array.isArray(value) ? value.join(" ") : String(value)}`,
          );
        if (parts.length > 0) message = parts.join("; ");
      }
    } catch {
      // keep default message
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface Me {
  id: string;
  organization_id: string | null;
  name: string;
  email: string;
  mobile_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Depot {
  id: string;
  organization_id: string;
  name: string;
  address: string;
  location: {
    type: string;
    coordinates: [number, number];
  } | null;
  parking_capacity: number;
  workshop_available: boolean;
  fuel_station_available: boolean;
  charging_available: boolean;
  charger_count: number;
  maintenance_bays: number;
  operating_hours: Record<string, string> | null;
  depot_manager_name: string;
  depot_manager_contact: string;
  created_at: string;
  updated_at: string;
}

export interface DepotCreateInput {
  name: string;
  address: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  parking_capacity?: number;
  workshop_available?: boolean;
  fuel_station_available?: boolean;
  charging_available?: boolean;
  charger_count?: number;
  maintenance_bays?: number;
  operating_hours?: { open: string; close: string };
  depot_manager_name?: string;
  depot_manager_contact?: string;
}

export type JobTemplateStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";

export interface JobTemplate {
  id: string;
  organization_id: string;
  source_depot_id: string;
  destination_depot_id: string | null;
  name: string;
  description: string;
  is_recurring: boolean;
  recurrence_rule: string;
  is_permanent: boolean;
  start_date: string | null;
  end_date: string | null;
  estimated_duration_minutes: number | null;
  estimated_distance_km: string | null;
  estimated_energy_kwh: string | null;
  status: JobTemplateStatus;
  created_at: string;
  updated_at: string;
}

export interface JobTemplateCreateInput {
  name: string;
  source_depot_id: string;
  destination_depot_id: string;
  description?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  is_permanent?: boolean;
  start_date?: string;
  end_date?: string;
  status?: JobTemplateStatus;
}

export function getMe(): Promise<Me> {
  return apiFetch<Me>("/me");
}

export function listDepots(): Promise<Depot[]> {
  return apiFetch<Depot[]>("/depot");
}

export function createDepot(
  input: DepotCreateInput,
): Promise<Depot> {
  return apiFetch<Depot>("/depot", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listJobTemplates(): Promise<JobTemplate[]> {
  return apiFetch<JobTemplate[]>("/job-template");
}

export function createJobTemplate(
  input: JobTemplateCreateInput,
): Promise<JobTemplate> {
  return apiFetch<JobTemplate>("/job-template", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface Organization {
  id: string;
  name: string;
  industry: string;
  country: string;
  headquarters_address: string;
  operating_states: string[];
  operating_cities: string[];
  gst_number: string;
  website: string;
  logo_url: string;
  timezone: string;
  currency: string;
  business_hours: Record<string, unknown> | null;
  data_quality_score: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationCreateInput {
  name: string;
  industry?: string;
  country?: string;
  headquarters_address?: string;
  operating_cities?: string[];
  gst_number?: string;
  website?: string;
  logo_url?: string;
  currency?: string;
  business_hours?: { start?: string; end?: string };
}

export function createOrganization(
  input: OrganizationCreateInput,
): Promise<Organization> {
  return apiFetch<Organization>("/organization", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface Vehicle {
  id: string;
  organization_id: string;
  registration_number: string;
  vin: string | null;
  chassis_number: string | null;
  manufacturer: string;
  model: string;
  variant: string | null;
  manufacture_year: number;
  purchase_date: string;
  vehicle_type: string;
  fuel_type: string;
  engine_cc: number | null;
  fuel_tank_capacity: string | null;
  battery_capacity_kwh: string | null;
  mileage_kmpl: string;
  payload_kg: string;
  seating_capacity: number;
  gvw_kg: string;
  status: string;
  current_location: unknown;
  assigned_driver_id: string | null;
  odometer_km: string | null;
  avg_daily_km: string | null;
  avg_monthly_km: string | null;
  trips_per_day: string | null;
  fuel_cost_per_month: string | null;
  maintenance_cost_per_month: string | null;
  insurance_expiry: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleCreateInput {
  registration_number: string;
  manufacturer: string;
  model: string;
  manufacture_year: number;
  purchase_date: string;
  vehicle_type: string;
  fuel_type: string;
  vin?: string;
  chassis_number?: string;
  variant?: string;
  engine_cc?: number;
  fuel_tank_capacity?: string;
  battery_capacity_kwh?: string;
  mileage_kmpl?: string;
  payload_kg?: string;
  seating_capacity?: number;
  gvw_kg?: string;
}

export interface VehicleBulkUploadStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  error_report: unknown[];
}

export function getVehicleBulkUploadStatus(
  uploadId: string,
): Promise<VehicleBulkUploadStatus> {
  return apiFetch<VehicleBulkUploadStatus>(
    `/vehicles/bulk-upload/${uploadId}`,
  );
}

export function uploadVehiclesCsv(
  file: File,
): Promise<VehicleBulkUploadStatus> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<VehicleBulkUploadStatus>("/vehicles/bulk-upload", {
    method: "POST",
    body: formData,
  });
}

export function createVehicle(
  input: VehicleCreateInput,
): Promise<Vehicle> {
  return apiFetch<Vehicle>("/vehicle", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listVehicles(): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>("/vehicle");
}
