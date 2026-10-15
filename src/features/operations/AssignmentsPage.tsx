import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCog } from "lucide-react";

import { listJobsPage, type Job } from "../../lib/opsApi";
import AssignDrawer from "./AssignDrawer";
import { AssignmentPill } from "./JobsPage";
import { useListState, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import { formatWindow, JOB_STATUS_LABEL } from "./format";
import { RANGE_OPTIONS, rangeParams } from "./jobRange";
import { useOps } from "./useOps";
import WorkspaceHead from "./WorkspaceHead";
import DataTable, { type Column } from "./ui/DataTable";
import { FilterBar, FilterSelect, SearchBox } from "./ui/FilterBar";
import Pagination from "./ui/Pagination";
import { Pill } from "./ui/Pill";
import { EmptyBlock } from "./ui/states";
import { jobTone } from "./ui/tones";

const PAGE_SIZE = 15;

const VIEWS = [
  { value: "PENDING", label: "Needs assignment" },
  { value: "ASSIGNED", label: "Ready to start" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "", label: "All" },
];

const ASSIGNMENT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "unassigned", label: "Nothing assigned" },
  { value: "missing_vehicle", label: "Needs a vehicle" },
  { value: "missing_driver", label: "Needs a driver" },
  { value: "assigned", label: "Fully assigned" },
];

function AssignmentsPage() {
  const list = useListState(
    WS.assignments.key,
    { ...WS.assignments.defaults } as Record<string, string>,
    WS.assignments.sort,
  );
  const { state } = list;
  const f = state.filters;
  const { date } = useOps();
  const navigate = useNavigate();
  const [assigning, setAssigning] = useState<Job | null>(null);

  const params = useMemo(
    () => ({
      page: state.page,
      page_size: PAGE_SIZE,
      search: list.query,
      ordering: state.sort,
      status: f.status,
      assignment: f.assignment,
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
    {
      key: "vehicle",
      header: "Vehicle",
      sortKey: "vehicle",
      render: (j) => j.vehicle_registration_number ?? <Pill tone="warn">Missing</Pill>,
    },
    {
      key: "driver",
      header: "Driver",
      sortKey: "driver",
      render: (j) => j.driver_name ?? <Pill tone="warn">Missing</Pill>,
    },
    { key: "state", header: "State", render: (j) => <AssignmentPill job={j} /> },
    {
      key: "action",
      header: "",
      render: (j) =>
        j.status === "PENDING" || j.status === "ASSIGNED" ? (
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
            onClick={(event) => { event.stopPropagation(); setAssigning(j); }}>
            <UserCog size={14} /> {j.vehicle_id || j.driver_id ? "Reassign" : "Assign"}
          </button>
        ) : null,
    },
  ];

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Assignments"
        description="Crew and vehicle your jobs. The server checks availability, licence and insurance, and double-booking."
        count={data?.count}
        extra={
          <div className="ops-seg" role="group" aria-label="Date range">
            {RANGE_OPTIONS.map((r) => (
              <button key={r.value} type="button" aria-pressed={f.range === r.value}
                onClick={() => list.setFilter("range", r.value)}>
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <div className="ops-seg" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.label} type="button" aria-pressed={f.status === v.value}
              onClick={() => list.setFilter("status", v.value)}>
              {v.label}
            </button>
          ))}
        </div>
        <SearchBox label="Search jobs" placeholder="Route, vehicle, driver or depot"
          value={state.search} onChange={list.setSearch} />
        <FilterSelect label="Missing" value={f.assignment} onChange={(v) => list.setFilter("assignment", v)}
          options={ASSIGNMENT_OPTIONS} />
      </FilterBar>

      <DataTable
        caption="Job assignments"
        columns={columns}
        rows={data?.results}
        rowKey={(j) => j.id}
        onRowClick={(j) => navigate(`/fleets/jobs?open=${j.id}`)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          f.status === "PENDING" && !list.query && !f.assignment ? (
            <EmptyBlock
              title="Everything in this range is assigned"
              text="No pending jobs need a vehicle or driver. Switch the view to see the rest."
            />
          ) : (
            <EmptyBlock title="No jobs match" text="Try a different range, view or search." />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="jobs" />
      )}

      {assigning && (
        <AssignDrawer job={assigning} onClose={() => setAssigning(null)} onDone={() => setAssigning(null)} />
      )}
    </div>
  );
}

export default AssignmentsPage;
