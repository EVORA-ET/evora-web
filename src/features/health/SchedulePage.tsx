import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import {
  getFleetMaintenanceStatus,
  listServiceRequirements,
  retireServiceRequirement,
  type FleetMaintenanceRow,
  type ServiceRequirement,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import ConfirmDialog from "../operations/ui/ConfirmDialog";
import DataTable, { type Column } from "../operations/ui/DataTable";
import { CheckField, TextArea } from "../operations/ui/Fields";
import { FilterBar, FilterSelect, SearchBox } from "../operations/ui/FilterBar";
import Pagination from "../operations/ui/Pagination";
import { Pill } from "../operations/ui/Pill";
import { EmptyBlock } from "../operations/ui/states";
import { formatDay, formatValue } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import { SERVICE_STATUS_LABEL } from "../intelligence/labels";
import { VerificationPill } from "../intelligence/SourceDrawer";
import { Definition, ServicePill } from "../intelligence/ui";
import { RequirementDrawer } from "./MaintenanceForms";

type FleetRequirement = FleetMaintenanceRow["requirements"][number];
interface Row {
  req: ServiceRequirement;
  check: FleetRequirement | undefined;
}

const PAGE_SIZE = 25;
const ACTIVE = { ordering: "name" };
const WITH_RETIRED = { ordering: "name", include_retired: true };
const STATUS_RANK: Record<string, number> = { overdue: 0, due_soon: 1, undetermined: 2, ok: 3 };

function dueText(c: FleetRequirement | undefined): string {
  if (!c) return "—";
  const parts: string[] = [];
  if (c.due_date) {
    const d = c.days_remaining ?? 0;
    parts.push(`${formatDay(c.due_date)} (${d < 0 ? `${-d} days overdue` : `${d} days`})`);
  }
  if (c.due_odometer_km !== null) {
    const km = c.km_remaining ?? 0;
    parts.push(`${formatValue(c.due_odometer_km, "km", 0)} (${km < 0 ? `${formatValue(-km, "km", 0)} over` : `${formatValue(km, "km", 0)} left`})`);
  }
  return parts.join(" · ") || "—";
}

function SchedulePage() {
  const navigate = useNavigate();
  const { invalidate, toast } = useOps();
  const [showRetired, setShowRetired] = useState(false);
  const [statusParam, setStatusParam] = useParam("status");
  const status = statusParam ?? "";
  const setStatus = (v: string) => setStatusParam(v || null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("status");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [retiring, setRetiring] = useState<ServiceRequirement | null>(null);
  const [reason, setReason] = useState("");
  const submit = useSubmit();

  const reqs = useResource(listServiceRequirements, showRetired ? WITH_RETIRED : ACTIVE);
  const fleet = useResource(getFleetMaintenanceStatus, 365);

  const checks = useMemo(() => {
    const m = new Map<string, FleetRequirement>();
    for (const v of fleet.data?.vehicles ?? []) for (const r of v.requirements) m.set(r.requirement_id, r);
    return m;
  }, [fleet.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: Row[] = (reqs.data ?? [])
      .map((req) => ({ req, check: req.retired_at ? undefined : checks.get(req.id) }))
      .filter(({ req, check }) =>
        (!q || req.name.toLowerCase().includes(q) || req.vehicle_registration.toLowerCase().includes(q)
          || req.component.toLowerCase().includes(q)) &&
        (!status || (status === "retired" ? Boolean(req.retired_at) : check?.status === status)));
    const rank = (r: Row) => (r.req.retired_at ? 9 : STATUS_RANK[r.check?.status ?? ""] ?? 5);
    return list.sort((a, b) =>
      sort === "vehicle"
        ? a.req.vehicle_registration.localeCompare(b.req.vehicle_registration) || a.req.name.localeCompare(b.req.name)
        : sort === "name"
          ? a.req.name.localeCompare(b.req.name)
          : rank(a) - rank(b) || (a.check?.days_remaining ?? Infinity) - (b.check?.days_remaining ?? Infinity));
  }, [reqs.data, checks, search, status, sort]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const retire = () =>
    submit.run(async () => {
      if (!retiring) return;
      if (!reason.trim()) throw new Error("Give a reason for retiring this requirement.");
      await retireServiceRequirement(retiring.id, reason.trim());
      toast.success(`"${retiring.name}" retired.`);
      setRetiring(null);
      setReason("");
      invalidate();
    });

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Requirement",
      render: ({ req }) => (
        <span>
          {req.name}
          <small className="ops-muted" style={{ display: "block" }}>
            Every {[req.interval_km !== null && formatValue(req.interval_km, "km", 0), req.interval_days !== null && `${req.interval_days} days`]
              .filter(Boolean).join(" or ")}
            {req.component && ` · ${req.component}`}
          </small>
        </span>
      ),
    },
    {
      key: "vehicle",
      header: "Vehicle",
      render: ({ req }) => (
        <button type="button" className="ops-link" onClick={(ev) => { ev.stopPropagation(); navigate(`/health/vehicles?vehicle=${req.vehicle_id}`); }}>
          {req.vehicle_registration}
        </button>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: ({ req, check }) =>
        req.retired_at ? <Pill>Retired</Pill> : check ? <ServicePill status={check.status} /> : <span className="ops-muted">Not evaluated</span>,
    },
    {
      key: "due",
      header: "Due",
      render: ({ req, check }) =>
        req.retired_at ? (
          <small className="ops-muted">Retired {formatDay(req.retired_at)}: {req.retired_reason}</small>
        ) : check?.status === "undetermined" ? (
          <small className="ops-muted">{check.undetermined_reasons.join(" ")}</small>
        ) : dueText(check),
    },
    {
      key: "lastdone",
      header: "Last completed",
      render: ({ req, check }) => (req.retired_at ? null : check?.last_service_on ? formatDay(check.last_service_on) : <span className="ops-muted">None recorded</span>),
    },
    {
      key: "warn",
      header: "Warning window",
      render: ({ req }) =>
        req.warning_km === null && req.warning_days === null ? (
          <span className="ops-muted">None (overdue only)</span>
        ) : [req.warning_km !== null && formatValue(req.warning_km, "km", 0), req.warning_days !== null && `${req.warning_days} days`]
          .filter(Boolean).join(" / "),
    },
    {
      key: "source",
      header: "Source",
      render: ({ req }) => (
        <span>
          {req.source.title}
          <span style={{ display: "block" }}><VerificationPill source={req.source} /></span>
        </span>
      ),
    },
    {
      key: "act",
      header: "",
      render: ({ req }) =>
        req.retired_at ? null : (
          <button type="button" className="ops-link" onClick={(ev) => { ev.stopPropagation(); submit.reset(); setReason(""); setRetiring(req); }}>
            Retire
          </button>
        ),
    },
  ];

  return (
    <div className="ops-ws">
      <div className="ops-wshead">
        <div>
          <h2 className="ops-wshead__title">Maintenance requirements</h2>
          <p className="ops-wshead__desc">
            Documented service intervals for each vehicle and when each falls due, from recorded services and odometer readings.
          </p>
        </div>
        <button type="button" className="ops-btn ops-btn--primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add requirement
        </button>
      </div>

      <section className="ops-card" aria-labelledby="sc-reqs">
        <div className="ops-card__head"><h2 id="sc-reqs">Service requirements</h2></div>
        <FilterBar active={Boolean(status || search || showRetired)}
          onClear={() => { setStatus(""); setSearch(""); setShowRetired(false); setPage(1); }}>
          <SearchBox value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Name, component or registration" label="Search requirements" />
          <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
            options={[
              { value: "", label: "All" },
              ...(["overdue", "due_soon", "undetermined", "ok"] as const).map((s) => ({ value: s, label: SERVICE_STATUS_LABEL[s] })),
              ...(showRetired ? [{ value: "retired", label: "Retired" }] : []),
            ]} />
          <FilterSelect label="Sort by" value={sort} onChange={setSort}
            options={[{ value: "status", label: "Most urgent" }, { value: "vehicle", label: "Vehicle" }, { value: "name", label: "Name" }]} />
          <CheckField label="Show retired" checked={showRetired}
            onChange={(ev) => { setShowRetired(ev.target.checked); setPage(1); }} />
        </FilterBar>
        <DataTable columns={columns} rows={reqs.data ? pageRows : undefined} rowKey={(r) => r.req.id}
          loading={reqs.loading} error={reqs.error} onRetry={reqs.reload} caption="Service requirements"
          empty={<EmptyBlock compact title={reqs.data?.length ? "No requirements match" : "No service requirements recorded"}
            text={reqs.data?.length ? undefined : "Add intervals from each vehicle's owner's manual or service schedule, citing the document."} />} />
        <Pagination page={current} totalPages={totalPages} count={rows.length} pageSize={PAGE_SIZE} onPage={setPage} noun="requirements" />
        {fleet.error && <p className="ops-callout ops-callout--warn" role="status">Status could not be loaded: {fleet.error}</p>}
        <Definition>
          Requirements are not edited after recording, so past checks stay explainable. To change an interval,
          retire the requirement and add a new one. Without a warning window only overdue is reported.
        </Definition>
      </section>

      {adding && <RequirementDrawer onClose={() => setAdding(false)} />}
      <ConfirmDialog open={Boolean(retiring)} title={`Retire "${retiring?.name ?? ""}"?`} confirmLabel="Retire requirement" danger
        busy={submit.busy} error={submit.formError} onConfirm={() => void retire()} onCancel={() => setRetiring(null)}>
        <p style={{ marginTop: 0 }}>
          It will no longer be checked for {retiring?.vehicle_registration}. It is kept, with the reason, for history.
        </p>
        <TextArea label="Reason" required value={reason} onChange={(ev) => setReason(ev.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

export default SchedulePage;
