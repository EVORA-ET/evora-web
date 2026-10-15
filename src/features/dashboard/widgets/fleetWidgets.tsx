import { Truck } from "lucide-react";

import { formatNumber } from "../../../lib/format";
import {
  VEHICLE_STATE_LABEL,
  fuelLabel,
  humanize,
  isOperational,
  vehicleIssues,
} from "../model/fleetModel";
import { useDashboardData } from "../useDashboardData";
import {
  BarChart,
  BigNumber,
  Donut,
  HBarList,
  Legend,
  ProgressBar,
  RingGauge,
  StackedBar,
  WidgetEmpty,
  type LegendItem,
} from "./primitives";

function NoVehicles() {
  return (
    <WidgetEmpty
      icon={Truck}
      title="No vehicles added yet"
      text="Add your fleet and this will fill in on its own."
      actionLabel="Add vehicles"
      to="/fleets"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Fleet status                                                        */
/* ------------------------------------------------------------------ */

function stateItems(stats: ReturnType<typeof useDashboardData>["stats"]): LegendItem[] {
  return [
    { label: VEHICLE_STATE_LABEL.on_trip, value: stats.stateCounts.on_trip, tone: "green" },
    { label: VEHICLE_STATE_LABEL.idle, value: stats.stateCounts.idle, tone: "slate" },
    { label: VEHICLE_STATE_LABEL.attention, value: stats.stateCounts.attention, tone: "amber" },
    { label: VEHICLE_STATE_LABEL.inactive, value: stats.stateCounts.inactive, tone: "muted" },
  ];
}

export function FleetStatusWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  return (
    <>
      <BigNumber value={formatNumber(stats.total)} unit={stats.total === 1 ? "vehicle" : "vehicles"} />
      <Legend columns={2} items={stateItems(stats)} />
    </>
  );
}

export function FleetStatusDonutWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const items = stateItems(stats);

  return (
    <div className="w-split">
      <Donut
        segments={items.map((item) => ({ label: item.label, value: Number(item.value), tone: item.tone }))}
        centerValue={formatNumber(stats.total)}
        centerLabel="vehicles"
      />
      <Legend items={items} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Composition                                                         */
/* ------------------------------------------------------------------ */

export function FleetCompositionWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  return (
    <div className="w-split">
      <Donut
        segments={[
          { label: "EV", value: stats.ev, tone: "green" },
          { label: "ICE", value: stats.ice, tone: "slate" },
        ]}
        centerValue={`${Math.round(stats.evShare ?? 0)}%`}
        centerLabel="electric"
      />
      <Legend
        items={[
          { label: "Electric (EV)", value: stats.ev, tone: "green" },
          { label: "Combustion (ICE)", value: stats.ice, tone: "slate" },
        ]}
      />
    </div>
  );
}

export function FleetCompositionBarWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const byFuel = Object.entries(stats.fuelCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <StackedBar
        segments={[
          { label: "EV", value: stats.ev, tone: "green" },
          { label: "ICE", value: stats.ice, tone: "slate" },
        ]}
      />
      <Legend
        columns={2}
        items={[
          { label: "EV", value: stats.ev, tone: "green" },
          { label: "ICE", value: stats.ice, tone: "slate" },
        ]}
      />
      <HBarList
        data={byFuel.map(([fuel, count]) => ({
          label: fuelLabel(fuel),
          value: count,
          tone: fuel === "ev" ? "green" : "slate",
        }))}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Active vehicles                                                     */
/* ------------------------------------------------------------------ */

export function ActiveVehiclesWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const share = stats.total ? (stats.activeStatus / stats.total) * 100 : 0;

  return (
    <>
      <BigNumber
        value={formatNumber(stats.activeStatus)}
        unit={`${share.toFixed(1)}% of fleet`}
        caption={
          stats.tripsInProgress > 0
            ? `${formatNumber(stats.stateCounts.on_trip)} on a trip right now`
            : "No trips in progress right now"
        }
      />
      <ProgressBar percent={share} />
    </>
  );
}

export function ActiveVehiclesRingWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const share = (stats.activeStatus / stats.total) * 100;

  return (
    <div className="w-split">
      <RingGauge
        percent={share}
        centerValue={formatNumber(stats.activeStatus)}
        centerLabel={`of ${formatNumber(stats.total)}`}
      />
      <Legend
        items={[
          { label: "Active", value: stats.activeStatus, tone: "primary" },
          { label: "Not active", value: stats.total - stats.activeStatus, tone: "muted" },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Availability, health, type, age                                     */
/* ------------------------------------------------------------------ */

export function VehicleAvailabilityWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const unavailable = stats.stateCounts.attention + stats.stateCounts.inactive;

  return (
    <>
      <BigNumber
        value={formatNumber(stats.stateCounts.idle)}
        unit="ready to dispatch"
        caption="Operational and not on a trip"
      />
      <HBarList
        max={stats.total}
        data={[
          { label: "Ready (idle)", value: stats.stateCounts.idle, tone: "green" },
          { label: "On a trip", value: stats.stateCounts.on_trip, tone: "primary" },
          { label: "Unavailable", value: unavailable, tone: "amber" },
        ]}
      />
    </>
  );
}

export function FleetHealthWidget() {
  const { snapshot, stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const now = new Date();
  const operational = snapshot.vehicles.filter(isOperational);
  const clean = operational.filter((vehicle) => vehicleIssues(vehicle, now).length === 0).length;
  const percent = operational.length ? (clean / operational.length) * 100 : 0;

  if (operational.length === 0) {
    return <WidgetEmpty icon={Truck} title="No operational vehicles" text="Vehicles that are active will be scored here." />;
  }

  return (
    <div className="w-split">
      <RingGauge
        percent={percent}
        tone={percent >= 80 ? "primary" : percent >= 50 ? "amber" : "error"}
        centerLabel="issue-free"
      />
      <div>
        <p className="w-note">
          {formatNumber(clean)} of {formatNumber(operational.length)} operational vehicles have no
          open maintenance or insurance issue.
        </p>
      </div>
    </div>
  );
}

export function VehiclesByTypeWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const entries = Object.entries(stats.typeCounts).sort((a, b) => b[1] - a[1]);

  return (
    <HBarList
      data={entries.map(([type, count]) => ({ label: humanize(type), value: count }))}
    />
  );
}

export function FleetAgeWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  return (
    <>
      <BigNumber
        value={stats.avgAgeYears !== null ? stats.avgAgeYears.toFixed(1) : "—"}
        unit="years average age"
      />
      <BarChart data={stats.ageBuckets.map((bucket) => ({ label: bucket.label, value: bucket.count }))} />
    </>
  );
}
