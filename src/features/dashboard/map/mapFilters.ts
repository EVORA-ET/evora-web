import type { Depot, JobTemplate, Vehicle } from "../../../lib/api";
import { pointToLatLng } from "../../../lib/geo";
import {
  fuelCategory,
  type FleetCategory,
  type FleetIndex,
  type FleetSnapshot,
} from "../model/fleetModel";

export interface MapFilters {
  fleet: "all" | FleetCategory;
  routeId: "all" | string;
  depotId: "all" | string;
  query: string;
}

export const DEFAULT_FILTERS: MapFilters = {
  fleet: "all",
  routeId: "all",
  depotId: "all",
  query: "",
};

export interface MapSelection {
  vehicles: Vehicle[];
  depots: Depot[];
  routes: JobTemplate[];
  /** True when any filter or search narrows the view. */
  narrowed: boolean;
}

function includesText(haystack: Array<string | null | undefined>, needle: string): boolean {
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

/**
 * Filters combine the way a manager thinks about them:
 *  - route  → that route, its two depots, and vehicles on its open trips
 *  - depot  → that depot, routes touching it, vehicles on those routes
 *  - fleet  → EV / ICE vehicles only
 *  - search → vehicles, routes or depots whose text matches
 *
 * Vehicles are not linked to a depot in the data model, so a depot view
 * shows vehicles through the routes that start or end there.
 */
export function selectForMap(
  snapshot: FleetSnapshot,
  index: FleetIndex,
  filters: MapFilters,
): MapSelection {
  const query = filters.query.trim().toLowerCase();

  /* Routes in scope */
  let routes = snapshot.routes.filter((route) => route.status !== "ARCHIVED");

  if (filters.routeId !== "all") {
    routes = routes.filter((route) => route.id === filters.routeId);
  }

  if (filters.depotId !== "all") {
    routes = routes.filter(
      (route) =>
        route.source_depot_id === filters.depotId ||
        route.destination_depot_id === filters.depotId,
    );
  }

  /* Depots in scope */
  let depots = snapshot.depots;

  if (filters.routeId !== "all" || filters.depotId !== "all") {
    const ids = new Set<string>();

    if (filters.depotId !== "all") ids.add(filters.depotId);

    routes.forEach((route) => {
      ids.add(route.source_depot_id);
      if (route.destination_depot_id) ids.add(route.destination_depot_id);
    });

    depots = depots.filter((depot) => ids.has(depot.id));
  }

  /* Vehicles in scope */
  let vehicles = snapshot.vehicles;

  if (filters.routeId !== "all" || filters.depotId !== "all") {
    const ids = new Set<string>();

    routes.forEach((route) => {
      index.openTripsByRoute.get(route.id)?.forEach((trip) => ids.add(trip.vehicle_id));
    });

    vehicles = vehicles.filter((vehicle) => ids.has(vehicle.id));
  }

  if (filters.fleet !== "all") {
    vehicles = vehicles.filter((vehicle) => fuelCategory(vehicle) === filters.fleet);
  }

  /* Search */
  if (query) {
    const matchedRoutes = routes.filter((route) =>
      includesText([route.name, route.description], query),
    );
    const matchedDepots = depots.filter((depot) =>
      includesText([depot.name, depot.address], query),
    );
    const vehiclesOnMatchedRoutes = new Set<string>();

    matchedRoutes.forEach((route) => {
      index.openTripsByRoute.get(route.id)?.forEach((trip) => vehiclesOnMatchedRoutes.add(trip.vehicle_id));
    });

    const matchedVehicles = vehicles.filter(
      (vehicle) =>
        includesText(
          [vehicle.registration_number, vehicle.manufacturer, vehicle.model, vehicle.vin],
          query,
        ) || vehiclesOnMatchedRoutes.has(vehicle.id),
    );

    routes = matchedRoutes;
    depots = matchedDepots;
    vehicles = matchedVehicles;
  }

  /* Only vehicles with a real position can be drawn. */
  vehicles = vehicles.filter((vehicle) => pointToLatLng(vehicle.current_location));

  return {
    vehicles,
    depots: depots.filter((depot) => pointToLatLng(depot.location)),
    routes,
    narrowed:
      filters.fleet !== "all" ||
      filters.routeId !== "all" ||
      filters.depotId !== "all" ||
      query.length > 0,
  };
}
