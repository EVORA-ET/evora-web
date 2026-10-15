import type { GeoPoint } from "./api";

export type LatLng = [number, number];

/** Converts a GeoJSON point ([lng, lat]) into Leaflet's [lat, lng]. */
export function pointToLatLng(point: GeoPoint | null | undefined): LatLng | null {
  if (!point || !Array.isArray(point.coordinates)) return null;

  const [lng, lat] = point.coordinates;

  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng)
  ) {
    return null;
  }

  return [lat, lng];
}
