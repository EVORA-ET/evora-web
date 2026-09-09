import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  createDepot,
  createJobTemplate,
  listDepots,
  listJobTemplates,
} from "../../lib/api";
import type {
  DepotCreateInput,
  JobTemplate,
  JobTemplateStatus,
} from "../../lib/api";
import { useTransition } from "../../app/useTransition";
import "./InfrastructureOnboardingPage.css";

interface Coordinates {
  lat: number;
  lng: number;
}

interface Depot {
  id: string;
  name: string;
  address: string;
  location: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  parking_capacity: number;
  workshop_available: boolean;
  fuel_station_available: boolean;
  charging_available: boolean;
  charger_count: number;
  maintenance_bays: number;
  operating_hours: {
    open: string;
    close: string;
  };
  depot_manager_name: string;
  depot_manager_contact: string;
}

interface DepotForm {
  name: string;
  address: string;
  parking_capacity: string;
  workshop_available: boolean;
  fuel_station_available: boolean;
  charging_available: boolean;
  charger_count: string;
  maintenance_bays: string;
  operating_open: string;
  operating_close: string;
  depot_manager_name: string;
  depot_manager_contact: string;
}

interface RouteData {
  id: string;
  sourceId: string;
  destinationId: string;
  name: string;
}

type RecurrencePattern =
  | "daily"
  | "daily_n"
  | "weekly"
  | "weekly_n"
  | "monthly"
  | "custom";

interface RouteForm {
  name: string;
  description: string;
  isRecurring: boolean;
  pattern: RecurrencePattern;
  intervalDays: string;
  weekDays: string[];
  weekInterval: string;
  monthDay: string;
  customRule: string;
  isPermanent: boolean;
  startDate: string;
  endDate: string;
  status: JobTemplateStatus;
}

const WEEKDAY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "MO", label: "M" },
  { value: "TU", label: "T" },
  { value: "WE", label: "W" },
  { value: "TH", label: "T" },
  { value: "FR", label: "F" },
  { value: "SA", label: "S" },
  { value: "SU", label: "S" },
];

const RECURRENCE_PATTERNS: Array<{ value: RecurrencePattern; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "daily_n", label: "Every N days" },
  { value: "weekly", label: "Weekly" },
  { value: "weekly_n", label: "Every N weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

const EMPTY_ROUTE_FORM: RouteForm = {
  name: "",
  description: "",
  isRecurring: false,
  pattern: "daily",
  intervalDays: "1",
  weekDays: [],
  weekInterval: "1",
  monthDay: "1",
  customRule: "",
  isPermanent: false,
  startDate: "",
  endDate: "",
  status: "ACTIVE",
};

function buildRecurrenceRule(form: RouteForm): string {
  if (!form.isRecurring) {
    return "";
  }

  switch (form.pattern) {
    case "daily": {
      return "FREQ=DAILY;INTERVAL=1";
    }

    case "daily_n": {
      const interval =
        Number(form.intervalDays) || 1;
      return `FREQ=DAILY;INTERVAL=${interval}`;
    }

    case "weekly": {
      return `FREQ=WEEKLY;INTERVAL=1;BYDAY=${form.weekDays.join(",")}`;
    }

    case "weekly_n": {
      const interval =
        Number(form.weekInterval) || 1;
      return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${
        form.weekDays.join(",")
      }`;
    }

    case "monthly": {
      const day =
        Number(form.monthDay) || 1;
      return `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${day}`;
    }

    case "custom": {
      return form.customRule.trim();
    }

    default: {
      return "";
    }
  }
}

interface SearchResult {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

type ActivePanel = "none" | "depot" | "route";

const EMPTY_DEPOT_FORM: DepotForm = {
  name: "",
  address: "",
  parking_capacity: "",
  workshop_available: false,
  fuel_station_available: false,
  charging_available: false,
  charger_count: "",
  maintenance_bays: "",
  operating_open: "08:00",
  operating_close: "20:00",
  depot_manager_name: "",
  depot_manager_contact: "",
};

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

function createDepotMarker(active = true) {
  return L.divIcon({
    className: "evora-marker-wrapper",
    html: `
      <div class="evora-marker ${active ? "is-active" : "is-faded"}">
        <span></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createPreviewMarker() {
  return L.divIcon({
    className: "evora-preview-marker-wrapper",
    html: `
      <div class="evora-preview-pin">
        <div class="evora-preview-pin-head">
          <span></span>
        </div>
      </div>
    `,
    iconSize: [40, 48],
    iconAnchor: [20, 44],
  });
}

export default function InfrastructureOnboardingPage() {
  const navigate = useNavigate();
  const { runTransition } = useTransition();

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const previewMarkerRef = useRef<L.Marker | null>(null);
  const suppressAddressSearchRef = useRef(false);
  const depotMarkersRef = useRef<Record<string, L.Marker>>({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  const [mapReady, setMapReady] = useState(false);

  const [activePanel, setActivePanel] =
    useState<ActivePanel>("none");

  /*
   * ------------------------------------------------------------
   * BACKEND DATA (source of truth)
   * ------------------------------------------------------------
   */

  const [depots, setDepots] = useState<Depot[]>([]);

  const [routes, setRoutes] = useState<RouteData[]>([]);

  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStartedRef = useRef(false);

  function toDepotView(serverDepot: Awaited<
    ReturnType<typeof listDepots>
  >[number]): Depot {
    const hours =
      serverDepot.operating_hours ?? {};

    return {
      id: serverDepot.id,

      name: serverDepot.name,

      address: serverDepot.address,

      location: serverDepot.location
        ? {
            type: "Point",

            coordinates: [
              serverDepot.location.coordinates[0],
              serverDepot.location.coordinates[1],
            ],
          }
        : null,

      parking_capacity:
        serverDepot.parking_capacity,

      workshop_available:
        serverDepot.workshop_available,

      fuel_station_available:
        serverDepot.fuel_station_available,

      charging_available:
        serverDepot.charging_available,

      charger_count:
        serverDepot.charger_count,

      maintenance_bays:
        serverDepot.maintenance_bays,

      operating_hours: {
        open:
          hours.start ?? hours.open ?? "08:00",

        close:
          hours.end ?? hours.close ?? "18:00",
      },

      depot_manager_name:
        serverDepot.depot_manager_name,

      depot_manager_contact:
        String(
          serverDepot.depot_manager_contact ?? ""
        ),
    };
  }

  function fetchInfrastructure() {
    void runTransition(async () => {
      try {
        const [serverDepots, serverTemplates] =
          await Promise.all([
            listDepots(),

            listJobTemplates(),
          ]);

        setDepots(
          serverDepots.map(toDepotView)
        );

        setRoutes(
          serverTemplates.map(
            (template: JobTemplate) => ({
              id: template.id,

              sourceId:
                template.source_depot_id,

              destinationId:
                template.destination_depot_id ??
                "",

              name: template.name,
            })
          )
        );

        setLoadError(null);
      } catch {
        setLoadError(
          "Could not load your network from the server. Please retry."
        );
      } finally {
        fetchStartedRef.current = false;
      }
    });
  }

  useEffect(() => {
    if (fetchStartedRef.current) {
      return;
    }

    fetchStartedRef.current = true;

    fetchInfrastructure();
  }, []);

  const [depotForm, setDepotForm] =
    useState<DepotForm>(EMPTY_DEPOT_FORM);

  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates | null>(null);

  const [searchResults, setSearchResults] =
    useState<SearchResult[]>([]);

  const [isSearching, setIsSearching] =
    useState(false);

  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const [routeForm, setRouteForm] =
    useState<RouteForm>(EMPTY_ROUTE_FORM);

  const [depotError, setDepotError] = useState<string | null>(null);
  const [depotSaving, setDepotSaving] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSaving, setRouteSaving] = useState(false);


  /*
   * ------------------------------------------------------------
   * MAP INITIALISATION
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current, {
      center: DEFAULT_CENTER,
      zoom: 11,
      zoomControl: false,
    });

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(map);

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    ).addTo(map);

    mapRef.current = map;

    /*
     * Tell React that Leaflet is now ready.
     * This is important because saved depots may already
     * exist before the map finishes initialising.
     */
    setMapReady(true);

    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  /*
 * ------------------------------------------------------------
 * UPDATE DEPOT MARKERS
 * ------------------------------------------------------------
 */

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const activeIds =
      activePanel === "route"
        ? new Set(
          [sourceId, destinationId].filter(Boolean)
        )
        : new Set(depots.map((depot) => depot.id));

    depots.forEach((depot) => {
      if (!depot.location) {
        return;
      }

      const [lng, lat] =
        depot.location.coordinates;

      const shouldBeActive =
        activePanel !== "route" ||
        activeIds.has(depot.id);

      const existing =
        depotMarkersRef.current[depot.id];

      if (existing) {
        existing.setIcon(
          createDepotMarker(shouldBeActive)
        );

        existing.setLatLng([lat, lng]);
      } else {
        const marker = L.marker(
          [lat, lng],
          {
            icon: createDepotMarker(
              shouldBeActive
            ),
          }
        ).addTo(map);

        marker.bindTooltip(depot.name, {
          direction: "top",
          offset: [0, -10],
          className: "evora-map-tooltip",
        });

        depotMarkersRef.current[
          depot.id
        ] = marker;
      }
    });

    Object.keys(
      depotMarkersRef.current
    ).forEach((id) => {
      if (
        !depots.some(
          (depot) => depot.id === id
        )
      ) {
        depotMarkersRef.current[id].remove();

        delete depotMarkersRef.current[id];
      }
    });
  }, [
    depots,
    activePanel,
    sourceId,
    destinationId,
    mapReady,
  ]);
  /*
   * ------------------------------------------------------------
   * DRAW ROUTE
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      return;
    }

    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }

    if (!sourceId || !destinationId) {
      return;
    }

    const source = depots.find(
      (depot) => depot.id === sourceId
    );

    const destination = depots.find(
      (depot) => depot.id === destinationId
    );

    if (
      !source?.location ||
      !destination?.location
    ) {
      return;
    }

    const [sourceLng, sourceLat] =
      source.location.coordinates;

    const [destinationLng, destinationLat] =
      destination.location.coordinates;

    routeLineRef.current = L.polyline(
      [
        [sourceLat, sourceLng],
        [destinationLat, destinationLng],
      ],
      {
        className: "evora-route-line",
        weight: 3,
        dashArray: "8 8",
      }
    ).addTo(mapRef.current);
  }, [
    sourceId,
    destinationId,
    depots,
    mapReady,
  ]);

  /*
   * ------------------------------------------------------------
   * RESTORE MAP VIEW FOR SAVED DEPOTS
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (
      !mapRef.current ||
      !mapReady ||
      depots.length === 0
    ) {
      return;
    }

    const bounds = L.latLngBounds(
      depots
        .filter((depot) => depot.location)
        .map((depot) => {
          const [lng, lat] =
            depot.location!.coordinates;

          return [lat, lng] as [
            number,
            number
          ];
        })
    );

    window.setTimeout(() => {
      if (!mapRef.current) {
        return;
      }

      mapRef.current.fitBounds(bounds, {
        padding: [70, 70],
        maxZoom: 14,
        animate: false,
      });
    }, 0);
  }, [depots, mapReady]);

  /*
   * ------------------------------------------------------------
   * ADDRESS SEARCH
   * ------------------------------------------------------------
   */

  useEffect(() => {
    if (activePanel !== "depot") {
      return;
    }

    /*
     * When the user drags the pin, reverse geocoding updates
     * the address field. We don't want that address update to
     * trigger a new search and move the pin somewhere else.
     */

    if (suppressAddressSearchRef.current) {
      suppressAddressSearchRef.current = false;
      return;
    }

    const address =
      depotForm.address.trim();

    if (address.length < 3) {
      setSearchResults([]);
      return;
    }

    const timeout = window.setTimeout(
      async () => {
        try {
          setIsSearching(true);

          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(
              address
            )}`
          );

          if (!response.ok) {
            throw new Error(
              "Unable to search address"
            );
          }

          const results: SearchResult[] =
            await response.json();

          setSearchResults(results);

          /*
           * While typing, move the map to the best
           * matching result.
           *
           * The preview pin is ALWAYS draggable.
           */

          if (
            results.length > 0 &&
            mapRef.current
          ) {
            const first = results[0];

            const lat = Number(first.lat);
            const lng = Number(first.lon);

            mapRef.current.flyTo(
              [lat, lng],
              13,
              {
                duration: 0.8,
              }
            );

            showPreviewMarker(
              lat,
              lng,
              true
            );
          }
        } catch {
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      },
      600
    );

    return () =>
      window.clearTimeout(timeout);
  }, [
    depotForm.address,
    activePanel,
  ]);

  /*
   * ------------------------------------------------------------
   * PREVIEW MARKER
   * ------------------------------------------------------------
   */

  function showPreviewMarker(
    lat: number,
    lng: number,
    draggable = true
  ) {
    if (!mapRef.current) {
      return;
    }

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }

    const marker = L.marker(
      [lat, lng],
      {
        icon: createPreviewMarker(),
        draggable,
        autoPan: true,
      }
    ).addTo(mapRef.current);

    /*
     * User starts dragging the pin.
     */

    marker.on("dragstart", () => {
      marker
        .getElement()
        ?.classList.add(
          "is-dragging"
        );
    });

    /*
     * User finishes dragging the pin.
     */

    marker.on(
      "dragend",
      async () => {
        marker
          .getElement()
          ?.classList.remove(
            "is-dragging"
          );

        const position =
          marker.getLatLng();

        /*
         * Store the exact coordinates selected
         * by the user.
         */

        setSelectedLocation({
          lat: position.lat,
          lng: position.lng,
        });

        /*
         * Prevent the address-search effect from
         * taking the pin back to the previous result.
         */

        suppressAddressSearchRef.current =
          true;

        await reverseGeocode(
          position.lat,
          position.lng
        );
      }
    );

    previewMarkerRef.current =
      marker;
  }

  /*
   * ------------------------------------------------------------
   * REVERSE GEOCODING
   * ------------------------------------------------------------
   */

  async function reverseGeocode(
    lat: number,
    lng: number
  ) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
      );

      if (!response.ok) {
        return;
      }

      const result =
        await response.json();

      if (result.display_name) {
        setDepotForm((current) => ({
          ...current,
          address:
            result.display_name,
        }));
      }
    } catch {
      /*
       * Keep the existing address if reverse
       * geocoding fails.
       */
    }
  }

  /*
   * ------------------------------------------------------------
   * FORM HANDLERS
   * ------------------------------------------------------------
   */

  function updateDepotForm<
    K extends keyof DepotForm
  >(
    key: K,
    value: DepotForm[K]
  ) {
    setDepotForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function selectSearchResult(
    result: SearchResult
  ) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);

    // setDepotForm((current) => ({
    //   ...current,
    //   address:
    //     result.display_name,
    // }));

    setSelectedLocation({
      lat,
      lng,
    });

    setSearchResults([]);

    if (mapRef.current) {
      mapRef.current.flyTo(
        [lat, lng],
        16,
        {
          duration: 0.8,
        }
      );
    }

    showPreviewMarker(
      lat,
      lng,
      true
    );
  }

  /*
   * ------------------------------------------------------------
   * OPEN DEPOT FORM
   * ------------------------------------------------------------
   */

  function openDepotForm() {
    setActivePanel("depot");

    setDepotForm(
      EMPTY_DEPOT_FORM
    );

    setSelectedLocation(null);

    setSearchResults([]);

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
  }

  /*
   * ------------------------------------------------------------
   * CONFIRM DEPOT
   * ------------------------------------------------------------
   */

  function confirmDepot() {
    if (!depotForm.name.trim()) {
      alert(
        "Please enter a depot name."
      );
      return;
    }

    if (!depotForm.address.trim()) {
      alert(
        "Please enter a depot address."
      );
      return;
    }

    if (!selectedLocation) {
      alert(
        "Please select and confirm the depot location on the map."
      );
      return;
    }

    setDepotError(null);
    setDepotSaving(true);

    void runTransition(async () => {
      const payload: DepotCreateInput = {
        name: depotForm.name.trim(),

        address: depotForm.address.trim(),

        location: {
          type: "Point",

          /*
           * GeoJSON uses:
           * [longitude, latitude]
           */

          coordinates: [
            selectedLocation.lng,
            selectedLocation.lat,
          ],
        },

        parking_capacity:
          Number(
            depotForm.parking_capacity
          ) || 0,

        workshop_available:
          depotForm.workshop_available,

        fuel_station_available:
          depotForm.fuel_station_available,

        charging_available:
          depotForm.charging_available,

        charger_count:
          Number(
            depotForm.charger_count
          ) || 0,

        maintenance_bays:
          Number(
            depotForm.maintenance_bays
          ) || 0,

        operating_hours: {
          open:
            depotForm.operating_open,

          close:
            depotForm.operating_close,
        },

        depot_manager_name:
          depotForm.depot_manager_name.trim(),

        depot_manager_contact:
          depotForm.depot_manager_contact.trim(),
      };

      try {
        const created = await createDepot(
          payload
        );

        const newDepot = toDepotView(created);

        setDepots((current) => [
          ...current,
          newDepot,
        ]);

        /*
         * Remove the temporary draggable marker.
         * The permanent depot marker will be created by
         * the depot marker effect.
         */

        if (previewMarkerRef.current) {
          previewMarkerRef.current.remove();
          previewMarkerRef.current = null;
        }

        setSelectedLocation(null);
        setSearchResults([]);
        setDepotForm(
          EMPTY_DEPOT_FORM
        );

        setActivePanel("none");

        /*
         * Focus the map on all depots.
         */

        window.setTimeout(() => {
          if (!mapRef.current) {
            return;
          }

          if (depots.length === 0) {
            if (!newDepot.location) {
              return;
            }

            const [lng, lat] =
              newDepot.location.coordinates;

            mapRef.current.flyTo(
              [lat, lng],
              14,
              {
                duration: 0.8,
              }
            );
          } else {
            const withLocation = [
              ...depots,
              newDepot,
            ].filter(
              (depot) => depot.location
            );

            if (withLocation.length === 0) {
              return;
            }

            const bounds =
              L.latLngBounds(
                withLocation.map(
                  (depot) => {
                    const location =
                      depot.location;

                    if (!location) {
                      return null;
                    }

                    const [
                      lng,
                      lat,
                    ] =
                      location.coordinates;

                    return [
                      lat,
                      lng,
                    ] as [
                        number,
                        number
                      ];
                  }
                ).filter(
                  (point): point is [
                    number,
                    number
                  ] => point !== null
                )
              );

            mapRef.current.fitBounds(
              bounds,
              {
                padding: [70, 70],
                maxZoom: 14,
                animate: true,
              }
            );
          }
        }, 50);
      } catch (submitError) {
        setDepotError(
          submitError instanceof Error
            ? submitError.message
            : "Could not save the depot. Please try again."
        );
      } finally {
        setDepotSaving(false);
      }
    });
  }

  /*
   * ------------------------------------------------------------
   * OPEN ROUTE FORM
   * ------------------------------------------------------------
   */

  function openRouteForm() {
    if (depots.length < 2) {
      alert(
        "Add at least 2 depots before creating a route."
      );
      return;
    }

    setActivePanel("route");

    setSourceId("");
    setDestinationId("");
    setRouteForm(
      EMPTY_ROUTE_FORM
    );
    setRouteError(null);
  }

  /*
   * ------------------------------------------------------------
   * CONFIRM ROUTE
   * ------------------------------------------------------------
   */

  function confirmRoute() {
    if (!routeForm.name.trim()) {
      alert(
        "Please enter a route name."
      );
      return;
    }

    if (
      !sourceId ||
      !destinationId
    ) {
      alert(
        "Please select both a source and destination."
      );
      return;
    }

    if (
      sourceId ===
      destinationId
    ) {
      alert(
        "Source and destination must be different depots."
      );
      return;
    }

    if (routeForm.isRecurring) {
      if (
        routeForm.pattern !== "custom" &&
        routeForm.pattern === "daily_n" &&
        (Number(routeForm.intervalDays) || 0) < 1
      ) {
        alert(
          "Interval must be at least 1 day."
        );
        return;
      }

      if (
        (routeForm.pattern === "weekly" ||
          routeForm.pattern === "weekly_n") &&
        routeForm.weekDays.length === 0
      ) {
        alert(
          "Select at least one weekday for a weekly recurrence."
        );
        return;
      }

      if (
        routeForm.pattern === "weekly_n" &&
        (Number(routeForm.weekInterval) || 0) < 1
      ) {
        alert(
          "Week interval must be at least 1."
        );
        return;
      }

      if (
        routeForm.pattern === "monthly" &&
        !(
          Number(routeForm.monthDay) >= 1 &&
          Number(routeForm.monthDay) <= 31
        )
      ) {
        alert(
          "Day of month must be between 1 and 31."
        );
        return;
      }

      if (
        routeForm.pattern === "custom" &&
        !routeForm.customRule.trim()
      ) {
        alert(
          "Enter a custom recurrence rule."
        );
        return;
      }
    }

    if (
      routeForm.startDate &&
      routeForm.endDate &&
      routeForm.endDate <
        routeForm.startDate
    ) {
      alert(
        "End date cannot be before the start date."
      );
      return;
    }

    setRouteError(null);
    setRouteSaving(true);

    void runTransition(async () => {
      const recurrence = buildRecurrenceRule(
        routeForm
      );

      try {
        const created =
          await createJobTemplate({
            name: routeForm.name.trim(),

            description:
              routeForm.description.trim() ||
              undefined,

            source_depot_id: sourceId,

            destination_depot_id:
              destinationId,

            is_recurring:
              routeForm.isRecurring,

            recurrence_rule:
              routeForm.isRecurring
                ? recurrence
                : "",

            is_permanent:
              routeForm.isPermanent,

            start_date:
              routeForm.startDate ||
              undefined,

            end_date:
              routeForm.endDate ||
              undefined,

            status: routeForm.status,
          });

        setRoutes((current) => [
          ...current,
          {
            id: created.id,

            sourceId:
              created.source_depot_id,

            destinationId:
              created.destination_depot_id ??
              "",

            name: created.name,
          },
        ]);

        setActivePanel("none");
      } catch (submitError) {
        setRouteError(
          submitError instanceof Error
            ? submitError.message
            : "Could not save the route. Please try again."
        );
      } finally {
        setRouteSaving(false);
      }
    });
  }

  /*
   * ------------------------------------------------------------
   * BACK TO CHOICES
   * ------------------------------------------------------------
   */

  function closePanel() {
    setActivePanel("none");

    setSearchResults([]);

    setSelectedLocation(null);

    if (previewMarkerRef.current) {
      previewMarkerRef.current.remove();
      previewMarkerRef.current = null;
    }
  }

  /*
   * ------------------------------------------------------------
   * SAVE & CONTINUE
   * ------------------------------------------------------------
   */

  const canContinue =
    depots.length >= 2 &&
    routes.length >= 1 &&
    !loadError;

  function handleContinue() {
    if (!canContinue) {
      return;
    }

    /*
     * Depots and routes have already been
     * persisted to the backend on each
     * confirm action.
     */

    navigate("/onboarding/fleet", {
      viewTransition: true,
    });
  }

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <div className="infrastructure-page">
      <header className="infrastructure-header">
        <div className="infrastructure-brand">
          EVORA
        </div>

        <button
          className={`continue-button ${canContinue
              ? "is-valid"
              : ""
            }`}
          disabled={!canContinue}
          onClick={
            handleContinue
          }
        >
          Save &amp; Continue
          <span>→</span>
        </button>
      </header>

      <main className="infrastructure-content">
        <section className="infrastructure-intro">
          <div>
            <p className="section-eyebrow">
              INFRASTRUCTURE
            </p>

            <h1>
              Tell us about your depots and routes.
            </h1>

            <p className="intro-copy">
              Set up your operating network so EVORA can
              understand where your fleet is based and how
              it moves.
            </p>
          </div>
        </section>

        <section className="infrastructure-workspace">
          <aside className="infrastructure-sidebar">
            <div className="count-grid">
              <div className="count-card">
                <span className="count-label">
                  DEPOTS
                </span>

                <strong>
                  {String(
                    depots.length
                  ).padStart(
                    2,
                    "0"
                  )}
                </strong>
              </div>

              <div className="count-card">
                <span className="count-label">
                  ROUTES
                </span>

                <strong>
                  {String(
                    routes.length
                  ).padStart(
                    2,
                    "0"
                  )}
                </strong>
              </div>
            </div>

            {loadError && (
              <div className="infrastructure-load-error">
                <p>
                  {loadError}
                </p>

                <button
                  className="load-retry"
                  type="button"
                  onClick={fetchInfrastructure}
                >
                  Retry ↻
                </button>
              </div>
            )}

            {activePanel ===
              "none" && (
                <div className="choice-section">
                  <button
                    className="choice-button"
                    onClick={
                      openDepotForm
                    }
                  >
                    <span className="choice-left">
                      <span className="choice-plus">
                        +
                      </span>

                      <span>
                        Add Depot
                      </span>
                    </span>

                    <span className="choice-arrow">
                      →
                    </span>
                  </button>

                  <button
                    className="choice-button"
                    onClick={
                      openRouteForm
                    }
                  >
                    <span className="choice-left">
                      <span className="choice-plus">
                        +
                      </span>

                      <span>
                        Add Route
                      </span>
                    </span>

                    <span className="choice-arrow">
                      →
                    </span>
                  </button>

                  {depots.length >
                    0 && (
                      <div className="added-summary">
                        <p>
                          NETWORK
                        </p>

                        {depots.map(
                          (
                            depot,
                            index
                          ) => (
                            <div
                              className="summary-row"
                              key={
                                depot.id
                              }
                            >
                              <span>
                                {String(
                                  index +
                                  1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              <strong>
                                {
                                  depot.name
                                }
                              </strong>
                            </div>
                          )
                        )}

                        {routes.map(
                          (
                            route,
                            index
                          ) => (
                            <div
                              className="summary-row route-row"
                              key={
                                route.id
                              }
                            >
                              <span>
                                R{String(
                                  index +
                                  1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                              </span>

                              <strong>
                                {
                                  route.name
                                }
                              </strong>
                            </div>
                          )
                        )}

                        {routes.length >
                          0 && (
                            <div className="route-summary">
                              <span>
                                {
                                  routes.length
                                }{" "}
                                confirmed{" "}
                                {routes.length ===
                                  1
                                  ? "route"
                                  : "routes"}
                              </span>
                            </div>
                          )}
                      </div>
                    )}
                </div>
              )}

            {activePanel ===
              "depot" && (
                <div className="form-panel">
                  <button
                    className="back-button"
                    onClick={
                      closePanel
                    }
                  >
                    ← Back
                  </button>

                  <div className="form-heading">
                    <p className="section-eyebrow">
                      NEW DEPOT
                    </p>

                    <h2>
                      Depot details
                    </h2>
                  </div>

                  <div className="form-fields">
                    <label className="field">
                      <span>
                        Depot name{" "}
                        <em>*</em>
                      </span>

                      <input
                        type="text"
                        placeholder="e.g. North Delhi Hub"
                        value={
                          depotForm.name
                        }
                        onChange={(
                          event
                        ) =>
                          updateDepotForm(
                            "name",
                            event.target
                              .value
                          )
                        }
                      />
                    </label>

                    <label className="field address-field">
                      <span>
                        Address{" "}
                        <em>*</em>
                      </span>

                      <input
                        type="text"
                        placeholder="Search location..."
                        value={
                          depotForm.address
                        }
                        onChange={(
                          event
                        ) => {
                          updateDepotForm(
                            "address",
                            event.target
                              .value
                          );

                          setSelectedLocation(
                            null
                          );
                        }}
                      />

                      {isSearching && (
                        <span className="search-status">
                          Searching...
                        </span>
                      )}

                      {searchResults.length >
                        0 && (
                          <div className="address-results">
                            {searchResults.map(
                              (
                                result
                              ) => (
                                <button
                                  key={
                                    result.place_id
                                  }
                                  type="button"
                                  onClick={() =>
                                    selectSearchResult(
                                      result
                                    )
                                  }
                                >
                                  <span className="result-pin">
                                    •
                                  </span>

                                  <span>
                                    {
                                      result.display_name
                                    }
                                  </span>
                                </button>
                              )
                            )}
                          </div>
                        )}
                    </label>

                    <div className="location-status">
                      <span
                        className={
                          selectedLocation
                            ? "status-dot confirmed"
                            : "status-dot"
                        }
                      />

                      <div>
                        <strong>
                          {selectedLocation
                            ? "Location selected"
                            : "Location not confirmed"}
                        </strong>

                        <small>
                          {selectedLocation
                            ? `${selectedLocation.lat.toFixed(
                              5
                            )}, ${selectedLocation.lng.toFixed(
                              5
                            )} · Drag the pin to adjust`
                            : "Choose an address, then adjust the map pin if needed."}
                        </small>
                      </div>
                    </div>

                    <div className="field-row">
                      <label className="field">
                        <span>
                          Parking capacity
                        </span>

                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={
                            depotForm.parking_capacity
                          }
                          onChange={(
                            event
                          ) =>
                            updateDepotForm(
                              "parking_capacity",
                              event.target
                                .value
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        <span>
                          Charger count
                        </span>

                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={
                            depotForm.charger_count
                          }
                          onChange={(
                            event
                          ) =>
                            updateDepotForm(
                              "charger_count",
                              event.target
                                .value
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="field-row">
                      <label className="field">
                        <span>
                          Maintenance bays
                        </span>

                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={
                            depotForm.maintenance_bays
                          }
                          onChange={(
                            event
                          ) =>
                            updateDepotForm(
                              "maintenance_bays",
                              event.target
                                .value
                            )
                          }
                        />
                      </label>

                      <div className="field">
                        <span>
                          Operating hours
                        </span>

                        <div className="time-row">
                          <input
                            type="time"
                            value={
                              depotForm.operating_open
                            }
                            onChange={(
                              event
                            ) =>
                              updateDepotForm(
                                "operating_open",
                                event.target
                                  .value
                              )
                            }
                          />

                          <span>
                            —
                          </span>

                          <input
                            type="time"
                            value={
                              depotForm.operating_close
                            }
                            onChange={(
                              event
                            ) =>
                              updateDepotForm(
                                "operating_close",
                                event.target
                                  .value
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="toggle-section">
                      <span className="toggle-title">
                        Facilities
                      </span>

                      <button
                        type="button"
                        className={`toggle-row ${depotForm.workshop_available
                            ? "selected"
                            : ""
                          }`}
                        onClick={() =>
                          updateDepotForm(
                            "workshop_available",
                            !depotForm.workshop_available
                          )
                        }
                      >
                        <span>
                          Workshop available
                        </span>

                        <span className="toggle">
                          <span />
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`toggle-row ${depotForm.fuel_station_available
                            ? "selected"
                            : ""
                          }`}
                        onClick={() =>
                          updateDepotForm(
                            "fuel_station_available",
                            !depotForm.fuel_station_available
                          )
                        }
                      >
                        <span>
                          Fuel station available
                        </span>

                        <span className="toggle">
                          <span />
                        </span>
                      </button>

                      <button
                        type="button"
                        className={`toggle-row ${depotForm.charging_available
                            ? "selected"
                            : ""
                          }`}
                        onClick={() =>
                          updateDepotForm(
                            "charging_available",
                            !depotForm.charging_available
                          )
                        }
                      >
                        <span>
                          Charging available
                        </span>

                        <span className="toggle">
                          <span />
                        </span>
                      </button>
                    </div>

                    <label className="field">
                      <span>
                        Depot manager name
                      </span>

                      <input
                        type="text"
                        placeholder="Manager name"
                        value={
                          depotForm.depot_manager_name
                        }
                        onChange={(
                          event
                        ) =>
                          updateDepotForm(
                            "depot_manager_name",
                            event.target
                              .value
                          )
                        }
                      />
                    </label>

                    <label className="field">
                      <span>
                        Depot manager contact
                      </span>

                      <input
                        type="tel"
                        placeholder="+91 XXXXX XXXXX"
                        value={
                          depotForm.depot_manager_contact
                        }
                        onChange={(
                          event
                        ) =>
                          updateDepotForm(
                            "depot_manager_contact",
                            event.target
                              .value
                          )
                        }
                      />
                    </label>

                    {depotError && (
                      <p
                        className="panel-error"
                        role="alert"
                      >
                        {depotError}
                      </p>
                    )}

                    <button
                      className="primary-action"
                      type="button"
                      disabled={
                        depotSaving ||
                        !depotForm.name.trim() ||
                        !depotForm.address.trim() ||
                        !selectedLocation
                      }
                      onClick={
                        confirmDepot
                      }
                    >
                      {depotSaving
                        ? "SAVING…"
                        : "Confirm Depot"}
                      <span>
                        →
                      </span>
                    </button>
                  </div>
                </div>
              )}

            {activePanel ===
              "route" && (
                <div className="form-panel route-panel">
                  <button
                    className="back-button"
                    onClick={
                      closePanel
                    }
                  >
                    ← Back
                  </button>

                  <div className="form-heading">
                    <p className="section-eyebrow">
                      NEW ROUTE
                    </p>

                    <h2>
                      Connect two depots
                    </h2>

                    <p>
                      Select where the route starts and where
                      it ends.
                    </p>
                  </div>

                  <div className="route-selects">
                    <div className="route-field">
                      <span className="route-field-number">
                        01
                      </span>

                      <label>
                        <span>
                          Source
                        </span>

                        <select
                          value={
                            sourceId
                          }
                          onChange={(
                            event
                          ) =>
                            setSourceId(
                              event.target
                                .value
                            )
                          }
                        >
                          <option value="">
                            Select source depot
                          </option>

                          {depots.map(
                            (
                              depot
                            ) => (
                              <option
                                key={
                                  depot.id
                                }
                                value={
                                  depot.id
                                }
                              >
                                {
                                  depot.name
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>

                    <div className="route-connector" />

                    <div className="route-field">
                      <span className="route-field-number">
                        02
                      </span>

                      <label>
                        <span>
                          Destination
                        </span>

                        <select
                          value={
                            destinationId
                          }
                          onChange={(
                            event
                          ) =>
                            setDestinationId(
                              event.target
                                .value
                            )
                          }
                        >
                          <option value="">
                            Select destination depot
                          </option>

                          {depots.map(
                            (
                              depot
                            ) => (
                              <option
                                key={
                                  depot.id
                                }
                                value={
                                  depot.id
                                }
                              >
                                {
                                  depot.name
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="route-map-note">
                    <span>
                      ●
                    </span>

                    <p>
                      Select a source and destination to
                      highlight the route on the map.
                    </p>
                  </div>

                  <div className="route-extra-fields">
                    <label className="field">
                      <span>
                        Route name{" "}
                        <em>*</em>
                      </span>

                      <input
                        type="text"
                        placeholder="e.g. North–South shuttle"
                        value={
                          routeForm.name
                        }
                        onChange={(
                          event
                        ) =>
                          setRouteForm(
                            (current) => ({
                              ...current,
                              name: event.target.value,
                            })
                          )
                        }
                      />
                    </label>

                    <label className="field">
                      <span>
                        Description
                      </span>

                      <textarea
                        rows={2}
                        placeholder="Optional notes about this route"
                        value={
                          routeForm.description
                        }
                        onChange={(
                          event
                        ) =>
                          setRouteForm(
                            (current) => ({
                              ...current,
                              description:
                                event.target.value,
                            })
                          )
                        }
                      />
                    </label>

                    <div className="route-toggles">
                      <button
                        type="button"
                        className={`route-toggle${
                          routeForm.isRecurring
                            ? " is-on"
                            : ""
                        }`}
                        onClick={() =>
                          setRouteForm(
                            (current) => ({
                              ...current,
                              isRecurring:
                                !current.isRecurring,
                            })
                          )
                        }
                      >
                        Recurring
                      </button>

                      <button
                        type="button"
                        className={`route-toggle${
                          routeForm.isPermanent
                            ? " is-on"
                            : ""
                        }`}
                        onClick={() =>
                          setRouteForm(
                            (current) => ({
                              ...current,
                              isPermanent:
                                !current.isPermanent,
                            })
                          )
                        }
                      >
                        Permanent
                      </button>
                    </div>

                    {routeForm.isRecurring && (
                      <div className="recurrence-section">
                        <label className="field">
                          <span>
                            Recurrence pattern
                          </span>

                          <select
                            value={
                              routeForm.pattern
                            }
                            onChange={(
                              event
                            ) =>
                              setRouteForm(
                                (current) => ({
                                  ...current,
                                  pattern: event
                                    .target
                                    .value as RecurrencePattern,
                                })
                              )
                            }
                          >
                            {RECURRENCE_PATTERNS.map(
                              (
                                pattern
                              ) => (
                                <option
                                  key={
                                    pattern.value
                                  }
                                  value={
                                    pattern.value
                                  }
                                >
                                  {
                                    pattern.label
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </label>

                        {(routeForm.pattern ===
                          "daily_n" ||
                          routeForm.pattern ===
                            "weekly" ||
                          routeForm.pattern ===
                            "weekly_n" ||
                          routeForm.pattern ===
                            "monthly") && (
                          <p className="recurrence-hint">
                            Saved rule:{" "}
                            <code>
                              {
                                buildRecurrenceRule(
                                  routeForm
                                )
                              }
                            </code>
                          </p>
                        )}

                        {routeForm.pattern ===
                          "custom" && (
                          <label className="field">
                            <span>
                              Custom rule{" "}
                              <em>*</em>
                            </span>

                            <input
                              type="text"
                              placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE"
                              value={
                                routeForm.customRule
                              }
                              onChange={(
                                event
                              ) =>
                                setRouteForm(
                                  (current) => ({
                                    ...current,
                                    customRule:
                                      event.target.value,
                                  })
                                )
                              }
                            />
                          </label>
                        )}

                        {(routeForm.pattern ===
                          "daily_n" ||
                          routeForm.pattern ===
                            "weekly_n") && (
                          <label className="field">
                            <span>
                              {routeForm.pattern ===
                              "daily_n"
                                ? "Every N days"
                                : "Every N weeks"}
                            </span>

                            <input
                              type="number"
                              min={1}
                              value={
                                routeForm.pattern ===
                                "daily_n"
                                  ? routeForm.intervalDays
                                  : routeForm.weekInterval
                              }
                              onChange={(
                                event
                              ) =>
                                setRouteForm(
                                  (current) => ({
                                    ...current,
                                    [routeForm.pattern ===
                                      "daily_n"
                                      ? "intervalDays"
                                      : "weekInterval"]:
                                      event.target.value,
                                  } as RouteForm)
                                )
                              }
                            />
                          </label>
                        )}

                        {(routeForm.pattern ===
                          "weekly" ||
                          routeForm.pattern ===
                            "weekly_n") && (
                          <div className="field">
                            <span>
                              Days of week
                            </span>

                            <div className="weekday-chips">
                              {WEEKDAY_OPTIONS.map(
                                (
                                  weekday
                                ) => {
                                  const selected =
                                    routeForm.weekDays.includes(
                                      weekday.value
                                    );

                                  return (
                                    <button
                                      key={
                                        weekday.value
                                      }
                                      type="button"
                                      className={`weekday-chip${
                                        selected
                                          ? " is-on"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        setRouteForm(
                                          (
                                            current
                                          ) => ({
                                            ...current,
                                            weekDays:
                                              selected
                                                ? current.weekDays.filter(
                                                    (
                                                      value
                                                    ) =>
                                                      value !==
                                                      weekday.value
                                                  )
                                                : [
                                                    ...current.weekDays,
                                                    weekday.value,
                                                  ],
                                          })
                                        )
                                      }
                                    >
                                      {
                                        weekday.label
                                      }
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}

                        {routeForm.pattern ===
                          "monthly" && (
                          <label className="field">
                            <span>
                              Day of month
                            </span>

                            <input
                              type="number"
                              min={1}
                              max={31}
                              value={
                                routeForm.monthDay
                              }
                              onChange={(
                                event
                              ) =>
                                setRouteForm(
                                  (current) => ({
                                    ...current,
                                    monthDay:
                                      event.target.value,
                                  })
                                )
                              }
                            />
                          </label>
                        )}
                      </div>
                    )}

                    <div className="form-grid">
                      <label className="field">
                        <span>
                          Start date
                        </span>

                        <input
                          type="date"
                          value={
                            routeForm.startDate
                          }
                          onChange={(
                            event
                          ) =>
                            setRouteForm(
                              (current) => ({
                                ...current,
                                startDate:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        <span>
                          End date
                        </span>

                        <input
                          type="date"
                          value={
                            routeForm.endDate
                          }
                          onChange={(
                            event
                          ) =>
                            setRouteForm(
                              (current) => ({
                                ...current,
                                endDate:
                                  event.target.value,
                              })
                            )
                          }
                        />
                      </label>
                    </div>

                    <label className="field">
                      <span>
                        Status
                      </span>

                      <select
                        value={
                          routeForm.status
                        }
                        onChange={(
                          event
                        ) =>
                          setRouteForm(
                            (current) => ({
                              ...current,
                              status: event.target
                                .value as JobTemplateStatus,
                            })
                          )
                        }
                      >
                        <option value="ACTIVE">
                          Active
                        </option>

                        <option value="PAUSED">
                          Paused
                        </option>
                      </select>
                    </label>
                  </div>

                  {routeError && (
                    <p
                      className="panel-error"
                      role="alert"
                    >
                      {routeError}
                    </p>
                  )}

                  <button
                    className="primary-action"
                    type="button"
                    disabled={
                      routeSaving ||
                      !routeForm.name.trim() ||
                      !sourceId ||
                      !destinationId ||
                      sourceId ===
                      destinationId
                    }
                    onClick={
                      confirmRoute
                    }
                  >
                    {routeSaving
                      ? "SAVING…"
                      : "Confirm Route"}
                    <span>
                      →
                    </span>
                  </button>
                </div>
              )}
          </aside>

          <section className="map-section">
            <div className="map-header">
              <div>
                <span className="map-title">
                  OPERATING NETWORK
                </span>

                <span className="map-subtitle">
                  {depots.length ===
                    0
                    ? "Add a depot to begin"
                    : `${depots.length} ${depots.length ===
                      1
                      ? "depot"
                      : "depots"
                    } on the map`}
                </span>
              </div>

              <span className="map-live">
                <span />
                LIVE
              </span>
            </div>

            <div
              ref={
                mapElementRef
              }
              className="infrastructure-map"
            />

            {activePanel ===
              "depot" &&
              selectedLocation && (
                <div className="map-instruction">
                  <span>
                    ↕
                  </span>

                  Drag the pin to adjust the exact location
                </div>
              )}

            {activePanel ===
              "route" &&
              sourceId &&
              destinationId && (
                <div className="route-map-legend">
                  <div>
                    <span className="legend-dot source" />
                    Source
                  </div>

                  <div>
                    <span className="legend-dot destination" />
                    Destination
                  </div>
                </div>
              )}

            {/* Empty map state intentionally omitted. */}
          </section>
        </section>
      </main>
    </div>
  );
}