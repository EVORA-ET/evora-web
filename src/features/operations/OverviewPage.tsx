import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import {
  getAttention,
  getOverviewSummary,
  listJobsPage,
  type AttentionItem,
  type Job,
  type OverviewSummary,
  type Partition,
  type Rate,
} from "../../lib/opsApi";
import { useResource } from "./hooks";
import { formatDateLong, formatPercent, formatTimeOnly, humanize, JOB_STATUS_LABEL, plural } from "./format";
import { useOps } from "./useOps";
import { useDrill } from "./workspaceHooks";
import { AssignmentPill } from "./JobsPage";
import { Pill } from "./ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";
import { jobTone } from "./ui/tones";

/* ------------------------------------------------------------------ */
/* Pulse metrics                                                       */
/* ------------------------------------------------------------------ */

function Metric({
  label,
  value,
  note,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "warn" | "danger";
  onClick: () => void;
}) {
  return (
    <button type="button" className={`ops-metric ${tone ? `ops-metric--${tone}` : ""}`} onClick={onClick}>
      <span className="ops-metric__label">{label}</span>
      <span className="ops-metric__value">{value}</span>
      {note && <span className="ops-metric__note">{note}</span>}
    </button>
  );
}

function Pulse({ summary }: { summary: OverviewSummary }) {
  const drill = useDrill();
  const navigate = useNavigate();
  const { jobs, vehicles, drivers } = summary;

  return (
    <div className="ops-metrics">
      <Metric label="Jobs" value={jobs.total}
        note={`${jobs.cancelled} cancelled`}
        onClick={() => drill("jobs", "/fleets/jobs", { range: "day" })} />
      <Metric label="Needs assignment" value={jobs.pending}
        tone={jobs.pending > 0 ? "warn" : undefined} note="pending jobs"
        onClick={() => drill("assignments", "/fleets/assignments", { range: "day", status: "PENDING" })} />
      <Metric label="In progress" value={jobs.in_progress}
        onClick={() => drill("jobs", "/fleets/jobs", { range: "day", status: "IN_PROGRESS" })} />
      <Metric label="Completed" value={jobs.completed}
        onClick={() => drill("jobs", "/fleets/jobs", { range: "day", status: "COMPLETED" })} />
      <Metric label="Needs attention" value={jobs.requiring_attention}
        tone={jobs.requiring_attention > 0 ? "danger" : undefined} note="jobs flagged"
        onClick={() => document.getElementById("ops-attention")?.scrollIntoView({ behavior: "smooth" })} />
      <Metric label="Vehicles available" value={vehicles.available}
        note={`of ${vehicles.usable} usable`}
        onClick={() => drill("vehicles", "/fleets/vehicles", { availability: "available" })} />
      <Metric label="Drivers available" value={drivers.available}
        note={`of ${drivers.usable} usable`}
        onClick={() => drill("drivers", "/fleets/drivers", { availability: "available" })} />
      <Metric label="Vehicles in use now" value={vehicles.in_use_now ?? 0} note="jobs in progress"
        onClick={() => navigate("/fleets/vehicles")} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Today's operations                                                  */
/* ------------------------------------------------------------------ */

const TODAY_LIST = { page: 1, page_size: 8, ordering: "scheduled_start_at" };

function TodayList() {
  const { date } = useOps();
  const navigate = useNavigate();
  const params = useMemo(() => ({ ...TODAY_LIST, date }), [date]);
  const { data, error, loading, reload } = useResource(listJobsPage, params);

  return (
    <section className="ops-card" aria-labelledby="ops-today">
      <div className="ops-card__head">
        <h2 id="ops-today">Operations on {formatDateLong(date)}</h2>
        <button type="button" className="ops-link" onClick={() => navigate("/fleets/jobs")}>View all</button>
      </div>
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !data ? (
        <Skeleton lines={5} height={18} />
      ) : data.results.length === 0 ? (
        <EmptyBlock compact title="No jobs scheduled" text="Nothing is planned for this day." />
      ) : (
        <ul className={`ops-rows ${loading ? "ops-busy" : ""}`}>
          {data.results.map((job: Job) => (
            <li key={job.id}>
              <button type="button" className="ops-rowbtn" onClick={() => navigate(`/fleets/jobs?open=${job.id}`)}>
                <span className="ops-list__main">
                  <strong>{formatTimeOnly(job.scheduled_start_at)} · {job.job_template_name}</strong>
                  <small>
                    {job.vehicle_registration_number ?? "No vehicle"} · {job.driver_name ?? "No driver"}
                  </small>
                </span>
                <span className="ops-pills">
                  <AssignmentPill job={job} />
                  <Pill tone={jobTone(job.status)}>{JOB_STATUS_LABEL[job.status]}</Pill>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && data.count > data.results.length && (
        <p className="ops-muted" style={{ marginTop: 8 }}>
          Showing {data.results.length} of {data.count}.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Attention                                                           */
/* ------------------------------------------------------------------ */

function attentionTarget(item: AttentionItem): string {
  if (item.action.type === "open_vehicle" && item.vehicle_id) {
    return `/fleets/vehicles?open=${item.vehicle_id}`;
  }
  if (item.action.type === "open_driver" && item.driver_id) {
    return `/fleets/drivers?open=${item.driver_id}`;
  }
  return `/fleets/jobs?open=${item.job_id}`;
}

function Attention() {
  const { date } = useOps();
  const navigate = useNavigate();
  const params = useMemo(() => ({ date }), [date]);
  const { data, error, loading, reload } = useResource(getAttention, params);

  return (
    <section className="ops-card" id="ops-attention" aria-labelledby="ops-attn-title">
      <div className="ops-card__head">
        <h2 id="ops-attn-title">Attention center</h2>
        {data && data.total > 0 && <Pill tone="warn">{plural(data.total, "item")}</Pill>}
      </div>
      {error && !data ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !data ? (
        <Skeleton lines={4} height={32} />
      ) : data.items.length === 0 ? (
        <div className="ops-state ops-state--compact">
          <CheckCircle2 size={22} strokeWidth={1.6} />
          <p className="ops-state__title">Nothing needs attention</p>
          <p className="ops-state__text">Every job on this day is assigned and on schedule.</p>
        </div>
      ) : (
        <ul className={`ops-attn ${loading ? "ops-busy" : ""}`}>
          {data.items.map((item) => (
            <li key={item.id} className={item.severity === "critical" ? "ops-attn--critical" : undefined}>
              <span className="ops-attn__text">
                <strong>{item.job_name}</strong>
                <small>{item.message}</small>
              </span>
              <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                onClick={() => navigate(attentionTarget(item))}>
                {item.action.label} <ArrowRight size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {data?.truncated && (
        <p className="ops-muted" style={{ marginTop: 8 }}>
          Showing the first {data.items.length} of {data.total} items.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Resource snapshot                                                   */
/* ------------------------------------------------------------------ */

function breakdown(counts: Record<string, number>): string {
  const parts = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, n]) => `${n} ${humanize(key).toLowerCase()}`);
  return parts.length ? parts.join(" · ") : "None yet";
}

function Snapshot({ summary }: { summary: OverviewSummary }) {
  const navigate = useNavigate();
  const { resources: r } = summary;

  const rows: { label: string; singular: string; count: number; note: string; to: string; action: string }[] = [
    { label: "Depots", singular: "Depot", count: r.depots, note: "Bases for vehicles and routes", to: "/fleets/depots", action: "View" },
    { label: "Fleets", singular: "Fleet", count: r.fleets, note: "Groups of vehicles", to: "/fleets/fleets", action: "Manage" },
    {
      label: "Vehicles", singular: "Vehicle",
      count: r.vehicles,
      note: `${breakdown(r.vehicles_by_status)} · ${r.vehicles_by_powertrain.ev} electric, ${r.vehicles_by_powertrain.ice} ICE`,
      to: "/fleets/vehicles",
      action: "Manage",
    },
    { label: "Drivers", singular: "Driver", count: r.drivers, note: breakdown(r.drivers_by_status), to: "/fleets/drivers", action: "Manage" },
    { label: "Routes", singular: "Route", count: r.routes.total, note: breakdown(r.routes.by_status), to: "/fleets/routes", action: "Manage" },
  ];

  return (
    <section className="ops-card" aria-labelledby="ops-snap">
      <div className="ops-card__head"><h2 id="ops-snap">Resource snapshot</h2></div>
      <ul className="ops-rows">
        {rows.map((row) => (
          <li key={row.label}>
            <button type="button" className="ops-rowbtn" onClick={() => navigate(row.to)}>
              <span className="ops-list__main">
                <strong>{plural(row.count, row.singular, row.label)}</strong>
                <small>{row.note}</small>
              </span>
              <span className="ops-link">{row.action}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Assignments & execution                                             */
/* ------------------------------------------------------------------ */

function Split({ total, parts }: { total: number; parts: { label: string; value: number; cls?: string }[] }) {
  return (
    <>
      <div className="ops-bar" role="img"
        aria-label={parts.map((p) => `${p.value} ${p.label}`).join(", ")}>
        {total > 0 && parts.map((p) => (
          <span key={p.label} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} />
        ))}
      </div>
      <p className="ops-muted" style={{ margin: "4px 0 12px" }}>
        {parts.map((p) => `${p.value} ${p.label}`).join(" · ")}
      </p>
    </>
  );
}

function resourceParts(p: Partition) {
  return [
    { label: "assigned", value: p.assigned },
    { label: "available", value: p.available, cls: "ops-bar--muted" },
    { label: "unavailable", value: p.unavailable, cls: "ops-bar--warn" },
  ];
}

function Execution({ summary }: { summary: OverviewSummary }) {
  const drill = useDrill();
  const { jobs, vehicles, drivers } = summary;

  return (
    <section className="ops-card" aria-labelledby="ops-exec">
      <div className="ops-card__head">
        <h2 id="ops-exec">Assignments &amp; execution</h2>
        <button type="button" className="ops-link"
          onClick={() => drill("assignments", "/fleets/assignments", { range: "day", status: "" })}>
          Open assignments
        </button>
      </div>
      <div className="ops-kv" style={{ marginBottom: 16 }}>
        <div><strong>{jobs.pending}</strong><span>Pending</span></div>
        <div><strong>{jobs.assigned}</strong><span>Assigned</span></div>
        <div><strong>{jobs.in_progress}</strong><span>In progress</span></div>
        <div><strong>{jobs.completed}</strong><span>Completed</span></div>
      </div>
      <p className="ops-card__sub" style={{ margin: "0 0 4px" }}>Vehicles ({vehicles.total})</p>
      <Split total={vehicles.total} parts={resourceParts(vehicles)} />
      <p className="ops-card__sub" style={{ margin: "0 0 4px" }}>Drivers ({drivers.total})</p>
      <Split total={drivers.total} parts={resourceParts(drivers)} />
      <p className="ops-formula">
        Assigned = committed to an assigned or running job on this day. Unavailable = not active, or insurance /
        licence expired on this day.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Performance                                                         */
/* ------------------------------------------------------------------ */

function Indicator({ title, rate, formula }: { title: string; rate: Rate; formula: string }) {
  return (
    <div>
      <p className="ops-metric__label">{title}</p>
      <p className="ops-metric__value" style={{ margin: "4px 0" }}>{formatPercent(rate.rate)}</p>
      <p className="ops-metric__note" style={{ margin: 0 }}>
        {rate.denominator === 0 ? "No data in this period" : `${rate.numerator} of ${rate.denominator}`}
      </p>
      <p className="ops-formula">{formula}</p>
    </div>
  );
}

function Performance({ summary }: { summary: OverviewSummary }) {
  const p = summary.performance;
  return (
    <section className="ops-card" aria-labelledby="ops-perf">
      <div className="ops-card__head"><h2 id="ops-perf">Performance indicators</h2></div>
      <div className="ops-metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Indicator title="Completion rate" rate={p.completion_rate}
          formula={`Completed ÷ non-cancelled jobs already due, ${p.period_from} to ${p.period_to}.`} />
        <Indicator title="Assignment coverage" rate={p.assignment_coverage}
          formula="Jobs with both a vehicle and a driver ÷ non-cancelled jobs on the selected day." />
        <Indicator title="Fleet utilisation" rate={p.fleet_utilisation}
          formula="Distinct usable vehicles on a job that day ÷ all usable vehicles." />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function OverviewPage() {
  const { date } = useOps();
  const params = useMemo(() => ({ date }), [date]);
  const { data: summary, error, reload } = useResource(getOverviewSummary, params);

  return (
    <div className="ops-ws">
      {error && !summary ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : !summary ? (
        <div className="ops-metrics">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="ops-metric"><Skeleton lines={2} height={18} /></div>
          ))}
        </div>
      ) : (
        <Pulse summary={summary} />
      )}

      <div className="ops-grid ops-grid--wide">
        <TodayList />
        <Attention />
      </div>

      {summary && (
        <>
          <div className="ops-grid">
            <Execution summary={summary} />
            <Snapshot summary={summary} />
          </div>
          <Performance summary={summary} />
        </>
      )}
    </div>
  );
}

export default OverviewPage;
