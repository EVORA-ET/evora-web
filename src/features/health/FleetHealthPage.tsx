import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardList, HeartPulse, Wrench } from "lucide-react";

import {
  getFleetMaintenanceStatus,
  getRecordedCosts,
  type FleetMaintenanceRow,
  type FleetMaintenanceStatus,
} from "../../lib/intelligenceApi";
import { fuelLabel } from "../operations/format";
import { useResource } from "../operations/hooks";
import DataTable, { type Column } from "../operations/ui/DataTable";
import { FilterBar, FilterSelect, SearchBox } from "../operations/ui/FilterBar";
import { Pill, type Tone } from "../operations/ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "../operations/ui/states";
import { SERIES } from "../intelligence/chartColors";
import { ColumnChart, Donut } from "../intelligence/charts";
import { formatDay, formatMoney, formatValue } from "../intelligence/format";
import { Definition, Stat } from "../intelligence/ui";
import { HEALTH_STATE_DEFINITION, HEALTH_STATE_LABEL, healthStateOf, nextDue, type VehicleHealthState } from "./healthState";

const WINDOW = 365;
const COSTS = { months: 12 };
const STATE_TONE: Record<VehicleHealthState, Tone> = {
  overdue: "danger",
  due_soon: "warn",
  needs_info: "neutral",
  not_due: "ok",
  no_requirements: "neutral",
  not_evaluated: "neutral",
};
const STATE_COLOR: Record<VehicleHealthState, string> = {
  overdue: SERIES.danger,
  due_soon: SERIES.warn,
  needs_info: "#8a8f8a",
  not_due: SERIES.ok,
  no_requirements: "#cfd3cd",
  not_evaluated: SERIES.unknown,
};

interface Message {
  title: string;
  text: string;
}

function message(d: FleetMaintenanceStatus, attention: number): Message {
  if (d.vehicles_evaluated === 0) {
    return {
      title: "A clearer maintenance picture starts with complete records.",
      text: "No vehicle has a service requirement, maintenance event or battery reading yet. Add documented service intervals and EVORA will tell you what is due.",
    };
  }
  if (attention > 0) {
    return {
      title: `${attention} vehicle${attention === 1 ? " needs" : "s need"} attention.`,
      text: "Review overdue service and unresolved faults first. Everything below is calculated from your configured requirements and recorded service history.",
    };
  }
  return {
    title: "Nothing is overdue under your configured rules.",
    text: `${d.vehicles_evaluated} vehicle${d.vehicles_evaluated === 1 ? " is" : "s are"} evaluated${d.vehicles_without_records ? `; ${d.vehicles_without_records} still have no maintenance records` : ""}. This reflects configured requirements only, not the mechanical condition of each vehicle.`,
  };
}

interface Action {
  icon: typeof Wrench;
  title: string;
  text: string;
  to: string;
}

function actionsFor(d: FleetMaintenanceStatus, needsInfo: number): Action[] {
  const a: Action[] = [];
  if (d.totals.overdue > 0) a.push({ icon: AlertTriangle, title: "Review overdue maintenance", text: `${d.totals.overdue} requirement(s) are past their documented interval.`, to: "/health/records?tab=rules&status=overdue" });
  if (d.totals.open_faults > 0) a.push({ icon: Wrench, title: "Investigate open faults", text: `${d.totals.open_faults} reported fault(s) have no recorded fix.`, to: "/health/vehicles?filter=open_faults" });
  if (d.totals.due_soon > 0) a.push({ icon: CalendarClock, title: "Schedule upcoming service", text: `${d.totals.due_soon} requirement(s) fall due within their warning window.`, to: "/health/records?tab=rules&status=due_soon" });
  if (needsInfo > 0) a.push({ icon: ClipboardList, title: "Complete missing readings", text: `${needsInfo} requirement(s) cannot be evaluated: a baseline service or odometer reading is missing.`, to: "/health/records?tab=rules&status=undetermined" });
  if (d.vehicles_without_records > 0) a.push({ icon: HeartPulse, title: "Configure maintenance requirements", text: `${d.vehicles_without_records} vehicle(s) have no maintenance records at all.`, to: "/health/vehicles?filter=not_evaluated" });
  a.push({ icon: Wrench, title: "Record a completed service", text: "Keeps due dates accurate.", to: "/health/records?tab=log&record=1" });
  return a.slice(0, 4);
}

function Upcoming({ rows }: { rows: FleetMaintenanceRow[] }) {
  const navigate = useNavigate();
  const items = rows.flatMap((r) => r.requirements.map((q) => ({ r, q })));
  const due = items
    .filter(({ q }) => q.status !== "undetermined")
    .sort((a, b) => (a.q.days_remaining ?? a.q.km_remaining ?? Infinity) - (b.q.days_remaining ?? b.q.km_remaining ?? Infinity))
    .slice(0, 8);
  const unknown = items.filter(({ q }) => q.status === "undetermined").slice(0, 5);
  return (
    <section className="ops-card intel-panel" aria-labelledby="fh-up">
      <div className="ops-card__head">
        <h2 id="fh-up">Upcoming maintenance</h2>
        <button type="button" className="ops-link" onClick={() => navigate("/health/records?tab=rules")}>All requirements</button>
      </div>
      {due.length === 0 ? (
        <p className="ops-muted">No requirement has a determinable due point yet.</p>
      ) : (
        <ol className="intel-due">
          {due.map(({ r, q }) => (
            <li key={q.requirement_id} className={`intel-due__item intel-due__item--${q.status}`}>
              <button type="button" className="intel-due__btn" onClick={() => navigate(`/health/vehicles?vehicle=${r.vehicle_id}`)}>
                <span className="intel-due__when">
                  {q.due_date ? formatDay(q.due_date) : q.due_odometer_km !== null ? formatValue(q.due_odometer_km, "km", 0) : "—"}
                </span>
                <span className="intel-due__what">
                  <strong>{q.name}</strong>
                  <small>
                    {r.registration_number}
                    {q.days_remaining !== null && ` · ${q.days_remaining < 0 ? `${-q.days_remaining} days overdue` : `in ${q.days_remaining} days`}`}
                    {q.km_remaining !== null && ` · ${q.km_remaining < 0 ? `${formatValue(-q.km_remaining, "km", 0)} over` : `${formatValue(q.km_remaining, "km", 0)} left`}`}
                  </small>
                </span>
                <Pill tone={q.status === "overdue" ? "danger" : q.status === "due_soon" ? "warn" : "ok"}>
                  {q.status === "overdue" ? "Overdue" : q.status === "due_soon" ? "Due soon" : "Not due"}
                </Pill>
              </button>
            </li>
          ))}
        </ol>
      )}
      {unknown.length > 0 && (
        <>
          <p className="intel-card-title" style={{ marginTop: 14 }}>Needs information</p>
          <ul className="intel-notes">
            {unknown.map(({ r, q }) => (
              <li key={q.requirement_id}><strong>{r.registration_number} · {q.name}:</strong> {q.undetermined_reasons.join(" ") || "Cannot be evaluated yet."}</li>
            ))}
          </ul>
        </>
      )}
      <Definition>Due points come from each documented interval and the last recorded service or odometer reading. No warning window is assumed where none was configured.</Definition>
    </section>
  );
}

function FleetHealthPage() {
  const navigate = useNavigate();
  const fleet = useResource(getFleetMaintenanceStatus, WINDOW);
  const costs = useResource(getRecordedCosts, COSTS);
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (fleet.data?.vehicles ?? []).filter((r) => {
      const st = healthStateOf(r);
      return (!q || r.registration_number.toLowerCase().includes(q))
        && (!state || (state === "open_faults" ? r.counts.open_faults > 0 : st === state));
    });
  }, [fleet.data, state, search]);

  if (fleet.error && !fleet.data) return <ErrorBlock message={fleet.error} onRetry={fleet.reload} />;
  const d = fleet.data;
  if (!d) {
    return (
      <div className="intel-stack">
        <section className="ops-card"><Skeleton lines={3} /></section>
        <div className="ops-metrics">{Array.from({ length: 4 }, (_, i) => <div key={i} className="ops-metric intel-metric--static"><Skeleton lines={2} /></div>)}</div>
      </div>
    );
  }

  const byState: Record<VehicleHealthState, number> = { overdue: 0, due_soon: 0, needs_info: 0, not_due: 0, no_requirements: 0, not_evaluated: d.vehicles_without_records };
  for (const r of d.vehicles) byState[healthStateOf(r)] += 1;
  const attention = d.vehicles.filter((r) => r.counts.overdue > 0 || r.counts.open_faults > 0).length;
  const msg = message(d, attention);
  const needsInfoVehicles = byState.needs_info + byState.no_requirements + d.vehicles_without_records;

  const columns: Column<FleetMaintenanceRow>[] = [
    {
      key: "vehicle",
      header: "Vehicle",
      render: (r) => (
        <span>
          {r.registration_number}
          <small className="ops-muted" style={{ display: "block" }}>
            {[r.manufacturer, r.model].filter(Boolean).join(" ")} · {fuelLabel(r.fuel_type)}
          </small>
        </span>
      ),
    },
    { key: "state", header: "Maintenance status", render: (r) => { const s = healthStateOf(r); return <Pill tone={STATE_TONE[s]}>{HEALTH_STATE_LABEL[s]}</Pill>; } },
    { key: "faults", header: "Open faults", className: "ops-num", render: (r) => (r.counts.open_faults > 0 ? <Pill tone="danger">{r.counts.open_faults}</Pill> : <span className="ops-muted">0</span>) },
    { key: "last", header: "Last recorded event", render: (r) => (r.last_event_on ? formatDay(r.last_event_on) : <span className="ops-muted">None recorded</span>) },
    {
      key: "next",
      header: "Next due",
      render: (r) => {
        const n = nextDue(r);
        return n ? (
          <span>{n.name}<small className="ops-muted" style={{ display: "block" }}>{n.due_date ? formatDay(n.due_date) : n.due_odometer_km !== null ? `at ${formatValue(n.due_odometer_km, "km", 0)}` : "—"}</small></span>
        ) : <span className="ops-muted">Not determinable</span>;
      },
    },
    {
      key: "data",
      header: "Data",
      render: (r) => (r.counts.undetermined > 0 ? <Pill tone="warn">{r.counts.undetermined} need readings</Pill> : r.requirements.length === 0 ? <Pill>No requirements</Pill> : <Pill tone="ok">Sufficient</Pill>),
    },
    { key: "go", header: "", render: () => <ArrowRight size={15} aria-label="Open vehicle profile" /> },
  ];

  const c = costs.data;
  const maint = c?.categories.maintenance;
  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "short" });
  };

  return (
    <div className="intel-stack">
      <section className="intel-hero intel-hero--quiet" aria-labelledby="fh-msg">
        <div className="intel-hero__text">
          <span className="intel-hero__eyebrow"><HeartPulse size={15} aria-hidden="true" /> Fleet health today · as of {formatDay(d.as_of)}</span>
          <h2 id="fh-msg">{msg.title}</h2>
          <p>{msg.text}</p>
        </div>
        <div className="intel-hero__action">
          <span className="intel-hero__eyebrow">Your next actions</span>
          <ul className="intel-actionlist">
            {actionsFor(d, d.totals.undetermined).map((a) => (
              <li key={a.title}>
                <button type="button" onClick={() => navigate(a.to)}>
                  <a.icon size={16} aria-hidden="true" />
                  <span><strong>{a.title}</strong><small>{a.text}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="ops-metrics">
        <Stat label="Overdue requirements" value={d.totals.overdue} tone={d.totals.overdue ? "danger" : undefined}
          note="past their documented interval" onClick={() => navigate("/health/records?tab=rules&status=overdue")} />
        <Stat label="Due soon" value={d.totals.due_soon} tone={d.totals.due_soon ? "warn" : undefined}
          note="inside a configured warning window" onClick={() => navigate("/health/records?tab=rules&status=due_soon")} />
        <Stat label="Open faults" value={d.totals.open_faults} tone={d.totals.open_faults ? "danger" : undefined}
          note="reported, no fix recorded" onClick={() => navigate("/health/vehicles?filter=open_faults")} />
        <Stat label="Vehicles needing information" value={needsInfoVehicles}
          note={`${d.vehicles_without_records} without records · ${byState.needs_info} missing readings`}
          onClick={() => navigate("/health/vehicles?filter=needs_info")} />
      </div>

      <div className="intel-grid-2">
        <section className="ops-card intel-panel" aria-labelledby="fh-dist">
          <div className="ops-card__head"><h2 id="fh-dist">Maintenance status by vehicle</h2></div>
          <Donut label="Vehicles by maintenance status" center={d.vehicles_in_scope} centerLabel="vehicles in service"
            segments={(Object.keys(byState) as VehicleHealthState[]).map((k) => ({ key: k, label: HEALTH_STATE_LABEL[k], value: byState[k], color: STATE_COLOR[k] }))} />
          <Definition>{HEALTH_STATE_DEFINITION}</Definition>
        </section>

        <section className="ops-card intel-panel" aria-labelledby="fh-cost">
          <div className="ops-card__head">
            <div>
              <h2 id="fh-cost">Maintenance spend</h2>
              {c && <p className="ops-card__sub">Recorded, {formatDay(c.window.start)} – {formatDay(c.window.end)} · {c.currency}</p>}
            </div>
          </div>
          {costs.error && !c ? (
            <ErrorBlock compact message={costs.error} onRetry={costs.reload} />
          ) : !c || !maint ? (
            <Skeleton lines={4} />
          ) : maint.total === null ? (
            <div className="intel-setup">
              <p className="intel-setup__lead">Not enough cost data for a trend yet.</p>
              <p className="ops-muted">
                {maint.records > 0
                  ? `${maint.records} maintenance event(s) recorded, none with a cost. Add costs from job cards or invoices.`
                  : "Record services and repairs with their invoice cost to see monthly spend."} Missing costs are never counted as zero.
              </p>
            </div>
          ) : (
            <>
              <p className="ops-muted" style={{ margin: 0 }}>
                <strong style={{ color: "var(--color-on-surface)" }}>{formatMoney(maint.total, c.currency)}</strong> from {maint.with_cost} costed event(s) across {maint.vehicles_with_cost} vehicle(s)
                {maint.without_cost > 0 && ` · ${maint.without_cost} event(s) without a cost (not included)`}
              </p>
              <ColumnChart label={`Recorded maintenance cost per month (${c.currency})`} height={240} width={520}
                categories={c.months.map((m) => monthLabel(m.month))}
                series={[{ key: "m", label: "Maintenance", color: SERIES.maintenance, values: c.months.map((m) => m.maintenance) }]}
                format={(n) => formatMoney(n, c.currency)} />
            </>
          )}
        </section>
      </div>

      <Upcoming rows={d.vehicles} />

      <section className="ops-card intel-panel" aria-labelledby="fh-vehicles">
        <div className="ops-card__head">
          <h2 id="fh-vehicles">Vehicle health summary</h2>
          <button type="button" className="ops-link" onClick={() => navigate("/health/vehicles")}>All vehicles</button>
        </div>
        <FilterBar active={Boolean(state || search)} onClear={() => { setState(""); setSearch(""); }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Registration" label="Search vehicles" />
          <FilterSelect label="Show" value={state} onChange={setState}
            options={[{ value: "", label: "All evaluated" },
              ...(["overdue", "due_soon", "needs_info", "not_due", "no_requirements"] as const).map((k) => ({ value: k, label: HEALTH_STATE_LABEL[k] })),
              { value: "open_faults", label: "With open faults" }]} />
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.vehicle_id}
          onRowClick={(r) => navigate(`/health/vehicles?vehicle=${r.vehicle_id}`)}
          loading={fleet.loading} error={fleet.error} onRetry={fleet.reload} caption="Vehicle health summary"
          empty={<EmptyBlock compact title={d.vehicles_evaluated ? "No vehicles match" : "No vehicles evaluated yet"}
            text={d.vehicles_evaluated ? undefined : "Configure service requirements under Maintenance Records & Rules."} />} />
        <Definition>{d.definition} No failure predictions are made.</Definition>
      </section>
    </div>
  );
}

export default FleetHealthPage;
