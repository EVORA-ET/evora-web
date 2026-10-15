/** Initial filter state per workspace; shared so drill-through can pre-filter. */
export const WS = {
  depots: { key: "ops.depots", defaults: { charging: "", workshop: "" }, sort: "name" },
  fleets: { key: "ops.fleets", defaults: {}, sort: "name" },
  vehicles: {
    key: "ops.vehicles",
    defaults: { status: "", powertrain: "", fleet: "", depot: "", availability: "" },
    sort: "-created_at",
  },
  drivers: {
    key: "ops.drivers",
    defaults: { status: "", shift: "", availability: "" },
    sort: "name",
  },
  routes: {
    key: "ops.routes",
    defaults: { status: "", depot: "", recurring: "" },
    sort: "name",
  },
  jobs: {
    key: "ops.jobs",
    defaults: {
      range: "day",
      status: "",
      assignment: "",
      route: "",
      depot: "",
      vehicle: "",
      vehicle_label: "",
      driver: "",
      driver_label: "",
    },
    sort: "scheduled_start_at",
  },
  assignments: {
    key: "ops.assignments",
    defaults: { range: "day", assignment: "", status: "PENDING" },
    sort: "scheduled_start_at",
  },
} as const;
