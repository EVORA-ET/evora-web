import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import {
  listMaintenanceEventsPage,
  voidMaintenanceEvent,
  type MaintenanceEvent,
  type MaintenanceEventType,
} from "../../lib/intelligenceApi";
import { getVehicle } from "../../lib/opsApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import ConfirmDialog from "../operations/ui/ConfirmDialog";
import DataTable, { type Column } from "../operations/ui/DataTable";
import { DetailList } from "../operations/ui/Detail";
import Drawer from "../operations/ui/Drawer";
import { CheckField, TextArea } from "../operations/ui/Fields";
import { FilterBar, FilterSelect } from "../operations/ui/FilterBar";
import Pagination from "../operations/ui/Pagination";
import { Pill } from "../operations/ui/Pill";
import { EmptyBlock } from "../operations/ui/states";
import { formatDay, formatMoney, formatStamp, formatValue } from "../intelligence/format";
import { useParam } from "../intelligence/hooks";
import { EVENT_TYPE_LABEL } from "../intelligence/labels";
import { SourceDetailDrawer } from "../intelligence/SourceDrawer";
import { Definition } from "../intelligence/ui";
import VehiclePicker from "../intelligence/VehiclePicker";
import { EventDrawer } from "./MaintenanceForms";

const PAGE_SIZE = 20;

function EventDetail({
  event,
  onClose,
  onVoid,
}: {
  event: MaintenanceEvent;
  onClose: () => void;
  onVoid: () => void;
}) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  return (
    <Drawer open title={`${EVENT_TYPE_LABEL[event.event_type]} · ${event.vehicle_registration}`} onClose={onClose}
      subtitle={`Recorded ${formatStamp(event.created_at)}`}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Close</button>
          {!event.voided_at && (
            <button type="button" className="ops-btn ops-btn--danger" onClick={onVoid}>Void record</button>
          )}
        </>
      }>
      {event.voided_at && (
        <p className="ops-callout ops-callout--warn">
          Voided {formatStamp(event.voided_at)}: {event.void_reason}. Kept for history; excluded from checks.
        </p>
      )}
      <DetailList items={[
        ["Date", formatDay(event.occurred_on)],
        ["Completed on", event.completed_on ? formatDay(event.completed_on) : "Not recorded"],
        ["Odometer", event.odometer_km !== null ? formatValue(event.odometer_km, "km", 0) : "Not recorded"],
        ["Component", event.component || "—"],
        ...(event.event_type === "fault_report"
          ? ([["Fault code", event.fault_code || "—"], ["Severity (as recorded)", event.fault_severity || "Not recorded"]] as [string, string][])
          : []),
        ["Linked requirement", event.requirement_id ? "Yes — counts toward the schedule" : "None"],
        ["Resolves a fault", event.resolves_id ? "Yes" : "No"],
        ["Description", event.description || "—"],
        ["Provider", event.provider || "—"],
        ["Cost", event.cost !== null ? formatMoney(event.cost, event.currency) : "Not recorded"],
        ["Downtime", event.downtime_hours !== null ? `${event.downtime_hours} h` : "Not recorded"],
        ["Origin", event.origin === "measured" ? "Documented (job card, invoice or report)" : "Organization-provided"],
        ["Source", event.source_id ? (
          <button type="button" className="ops-link" onClick={() => setSourceId(event.source_id)}>View source</button>
        ) : "None cited"],
      ]} />
      <SourceDetailDrawer id={sourceId} onClose={() => setSourceId(null)} />
    </Drawer>
  );
}

function EventLogPage() {
  const navigate = useNavigate();
  const { invalidate, toast } = useOps();
  const [vehicleId, setVehicleId] = useParam("vehicle");
  const [type, setType] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [ordering, setOrdering] = useState("-occurred_on");
  const [page, setPage] = useState(1);
  const [picking, setPicking] = useState(false);
  const [recordParam, setRecordParam] = useParam("record");
  const [recordingState, setRecording] = useState(false);
  const recording = recordingState || recordParam === "1";
  const [openEvent, setOpenEvent] = useState<MaintenanceEvent | null>(null);
  const [voiding, setVoiding] = useState<MaintenanceEvent | null>(null);
  const [reason, setReason] = useState("");
  const submit = useSubmit();

  const params = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      ordering,
      vehicle_id: vehicleId ?? undefined,
      event_type: type || undefined,
      include_voided: includeVoided || undefined,
    }),
    [page, ordering, vehicleId, type, includeVoided],
  );
  const { data, error, loading, reload } = useResource(listMaintenanceEventsPage, params);
  const vehicle = useResource(getVehicle, vehicleId);
  const vehicleLabel = vehicleId ? (vehicle.data?.id === vehicleId ? vehicle.data.registration_number : "…") : "All vehicles";

  const doVoid = () =>
    submit.run(async () => {
      if (!voiding) return;
      if (!reason.trim()) throw new Error("Give a reason for voiding this record.");
      await voidMaintenanceEvent(voiding.id, reason.trim());
      toast.success("Record voided.");
      setVoiding(null);
      setOpenEvent(null);
      setReason("");
      invalidate();
    });

  const columns: Column<MaintenanceEvent>[] = [
    { key: "date", header: "Date", render: (e) => formatDay(e.occurred_on) },
    {
      key: "vehicle",
      header: "Vehicle",
      render: (e) => (
        <button type="button" className="ops-link" onClick={(ev) => { ev.stopPropagation(); navigate(`/health/vehicles?vehicle=${e.vehicle_id}`); }}>
          {e.vehicle_registration}
        </button>
      ),
    },
    {
      key: "type",
      header: "Event",
      render: (e) => (
        <span>
          <Pill tone={e.event_type === "fault_report" ? "danger" : e.event_type === "repair" ? "warn" : "neutral"}>
            {EVENT_TYPE_LABEL[e.event_type]}
          </Pill>
          {e.voided_at && <Pill>Voided</Pill>}
        </span>
      ),
    },
    {
      key: "what",
      header: "Details",
      render: (e) => (
        <span>
          {[e.component, e.fault_code].filter(Boolean).join(" · ") || "—"}
          {e.description && <small className="ops-muted" style={{ display: "block" }}>{e.description.slice(0, 80)}</small>}
        </span>
      ),
    },
    { key: "odo", header: "Odometer", className: "ops-num", render: (e) => (e.odometer_km !== null ? formatValue(e.odometer_km, "km", 0) : <span className="ops-muted">—</span>) },
    { key: "cost", header: "Cost", className: "ops-num", render: (e) => (e.cost !== null ? formatMoney(e.cost, e.currency) : <span className="ops-muted">Not recorded</span>) },
    { key: "down", header: "Downtime", className: "ops-num", render: (e) => (e.downtime_hours !== null ? `${e.downtime_hours} h` : <span className="ops-muted">—</span>) },
    { key: "origin", header: "Basis", render: (e) => (e.origin === "measured" ? "Documented" : "Org.-provided") },
  ];

  return (
    <div className="ops-ws">
      <div className="ops-wshead">
        <div>
          <h2 className="ops-wshead__title">Service &amp; Fault Log</h2>
          <p className="ops-wshead__desc">Every recorded service, inspection, repair, replacement and fault report.</p>
        </div>
        <button type="button" className="ops-btn ops-btn--primary" onClick={() => setRecording(true)}>
          <Plus size={16} /> Record event
        </button>
      </div>

      <section className="ops-card" aria-labelledby="log-events">
        <div className="ops-card__head"><h2 id="log-events">Maintenance events</h2></div>
        <FilterBar active={Boolean(vehicleId || type || includeVoided)}
          onClear={() => { setVehicleId(null); setType(""); setIncludeVoided(false); setPage(1); }}>
          <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setPicking(true)}
            aria-label={`Vehicle filter: ${vehicleLabel}. Change`}>
            Vehicle: {vehicleLabel}
          </button>
          <FilterSelect label="Type" value={type} onChange={(v) => { setType(v); setPage(1); }}
            options={[{ value: "", label: "All types" },
              ...(Object.keys(EVENT_TYPE_LABEL) as MaintenanceEventType[]).map((k) => ({ value: k, label: EVENT_TYPE_LABEL[k] }))]} />
          <FilterSelect label="Sort" value={ordering} onChange={(v) => { setOrdering(v); setPage(1); }}
            options={[{ value: "-occurred_on", label: "Newest first" }, { value: "occurred_on", label: "Oldest first" }]} />
          <CheckField label="Include voided" checked={includeVoided}
            onChange={(ev) => { setIncludeVoided(ev.target.checked); setPage(1); }} />
        </FilterBar>
        <DataTable columns={columns} rows={data?.results} rowKey={(e) => e.id} onRowClick={setOpenEvent}
          loading={loading} error={error} onRetry={reload} caption="Maintenance events"
          empty={<EmptyBlock compact title={vehicleId || type ? "No events match these filters" : "No maintenance events recorded"}
            text={vehicleId || type ? undefined : "Record services, repairs and fault reports from job cards or invoices."} />} />
        {data && (
          <Pagination page={data.page} totalPages={data.total_pages} count={data.count} pageSize={data.page_size}
            onPage={setPage} noun="events" />
        )}
        <Definition>
          Records are never edited or deleted. A wrong record is voided with a reason and stays visible with
          "Include voided". Missing costs and downtime are shown as not recorded, never as zero.
        </Definition>
      </section>

      <Drawer open={picking} title="Filter by vehicle" onClose={() => setPicking(false)}
        footer={
          <>
            <button type="button" className="ops-btn ops-btn--ghost" onClick={() => { setVehicleId(null); setPage(1); setPicking(false); }}>
              All vehicles
            </button>
            <button type="button" className="ops-btn ops-btn--secondary" onClick={() => setPicking(false)}>Close</button>
          </>
        }>
        <VehiclePicker selectedId={vehicleId} label="Vehicles"
          onSelect={(v) => { setVehicleId(v.id); setPage(1); setPicking(false); }} />
      </Drawer>
      {recording && (
        <EventDrawer
          presetVehicle={vehicleId && vehicle.data?.id === vehicleId ? { id: vehicleId, label: vehicle.data.registration_number } : undefined}
          onClose={() => { setRecording(false); setRecordParam(null); }} />
      )}
      {openEvent && (
        <EventDetail event={openEvent} onClose={() => setOpenEvent(null)}
          onVoid={() => { submit.reset(); setReason(""); setVoiding(openEvent); }} />
      )}
      <ConfirmDialog open={Boolean(voiding)} title="Void this record?" confirmLabel="Void record" danger busy={submit.busy}
        error={submit.formError} onConfirm={() => void doVoid()} onCancel={() => setVoiding(null)}>
        <p style={{ marginTop: 0 }}>
          The record is kept for history but no longer counts toward schedules, open faults, costs or downtime.
          This cannot be undone.
        </p>
        <TextArea label="Reason" required value={reason} onChange={(ev) => setReason(ev.target.value)} />
      </ConfirmDialog>
    </div>
  );
}

export default EventLogPage;
