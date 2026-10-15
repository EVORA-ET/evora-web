import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Bus,
  Car,
  CarFront,
  Container,
  Truck,
  Van,
  Warehouse,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { Vehicle } from "../../../lib/api";
import { fuelCategory, type VehicleState } from "../model/fleetModel";

/**
 * One teardrop silhouette for every marker, so the map reads as a single
 * visual language: colour = fleet type, glyph = vehicle type, size = depot.
 */
export const PIN_PATH =
  "M20 1C9.4 1 1 9.3 1 19.6c0 13.4 16 28.6 18 30.3a1.6 1.6 0 0 0 2 0c2-1.7 18-16.9 18-30.3C39 9.3 30.6 1 20 1Z";

const VEHICLE_GLYPH: Record<string, LucideIcon> = {
  bus: Bus,
  truck: Truck,
  car: CarFront,
  van: Van,
  trailer: Container,
  other: Car,
};

function glyphSvg(Icon: LucideIcon, size: number): string {
  return renderToStaticMarkup(<Icon size={size} strokeWidth={2.2} />);
}

function shape(): string {
  return `
    <svg class="map-pin__shape" viewBox="0 0 40 52" aria-hidden="true">
      <path class="map-pin__body" d="${PIN_PATH}" />
      <circle class="map-pin__hole" cx="20" cy="19.5" r="12" />
    </svg>`;
}

export function vehiclePinIcon(vehicle: Vehicle, state: VehicleState): L.DivIcon {
  const category = fuelCategory(vehicle);
  const Glyph = VEHICLE_GLYPH[vehicle.vehicle_type] ?? Car;

  const html = `
    <div class="map-pin map-pin--${category} map-pin--${state}">
      ${state === "on_trip" ? '<span class="map-pin__pulse"></span>' : ""}
      ${shape()}
      <span class="map-pin__glyph">${glyphSvg(Glyph, 16)}</span>
      ${category === "ev" ? `<span class="map-pin__badge map-pin__badge--ev">${glyphSvg(Zap, 9)}</span>` : ""}
      ${state === "attention" ? '<span class="map-pin__badge map-pin__badge--attention">!</span>' : ""}
    </div>`;

  return L.divIcon({
    className: "map-pin-wrapper",
    html,
    iconSize: [40, 52],
    iconAnchor: [20, 50],
    popupAnchor: [0, -46],
    tooltipAnchor: [16, -30],
  });
}

export function depotPinIcon(name: string, hasCharging: boolean): L.DivIcon {
  const label = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
    <div class="map-pin map-pin--depot">
      ${shape()}
      <span class="map-pin__glyph">${glyphSvg(Warehouse, 20)}</span>
      ${hasCharging ? `<span class="map-pin__badge map-pin__badge--depot-ev">${glyphSvg(Zap, 10)}</span>` : ""}
      <span class="map-pin__label">${label}</span>
    </div>`;

  return L.divIcon({
    className: "map-pin-wrapper map-pin-wrapper--depot",
    html,
    iconSize: [52, 68],
    iconAnchor: [26, 65],
    popupAnchor: [0, -60],
    tooltipAnchor: [22, -38],
  });
}
