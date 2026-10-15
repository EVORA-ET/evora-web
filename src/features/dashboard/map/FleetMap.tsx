import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPinOff, RefreshCw, RotateCcw, Search, Truck } from "lucide-react";

import { pointToLatLng, type LatLng } from "../../../lib/geo";
import { formatTime } from "../../../lib/format";
import {
  fuelCategory,
  summariseRoute,
  vehicleState,
  type VehicleState,
} from "../model/fleetModel";
import { useDashboardData } from "../useDashboardData";
import { DEFAULT_FILTERS, selectForMap, type MapFilters } from "./mapFilters";
import { depotPopup, routePopup, vehiclePopup } from "./mapPopups";
import LegendPin from "./LegendPin";
import { depotPinIcon, vehiclePinIcon } from "./mapPins";
import "./FleetMap.css";

/** Shown until real data tells us where the fleet is (India). */
const FALLBACK_CENTER: LatLng = [22.5, 79];
const FALLBACK_ZOOM = 5;

/* OpenStreetMap's own tiles: free and key-free, same as the onboarding map. */
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function plainTooltip(text: string): HTMLElement {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}

interface VehicleEntry {
  marker: L.Marker;
  signature: string;
}

function FleetMap() {
  const { snapshot, index, stats, loading, error, refreshing, lastUpdated, refresh } =
    useDashboardData();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const [queryInput, setQueryInput] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const depotLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const vehicleLayer = useRef<L.LayerGroup | null>(null);

  const vehicleEntries = useRef<Map<string, VehicleEntry>>(new Map());
  const depotSignature = useRef("");
  const routeSignature = useRef("");
  const fittedKey = useRef<string | null>(null);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  /* Debounce the search box so the map doesn't re-fit on every keystroke. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) =>
        current.query === queryInput ? current : { ...current, query: queryInput },
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const selection = useMemo(
    () => selectForMap(snapshot, index, filters),
    [snapshot, index, filters],
  );

  /* ---------------------------------------------------------------- */
  /* Create the map once                                               */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: FALLBACK_CENTER,
      zoom: FALLBACK_ZOOM,
      zoomControl: false,
      scrollWheelZoom: false,
      worldCopyJump: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    routeLayer.current = L.layerGroup().addTo(map);
    depotLayer.current = L.layerGroup().addTo(map);
    vehicleLayer.current = L.layerGroup().addTo(map);

    /* The page scrolls past this map, so the wheel only zooms after a click. */
    map.on("click", () => map.scrollWheelZoom.enable());
    container.addEventListener("mouseleave", () => map.scrollWheelZoom.disable());

    /* Popup links are plain markup; route them through the SPA router. */
    const onContainerClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest<HTMLElement>("[data-nav]");
      if (!link) return;

      event.preventDefault();
      navigateRef.current(link.dataset.nav ?? "/fleets");
    };
    container.addEventListener("click", onContainerClick);

    /* Keep tiles correct when the sidebar collapses or the window resizes. */
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    mapRef.current = map;
    setMapReady(true);

    const entries = vehicleEntries.current;

    return () => {
      observer.disconnect();
      container.removeEventListener("click", onContainerClick);
      map.remove();
      mapRef.current = null;
      entries.clear();
      depotSignature.current = "";
      routeSignature.current = "";
      fittedKey.current = null;
      setMapReady(false);
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Depots                                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const layer = depotLayer.current;
    if (!mapReady || !layer) return;

    const signature = selection.depots.map((depot) => `${depot.id}:${depot.updated_at}`).join("|");
    if (signature === depotSignature.current) return;
    depotSignature.current = signature;

    layer.clearLayers();

    selection.depots.forEach((depot) => {
      const position = pointToLatLng(depot.location);
      if (!position) return;

      const routeCount = snapshot.routes.filter(
        (route) =>
          route.source_depot_id === depot.id || route.destination_depot_id === depot.id,
      ).length;

      L.marker(position, {
        icon: depotPinIcon(depot.name, depot.charging_available),
        zIndexOffset: 400,
        riseOnHover: true,
        keyboard: true,
        title: depot.name,
      })
        .bindPopup(depotPopup(depot, routeCount), { className: "map-popup", minWidth: 260, maxWidth: 300 })
        .addTo(layer);
    });
  }, [mapReady, selection.depots, snapshot.routes]);

  /* ---------------------------------------------------------------- */
  /* Routes                                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const layer = routeLayer.current;
    if (!mapReady || !layer) return;

    const summaries = selection.routes
      .map((route) => summariseRoute(route, snapshot, index))
      .filter((summary) => {
        const from = pointToLatLng(summary.source?.location);
        const to = pointToLatLng(summary.destination?.location);
        return Boolean(from && to);
      });

    const signature = summaries
      .map(
        (s) =>
          `${s.route.id}:${s.route.updated_at}:${s.inProgress}:${s.assigned}:${s.completed}:${s.delayed}:${s.vehicleIds.length}`,
      )
      .join("|");

    if (signature === routeSignature.current) return;
    routeSignature.current = signature;

    layer.clearLayers();

    summaries.forEach((summary) => {
      const from = pointToLatLng(summary.source?.location)!;
      const to = pointToLatLng(summary.destination?.location)!;
      const live = summary.inProgress > 0;

      L.polyline([from, to], {
        className: live ? "route-line route-line--live" : "route-line",
        weight: live ? 4 : 3,
        lineCap: "round",
        interactive: true,
      })
        .bindTooltip(plainTooltip(summary.route.name), { sticky: true, className: "map-tooltip" })
        .bindPopup(routePopup(summary), { className: "map-popup", minWidth: 260, maxWidth: 300 })
        .addTo(layer);
    });
  }, [mapReady, selection.routes, snapshot, index]);

  /* ---------------------------------------------------------------- */
  /* Vehicles (diffed so open popups survive the 20s refresh)          */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const layer = vehicleLayer.current;
    if (!mapReady || !layer) return;

    const now = new Date();
    const entries = vehicleEntries.current;
    const seen = new Set<string>();

    selection.vehicles.forEach((vehicle) => {
      const position = pointToLatLng(vehicle.current_location);
      if (!position) return;

      seen.add(vehicle.id);

      const state: VehicleState = vehicleState(vehicle, index, now);
      const trip = index.liveTripByVehicle.get(vehicle.id);
      const signature = [
        position.join(","),
        state,
        vehicle.updated_at,
        trip?.id ?? "",
        trip?.completion_percentage ?? "",
        vehicle.assigned_driver_id ?? "",
      ].join("|");

      const existing = entries.get(vehicle.id);

      if (existing && existing.signature === signature) return;

      const html = vehiclePopup(vehicle, state, index);
      const label = `${vehicle.registration_number} · ${fuelCategory(vehicle).toUpperCase()}`;

      if (existing) {
        existing.marker.setLatLng(position);
        existing.marker.setIcon(vehiclePinIcon(vehicle, state));
        existing.marker.setPopupContent(html);
        existing.marker.setTooltipContent(plainTooltip(label));
        existing.signature = signature;
        return;
      }

      const marker = L.marker(position, {
        icon: vehiclePinIcon(vehicle, state),
        riseOnHover: true,
        keyboard: true,
        title: vehicle.registration_number,
        zIndexOffset: state === "attention" ? 300 : state === "on_trip" ? 200 : 0,
      })
        .bindTooltip(plainTooltip(label), { direction: "top", offset: [0, -34], className: "map-tooltip" })
        .bindPopup(html, { className: "map-popup", minWidth: 260, maxWidth: 300 })
        .addTo(layer);

      entries.set(vehicle.id, { marker, signature });
    });

    entries.forEach((entry, id) => {
      if (seen.has(id)) return;

      layer.removeLayer(entry.marker);
      entries.delete(id);
    });
  }, [mapReady, selection.vehicles, index]);

  /* ---------------------------------------------------------------- */
  /* Fit the view when filters change (never on a background refresh)  */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    const key = JSON.stringify(filters);
    if (fittedKey.current === key) return;

    const points: LatLng[] = [];

    selection.depots.forEach((depot) => {
      const point = pointToLatLng(depot.location);
      if (point) points.push(point);
    });
    selection.vehicles.forEach((vehicle) => {
      const point = pointToLatLng(vehicle.current_location);
      if (point) points.push(point);
    });

    if (points.length === 0) return;

    fittedKey.current = key;
    map.flyToBounds(L.latLngBounds(points), {
      padding: [90, 90],
      maxZoom: 13,
      duration: 0.8,
    });
  }, [mapReady, filters, selection]);

  /* ---------------------------------------------------------------- */
  /* Render                                                            */
  /* ---------------------------------------------------------------- */
  const hasAnything = snapshot.depots.length > 0 || snapshot.vehicles.length > 0;
  const nothingMatches =
    hasAnything && selection.narrowed && selection.vehicles.length === 0 && selection.depots.length === 0;
  const showEmpty = !loading && !error && !hasAnything;

  const setFilter = <K extends keyof MapFilters>(key: K, value: MapFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const resetFilters = () => {
    setQueryInput("");
    setFilters(DEFAULT_FILTERS);
  };

  return (
    <section className="fleet-map" aria-labelledby="fleet-map-title">
      <header className="fleet-map__header">
        <p className="fleet-map__eyebrow">Operations overview</p>
        <h1 id="fleet-map-title" className="fleet-map__title">Fleet Map</h1>
        <p className="fleet-map__subtitle">Live view of your mixed fleet</p>
      </header>

      <div className="fleet-map__card">
        <div ref={containerRef} className="fleet-map__canvas" />

        <div className="fleet-map__toolbar">
          <select
            className="fleet-map__select"
            value={filters.fleet}
            onChange={(event) => setFilter("fleet", event.target.value as MapFilters["fleet"])}
            aria-label="Filter by fleet"
          >
            <option value="all">All Fleets</option>
            <option value="ev">EV Fleet</option>
            <option value="ice">ICE Fleet</option>
          </select>

          <select
            className="fleet-map__select"
            value={filters.routeId}
            onChange={(event) => setFilter("routeId", event.target.value)}
            aria-label="Filter by route"
          >
            <option value="all">All Routes</option>
            {snapshot.routes
              .filter((route) => route.status !== "ARCHIVED")
              .map((route) => (
                <option key={route.id} value={route.id}>{route.name}</option>
              ))}
          </select>

          <select
            className="fleet-map__select"
            value={filters.depotId}
            onChange={(event) => setFilter("depotId", event.target.value)}
            aria-label="Filter by depot"
          >
            <option value="all">All Depots</option>
            {snapshot.depots.map((depot) => (
              <option key={depot.id} value={depot.id}>{depot.name}</option>
            ))}
          </select>

          <label className="fleet-map__search">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="Search vehicle, route or depot…"
              aria-label="Search vehicle, route or depot"
            />
          </label>

          {(selection.narrowed || queryInput) && (
            <button type="button" className="fleet-map__reset" onClick={resetFilters}>
              <RotateCcw size={16} strokeWidth={1.8} />
              Reset
            </button>
          )}
        </div>

        <div className="fleet-map__legend" aria-label="Map legend">
          <span><LegendPin variant="ev" /> EV</span>
          <span><LegendPin variant="ice" /> ICE</span>
          <span><LegendPin variant="depot" /> Depot</span>
          <span><span className="fleet-map__legend-pulse" /> On a trip</span>
          <span><LegendPin variant="attention" /> Needs attention</span>
        </div>

        <div className="fleet-map__status">
          {stats.withoutLocation > 0 && stats.total > 0 && (
            <span className="fleet-map__chip fleet-map__chip--muted" title="These vehicles have no location stored yet">
              <MapPinOff size={14} strokeWidth={2} />
              {stats.withoutLocation} without location
            </span>
          )}

          <span className="fleet-map__chip fleet-map__chip--live">
            <span className="fleet-map__live-dot" />
            Live · {formatTime(lastUpdated)}
            <button
              type="button"
              className={`fleet-map__refresh ${refreshing ? "fleet-map__refresh--spin" : ""}`}
              onClick={() => void refresh()}
              aria-label="Refresh now"
            >
              <RefreshCw size={14} strokeWidth={2} />
            </button>
          </span>

          <span className="fleet-map__chip fleet-map__chip--count">
            {selection.vehicles.length} {selection.vehicles.length === 1 ? "vehicle" : "vehicles"} shown
          </span>
        </div>

        {loading && (
          <div className="fleet-map__overlay" role="status">
            <span className="fleet-map__spinner" />
            <p>Loading your fleet…</p>
          </div>
        )}

        {error && !loading && (
          <div className="fleet-map__overlay">
            <div className="fleet-map__notice">
              <h2>We couldn't load your fleet</h2>
              <p>{error}</p>
              <button type="button" className="fleet-map__cta" onClick={() => void refresh()}>
                Try again
              </button>
            </div>
          </div>
        )}

        {showEmpty && (
          <div className="fleet-map__overlay">
            <div className="fleet-map__notice">
              <span className="fleet-map__notice-icon"><Truck size={26} strokeWidth={1.6} /></span>
              <h2>No fleet added yet</h2>
              <p>Add your depots and vehicles and they'll show up here, live.</p>
              <button type="button" className="fleet-map__cta" onClick={() => navigate("/fleets")}>
                Add your fleet →
              </button>
            </div>
          </div>
        )}

        {nothingMatches && (
          <div className="fleet-map__nomatch">
            <p>Nothing matches these filters.</p>
            <button type="button" onClick={resetFilters}>Reset filters</button>
          </div>
        )}

        {!loading && !error && hasAnything && !nothingMatches && stats.total > 0 && stats.withLocation === 0 && (
          <div className="fleet-map__nomatch fleet-map__nomatch--soft">
            <p>Your vehicles aren't reporting a location yet, so only depots are shown.</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default FleetMap;
