import { listVehiclesPage, type OpsVehicle } from "../../lib/opsApi";

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export interface AllVehicles {
  vehicles: OpsVehicle[];
  /** True when the fleet is larger than the 2,000 vehicles loaded for client-side filtering. */
  truncated: boolean;
}

/**
 * Every vehicle of the organization (optionally one powertrain), for screens
 * that filter by values the vehicle list endpoint cannot filter on (readiness
 * state, maintenance status). Loads at most 2,000 and says so when truncated.
 */
export async function loadAllVehicles(params: { powertrain?: "ice" | "ev" }): Promise<AllVehicles> {
  const vehicles: OpsVehicle[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await listVehiclesPage({ page, page_size: PAGE_SIZE, ordering: "registration_number", ...params });
    vehicles.push(...res.results);
    if (page >= res.total_pages) return { vehicles, truncated: false };
  }
  return { vehicles, truncated: true };
}
