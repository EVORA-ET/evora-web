import { Zap } from "lucide-react";

import { formatNumber } from "../../../lib/format";
import { useDashboardData } from "../useDashboardData";
import {
  BarChart,
  BigNumber,
  Legend,
  ProgressBar,
  RingGauge,
  WidgetEmpty,
} from "./primitives";

export function MigrationProgressWidget() {
  const { stats } = useDashboardData();

  if (stats.total === 0) {
    return (
      <WidgetEmpty
        icon={Zap}
        title="No vehicles added yet"
        text="Your EV share is calculated from the fleet you add."
        actionLabel="Add vehicles"
        to="/fleets"
      />
    );
  }

  return (
    <div className="w-split">
      <RingGauge
        percent={stats.evShare ?? 0}
        tone="green"
        centerValue={`${Math.round(stats.evShare ?? 0)}%`}
        centerLabel="electric"
      />
      <div>
        <Legend
          items={[
            { label: "Electric vehicles", value: stats.ev, tone: "green" },
            { label: "Still combustion", value: stats.ice, tone: "slate" },
          ]}
        />
      </div>
    </div>
  );
}

export function EvShareBarWidget() {
  const { stats } = useDashboardData();
  if (stats.total === 0) {
    return <WidgetEmpty icon={Zap} title="No vehicles added yet" actionLabel="Add vehicles" to="/fleets" />;
  }

  return (
    <>
      <BigNumber
        value={`${(stats.evShare ?? 0).toFixed(1)}%`}
        unit="of your fleet is electric"
        caption={`${formatNumber(stats.ev)} of ${formatNumber(stats.total)} vehicles`}
      />
      <ProgressBar percent={stats.evShare ?? 0} tone="green" />
    </>
  );
}

export function EvVsIceCostWidget() {
  const { stats } = useDashboardData();
  const { ev, ice } = stats.cost;

  if (ev.vehiclesWithData === 0 && ice.vehiclesWithData === 0) {
    return (
      <WidgetEmpty
        icon={Zap}
        title="No running costs recorded"
        text="Add monthly fuel and maintenance costs to your vehicles to compare EV and ICE."
        actionLabel="Update vehicles"
        to="/fleets"
      />
    );
  }

  const bar = (value: number | null) => Math.round(value ?? 0);

  return (
    <>
      <p className="w-note">Average monthly running cost per vehicle (fuel + maintenance)</p>
      <BarChart
        data={[
          { label: "EV", value: bar(ev.avgTotal), tone: "green", display: ev.avgTotal === null ? "—" : formatNumber(ev.avgTotal) },
          { label: "ICE", value: bar(ice.avgTotal), tone: "slate", display: ice.avgTotal === null ? "—" : formatNumber(ice.avgTotal) },
        ]}
      />
      <p className="w-note">
        Based on {formatNumber(ev.vehiclesWithData)} EV and {formatNumber(ice.vehiclesWithData)} ICE
        vehicles with cost data.
      </p>
    </>
  );
}
