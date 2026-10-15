import { Route as RouteIcon, UsersRound } from "lucide-react";

import { formatNumber } from "../../../lib/format";
import { TRIP_STATUS_LABEL } from "../model/fleetModel";
import { useDashboardData } from "../useDashboardData";
import {
  BarChart,
  BigNumber,
  Donut,
  HBarList,
  Legend,
  LineChart,
  ListRow,
  Pill,
  ProgressBar,
  RingGauge,
  WidgetEmpty,
  type LegendItem,
} from "./primitives";

function utilisationDelta(now: number | null, before: number | null): string | null {
  if (now === null || before === null) return null;

  const diff = now - before;
  if (Math.abs(diff) < 0.05) return "Same as last week";
  return `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pts vs last week`;
}

function NoTrips() {
  return (
    <WidgetEmpty
      icon={RouteIcon}
      title="No trips recorded yet"
      text="Once trips are scheduled against your routes they'll show up here."
      actionLabel="Set up routes"
      to="/fleets"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Utilisation                                                         */
/* ------------------------------------------------------------------ */

export function FleetUtilizationWidget() {
  const { stats } = useDashboardData();
  const hasTrips = stats.week.some((day) => day.trips > 0);

  if (stats.operational === 0 || !hasTrips) {
    return (
      <WidgetEmpty
        icon={RouteIcon}
        title="No trips in the last 7 days"
        text="Utilisation is the share of operational vehicles that ran a trip each day."
      />
    );
  }

  const delta = utilisationDelta(stats.weekAvgUtilisation, stats.previousWeekAvgUtilisation);

  return (
    <>
      <div className="w-kpi-line">
        <BigNumber
          value={`${(stats.weekAvgUtilisation ?? 0).toFixed(0)}%`}
          unit="avg. utilisation, last 7 days"
        />
        {delta && <Pill tone="green">{delta}</Pill>}
      </div>
      <BarChart
        emphasiseLast
        max={100}
        data={stats.week.map((day) => ({
          label: day.label,
          value: day.utilisation ?? 0,
          display: `${Math.round(day.utilisation ?? 0)}%`,
        }))}
      />
    </>
  );
}

export function FleetUtilizationLineWidget() {
  const { stats } = useDashboardData();
  const hasTrips = stats.week.some((day) => day.trips > 0);

  if (stats.operational === 0 || !hasTrips) {
    return <WidgetEmpty icon={RouteIcon} title="No trips in the last 7 days" />;
  }

  return (
    <>
      <div className="w-kpi-line">
        <BigNumber value={`${(stats.weekAvgUtilisation ?? 0).toFixed(0)}%`} unit="7-day average" />
      </div>
      <LineChart
        max={100}
        unit="%"
        data={stats.week.map((day) => ({ label: day.label, value: day.utilisation ?? 0 }))}
      />
    </>
  );
}

export function EvIceUtilizationWidget() {
  const { stats } = useDashboardData();
  const evTotal = stats.week.reduce((sum, day) => sum + day.ev, 0);
  const iceTotal = stats.week.reduce((sum, day) => sum + day.ice, 0);

  if (evTotal + iceTotal === 0) {
    return <WidgetEmpty icon={RouteIcon} title="No trips in the last 7 days" />;
  }

  const total = evTotal + iceTotal;

  return (
    <>
      <Legend
        columns={2}
        items={[
          { label: `EV trips · ${Math.round((evTotal / total) * 100)}%`, value: evTotal, tone: "green" },
          { label: `ICE trips · ${Math.round((iceTotal / total) * 100)}%`, value: iceTotal, tone: "slate" },
        ]}
      />
      <div className="w-grouped">
        {stats.week.map((day) => {
          const ceiling = Math.max(1, ...stats.week.map((d) => d.ev + d.ice));

          return (
            <div className="w-grouped__col" key={day.key}>
              <div className="w-grouped__stack">
                <span
                  className="w-grouped__seg w-grouped__seg--ice"
                  style={{ height: `${(day.ice / ceiling) * 100}%` }}
                  title={`ICE: ${day.ice}`}
                />
                <span
                  className="w-grouped__seg w-grouped__seg--ev"
                  style={{ height: `${(day.ev / ceiling) * 100}%` }}
                  title={`EV: ${day.ev}`}
                />
              </div>
              <span className="w-bars__label">{day.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Trips                                                               */
/* ------------------------------------------------------------------ */

export function ActiveTripsWidget() {
  const { snapshot, index, stats } = useDashboardData();

  if (snapshot.trips.length === 0) return <NoTrips />;

  const live = snapshot.trips.filter((trip) => trip.status === "IN_PROGRESS");

  if (live.length === 0) {
    return (
      <>
        <BigNumber value="0" unit="trips in progress" caption={`${formatNumber(stats.tripCounts.ASSIGNED)} assigned and waiting`} />
      </>
    );
  }

  return (
    <div className="w-list">
      {live.slice(0, 6).map((trip) => {
        const route = index.routeById.get(trip.job_template_id);
        const vehicle = index.vehicleById.get(trip.vehicle_id);
        const driver = index.driverById.get(trip.driver_id);
        const delay = index.maxDelayByTrip.get(trip.id) ?? 0;

        return (
          <div key={trip.id} className="w-trip">
            <ListRow
              primary={route?.name ?? "Route"}
              secondary={[vehicle?.registration_number, driver?.name].filter(Boolean).join(" · ")}
              trailing={delay > 0 ? <Pill tone="amber">{delay} min late</Pill> : <Pill tone="green">{trip.completion_percentage}%</Pill>}
            />
            <ProgressBar percent={trip.completion_percentage} tone={delay > 0 ? "amber" : "green"} />
          </div>
        );
      })}
    </div>
  );
}

function tripItems(stats: ReturnType<typeof useDashboardData>["stats"]): LegendItem[] {
  return [
    { label: TRIP_STATUS_LABEL.IN_PROGRESS, value: stats.tripCounts.IN_PROGRESS, tone: "primary" },
    { label: TRIP_STATUS_LABEL.ASSIGNED, value: stats.tripCounts.ASSIGNED, tone: "green" },
    { label: TRIP_STATUS_LABEL.PENDING, value: stats.tripCounts.PENDING, tone: "slate" },
    { label: TRIP_STATUS_LABEL.COMPLETED, value: stats.tripCounts.COMPLETED, tone: "mint" },
    { label: TRIP_STATUS_LABEL.CANCELLED, value: stats.tripCounts.CANCELLED, tone: "muted" },
  ];
}

export function TripStatusWidget() {
  const { snapshot, stats } = useDashboardData();
  if (snapshot.trips.length === 0) return <NoTrips />;

  const items = tripItems(stats);

  return (
    <div className="w-split">
      <Donut
        segments={items.map((item) => ({ label: item.label, value: Number(item.value), tone: item.tone }))}
        centerValue={formatNumber(snapshot.trips.length)}
        centerLabel="trips"
      />
      <Legend items={items} />
    </div>
  );
}

export function TripStatusBarsWidget() {
  const { snapshot, stats } = useDashboardData();
  if (snapshot.trips.length === 0) return <NoTrips />;

  return (
    <HBarList
      data={tripItems(stats).map((item) => ({
        label: item.label,
        value: Number(item.value),
        tone: item.tone,
      }))}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Drivers + location coverage                                         */
/* ------------------------------------------------------------------ */

export function DriverAssignmentsWidget() {
  const { stats } = useDashboardData();
  const { drivers } = stats;

  if (drivers.total === 0) {
    return (
      <WidgetEmpty
        icon={UsersRound}
        title="No drivers added yet"
        text="Add drivers to see who is on the road and which vehicles are unassigned."
        actionLabel="Add drivers"
        to="/fleets"
      />
    );
  }

  return (
    <>
      <BigNumber value={formatNumber(drivers.onTrip)} unit={`of ${formatNumber(drivers.total)} drivers on a trip`} />
      <Legend
        columns={2}
        items={[
          { label: "Active", value: drivers.active, tone: "green" },
          { label: "On leave", value: drivers.onLeave, tone: "amber" },
          { label: "Other status", value: drivers.other, tone: "muted" },
          { label: "Vehicles w/o driver", value: drivers.vehiclesWithoutDriver, tone: "slate" },
        ]}
      />
    </>
  );
}

export function VehicleLocationsWidget() {
  const { stats } = useDashboardData();

  if (stats.total === 0) {
    return <WidgetEmpty icon={RouteIcon} title="No vehicles added yet" actionLabel="Add vehicles" to="/fleets" />;
  }

  const percent = (stats.withLocation / stats.total) * 100;

  return (
    <div className="w-split">
      <RingGauge
        percent={percent}
        centerValue={formatNumber(stats.withLocation)}
        centerLabel={`of ${formatNumber(stats.total)}`}
      />
      <p className="w-note">
        {stats.withLocation === stats.total
          ? "Every vehicle is reporting a position on the map."
          : `${formatNumber(stats.withoutLocation)} ${stats.withoutLocation === 1 ? "vehicle has" : "vehicles have"} no location yet.`}
      </p>
    </div>
  );
}
