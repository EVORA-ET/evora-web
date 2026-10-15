import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import type { JobTemplateStatus } from "../../lib/api";
import {
  createRouteRecord,
  deleteRoute,
  getRoute,
  listRoutesPage,
  updateRoute,
  type Route,
  type RouteInput,
} from "../../lib/opsApi";
import { conflictDetail, useListState, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import { humanize, plural } from "./format";
import { useOps } from "./useOps";
import { useDrill, useLookups, useRecordParams, useSubmit } from "./workspaceHooks";
import WorkspaceHead from "./WorkspaceHead";
import ConfirmDialog from "./ui/ConfirmDialog";
import DataTable, { type Column } from "./ui/DataTable";
import { DetailList, Section } from "./ui/Detail";
import Drawer from "./ui/Drawer";
import { CheckField, SelectField, TextArea, TextField } from "./ui/Fields";
import { FilterBar, FilterSelect, SearchBox } from "./ui/FilterBar";
import Pagination from "./ui/Pagination";
import { Pill } from "./ui/Pill";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";
import { routeTone } from "./ui/tones";

const PAGE_SIZE = 15;

const STATUSES = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
];

interface FormValues {
  name: string;
  source_depot_id: string;
  destination_depot_id: string;
  description: string;
  is_recurring: boolean;
  recurrence_rule: string;
  is_permanent: boolean;
  start_date: string;
  end_date: string;
  estimated_duration_minutes: string;
  estimated_distance_km: string;
  estimated_energy_kwh: string;
  status: string;
}

const EMPTY: FormValues = {
  name: "",
  source_depot_id: "",
  destination_depot_id: "",
  description: "",
  is_recurring: false,
  recurrence_rule: "",
  is_permanent: false,
  start_date: "",
  end_date: "",
  estimated_duration_minutes: "",
  estimated_distance_km: "",
  estimated_energy_kwh: "",
  status: "ACTIVE",
};

function fromRoute(r: Route): FormValues {
  return {
    name: r.name,
    source_depot_id: r.source_depot_id,
    destination_depot_id: r.destination_depot_id ?? "",
    description: r.description,
    is_recurring: r.is_recurring,
    recurrence_rule: r.recurrence_rule,
    is_permanent: r.is_permanent,
    start_date: r.start_date ?? "",
    end_date: r.end_date ?? "",
    estimated_duration_minutes:
      r.estimated_duration_minutes === null ? "" : String(r.estimated_duration_minutes),
    estimated_distance_km: r.estimated_distance_km ?? "",
    estimated_energy_kwh: r.estimated_energy_kwh ?? "",
    status: r.status,
  };
}

function validate(v: FormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = "Name is required.";
  if (!v.source_depot_id) e.source_depot_id = "Choose the starting depot.";
  if (v.is_recurring && !v.recurrence_rule.trim()) {
    e.recurrence_rule = "Describe the recurrence, e.g. “Weekdays”.";
  }
  if (v.start_date && v.end_date && v.end_date < v.start_date) {
    e.end_date = "End date must not be before the start date.";
  }
  for (const f of ["estimated_duration_minutes", "estimated_distance_km", "estimated_energy_kwh"] as const) {
    if (v[f] !== "" && !(Number(v[f]) >= 0)) e[f] = "Must be 0 or more.";
  }
  return e;
}

function toInput(v: FormValues): RouteInput {
  return {
    name: v.name.trim(),
    source_depot_id: v.source_depot_id,
    destination_depot_id: v.destination_depot_id || null,
    description: v.description.trim(),
    is_recurring: v.is_recurring,
    recurrence_rule: v.is_recurring ? v.recurrence_rule.trim() : "",
    is_permanent: v.is_permanent,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
    estimated_duration_minutes:
      v.estimated_duration_minutes === "" ? null : Number(v.estimated_duration_minutes),
    estimated_distance_km: v.estimated_distance_km === "" ? null : v.estimated_distance_km,
    estimated_energy_kwh: v.estimated_energy_kwh === "" ? null : v.estimated_energy_kwh,
    status: v.status as JobTemplateStatus,
  };
}

function RouteForm({
  route,
  onClose,
  onSaved,
}: {
  route: Route | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast, invalidate } = useOps();
  const lookups = useLookups();
  const submit = useSubmit();
  const [values, setValues] = useState<FormValues>(() => (route ? fromRoute(route) : EMPTY));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((c) => ({ ...c, [key]: value }));
  const err = (key: string) => clientErrors[key] ?? submit.errors[key];

  const save = async () => {
    const problems = validate(values);
    setClientErrors(problems);
    if (Object.keys(problems).length) return;
    await submit.run(async () => {
      const saved = route
        ? await updateRoute(route.id, toInput(values))
        : await createRouteRecord(toInput(values));
      toast.success(route ? "Route updated." : "Route created.");
      invalidate();
      onSaved(saved.id);
    });
  };

  return (
    <Drawer
      open
      title={route ? "Edit route" : "Add route"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : route ? "Save changes" : "Create route"}
          </button>
        </>
      }
    >
      <form className="ops-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {lookups.error && <p className="ops-callout ops-callout--warn">Couldn’t load depots: {lookups.error}</p>}

        <TextField label="Route name" required value={values.name} error={err("name")}
          onChange={(e) => set("name", e.target.value)} />
        <div className="ops-form__row">
          <SelectField label="From depot" required placeholder="Choose a depot" options={lookups.depots}
            value={values.source_depot_id} error={err("source_depot_id")}
            onChange={(e) => set("source_depot_id", e.target.value)} />
          <SelectField label="To depot" placeholder="Same as start / none" options={lookups.depots}
            value={values.destination_depot_id} error={err("destination_depot_id")}
            onChange={(e) => set("destination_depot_id", e.target.value)} />
        </div>
        <TextArea label="Description" value={values.description} error={err("description")}
          onChange={(e) => set("description", e.target.value)} />
        <SelectField label="Status" options={STATUSES} value={values.status} error={err("status")}
          onChange={(e) => set("status", e.target.value)}
          hint="Only active routes can be used for new daily jobs." />

        <fieldset className="ops-checks">
          <legend>Schedule</legend>
          <CheckField label="Recurring" checked={values.is_recurring}
            onChange={(e) => set("is_recurring", e.target.checked)} />
          <CheckField label="Permanent" checked={values.is_permanent}
            onChange={(e) => set("is_permanent", e.target.checked)} />
        </fieldset>
        {values.is_recurring && (
          <TextField label="Recurrence" required value={values.recurrence_rule} error={err("recurrence_rule")}
            placeholder="e.g. Weekdays" onChange={(e) => set("recurrence_rule", e.target.value)} />
        )}
        <div className="ops-form__row">
          <TextField label="Valid from" type="date" value={values.start_date} error={err("start_date")}
            onChange={(e) => set("start_date", e.target.value)} />
          <TextField label="Valid until" type="date" value={values.end_date} error={err("end_date")}
            onChange={(e) => set("end_date", e.target.value)} />
        </div>
        <div className="ops-form__row ops-form__row--3">
          <TextField label="Duration (min)" type="number" min={0} value={values.estimated_duration_minutes}
            error={err("estimated_duration_minutes")}
            onChange={(e) => set("estimated_duration_minutes", e.target.value)} />
          <TextField label="Distance (km)" type="number" min={0} step="0.1" value={values.estimated_distance_km}
            error={err("estimated_distance_km")} onChange={(e) => set("estimated_distance_km", e.target.value)} />
          <TextField label="Energy (kWh)" type="number" min={0} step="0.1" value={values.estimated_energy_kwh}
            error={err("estimated_energy_kwh")} onChange={(e) => set("estimated_energy_kwh", e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}

function RouteDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (r: Route) => void }) {
  const { toast, invalidate } = useOps();
  const drill = useDrill();
  const { data: route, error, loading, reload } = useResource(getRoute, id);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const del = useSubmit();
  const statusChange = useSubmit();

  const remove = async () => {
    const ok = await del.run(async () => {
      try {
        await deleteRoute(id);
      } catch (e) {
        const reason = conflictDetail(e);
        if (reason) setBlocked(reason);
        throw e;
      }
    });
    if (ok) {
      toast.success("Route deleted.");
      invalidate();
      setConfirming(false);
      onClose();
    }
  };

  const setStatus = async (status: JobTemplateStatus) => {
    const ok = await statusChange.run(async () => {
      await updateRoute(id, { status });
    });
    if (ok) {
      toast.success(status === "ARCHIVED" ? "Route archived." : `Route is now ${humanize(status).toLowerCase()}.`);
      invalidate();
    } else {
      toast.error(statusChange.formError ?? "Couldn’t change the route status.");
    }
  };

  return (
    <Drawer
      open
      title={route?.name ?? "Route"}
      subtitle={route && `${route.source_depot_name}${route.destination_depot_name ? ` → ${route.destination_depot_name}` : ""}`}
      onClose={onClose}
      footer={
        route && (
          <>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--danger-text"
              onClick={() => { setBlocked(null); setConfirming(true); }}>
              <Trash2 size={16} /> Delete
            </button>
            <button type="button" className="ops-btn ops-btn--primary" onClick={() => onEdit(route)}>
              <Pencil size={16} /> Edit
            </button>
          </>
        )
      }
    >
      {error && !route ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !route ? (
        <Skeleton lines={8} />
      ) : (
        <div className={loading ? "ops-busy" : undefined}>
          <Section title="Status">
            <div className="ops-pills" style={{ marginBottom: 8 }}>
              <Pill tone={routeTone(route.status)}>{humanize(route.status)}</Pill>
              {route.is_recurring && <Pill>Recurring</Pill>}
              {route.is_permanent && <Pill>Permanent</Pill>}
            </div>
            <div className="ops-pills">
              {route.status !== "ACTIVE" && (
                <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                  disabled={statusChange.busy} onClick={() => void setStatus("ACTIVE")}>Activate</button>
              )}
              {route.status === "ACTIVE" && (
                <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                  disabled={statusChange.busy} onClick={() => void setStatus("PAUSED")}>Pause</button>
              )}
              {route.status !== "ARCHIVED" && (
                <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                  disabled={statusChange.busy} onClick={() => void setStatus("ARCHIVED")}>Archive</button>
              )}
            </div>
            {route.status !== "ACTIVE" && (
              <p className="ops-callout ops-callout--warn" style={{ marginTop: 8 }}>
                This route is {humanize(route.status).toLowerCase()}, so new daily jobs can’t be created from it.
              </p>
            )}
          </Section>

          <Section title="Daily jobs">
            <div className="ops-stats">
              <button type="button" className="ops-stat" disabled={!route.job_count}
                onClick={() => drill("jobs", "/fleets/jobs", { range: "all", route: route.id })}>
                <strong>{route.job_count ?? 0}</strong>
                <span>{plural(route.job_count ?? 0, "job")}</span>
                <small>all time</small>
              </button>
              <button type="button" className="ops-stat" disabled={!route.upcoming_job_count}
                onClick={() => drill("jobs", "/fleets/jobs", { range: "upcoming", route: route.id })}>
                <strong>{route.upcoming_job_count ?? 0}</strong>
                <span>upcoming</span>
                <small>open and scheduled</small>
              </button>
            </div>
          </Section>

          <Section title="Details">
            <DetailList items={[
              ["From", (
                <button type="button" className="ops-link"
                  onClick={() => drill("depots", "/fleets/depots", {}, { search: route.source_depot_name })}>
                  {route.source_depot_name}
                </button>
              )],
              ["To", route.destination_depot_name ?? "—"],
              ["Description", route.description || "—"],
              ["Recurrence", route.is_recurring ? route.recurrence_rule || "—" : "One-off"],
              ["Valid", route.start_date || route.end_date ? `${route.start_date ?? "…"} to ${route.end_date ?? "open"}` : "No limits"],
              ["Duration", route.estimated_duration_minutes ? `${route.estimated_duration_minutes} min` : "—"],
              ["Distance", route.estimated_distance_km ? `${route.estimated_distance_km} km` : "—"],
              ["Energy", route.estimated_energy_kwh ? `${route.estimated_energy_kwh} kWh` : "—"],
            ]} />
          </Section>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this route?"
        confirmLabel="Delete route"
        danger
        busy={del.busy}
        blockedReason={blocked}
        error={del.formError}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong>{route?.name}</strong> will be removed permanently. Routes that already have daily jobs
          can’t be deleted — archive them instead.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

function RoutesPage() {
  const list = useListState(WS.routes.key, { ...WS.routes.defaults } as Record<string, string>, WS.routes.sort);
  const { state } = list;
  const lookups = useLookups();
  const { openId, creating, open, create, close } = useRecordParams();
  const [editing, setEditing] = useState<Route | null>(null);

  const params = useMemo(
    () => ({
      page: state.page,
      page_size: PAGE_SIZE,
      search: list.query,
      ordering: state.sort,
      status: state.filters.status,
      depot_id: state.filters.depot,
      is_recurring: state.filters.recurring,
    }),
    [state.page, state.sort, state.filters, list.query],
  );
  const { data, error, loading, reload } = useResource(listRoutesPage, params);

  const columns: Column<Route>[] = [
    {
      key: "name",
      header: "Route",
      sortKey: "name",
      render: (r) => (
        <div className="ops-cell">
          <strong>{r.name}</strong>
          <small>{r.is_recurring ? `Recurring · ${r.recurrence_rule}` : "One-off"}</small>
        </div>
      ),
    },
    { key: "from", header: "From", sortKey: "source", render: (r) => r.source_depot_name },
    { key: "to", header: "To", sortKey: "destination", render: (r) => r.destination_depot_name ?? "—" },
    { key: "status", header: "Status", sortKey: "status", render: (r) => <Pill tone={routeTone(r.status)}>{humanize(r.status)}</Pill> },
    { key: "dist", header: "Distance", sortKey: "estimated_distance_km", className: "ops-num",
      render: (r) => (r.estimated_distance_km ? `${r.estimated_distance_km} km` : "—") },
    { key: "dur", header: "Duration", sortKey: "estimated_duration_minutes", className: "ops-num",
      render: (r) => (r.estimated_duration_minutes ? `${r.estimated_duration_minutes} min` : "—") },
    { key: "jobs", header: "Upcoming jobs", className: "ops-num", render: (r) => r.upcoming_job_count ?? 0 },
  ];

  const formOpen = creating || editing !== null;

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Routes"
        description="Reusable route templates your daily jobs are created from."
        count={data?.count}
        action={{ label: "Add Route", onClick: create }}
      />

      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <SearchBox label="Search routes" placeholder="Name, description or depot"
          value={state.search} onChange={list.setSearch} />
        <FilterSelect label="Status" value={state.filters.status} onChange={(v) => list.setFilter("status", v)}
          options={[{ value: "", label: "All" }, ...STATUSES]} />
        <FilterSelect label="Depot" value={state.filters.depot} onChange={(v) => list.setFilter("depot", v)}
          options={[{ value: "", label: "All" }, ...lookups.depots]} />
        <FilterSelect label="Recurring" value={state.filters.recurring}
          onChange={(v) => list.setFilter("recurring", v)}
          options={[{ value: "", label: "Any" }, { value: "true", label: "Recurring" }, { value: "false", label: "One-off" }]} />
      </FilterBar>

      <DataTable
        caption="Routes"
        columns={columns}
        rows={data?.results}
        rowKey={(r) => r.id}
        onRowClick={(r) => open(r.id)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          list.hasActiveFilters ? (
            <EmptyBlock title="No routes match" text="Try a different search or clear the filters." />
          ) : (
            <EmptyBlock title="No routes yet" text="Create a route, then schedule daily jobs from it."
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Route</button>} />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="routes" />
      )}

      {openId && !formOpen && <RouteDetail id={openId} onClose={close} onEdit={setEditing} />}
      {formOpen && (
        <RouteForm
          key={editing?.id ?? "new"}
          route={editing}
          onClose={() => { setEditing(null); close(); }}
          onSaved={(id) => { setEditing(null); open(id); }}
        />
      )}
    </div>
  );
}

export default RoutesPage;
