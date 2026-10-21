import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Gauge, Plus, Wrench } from "lucide-react";

import {
  getFleetMaintenanceStatus,
  getMaintenanceStatus,
  getVehicleUsage,
  listAssessments,
  listMaintenanceEventsPage,
  listObservationsPage,
  persistMaintenanceAssessment,
  type BatteryCheck,
  type MaintenanceStatus,
  type ServiceDimension,
} from "../../lib/intelligenceApi";
import { getVehicle, type OpsVehicle } from "../../lib/opsApi";
import { fuelLabel, humanize } from "../operations/format";
import { useDebounced, useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import { FilterSelect, SearchBox } from "../operations/ui/FilterBar";
import { Pill, type Tone } from "../operations/ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "../operations/ui/states";
import { vehicleTone } from "../operations/ui/tones";
import { formatDay, formatMoney, formatStamp, formatValue } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import { EVENT_TYPE_LABEL } from "../intelligence/labels";
import ObservationDrawer, { type ObservationPreset } from "../intelligence/ObservationDrawer";
import ProvenanceTable from "../intelligence/ProvenanceTable";
import { CoverageBadge, Definition, Disclosure, ServicePill, Segmented } from "../intelligence/ui";
import { loadAllVehicles } from "../intelligence/vehicles";
import { HEALTH_STATE_LABEL, healthStateOf, type VehicleHealthState } from "./healthState";
import { EventDrawer, RequirementDrawer, type FaultRef, type VehicleRef } from "./MaintenanceForms";

const WINDOWS = [
  { value: "90", label: "90 days" },
  { value: "365", label: "12 months" },
  { value: "730", label: "24 months" },
];

interface StatusParams {
  id: string;
  windowDays: number;
}
const loadStatus = (p: StatusParams) => getMaintenanceStatus(p.id, p.windowDays);

function dimensionText(d: ServiceDimension | undefined, unit: "time" | "distance"): string {
  if (!d) return "Not part of this requirement";
  if (d.status === "undetermined") return d.reason ?? "Undetermined";
  if (unit === "time") {
    const days = d.days_remaining ?? 0;
    return `Due ${formatDay(d.due_date)} · ${days < 0 ? `${-days} days overdue` : `${days} days left`}`;
  }
  const km = d.km_remaining ?? 0;
  return `Due at ${formatValue(d.due_odometer_km, "km", 0)} · ${km < 0 ? `${formatValue(-km, "km", 0)} overdue` : `${formatValue(km, "km", 0)} left`}`;
}

function Requirements({
  status,
  onAdd,
}: {
  status: MaintenanceStatus;
  onAdd: () => void;
}) {
  const reqs = status.result.service_requirements;
  return (
    <section className="ops-card" aria-labelledby="vh-reqs">
      <div className="ops-card__head">
        <h2 id="vh-reqs">Service schedule</h2>
        <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={onAdd}>
          <Plus size={15} /> Add requirement
        </button>
      </div>
      {reqs.length === 0 ? (
        <EmptyBlock compact title="No documented service intervals"
          text="Add the intervals from the owner's manual or service schedule, citing the document." />
      ) : (
        <div className="ops-table-scroll">
          <table className="ops-table">
            <caption className="ops-sr-only">Service requirements and their status</caption>
            <thead>
              <tr>
                <th scope="col">Requirement</th>
                <th scope="col">Status</th>
                <th scope="col">By time</th>
                <th scope="col">By distance</th>
              </tr>
            </thead>
            <tbody>
              {reqs.map((r) => (
                <tr key={r.requirement_id}>
                  <td>
                    {r.name}
                    <small className="ops-muted" style={{ display: "block" }}>
                      Every {[r.interval_km !== null && formatValue(r.interval_km, "km", 0), r.interval_days !== null && `${r.interval_days} days`]
                        .filter(Boolean).join(" or ")} · {r.source.title}
                    </small>
                    {r.notes.length > 0 && <small className="ops-muted" style={{ display: "block" }}>{r.notes.join(" ")}</small>}
                  </td>
                  <td><ServicePill status={r.status} /></td>
                  <td>{dimensionText(r.dimensions.time, "time")}</td>
                  <td>{dimensionText(r.dimensions.distance, "distance")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Definition>
        Due dates count from the last recorded service that satisfied each requirement. Without one, the status
        is undetermined rather than assumed.
      </Definition>
    </section>
  );
}

function Faults({
  status,
  onResolve,
  onReport,
}: {
  status: MaintenanceStatus;
  onResolve: (f: FaultRef) => void;
  onReport: () => void;
}) {
  const faults = status.result.open_faults;
  return (
    <section className="ops-card" aria-labelledby="vh-faults">
      <div className="ops-card__head">
        <h2 id="vh-faults">Open faults</h2>
        <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={onReport}>
          <Plus size={15} /> Report a fault
        </button>
      </div>
      {faults.length === 0 ? (
        <EmptyBlock compact title="No open fault reports" />
      ) : (
        <ul className="ops-rows">
          {faults.map((f) => (
            <li key={f.event_id}>
              <div className="ops-rowbtn" style={{ cursor: "default" }}>
                <span className="ops-list__main">
                  <strong>{[f.fault_code, f.component].filter(Boolean).join(" · ") || "Fault"}</strong>
                  <small>
                    Reported {formatDay(f.reported_on)} · open {f.days_open} days
                    {f.severity && ` · severity as recorded: ${f.severity}`}
                    {f.description && ` · ${f.description}`}
                  </small>
                </span>
                <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => onResolve(f)}>
                  <Wrench size={14} /> Record fix
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Definition>
        A fault stays open until a repair or replacement is recorded against it. The vehicle's operational status
        (for example "under maintenance") is not treated as a fault.
      </Definition>
    </section>
  );
}

function Battery({
  battery,
  vehicle,
  record,
}: {
  battery: BatteryCheck;
  vehicle: VehicleRef;
  record: (p: ObservationPreset) => void;
}) {
  const preset = (kind: string): ObservationPreset => ({
    kind,
    subject: { type: "vehicle", id: vehicle.id, label: vehicle.label },
  });
  const soh = battery.state_of_health;
  const cap = battery.capacity_retention;
  const soc = battery.state_of_charge;
  return (
    <section className="ops-card" aria-labelledby="vh-battery">
      <div className="ops-card__head"><h2 id="vh-battery">Battery</h2></div>
      <dl className="ops-deflist">
        <div className="ops-deflist__row">
          <dt>State of health (SoH)</dt>
          <dd>
            {soh ? (
              <>
                {formatValue(soh.pct, "%")} {soh.stale && <Pill tone="warn">stale</Pill>}
                <small className="ops-muted" style={{ display: "block" }}>
                  {soh.method ? humanize(soh.method) : "method not recorded"} · {formatDay(soh.at)}
                  {soh.source ? ` · ${soh.source.title}` : " · no source cited"}
                  {soh.stale && soh.stale_reason && ` · ${soh.stale_reason}`}
                </small>
              </>
            ) : <span className="ops-muted">Not recorded</span>}
          </dd>
        </div>
        <div className="ops-deflist__row">
          <dt>Warranty SoH threshold</dt>
          <dd>
            {battery.warranty_threshold ? (
              <>
                {formatValue(battery.warranty_threshold.pct, "%")}
                {battery.warranty_check && (
                  <small className="ops-muted" style={{ display: "block" }}>{battery.warranty_check.explanation}</small>
                )}
              </>
            ) : <span className="ops-muted">Not recorded</span>}
          </dd>
        </div>
        <div className="ops-deflist__row">
          <dt>Capacity retention</dt>
          <dd>
            {cap ? (
              <>
                {formatValue(cap.retention_pct, "%")} ({formatValue(cap.measured_capacity_kwh, "kWh")} of{" "}
                {formatValue(cap.nominal_capacity_kwh, "kWh")} nominal)
                {cap.stale && <Pill tone="warn">stale</Pill>}
                <small className="ops-muted" style={{ display: "block" }}>
                  {cap.basis === "estimated" ? "Estimated" : "Measured"} · {humanize(cap.method)} · {formatDay(cap.at)}
                </small>
              </>
            ) : <span className="ops-muted">Not recorded</span>}
          </dd>
        </div>
        <div className="ops-deflist__row">
          <dt>State of charge (SoC)</dt>
          <dd>
            {soc ? (
              <>
                {formatValue(soc.pct, "%")} · {formatDay(soc.at)}
                <small className="ops-muted" style={{ display: "block" }}>{soc.note}</small>
              </>
            ) : <span className="ops-muted">Not recorded</span>}
          </dd>
        </div>
      </dl>
      {(battery.messages ?? []).length > 0 && (
        <ul className="intel-notes">{(battery.messages ?? []).map((m) => <li key={m}>{m}</li>)}</ul>
      )}
      <div className="intel-actions">
        <button type="button" className="ops-link" onClick={() => record(preset("battery_soh_pct"))}><Plus size={13} /> Record SoH</button>
        <button type="button" className="ops-link" onClick={() => record(preset("battery_capacity_kwh"))}><Plus size={13} /> Record capacity</button>
        <button type="button" className="ops-link" onClick={() => record(preset("battery_warranty_soh_threshold_pct"))}><Plus size={13} /> Record warranty threshold</button>
        <button type="button" className="ops-link" onClick={() => record(preset("battery_soc_pct"))}><Plus size={13} /> Record SoC</button>
      </div>
      <Definition>
        State of charge is how full the battery is right now; it says nothing about battery health and is never
        used as a health input. Only recorded readings are shown — no degradation forecast is made.
      </Definition>
    </section>
  );
}

function Records({ status }: { status: MaintenanceStatus }) {
  const r = status.result.records;
  const costs = Object.entries(r.recorded_cost_by_currency);
  return (
    <section className="ops-card" aria-labelledby="vh-records">
      <div className="ops-card__head">
        <h2 id="vh-records">Recorded maintenance</h2>
        <span className="ops-muted">{formatDay(r.window.start)} – {formatDay(r.window.end)}</span>
      </div>
      <div className="ops-kv">
        <div><span className="ops-muted">Events</span><strong>{r.event_count}</strong></div>
        <div><span className="ops-muted">Repairs</span><strong>{r.repair_count}</strong></div>
        <div>
          <span className="ops-muted">Recorded cost</span>
          <strong>{costs.length ? costs.map(([c, v]) => formatMoney(v, c)).join(" + ") : "None recorded"}</strong>
        </div>
        <div>
          <span className="ops-muted">Recorded downtime</span>
          <strong>{r.recorded_downtime_hours !== null ? `${r.recorded_downtime_hours} h` : "None recorded"}</strong>
        </div>
      </div>
      <p className="ops-muted" style={{ margin: "8px 0 0" }}>
        {r.events_without_cost > 0 && `${r.events_without_cost} event(s) have no cost recorded. `}
        {r.event_count - r.events_with_downtime > 0 && `${r.event_count - r.events_with_downtime} event(s) have no downtime recorded. `}
        {r.note}
      </p>
    </section>
  );
}

const ALL_VEHICLES = {};
const FLEET_WINDOW = 365;
const STATE_TONE: Record<VehicleHealthState, Tone> = {
  overdue: "danger", due_soon: "warn", needs_info: "neutral", not_due: "ok", no_requirements: "neutral", not_evaluated: "neutral",
};

/** Every vehicle (ICE and EV) with its maintenance state; filters run on the loaded list. */
function HealthVehicleList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const vehicles = useResource(loadAllVehicles, ALL_VEHICLES);
  const fleet = useResource(getFleetMaintenanceStatus, FLEET_WINDOW);
  const [filter, setFilter] = useParam("filter");
  const [powertrain, setPowertrain] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim().toLowerCase());
  const rows = useMemo(() => {
    const byId = new Map((fleet.data?.vehicles ?? []).map((r) => [r.vehicle_id, r]));
    return (vehicles.data?.vehicles ?? [])
      .filter((v) => v.status !== "retired" && v.status !== "sold")
      .map((v) => ({ v, row: byId.get(v.id) }))
      .filter(({ v, row }) => {
        const st = healthStateOf(row);
        const text = `${v.registration_number} ${v.manufacturer} ${v.model}`.toLowerCase();
        const matches = !filter
          || (filter === "open_faults" ? (row?.counts.open_faults ?? 0) > 0
            : filter === "needs_info" ? st === "needs_info" || st === "no_requirements" || st === "not_evaluated"
              : st === filter);
        const pt = !powertrain || (powertrain === "ev" ? v.fuel_type === "ev" : v.fuel_type !== "ev");
        return (!q || text.includes(q)) && matches && pt;
      });
  }, [vehicles.data, fleet.data, filter, powertrain, q]);

  return (
    <section className="ops-card intel-panel" aria-labelledby="vh-list">
      <h2 id="vh-list" className="intel-card-title" style={{ marginBottom: 10 }}>Vehicles</h2>
      <div className="intel-stack" style={{ gap: 8 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Registration or model" label="Search vehicles" />
        <div className="ops-form__row">
          <FilterSelect label="Powertrain" value={powertrain} onChange={setPowertrain}
            options={[{ value: "", label: "All" }, { value: "ice", label: "ICE" }, { value: "ev", label: "EV" }]} />
          <FilterSelect label="Status" value={filter ?? ""} onChange={(v) => setFilter(v || null)}
            options={[{ value: "", label: "All" },
              ...(["overdue", "due_soon", "not_due", "no_requirements", "not_evaluated"] as const).map((k) => ({ value: k, label: HEALTH_STATE_LABEL[k] })),
              { value: "needs_info", label: "Needs information" },
              { value: "open_faults", label: "With open faults" }]} />
        </div>
      </div>
      {vehicles.error && !vehicles.data ? (
        <ErrorBlock compact message={vehicles.error} onRetry={vehicles.reload} />
      ) : !vehicles.data || !fleet.data ? (
        <Skeleton lines={6} />
      ) : rows.length === 0 ? (
        <EmptyBlock compact title={vehicles.data.vehicles.length ? "No vehicles match" : "No vehicles recorded"} />
      ) : (
        <ul className="intel-picker__list" aria-label="Vehicles" style={{ marginTop: 10 }}>
          {rows.map(({ v, row }) => {
            const st = healthStateOf(row);
            return (
              <li key={v.id}>
                <button type="button" className="intel-picker__item" aria-current={v.id === selectedId} onClick={() => onSelect(v.id)}>
                  <span>
                    <strong>{v.registration_number}</strong>
                    <small>{v.manufacturer} {v.model} · {fuelLabel(v.fuel_type)}{(row?.counts.open_faults ?? 0) > 0 ? ` · ${row?.counts.open_faults} open fault(s)` : ""}</small>
                  </span>
                  <Pill tone={STATE_TONE[st]}>{HEALTH_STATE_LABEL[st]}</Pill>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const loadUsage = (id: string) => getVehicleUsage(id, 365);

/** ICE-specific readings; EV readings live in the Battery panel. */
function EngineAndFuel({ vehicle, record }: { vehicle: OpsVehicle; record: (p: ObservationPreset) => void }) {
  const usage = useResource(loadUsage, vehicle.id);
  const u = usage.data?.vehicle_id === vehicle.id ? usage.data : undefined;
  const fuel = u?.measured.fuel_consumption;
  const odo = u?.measured.odometer;
  return (
    <section className="ops-card intel-panel" aria-labelledby="vh-ice">
      <div className="ops-card__head">
        <h2 id="vh-ice"><Gauge size={17} aria-hidden="true" /> Engine &amp; fuel</h2>
        <button type="button" className="ops-link"
          onClick={() => record({ kind: "odometer_km", subject: { type: "vehicle", id: vehicle.id, label: vehicle.registration_number } })}>
          <Plus size={13} /> Record odometer reading
        </button>
      </div>
      {usage.error && !u ? <ErrorBlock compact message={usage.error} onRetry={usage.reload} /> : !u ? <Skeleton lines={3} /> : (
        <dl className="ops-deflist">
          <div className="ops-deflist__row">
            <dt>Distance driven (measured)</dt>
            <dd>{odo?.status === "ok" ? `${formatValue(odo.annualised_distance_km, "km/yr", 0)} annualised from ${odo.reading_count} readings` : "Not enough odometer readings"}</dd>
          </div>
          <div className="ops-deflist__row">
            <dt>Fuel economy (from fill records)</dt>
            <dd>{fuel && fuel.status === "ok" ? formatValue(fuel.km_per_l ?? null, "km/L") : "Not recorded — needs two full fills with odometer, 300+ km apart"}</dd>
          </div>
          <div className="ops-deflist__row"><dt>Engine hours</dt><dd>Not recorded (EVORA does not track engine hours yet)</dd></div>
          <div className="ops-deflist__row"><dt>Battery state of health / charge</dt><dd>Not applicable to a {fuelLabel(vehicle.fuel_type).toLowerCase()} vehicle</dd></div>
        </dl>
      )}
    </section>
  );
}

type TimelineItem = { at: string; kind: string; title: string; detail: string; tone: Tone; flag?: string };

/** Services, faults, readings and stored snapshots in one chronological list. */
function HealthTimeline({ vehicle, onRecord }: { vehicle: VehicleRef; onRecord: () => void }) {
  const evParams = useMemo(() => ({ page: 1, page_size: 25, vehicle_id: vehicle.id, ordering: "-occurred_on", include_voided: true }), [vehicle.id]);
  const obsParams = useMemo(() => ({ page: 1, page_size: 25, vehicle_id: vehicle.id, kind: "odometer_km,battery_soh_pct,battery_soc_pct,battery_capacity_kwh", ordering: "-created_at" }), [vehicle.id]);
  const snapParams = useMemo(() => ({ kind: "maintenance_status", vehicle_id: vehicle.id }), [vehicle.id]);
  const events = useResource(listMaintenanceEventsPage, evParams);
  const obs = useResource(listObservationsPage, obsParams);
  const snaps = useResource(listAssessments, snapParams);
  const [kind, setKind] = useState<"all" | "service" | "reading">("all");
  const [expanded, setExpanded] = useState(false);
  const [, openAssessment] = useParam("assessment");

  const items: (TimelineItem & { id: string; onOpen?: () => void })[] = [];
  for (const e of events.data?.results ?? []) {
    items.push({
      id: e.id, at: e.occurred_on, kind: "service",
      title: `${EVENT_TYPE_LABEL[e.event_type]}${e.component ? ` · ${e.component}` : ""}${e.fault_code ? ` · ${e.fault_code}` : ""}`,
      detail: [e.odometer_km !== null ? formatValue(e.odometer_km, "km", 0) : null,
        e.cost !== null ? formatMoney(e.cost, e.currency) : "cost not recorded",
        e.origin === "measured" ? "documented" : "organization-provided"].filter(Boolean).join(" · "),
      tone: e.event_type === "fault_report" ? "danger" : "neutral",
      flag: e.voided_at ? `Voided: ${e.void_reason}` : undefined,
    });
  }
  for (const o of obs.data?.results ?? []) {
    items.push({
      id: o.id, at: o.observed_at ?? o.created_at, kind: "reading",
      title: `${o.kind === "odometer_km" ? "Odometer" : o.kind === "battery_soh_pct" ? "Battery state of health" : o.kind === "battery_soc_pct" ? "State of charge" : "Battery capacity"} ${formatValue(o.value, o.unit, 1)}`,
      detail: [o.source?.title ?? "no source cited", o.evidence_class.replace(/_/g, " ")].join(" · "),
      tone: "info",
      flag: o.superseded_by_id ? "Superseded by a correction" : o.stale ? `Stale: ${o.stale_reason}` : undefined,
    });
  }
  for (const a of snaps.data ?? []) {
    items.push({
      id: a.id, at: a.created_at, kind: "reading", title: "Status snapshot stored",
      detail: a.headline.counts ? `${a.headline.counts.overdue ?? 0} overdue · ${a.headline.counts.open_faults ?? 0} open faults · ${a.method_version}` : a.method_version,
      tone: "ok", onOpen: () => openAssessment(a.id),
    });
  }
  const sorted = items.filter((i) => kind === "all" || i.kind === kind).sort((a, b) => b.at.localeCompare(a.at));
  // Consecutive odometer readings collapse into one entry so services and faults stay visible.
  const grouped: typeof items = [];
  for (const it of sorted) {
    const prev = grouped[grouped.length - 1];
    const isOdo = it.title.startsWith("Odometer ") && !it.flag;
    if (isOdo && prev && prev.id.startsWith("odo-group:")) {
      const n = Number(prev.id.split(":")[1]) + 1;
      prev.id = `odo-group:${n}:${prev.id.split(":")[2]}`;
      prev.title = `${n} odometer readings`;
      prev.detail = `${it.title.replace("Odometer ", "")} → ${prev.detail.split(" → ")[1] ?? prev.detail}`;
      prev.at = it.at;
      continue;
    }
    if (isOdo && prev && prev.title.startsWith("Odometer ") && !prev.flag) {
      grouped[grouped.length - 1] = {
        ...prev,
        id: `odo-group:2:${prev.id}`,
        title: "2 odometer readings",
        detail: `${it.title.replace("Odometer ", "")} → ${prev.title.replace("Odometer ", "")} · ${prev.detail}`,
        at: it.at,
      };
      continue;
    }
    grouped.push({ ...it });
  }
  const shown = expanded ? grouped : grouped.slice(0, 10);
  const loading = !events.data || !obs.data || !snaps.data;
  const error = events.error ?? obs.error ?? snaps.error;

  return (
    <section className="ops-card intel-panel" aria-labelledby="vh-time">
      <div className="ops-card__head">
        <h2 id="vh-time">History</h2>
        <span className="intel-row">
          <Segmented label="Show" value={kind} onChange={setKind}
            options={[{ value: "all", label: "All" }, { value: "service", label: "Services & faults" }, { value: "reading", label: "Readings" }]} />
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={onRecord}>
            <Plus size={15} /> Record service or fault
          </button>
        </span>
      </div>
      {error && loading ? (
        <ErrorBlock compact message={error} onRetry={() => { events.reload(); obs.reload(); snaps.reload(); }} />
      ) : loading ? (
        <Skeleton lines={5} />
      ) : shown.length === 0 ? (
        <EmptyBlock compact title="Nothing recorded yet" text="Services, faults and readings appear here as they are recorded." />
      ) : (
        <ol className="intel-history">
          {shown.map((i) => (
            <li key={i.id} className={`intel-history__item intel-history__item--${i.tone}${i.flag ? " intel-history__item--muted" : ""}`}>
              <span className="intel-history__date">{i.at.length > 10 ? formatStamp(i.at) : formatDay(i.at)}</span>
              <span className="intel-history__body">
                <strong>{i.onOpen ? <button type="button" className="ops-link" onClick={i.onOpen}>{i.title}</button> : i.title}</strong>
                <small>{i.detail}</small>
                {i.flag && <small className="intel-history__flag">{i.flag}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {grouped.length > 10 && (
        <button type="button" className="ops-link" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show fewer" : `Show all ${grouped.length} entries`}
        </button>
      )}
      <p className="ops-muted" style={{ margin: "8px 0 0" }}>
        Covers the most recent 25 events and 25 readings. <Link className="ops-link" to={`/health/records?tab=log&vehicle=${vehicle.id}`}>Open the full service &amp; fault log</Link>
      </p>
    </section>
  );
}

function Snapshots({ vehicleId, windowDays }: { vehicleId: string; windowDays: number }) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const [, open] = useParam("assessment");
  const params = useMemo(() => ({ kind: "maintenance_status", vehicle_id: vehicleId }), [vehicleId]);
  const { data, error, reload } = useResource(listAssessments, params);

  const save = () =>
    submit.run(async () => {
      const a = await persistMaintenanceAssessment(vehicleId, windowDays);
      toast.success("Maintenance snapshot stored.");
      invalidate();
      open(a.id);
    });

  return (
    <section className="ops-card" aria-labelledby="vh-snap">
      <div className="ops-card__head">
        <h2 id="vh-snap">Stored snapshots</h2>
        <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={save} disabled={submit.busy}>
          <Camera size={15} /> {submit.busy ? "Storing…" : "Store snapshot"}
        </button>
      </div>
      {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
      {error && !data ? (
        <ErrorBlock compact message={error} onRetry={reload} />
      ) : !data ? (
        <Skeleton lines={2} />
      ) : data.length === 0 ? (
        <EmptyBlock compact title="No stored snapshots"
          text="Store one to keep a record of this status with the evidence it used." />
      ) : (
        <ul className="ops-rows">
          {data.map((a) => (
            <li key={a.id}>
              <button type="button" className="ops-rowbtn" onClick={() => open(a.id)}>
                <span className="ops-list__main">
                  <strong>{formatStamp(a.created_at)}</strong>
                  <small>
                    {a.headline.counts
                      ? `${a.headline.counts.overdue ?? 0} overdue · ${a.headline.counts.due_soon ?? 0} due soon · ${a.headline.counts.open_faults ?? 0} open faults`
                      : a.method_version}
                  </small>
                </span>
                <CoverageBadge level={a.evidence_level} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Definition>
        A snapshot stores the result together with every input used, so it can be re-run and compared later.
      </Definition>
    </section>
  );
}

function VehicleHealthPage() {
  const [vehicleId, setVehicleId] = useParam("vehicle");
  const [windowDays, setWindowDays] = useState("365");
  const [recording, setRecording] = useState<ObservationPreset | null>(null);
  const [addingReq, setAddingReq] = useState(false);
  const [event, setEvent] = useState<{ type?: "fault_report"; resolves?: FaultRef } | null>(null);

  const vehicle = useResource(getVehicle, vehicleId);
  const statusParams = useMemo(
    () => (vehicleId ? { id: vehicleId, windowDays: Number(windowDays) } : null),
    [vehicleId, windowDays],
  );
  const status = useResource(loadStatus, statusParams);

  const v = vehicle.data && vehicle.data.id === vehicleId ? vehicle.data : undefined;
  const s = status.data && status.data.vehicle_id === vehicleId ? status.data : undefined;
  const ref: VehicleRef | null = v ? { id: v.id, label: v.registration_number } : null;

  return (
    <div className="ops-ws">
      <div className="ops-wshead">
        <div>
          <h2 className="ops-wshead__title">Vehicles</h2>
          <p className="ops-wshead__desc">
            Each vehicle's service schedule, open faults, readings and history, with the source of every value.
          </p>
        </div>
      </div>
      <div className="intel-split">
        <HealthVehicleList selectedId={vehicleId} onSelect={setVehicleId} />

        <div className="intel-stack">
          {!vehicleId ? (
            <section className="ops-card">
              <EmptyBlock title="Select a vehicle" text="Pick a vehicle to see its maintenance status." />
            </section>
          ) : vehicle.error && !v ? (
            <ErrorBlock message={vehicle.error} onRetry={vehicle.reload} />
          ) : !v || !ref ? (
            <section className="ops-card"><Skeleton lines={6} /></section>
          ) : (
            <>
              <section className="ops-card" aria-label="Vehicle">
                <div className="ops-card__head">
                  <div>
                    <h2>{v.registration_number}</h2>
                    <p className="ops-card__sub">
                      {[v.manufacturer, v.model, v.variant].filter(Boolean).join(" ")} · {fuelLabel(v.fuel_type)} ·{" "}
                      {v.depot_name ?? "No depot"}
                    </p>
                  </div>
                  <Pill tone={vehicleTone(v.status)}>{humanize(v.status)}</Pill>
                </div>
                <div className="intel-row intel-row--between">
                  <p className="ops-muted" style={{ margin: 0 }}>
                    {s ? `Checked as of ${formatDay(s.parameters.as_of)} (${s.result.method_version})` : "Checking…"}
                  </p>
                  <Segmented label="Record window" value={windowDays} onChange={setWindowDays} options={WINDOWS} />
                </div>
                {s && (
                  <div className="intel-headline" style={{ marginTop: 12 }}>
                    <div><span>Overdue</span><strong>{s.result.counts.overdue}</strong></div>
                    <div><span>Due soon</span><strong>{s.result.counts.due_soon}</strong></div>
                    <div><span>Undetermined</span><strong>{s.result.counts.undetermined}</strong></div>
                    <div><span>Open faults</span><strong>{s.result.counts.open_faults}</strong></div>
                  </div>
                )}
                {s && s.result.messages.length > 0 && (
                  <ul className="intel-notes">{s.result.messages.map((m) => <li key={m}>{m}</li>)}</ul>
                )}
              </section>

              {status.error && !s ? (
                <ErrorBlock message={status.error} onRetry={status.reload} />
              ) : !s ? (
                <section className="ops-card"><Skeleton lines={6} /></section>
              ) : (
                <>
                  <Requirements status={s} onAdd={() => setAddingReq(true)} />
                  <Faults status={s} onReport={() => setEvent({ type: "fault_report" })}
                    onResolve={(f) => setEvent({ resolves: f })} />
                  {s.result.battery.applicable ? (
                    <Battery battery={s.result.battery} vehicle={ref} record={setRecording} />
                  ) : (
                    <EngineAndFuel vehicle={v} record={setRecording} />
                  )}
                  <Records status={s} />
                  <Disclosure title="Evidence used" meta={`${Object.keys(s.evidence).length} inputs`}>
                    <ProvenanceTable inputs={Object.values(s.evidence)} caption="Maintenance status inputs" />
                  </Disclosure>
                  <Definition>{s.result.predictive_assessment.reason}</Definition>
                </>
              )}
              <HealthTimeline vehicle={ref} onRecord={() => setEvent({})} />
              <Snapshots vehicleId={v.id} windowDays={Number(windowDays)} />

              {addingReq && <RequirementDrawer presetVehicle={ref} onClose={() => setAddingReq(false)} />}
              {event && (
                <EventDrawer presetVehicle={ref} presetType={event.type} resolves={event.resolves}
                  onClose={() => setEvent(null)} />
              )}
              <ObservationDrawer open={Boolean(recording)} preset={recording ?? undefined}
                onClose={() => setRecording(null)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default VehicleHealthPage;
