import { renderToStaticMarkup } from "react-dom/server";

import type { Depot } from "../../../lib/api";
import { formatDate, formatNumber, toNumber } from "../../../lib/format";
import {
  VEHICLE_STATE_LABEL,
  fuelCategory,
  fuelLabel,
  humanize,
  type FleetIndex,
  type RouteSummary,
  type VehicleState,
} from "../model/fleetModel";
import type { Vehicle } from "../../../lib/api";

/**
 * Popup bodies are rendered to static markup. React escapes every value,
 * so user-entered names and addresses can't inject HTML into the map.
 * Elements carrying `data-nav` are routed by the FleetMap click handler.
 */

function stat(label: string, value: string) {
  return (
    <div className="map-card__stat" key={label}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function vehiclePopup(
  vehicle: Vehicle,
  state: VehicleState,
  index: FleetIndex,
): string {
  const trip = index.liveTripByVehicle.get(vehicle.id);
  const route = trip ? index.routeById.get(trip.job_template_id) : undefined;
  const driverId = trip?.driver_id ?? vehicle.assigned_driver_id;
  const driver = driverId ? index.driverById.get(driverId) : undefined;
  const battery = toNumber(vehicle.battery_capacity_kwh);
  const odometer = toNumber(vehicle.odometer_km);

  return renderToStaticMarkup(
    <div className="map-card">
      <div className="map-card__head">
        <div>
          <p className="map-card__title">{vehicle.registration_number}</p>
          <p className="map-card__sub">
            {[vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ")}
          </p>
        </div>
        <span className={`map-card__chip map-card__chip--${state}`}>{VEHICLE_STATE_LABEL[state]}</span>
      </div>

      <dl className="map-card__stats">
        {stat("Powertrain", fuelLabel(vehicle.fuel_type))}
        {stat("Type", humanize(vehicle.vehicle_type))}
        {fuelCategory(vehicle) === "ev" && battery !== null && (
          stat("Battery capacity", `${formatNumber(battery, 1)} kWh`)
        )}
        {odometer !== null && stat("Odometer", `${formatNumber(odometer)} km`)}
        {stat("Route", route?.name ?? "Not on a trip")}
        {trip && stat("Trip progress", `${trip.completion_percentage}%`)}
        {stat("Driver", driver?.name ?? "Not assigned")}
        {stat("Updated", formatDate(vehicle.updated_at))}
      </dl>

      <a className="map-card__link" href={`/fleets?vehicle=${vehicle.id}`} data-nav={`/fleets?vehicle=${vehicle.id}`}>
        View Vehicle →
      </a>
    </div>,
  );
}

export function depotPopup(depot: Depot, routeCount: number): string {
  return renderToStaticMarkup(
    <div className="map-card">
      <div className="map-card__head">
        <div>
          <p className="map-card__title">{depot.name}</p>
          <p className="map-card__sub">{depot.address}</p>
        </div>
      </div>

      <dl className="map-card__stats">
        {stat("Parking capacity", formatNumber(depot.parking_capacity))}
        {stat("EV chargers", depot.charging_available ? formatNumber(depot.charger_count) : "None")}
        {stat("Maintenance bays", formatNumber(depot.maintenance_bays))}
        {stat("Routes", formatNumber(routeCount))}
        {depot.depot_manager_name && stat("Manager", depot.depot_manager_name)}
      </dl>

      <ul className="map-card__tags">
        {depot.workshop_available && <li>Workshop</li>}
        {depot.fuel_station_available && <li>Fuel station</li>}
        {depot.charging_available && <li>Charging</li>}
      </ul>

      <a className="map-card__link" href={`/fleets?depot=${depot.id}`} data-nav={`/fleets?depot=${depot.id}`}>
        View Depot →
      </a>
    </div>,
  );
}

export function routePopup(summary: RouteSummary): string {
  const { route, source, destination } = summary;
  const distance = toNumber(route.estimated_distance_km);

  return renderToStaticMarkup(
    <div className="map-card">
      <div className="map-card__head">
        <div>
          <p className="map-card__title">{route.name}</p>
          <p className="map-card__sub">
            {source?.name ?? "Unknown depot"} → {destination?.name ?? "—"}
          </p>
        </div>
        <span className="map-card__chip map-card__chip--route">{humanize(route.status)}</span>
      </div>

      <dl className="map-card__stats">
        {stat("Vehicles on route", formatNumber(summary.vehicleIds.length))}
        {stat("In progress", formatNumber(summary.inProgress))}
        {stat("Assigned", formatNumber(summary.assigned))}
        {stat("Delayed", formatNumber(summary.delayed))}
        {stat("Completed", formatNumber(summary.completed))}
        {distance !== null && stat("Distance", `${formatNumber(distance, 1)} km`)}
      </dl>

      <p className="map-card__note">Drawn as a straight line between depots.</p>

      <a className="map-card__link" href={`/fleets?route=${route.id}`} data-nav={`/fleets?route=${route.id}`}>
        View Route →
      </a>
    </div>,
  );
}
