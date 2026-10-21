/**
 * Carbon footprint and report calls. JSON goes through `apiFetch`; the PDF
 * download needs the raw response, so it repeats only the auth header and
 * base URL logic of ./api (which stays unchanged).
 */
import { apiFetch, ApiError } from "./api";
import { qs } from "./opsApi";
import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type FuelBoundary = "tank_to_wheel" | "well_to_wheel";
export type GridBoundary = "generation" | "consumption_incl_td_losses";

export interface CarbonParams {
  start: string;
  end: string;
  fuel_boundary: FuelBoundary;
  grid_boundary: GridBoundary;
}

export interface FactorRef {
  observation_id: string;
  value: number;
  unit: string;
  qualifiers: Record<string, string | number>;
  effective_from: string | null;
  source: { title: string; publisher?: string; verification_status?: string } | null;
  origin: string;
}

export interface ScenarioVehicle {
  vehicle_id: string;
  registration_number: string;
  distance_km: number;
  distance_basis: "measured" | "organization_provided";
  distance_note: string;
  litres: number;
  ice_kgco2e: number;
  ev_model: string;
  ev_consumption_source: string;
  ev_grid_kwh_per_km: number;
  ev_kwh: number;
  ev_kgco2e: number;
  reduction_kgco2e: number;
}

export interface Scenario {
  method_version: string;
  status: "ok" | "insufficient";
  reason?: string;
  eligible_vehicles?: number;
  ice_vehicles?: number;
  vehicles: ScenarioVehicle[];
  shares: { share_pct: number; modelled_kgco2e: number; reduction_kgco2e: number; reduction_pct: number | null }[];
  skipped?: { reason: string; vehicles: number }[];
  grid_factor?: FactorRef | null;
  definition?: string;
}

export interface BoundaryOption {
  fuel_boundary: FuelBoundary;
  grid_boundary: GridBoundary;
  label: string;
  explanation: string;
  fuel_factors: string[];
  grid_factor: boolean;
}

export interface Footprint {
  method_version: string;
  status: "ok" | "insufficient";
  period: { start: string; end: string; days: number };
  boundary: {
    fuel: FuelBoundary;
    grid: GridBoundary;
    label: string;
    comparability: string;
    explanation: string;
    lifecycle_included: false;
  };
  unit: "kgCO2e";
  factors: {
    fuel: Record<string, FactorRef | null>;
    grid: FactorRef | null;
    charging_efficiency: FactorRef | null;
    as_of: string;
  };
  missing: string[];
  totals: {
    kgco2e: number | null;
    fuel_kgco2e: number | null;
    electricity_kgco2e: number | null;
    fuel_litres: number | null;
    electricity_kwh: number | null;
  };
  coverage: {
    vehicles_in_service: number;
    ice_vehicles: number;
    ev_vehicles: number;
    reporting_vehicles: number;
    ice_reporting: number;
    ev_reporting: number;
    records_counted: number;
    records_excluded: { reason: string; records: number }[];
  };
  months: { month: string; kgco2e: number | null; fuel_kgco2e: number | null; electricity_kgco2e: number | null }[];
  previous: {
    period: { start: string; end: string };
    kgco2e: number | null;
    comparable: boolean;
    reasons: string[];
    change_kgco2e: number | null;
    change_pct: number | null;
    note: string;
  };
  composition: {
    total: number;
    ev: number;
    ice: number;
    unclassified: number;
    ev_share_pct: number | null;
    definition: string;
  };
  scenario: Scenario;
  definition: string;
  boundaries: BoundaryOption[];
}

export function getFootprint(params: CarbonParams): Promise<Footprint> {
  return apiFetch(`/carbon/footprint${qs({ ...params })}`);
}

/** Downloads the PDF report and saves it with the server's filename. */
export async function downloadCarbonReport(params: CarbonParams & { scenario_pct: number }): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${API_BASE}/carbon/report.pdf${qs({ ...params })}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let message = `Report could not be generated (${response.status}).`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object") {
        message = Object.values(body as Record<string, unknown>).map(String).join(" ") || message;
      }
    } catch {
      /* not JSON: keep the generic message */
    }
    throw new ApiError(response.status, message);
  }
  const blob = await response.blob();
  if (blob.type !== "application/pdf" || blob.size === 0) {
    throw new ApiError(500, "The server did not return a PDF.");
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "evora-carbon-report.pdf";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
