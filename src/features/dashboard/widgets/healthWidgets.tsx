import { ShieldCheck, Wrench } from "lucide-react";

import { daysUntil, formatDate, formatNumber } from "../../../lib/format";
import {
  INSURANCE_WARNING_DAYS,
  LICENSE_WARNING_DAYS,
  isOperational,
  vehicleIssues,
} from "../model/fleetModel";
import { useDashboardData } from "../useDashboardData";
import {
  BigNumber,
  Donut,
  HBarList,
  Legend,
  ListRow,
  Pill,
  ProgressBar,
  WidgetEmpty,
  type LegendItem,
} from "./primitives";

function NoVehicles() {
  return (
    <WidgetEmpty
      icon={Wrench}
      title="No vehicles added yet"
      text="Maintenance and insurance status appears once your fleet is added."
      actionLabel="Add vehicles"
      to="/fleets"
    />
  );
}

function useMaintenanceBreakdown() {
  const { snapshot } = useDashboardData();
  const now = new Date();

  let healthy = 0;
  let underMaintenance = 0;
  let insurance = 0;
  let notOperational = 0;

  for (const vehicle of snapshot.vehicles) {
    if (vehicle.status === "under_maintenance") {
      underMaintenance += 1;
      continue;
    }

    if (!isOperational(vehicle)) {
      notOperational += 1;
      continue;
    }

    const issues = vehicleIssues(vehicle, now);
    if (issues.length > 0) insurance += 1;
    else healthy += 1;
  }

  return { healthy, underMaintenance, insurance, notOperational };
}

export function MaintenanceOverviewWidget() {
  const { stats } = useDashboardData();
  const breakdown = useMaintenanceBreakdown();

  if (stats.total === 0) return <NoVehicles />;

  const operational = breakdown.healthy + breakdown.insurance + breakdown.underMaintenance;
  const percent = operational ? (breakdown.healthy / operational) * 100 : 0;

  return (
    <>
      <div className="w-row-stat">
        <span>Healthy</span>
        <strong>{formatNumber(breakdown.healthy)}</strong>
      </div>
      <ProgressBar percent={percent} />
      <div className="w-row-stat">
        <span>Insurance needs a look</span>
        <strong className="w-amber">{formatNumber(breakdown.insurance)}</strong>
      </div>
      <div className="w-row-stat">
        <span>Under maintenance</span>
        <strong className="w-error">{formatNumber(breakdown.underMaintenance)}</strong>
      </div>
    </>
  );
}

export function MaintenanceDonutWidget() {
  const { stats } = useDashboardData();
  const breakdown = useMaintenanceBreakdown();

  if (stats.total === 0) return <NoVehicles />;

  const items: LegendItem[] = [
    { label: "Healthy", value: breakdown.healthy, tone: "green" },
    { label: "Insurance issue", value: breakdown.insurance, tone: "amber" },
    { label: "Under maintenance", value: breakdown.underMaintenance, tone: "error" },
    { label: "Not operational", value: breakdown.notOperational, tone: "muted" },
  ];

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

export function UnderMaintenanceWidget() {
  const { snapshot, stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const list = snapshot.vehicles.filter((vehicle) => vehicle.status === "under_maintenance");

  if (list.length === 0) {
    return (
      <WidgetEmpty
        icon={ShieldCheck}
        title="Nothing in the workshop"
        text="Vehicles marked as under maintenance will be listed here."
      />
    );
  }

  return (
    <div className="w-list">
      {list.slice(0, 7).map((vehicle) => (
        <ListRow
          key={vehicle.id}
          tone="amber"
          to={`/fleets?vehicle=${vehicle.id}`}
          primary={vehicle.registration_number}
          secondary={[vehicle.manufacturer, vehicle.model].filter(Boolean).join(" ")}
          trailing={<Pill tone="amber">In workshop</Pill>}
        />
      ))}
      {list.length > 7 && <p className="w-note">+{list.length - 7} more</p>}
    </div>
  );
}

export function InsuranceRenewalsWidget() {
  const { snapshot, stats } = useDashboardData();
  if (stats.total === 0) return <NoVehicles />;

  const now = new Date();
  const due = snapshot.vehicles
    .filter((vehicle) => vehicle.status !== "retired" && vehicle.status !== "sold")
    .map((vehicle) => ({ vehicle, days: daysUntil(vehicle.insurance_expiry, now) }))
    .filter((item): item is { vehicle: typeof item.vehicle; days: number } =>
      item.days !== null && item.days <= INSURANCE_WARNING_DAYS * 2,
    )
    .sort((a, b) => a.days - b.days);

  if (due.length === 0) {
    return (
      <WidgetEmpty
        icon={ShieldCheck}
        title="No renewals coming up"
        text={`Nothing expires in the next ${INSURANCE_WARNING_DAYS * 2} days.`}
      />
    );
  }

  return (
    <div className="w-list">
      {due.slice(0, 6).map(({ vehicle, days }) => (
        <ListRow
          key={vehicle.id}
          tone={days < 0 ? "error" : "amber"}
          to={`/fleets?vehicle=${vehicle.id}`}
          primary={vehicle.registration_number}
          secondary={`Expires ${formatDate(vehicle.insurance_expiry)}`}
          trailing={
            <Pill tone={days < 0 ? "error" : "amber"}>
              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `in ${days}d`}
            </Pill>
          }
        />
      ))}
    </div>
  );
}

export function LicenceRenewalsWidget() {
  const { snapshot } = useDashboardData();

  if (snapshot.drivers.length === 0) {
    return (
      <WidgetEmpty
        icon={ShieldCheck}
        title="No drivers added yet"
        actionLabel="Add drivers"
        to="/fleets"
      />
    );
  }

  const now = new Date();
  const due = snapshot.drivers
    .filter((driver) => driver.status === "active")
    .map((driver) => ({ driver, days: daysUntil(driver.license_expiry, now) }))
    .filter((item): item is { driver: typeof item.driver; days: number } =>
      item.days !== null && item.days <= LICENSE_WARNING_DAYS * 2,
    )
    .sort((a, b) => a.days - b.days);

  if (due.length === 0) {
    return (
      <WidgetEmpty
        icon={ShieldCheck}
        title="All licences are in date"
        text={`Nothing expires in the next ${LICENSE_WARNING_DAYS * 2} days.`}
      />
    );
  }

  return (
    <div className="w-list">
      {due.slice(0, 6).map(({ driver, days }) => (
        <ListRow
          key={driver.id}
          tone={days < 0 ? "error" : "amber"}
          to={`/fleets?driver=${driver.id}`}
          primary={driver.name}
          secondary={`Licence ${driver.license_class} · expires ${formatDate(driver.license_expiry)}`}
          trailing={
            <Pill tone={days < 0 ? "error" : "amber"}>
              {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `in ${days}d`}
            </Pill>
          }
        />
      ))}
    </div>
  );
}

export function BatteryCapacityWidget() {
  const { snapshot, stats } = useDashboardData();

  if (stats.ev === 0) {
    return (
      <WidgetEmpty
        icon={Wrench}
        title="No electric vehicles yet"
        text="Battery capacity for your EVs will appear here."
        actionLabel="Add vehicles"
        to="/fleets"
      />
    );
  }

  if (stats.evBatteryCount === 0) {
    return (
      <WidgetEmpty
        icon={Wrench}
        title="No battery capacity recorded"
        text="Add the battery size (kWh) to your EVs to see it here."
        actionLabel="Update vehicles"
        to="/fleets"
      />
    );
  }

  const top = snapshot.vehicles
    .filter((vehicle) => vehicle.fuel_type === "ev" && vehicle.battery_capacity_kwh)
    .map((vehicle) => ({
      label: vehicle.registration_number,
      value: Number(vehicle.battery_capacity_kwh),
    }))
    .filter((item) => Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <>
      <BigNumber
        value={formatNumber(stats.evBatteryTotalKwh, 0)}
        unit="kWh installed"
        caption={`Avg ${formatNumber(stats.evBatteryAvgKwh ?? 0, 1)} kWh across ${formatNumber(stats.evBatteryCount)} EVs`}
      />
      <HBarList data={top.map((item) => ({ ...item, display: `${formatNumber(item.value, 1)} kWh` }))} />
    </>
  );
}
