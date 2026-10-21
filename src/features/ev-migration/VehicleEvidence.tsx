import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { getVehicleUsage, type EvCandidate } from "../../lib/intelligenceApi";
import { getVehicle, type OpsVehicle } from "../../lib/opsApi";
import { fuelLabel, humanize } from "../operations/format";
import { useResource } from "../operations/hooks";
import { Pill } from "../operations/ui/Pill";
import { ErrorBlock, Skeleton } from "../operations/ui/states";
import { vehicleTone } from "../operations/ui/tones";
import { formatValue } from "../intelligence/format";
import { SUPPLY_HINT, inputLabel } from "../intelligence/labels";
import ObservationDrawer, { type ObservationPreset } from "../intelligence/ObservationDrawer";
import { Definition, Disclosure } from "../intelligence/ui";

const USAGE_WINDOW = 365;
const loadUsage = (p: { id: string }) => getVehicleUsage(p.id, USAGE_WINDOW);

/** Vehicle identity plus measured / planned / manually entered usage. */
export function VehicleEvidence({ vehicleId }: { vehicleId: string }) {
  const vehicle = useResource(getVehicle, vehicleId);
  const usageParams = useMemo(() => ({ id: vehicleId }), [vehicleId]);
  const usage = useResource(loadUsage, usageParams);
  const [recording, setRecording] = useState<ObservationPreset | null>(null);

  const v = vehicle.data && vehicle.data.id === vehicleId ? vehicle.data : undefined;
  const u = usage.data && usage.data.vehicle_id === vehicleId ? usage.data : undefined;

  if (vehicle.error && !v) return <ErrorBlock compact message={vehicle.error} onRetry={vehicle.reload} />;
  if (!v) return <Skeleton lines={5} />;

  const odo = u?.measured.odometer;
  const fuel = u?.measured.fuel_consumption;

  return (
    <section className="ops-card" aria-label="Vehicle profile">
      <div className="ops-card__head">
        <div>
          <h2>{v.registration_number}</h2>
          <p className="ops-card__sub">
            {[v.manufacturer, v.model, v.variant].filter(Boolean).join(" ")} · {humanize(v.vehicle_type)} ·{" "}
            {fuelLabel(v.fuel_type)} · {v.depot_name ?? "No depot"}
          </p>
        </div>
        <Pill tone={vehicleTone(v.status)}>{humanize(v.status)}</Pill>
      </div>

      {usage.error && !u ? (
        <ErrorBlock compact message={usage.error} onRetry={usage.reload} />
      ) : !u || !odo ? (
        <Skeleton lines={3} />
      ) : (
        <div className="intel-stack" style={{ gap: 12 }}>
          <div>
            <p className="intel-card-title">Measured (odometer readings, last {USAGE_WINDOW} days)</p>
            {odo.status === "ok" ? (
              <div className="ops-kv" style={{ marginTop: 8 }}>
                <div><span className="ops-muted">Annualised</span><strong>{formatValue(odo.annualised_distance_km, "km/yr", 0)}</strong></div>
                <div><span className="ops-muted">90th pct. day</span><strong>{formatValue(odo.daily.p90_km, "km", 0)}</strong></div>
                <div><span className="ops-muted">Max day</span><strong>{formatValue(odo.daily.max_observed_km, "km", 0)}</strong></div>
                <div><span className="ops-muted">Daily samples</span><strong>{odo.daily.sample_count}</strong></div>
              </div>
            ) : (
              <p className="ops-muted" style={{ margin: "4px 0 0" }}>
                {odo.status === "invalid" ? "Odometer series is invalid: " : "Not enough readings: "}
                {odo.reasons.join(" ")}
              </p>
            )}
            {odo.status === "ok" && odo.reasons.length > 0 && (
              <Definition>{odo.reasons.join(" ")}</Definition>
            )}
            <p className="ops-muted" style={{ margin: "6px 0 0" }}>
              Fuel economy from fill records:{" "}
              {fuel && fuel.status === "ok"
                ? formatValue(fuel.km_per_l ?? null, "km/L")
                : "not available (needs two full fills with odometer, 300+ km apart)"}
            </p>
            <button type="button" className="ops-link" style={{ marginTop: 6 }}
              onClick={() => setRecording({
                kind: "odometer_km",
                subject: { type: "vehicle", id: v.id, label: v.registration_number },
              })}>
              <Plus size={13} /> Record odometer reading
            </button>
          </div>

          <Disclosure title="Planned and manually entered figures" meta="not measured">
            <dl className="ops-deflist">
              <div className="ops-deflist__row">
                <dt>Largest planned day</dt>
                <dd>
                  {formatValue(u.planned.max_planned_day_km, "km", 0)}
                  <small className="ops-muted" style={{ display: "block" }}>
                    Route estimates of {u.planned.completed_jobs} completed jobs — planned, not measured
                  </small>
                </dd>
              </div>
              {(
                [
                  ["Average monthly km (record)", u.vehicle_record.avg_monthly_km, "km"],
                  ["Mileage (record)", u.vehicle_record.mileage_kmpl, "km/L"],
                  ["Maintenance / month (record)", u.vehicle_record.maintenance_cost_per_month, ""],
                  ["Rated payload (record)", v.payload_kg, "kg"],
                ] as [string, unknown, string][]
              ).map(([label, value, unit]) => (
                <div key={label} className="ops-deflist__row">
                  <dt>{label}</dt>
                  <dd>{formatValue(value as number | string | null, unit)}</dd>
                </div>
              ))}
            </dl>
            <Definition>
              Vehicle-record fields are single values with no date or source. They are used only as a
              labelled last resort and count as organization-provided evidence.
            </Definition>
          </Disclosure>
        </div>
      )}

      <ObservationDrawer open={Boolean(recording)} preset={recording ?? undefined}
        onClose={() => setRecording(null)} />
    </section>
  );
}

/** "How to supply" actions for the missing inputs of an assessment. */
export function SupplyActions({
  missing,
  vehicle,
  candidate,
  connector,
}: {
  missing: string[];
  vehicle: Pick<OpsVehicle, "id" | "registration_number" | "depot_id" | "depot_name"> | undefined;
  candidate: EvCandidate | undefined;
  connector?: "ac" | "dc";
}) {
  const [preset, setPreset] = useState<ObservationPreset | null>(null);
  const items = missing.filter((m) => SUPPLY_HINT[m]?.kind);
  if (items.length === 0) return null;

  const presetFor = (name: string): ObservationPreset | string => {
    const hint = SUPPLY_HINT[name];
    const qualifiers: Record<string, string> = {};
    if (hint.kind === "charger_power_kw" && connector) qualifiers.connector = connector;
    if (hint.kind === "vehicle_purchase_price") qualifiers.purpose = "candidate_quote";
    switch (hint.subject) {
      case "vehicle":
        return vehicle
          ? { kind: hint.kind, qualifiers, subject: { type: "vehicle", id: vehicle.id, label: vehicle.registration_number } }
          : "Select a vehicle first.";
      case "depot":
        return vehicle?.depot_id
          ? { kind: hint.kind, qualifiers, subject: { type: "depot", id: vehicle.depot_id, label: vehicle.depot_name ?? "" } }
          : "This vehicle has no depot. Assign one in Operations → Vehicles first.";
      case "ev_candidate":
        return candidate
          ? { kind: hint.kind, qualifiers, subject: { type: "ev_candidate", id: candidate.id, label: candidate.label } }
          : "Check an EV model first.";
      default:
        return { kind: hint.kind, qualifiers, subject: { type: "organization", id: null, label: "" } };
    }
  };

  return (
    <div className="intel-stack" style={{ gap: 6 }}>
      <p className="intel-card-title">Supply the missing evidence</p>
      <ul className="ops-rows">
        {items.map((name) => {
          const p = presetFor(name);
          return (
            <li key={name}>
              <div className="ops-rowbtn" style={{ cursor: "default" }}>
                <span className="ops-list__main">
                  <strong>{inputLabel(name)}</strong>
                  <small>{typeof p === "string" ? p : SUPPLY_HINT[name].text}</small>
                </span>
                {typeof p !== "string" && (
                  <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setPreset(p)}>
                    <Plus size={14} /> Record
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="ops-muted" style={{ margin: 0 }}>
        After recording, run the assessment again. Earlier assessments keep the inputs they used.
      </p>
      <ObservationDrawer open={Boolean(preset)} preset={preset ?? undefined} onClose={() => setPreset(null)} />
    </div>
  );
}
