import { useMemo, useState } from "react";
import { CalendarClock, Pencil, Play, CheckCircle2, Trash2, UserCog, XCircle, X } from "lucide-react";

import type { JobInstanceStatus } from "../../lib/api";
import {
  createJob,
  deleteJob,
  getJob,
  listJobsPage,
  setJobStatus,
  updateJob,
  type Job,
  type JobDetail as JobDetailData,
} from "../../lib/opsApi";
import AssignDrawer from "./AssignDrawer";
import { conflictDetail, useListState, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import {
  formatDateTime,
  formatTimeOnly,
  formatWindow,
  fromDateTimeInput,
  humanize,
  JOB_STATUS_LABEL,
  toDateTimeInput,
} from "./format";
import { RANGE_OPTIONS, rangeParams } from "./jobRange";
import { useOps } from "./useOps";
import { useDrill, useLookups, useRecordParams, useRouteLookup, useSubmit } from "./workspaceHooks";
import WorkspaceHead from "./WorkspaceHead";
import ConfirmDialog from "./ui/ConfirmDialog";
import DataTable, { type Column } from "./ui/DataTable";
import { DetailList, Section } from "./ui/Detail";
import Drawer from "./ui/Drawer";
import { SelectField, TextField } from "./ui/Fields";
import { FilterBar, FilterSelect, SearchBox } from "./ui/FilterBar";
import Pagination from "./ui/Pagination";
import { Pill } from "./ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";
import { jobTone } from "./ui/tones";

const PAGE_SIZE = 15;

const STATUS_OPTIONS = (Object.keys(JOB_STATUS_LABEL) as JobInstanceStatus[]).map((s) => ({
  value: s,
  label: JOB_STATUS_LABEL[s],
}));

const ASSIGNMENT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "assigned", label: "Fully assigned" },
  { value: "unassigned", label: "Nothing assigned" },
  { value: "missing_vehicle", label: "Needs a vehicle" },
  { value: "missing_driver", label: "Needs a driver" },
];

export function AssignmentPill({ job }: { job: Job }) {
  switch (job.assignment_state) {
    case "assigned":
      return <Pill tone="ok">Assigned</Pill>;
    case "unassigned":
      return <Pill tone="warn">Unassigned</Pill>;
    case "missing_vehicle":
      return <Pill tone="warn">Needs vehicle</Pill>;
    default:
      return <Pill tone="warn">Needs driver</Pill>;
  }
}

/* ------------------------------------------------------------------ */
/* Create / reschedule                                                 */
/* ------------------------------------------------------------------ */

function JobForm({
  job,
  initialDate,
  onClose,
  onSaved,
}: {
  job: JobDetailData | null;
  initialDate: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast, invalidate } = useOps();
  const routes = useRouteLookup();
  const submit = useSubmit();
  const [routeId, setRouteId] = useState(job?.job_template_id ?? "");
  const [start, setStart] = useState(
    job ? toDateTimeInput(job.scheduled_start_at) : `${initialDate}T09:00`,
  );
  const [end, setEnd] = useState(job ? toDateTimeInput(job.scheduled_end_at) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const err = (key: string) => errors[key] ?? submit.errors[key];

  const routeOptions = useMemo(() => {
    // Keep the job's current route selectable even if it is no longer active.
    if (job && !routes.options.some((o) => o.value === job.job_template_id)) {
      return [{ value: job.job_template_id, label: job.job_template_name }, ...routes.options];
    }
    return routes.options;
  }, [routes.options, job]);

  const save = async () => {
    const problems: Record<string, string> = {};
    if (!routeId) problems.job_template_id = "Choose a route.";
    if (!start) problems.scheduled_start_at = "Start time is required.";
    if (start && end && new Date(end) <= new Date(start)) {
      problems.scheduled_end_at = "End must be after the start.";
    }
    setErrors(problems);
    if (Object.keys(problems).length) return;

    await submit.run(async () => {
      const startIso = fromDateTimeInput(start)!;
      const endIso = fromDateTimeInput(end);
      const saved = job
        ? await updateJob(job.id, {
            job_template_id: routeId,
            scheduled_start_at: startIso,
            ...(endIso ? { scheduled_end_at: endIso } : {}),
          })
        : await createJob({
            job_template_id: routeId,
            scheduled_start_at: startIso,
            scheduled_end_at: endIso,
          });
      toast.success(job ? "Job rescheduled." : "Job created. Assign a vehicle and driver next.");
      invalidate();
      onSaved(saved.id);
    });
  };

  return (
    <Drawer
      open
      title={job ? "Edit schedule" : "Add daily job"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : job ? "Save changes" : "Create job"}
          </button>
        </>
      }
    >
      <form className="ops-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {routes.error && <p className="ops-callout ops-callout--warn">Couldn’t load routes: {routes.error}</p>}
        {!routes.loading && !routes.error && routeOptions.length === 0 && (
          <p className="ops-callout ops-callout--warn">
            There are no active routes. Create a route first, then schedule jobs from it.
          </p>
        )}

        <SelectField label="Route" required placeholder="Choose a route" options={routeOptions}
          value={routeId} error={err("job_template_id")} onChange={(e) => setRouteId(e.target.value)} />
        <TextField label="Starts" type="datetime-local" required value={start}
          error={err("scheduled_start_at")} onChange={(e) => setStart(e.target.value)} />
        <TextField label="Ends" type="datetime-local" value={end} error={err("scheduled_end_at")}
          hint="Optional. Defaults to the route’s estimated duration."
          onChange={(e) => setEnd(e.target.value)} />
        {job && (job.vehicle_id || job.driver_id) && (
          <p className="ops-muted">
            Changing the time re-checks the assigned vehicle and driver; the change is refused if either
            would be double-booked.
          </p>
        )}
      </form>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

const TRANSITIONS: Record<
  JobInstanceStatus,
  { to: JobInstanceStatus; label: string; confirm?: string; danger?: boolean }[]
> = {
  PENDING: [{ to: "CANCELLED", label: "Cancel job", confirm: "Cancel this job? It will no longer run.", danger: true }],
  ASSIGNED: [
    { to: "IN_PROGRESS", label: "Start job" },
    { to: "CANCELLED", label: "Cancel job", confirm: "Cancel this job? The vehicle and driver are freed.", danger: true },
  ],
  IN_PROGRESS: [
    { to: "COMPLETED", label: "Complete job", confirm: "Mark this job as completed?" },
    { to: "CANCELLED", label: "Cancel job", confirm: "Cancel this job while it is in progress?", danger: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

function JobDetailDrawer({
  id,
  onClose,
  onEdit,
}: {
  id: string;
  onClose: () => void;
  onEdit: (job: JobDetailData) => void;
}) {
  const { toast, invalidate } = useOps();
  const drill = useDrill();
  const { data: job, error, loading, reload } = useResource(getJob, id);
  const [assigning, setAssigning] = useState(false);
  const [pending, setPending] = useState<(typeof TRANSITIONS)[JobInstanceStatus][number] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const transition = useSubmit();
  const del = useSubmit();
  const progressSave = useSubmit();

  const open = job && (job.status === "PENDING" || job.status === "ASSIGNED");

  const runTransition = async () => {
    if (!pending) return;
    const ok = await transition.run(async () => {
      await setJobStatus(id, pending.to);
    });
    if (ok) {
      toast.success(`Job ${JOB_STATUS_LABEL[pending.to].toLowerCase()}.`);
      invalidate();
      setPending(null);
    }
  };

  const remove = async () => {
    const ok = await del.run(async () => {
      try {
        await deleteJob(id);
      } catch (e) {
        const reason = conflictDetail(e);
        if (reason) setBlocked(reason);
        throw e;
      }
    });
    if (ok) {
      toast.success("Job deleted.");
      invalidate();
      setConfirmDelete(false);
      onClose();
    }
  };

  const saveProgress = async () => {
    const value = Number(progress);
    if (progress === null || !Number.isFinite(value) || value < 0 || value > 100) {
      toast.error("Progress must be between 0 and 100.");
      return;
    }
    const ok = await progressSave.run(async () => {
      await updateJob(id, { completion_percentage: value });
    });
    if (ok) {
      toast.success("Progress updated.");
      setProgress(null);
      invalidate();
    } else {
      toast.error(progressSave.formError ?? "Couldn’t update progress.");
    }
  };

  const actions = job ? TRANSITIONS[job.status] : [];

  return (
    <Drawer
      open
      wide
      title={job?.job_template_name ?? "Daily job"}
      subtitle={job && formatWindow(job.scheduled_start_at, job.scheduled_end_at)}
      onClose={onClose}
      footer={
        job && (
          <>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--danger-text"
              onClick={() => { setBlocked(null); setConfirmDelete(true); }}>
              <Trash2 size={16} /> Delete
            </button>
            <div className="ops-pills">
              {open && (
                <button type="button" className="ops-btn ops-btn--secondary" onClick={() => onEdit(job)}>
                  <Pencil size={16} /> Edit schedule
                </button>
              )}
              {open && (
                <button type="button" className="ops-btn ops-btn--primary" onClick={() => setAssigning(true)}>
                  <UserCog size={16} />
                  {job.vehicle_id || job.driver_id ? "Reassign" : "Assign"}
                </button>
              )}
            </div>
          </>
        )
      }
    >
      {error && !job ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !job ? (
        <Skeleton lines={10} />
      ) : (
        <div className={loading ? "ops-busy" : undefined}>
          <Section title="Status">
            <div className="ops-pills" style={{ marginBottom: 8 }}>
              <Pill tone={jobTone(job.status)}>{JOB_STATUS_LABEL[job.status]}</Pill>
              <AssignmentPill job={job} />
            </div>
            {transition.formError && !pending && (
              <p className="ops-callout ops-callout--danger" role="alert">{transition.formError}</p>
            )}
            {actions.length > 0 && (
              <div className="ops-pills">
                {actions.map((a) => (
                  <button key={a.to} type="button"
                    className={`ops-btn ops-btn--sm ${a.danger ? "ops-btn--ghost ops-btn--danger-text" : "ops-btn--secondary"}`}
                    onClick={() => { transition.reset(); setPending(a); }}>
                    {a.to === "IN_PROGRESS" ? <Play size={14} /> : a.to === "COMPLETED" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            {job.status === "PENDING" && (
              <p className="ops-muted" style={{ marginTop: 8 }}>
                A job can start once both a vehicle and a driver are assigned.
              </p>
            )}
          </Section>

          {job.status === "IN_PROGRESS" && (
            <Section title="Progress">
              <div className="ops-form__row">
                <TextField label="Completion %" type="number" min={0} max={100}
                  value={progress ?? String(job.completion_percentage)}
                  onChange={(e) => setProgress(e.target.value)} />
                <div style={{ alignSelf: "end" }}>
                  <button type="button" className="ops-btn ops-btn--secondary"
                    disabled={progress === null || progressSave.busy} onClick={() => void saveProgress()}>
                    Save progress
                  </button>
                </div>
              </div>
            </Section>
          )}

          <Section title="Route and resources">
            <DetailList items={[
              ["Route", (
                <button type="button" className="ops-link"
                  onClick={() => drill("routes", "/fleets/routes", {}, { search: job.job_template_name })}>
                  {job.job_template_name}
                </button>
              )],
              ["From", job.source_depot_name],
              ["To", job.destination_depot_name ?? "—"],
              ["Vehicle", job.vehicle_id ? (
                <button type="button" className="ops-link"
                  onClick={() => drill("vehicles", "/fleets/vehicles", {}, { search: job.vehicle_registration_number ?? "" })}>
                  {job.vehicle_label ?? job.vehicle_registration_number}
                </button>
              ) : <span className="ops-muted">Not assigned</span>],
              ["Driver", job.driver_id ? (
                <button type="button" className="ops-link"
                  onClick={() => drill("drivers", "/fleets/drivers", {}, { search: job.driver_name ?? "" })}>
                  {job.driver_name}{job.driver_code ? ` (${job.driver_code})` : ""}
                </button>
              ) : <span className="ops-muted">Not assigned</span>],
            ]} />
          </Section>

          <Section title="Timing">
            <DetailList items={[
              ["Scheduled", formatWindow(job.scheduled_start_at, job.scheduled_end_at)],
              ["Actual start", formatDateTime(job.actual_start_at)],
              ["Actual end", formatDateTime(job.actual_end_at)],
              ["Progress", `${job.completion_percentage}%`],
              ["Planned distance", job.template.estimated_distance_km ? `${job.template.estimated_distance_km} km` : "—"],
              ["Planned duration", job.template.estimated_duration_minutes ? `${job.template.estimated_duration_minutes} min` : "—"],
            ]} />
          </Section>

          <Section title={`Stops (${job.stops.length})`}>
            {job.stops.length === 0 ? (
              <p className="ops-muted">This job has no stops.</p>
            ) : (
              <ol className="ops-stops">
                {job.stops.map((s) => (
                  <li key={s.id}>
                    <span className="ops-stops__seq">{s.sequence_number}</span>
                    <div className="ops-list__main" style={{ flex: 1 }}>
                      <strong>{s.stop_name}</strong>
                      <small>
                        {s.stop_address || humanize(s.stop_type)}
                        {s.estimated_arrival ? ` · ETA ${formatTimeOnly(s.estimated_arrival)}` : ""}
                      </small>
                    </div>
                    <Pill>{humanize(s.status)}</Pill>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      )}

      {assigning && job && (
        <AssignDrawer job={job} onClose={() => setAssigning(false)} onDone={() => { setAssigning(false); reload(); }} />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={pending?.label ?? ""}
        confirmLabel={pending?.label ?? "Confirm"}
        danger={pending?.danger}
        busy={transition.busy}
        error={transition.formError}
        onConfirm={runTransition}
        onCancel={() => setPending(null)}
      >
        <p>{pending?.confirm}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this job?"
        confirmLabel="Delete job"
        danger
        busy={del.busy}
        blockedReason={blocked}
        error={del.formError}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>
          Jobs that haven’t started can be deleted. Started or completed jobs are operating history —
          cancel them instead.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

function JobsPage() {
  const list = useListState(WS.jobs.key, { ...WS.jobs.defaults } as Record<string, string>, WS.jobs.sort);
  const { state } = list;
  const { date } = useOps();
  const lookups = useLookups();
  const routes = useRouteLookup();
  const { openId, creating, open, create, close } = useRecordParams();
  const [editing, setEditing] = useState<JobDetailData | null>(null);
  const f = state.filters;

  const params = useMemo(
    () => ({
      page: state.page,
      page_size: PAGE_SIZE,
      search: list.query,
      ordering: state.sort,
      status: f.status,
      assignment: f.assignment,
      job_template_id: f.route,
      depot_id: f.depot,
      vehicle_id: f.vehicle,
      driver_id: f.driver,
      ...rangeParams(f.range, date),
    }),
    [state.page, state.sort, f, list.query, date],
  );
  const { data, error, loading, reload } = useResource(listJobsPage, params);

  const columns: Column<Job>[] = [
    {
      key: "route",
      header: "Job",
      sortKey: "route",
      render: (j) => (
        <div className="ops-cell">
          <strong>{j.job_template_name}</strong>
          <small>{j.source_depot_name}{j.destination_depot_name ? ` → ${j.destination_depot_name}` : ""}</small>
        </div>
      ),
    },
    { key: "when", header: "Scheduled", sortKey: "scheduled_start_at", render: (j) => formatWindow(j.scheduled_start_at, j.scheduled_end_at) },
    { key: "status", header: "Status", sortKey: "status", render: (j) => <Pill tone={jobTone(j.status)}>{JOB_STATUS_LABEL[j.status]}</Pill> },
    { key: "vehicle", header: "Vehicle", sortKey: "vehicle", render: (j) => j.vehicle_registration_number ?? <span className="ops-muted">—</span> },
    { key: "driver", header: "Driver", sortKey: "driver", render: (j) => j.driver_name ?? <span className="ops-muted">—</span> },
    { key: "assign", header: "Assignment", render: (j) => <AssignmentPill job={j} /> },
    { key: "pct", header: "Progress", className: "ops-num", render: (j) => `${j.completion_percentage}%` },
  ];

  const formOpen = creating || editing !== null;
  const clearFilter = (...names: string[]) => names.forEach((n) => list.setFilter(n, ""));

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Daily Jobs"
        description="Scheduled runs created from your routes, with their crew and vehicle."
        count={data?.count}
        action={{ label: "Add Job", onClick: create }}
        extra={
          <div className="ops-seg" role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.value} type="button" aria-pressed={f.range === r.value}
                onClick={() => list.setFilter("range", r.value)}>
                {r.value === "day" ? <><CalendarClock size={14} style={{ verticalAlign: -2 }} /> {r.label}</> : r.label}
              </button>
            ))}
          </div>
        }
      />

      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <SearchBox label="Search jobs" placeholder="Route, vehicle, driver or depot"
          value={state.search} onChange={list.setSearch} />
        <FilterSelect label="Status" value={f.status} onChange={(v) => list.setFilter("status", v)}
          options={[{ value: "", label: "All" }, ...STATUS_OPTIONS]} />
        <FilterSelect label="Assignment" value={f.assignment} onChange={(v) => list.setFilter("assignment", v)}
          options={ASSIGNMENT_OPTIONS} />
        <FilterSelect label="Route" value={f.route} onChange={(v) => list.setFilter("route", v)}
          options={[{ value: "", label: "All" }, ...routes.options]} />
        <FilterSelect label="Depot" value={f.depot} onChange={(v) => list.setFilter("depot", v)}
          options={[{ value: "", label: "All" }, ...lookups.depots]} />
        {f.vehicle && (
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
            onClick={() => clearFilter("vehicle", "vehicle_label")}>
            Vehicle: {f.vehicle_label || "selected"} <X size={14} />
          </button>
        )}
        {f.driver && (
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
            onClick={() => clearFilter("driver", "driver_label")}>
            Driver: {f.driver_label || "selected"} <X size={14} />
          </button>
        )}
      </FilterBar>

      <DataTable
        caption="Daily jobs"
        columns={columns}
        rows={data?.results}
        rowKey={(j) => j.id}
        onRowClick={(j) => open(j.id)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          list.hasActiveFilters || f.range !== "all" ? (
            <EmptyBlock
              title="No jobs found"
              text={f.range === "day" ? "Nothing is scheduled for this day, or no job matches the filters." : "No job matches the current range and filters."}
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Job</button>}
            />
          ) : (
            <EmptyBlock title="No jobs yet" text="Schedule a job from one of your routes."
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Job</button>} />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="jobs" />
      )}

      {openId && !formOpen && <JobDetailDrawer id={openId} onClose={close} onEdit={setEditing} />}
      {formOpen && (
        <JobForm
          key={editing?.id ?? "new"}
          job={editing}
          initialDate={date}
          onClose={() => { setEditing(null); close(); }}
          onSaved={(id) => { setEditing(null); open(id); }}
        />
      )}
    </div>
  );
}

export default JobsPage;
