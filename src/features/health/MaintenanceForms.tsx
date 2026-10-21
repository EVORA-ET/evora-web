import { useMemo, useState } from "react";

import {
  createMaintenanceEvent,
  createServiceRequirement,
  getMaintenanceStatus,
  listServiceRequirements,
  type MaintenanceEvent,
  type MaintenanceEventType,
  type OpenFault,
} from "../../lib/intelligenceApi";
import { useResource } from "../operations/hooks";
import { useOps } from "../operations/useOps";
import { useSubmit } from "../operations/workspaceHooks";
import Drawer from "../operations/ui/Drawer";
import { SelectField, TextArea, TextField } from "../operations/ui/Fields";
import { formatDay, todayInput } from "../intelligence/format";
import { useCurrency } from "../intelligence/hooks";
import { EVENT_TYPE_LABEL } from "../intelligence/labels";
import { SourceSelect } from "../intelligence/SourceDrawer";
import VehiclePicker from "../intelligence/VehiclePicker";

export interface VehicleRef {
  id: string;
  label: string;
}

function VehicleChoice({
  vehicle,
  setVehicle,
  error,
}: {
  vehicle: VehicleRef | null;
  setVehicle: (v: VehicleRef) => void;
  error?: string;
}) {
  return (
    <div>
      <p className="ops-muted" style={{ margin: "0 0 6px" }}>
        Vehicle: <strong>{vehicle?.label ?? "none selected"}</strong>
      </p>
      <VehiclePicker selectedId={vehicle?.id ?? null} label="Vehicles"
        onSelect={(v) => setVehicle({ id: v.id, label: v.registration_number })} />
      {error && <p className="ops-field__error">{error}</p>}
    </div>
  );
}

/** Record a documented service interval (km and/or days) with its source. */
export function RequirementDrawer({
  presetVehicle,
  onClose,
}: {
  presetVehicle?: VehicleRef;
  onClose: () => void;
}) {
  const { invalidate, toast } = useOps();
  const submit = useSubmit();
  const [vehicle, setVehicle] = useState<VehicleRef | null>(presetVehicle ?? null);
  const [f, setF] = useState({
    name: "",
    component: "",
    interval_km: "",
    interval_days: "",
    warning_km: "",
    warning_days: "",
    source_id: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = () =>
    submit.run(async () => {
      if (!vehicle) throw new Error("Select a vehicle.");
      await createServiceRequirement({
        vehicle_id: vehicle.id,
        name: f.name.trim(),
        component: f.component.trim(),
        interval_km: f.interval_km || null,
        interval_days: f.interval_days ? Number(f.interval_days) : null,
        warning_km: f.warning_km || null,
        warning_days: f.warning_days ? Number(f.warning_days) : null,
        source_id: f.source_id,
      });
      toast.success("Service requirement recorded.");
      invalidate();
      onClose();
    });

  const e = submit.errors;
  return (
    <Drawer open title="Add a service requirement" onClose={onClose} wide={!presetVehicle}
      subtitle="An interval from a cited document — owner's manual, service schedule or statutory rule."
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : "Save requirement"}
          </button>
        </>
      }>
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {presetVehicle ? (
          <p style={{ margin: 0 }}>Vehicle: <strong>{presetVehicle.label}</strong></p>
        ) : (
          <VehicleChoice vehicle={vehicle} setVehicle={setVehicle} error={e.vehicle_id} />
        )}
        <div className="ops-form__row">
          <TextField label="Name" required value={f.name} error={e.name} placeholder="e.g. Engine oil and filter"
            onChange={(ev) => set("name", ev.target.value)} />
          <TextField label="Component" value={f.component} error={e.component} onChange={(ev) => set("component", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Interval (km)" type="number" min={0} step="any" value={f.interval_km} error={e.interval_km}
            onChange={(ev) => set("interval_km", ev.target.value)} />
          <TextField label="Interval (days)" type="number" min={1} step={1} value={f.interval_days} error={e.interval_days}
            onChange={(ev) => set("interval_days", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Warn this many km before" type="number" min={0} step="any" value={f.warning_km}
            error={e.warning_km} hint="Optional. Without it only overdue is reported." onChange={(ev) => set("warning_km", ev.target.value)} />
          <TextField label="Warn this many days before" type="number" min={0} step={1} value={f.warning_days}
            error={e.warning_days} hint="Optional. Without it only overdue is reported." onChange={(ev) => set("warning_days", ev.target.value)} />
        </div>
        <SourceSelect required value={f.source_id} error={e.source_id} onChange={(id) => set("source_id", id)} />
        <p className="ops-muted" style={{ margin: 0 }}>
          Requirements are not edited after recording, so past checks stay explainable. To change one, retire it
          and add a new one.
        </p>
      </form>
    </Drawer>
  );
}

/** An open fault report, as listed by the vehicle's maintenance status. */
export type FaultRef = Pick<OpenFault, "event_id" | "fault_code" | "component" | "reported_on" | "description">;

function faultLabel(f: FaultRef): string {
  return `${formatDay(f.reported_on)} · ${f.fault_code || f.description.slice(0, 40) || f.component || "fault"}`;
}

const loadStatus = (id: string) => getMaintenanceStatus(id);

const SERVICE_TYPES: MaintenanceEventType[] = ["scheduled_service", "inspection", "component_replacement"];

/** Record a maintenance event, fault report or fault resolution. */
export function EventDrawer({
  presetVehicle,
  presetType,
  resolves,
  onClose,
}: {
  presetVehicle?: VehicleRef;
  presetType?: MaintenanceEventType;
  resolves?: FaultRef;
  onClose: () => void;
}) {
  const { invalidate, toast } = useOps();
  const currency = useCurrency();
  const submit = useSubmit();
  const [vehicle, setVehicle] = useState<VehicleRef | null>(presetVehicle ?? null);
  const [f, setF] = useState({
    event_type: presetType ?? ("" as MaintenanceEventType | ""),
    occurred_on: todayInput(),
    completed_on: "",
    odometer_km: "",
    requirement_id: "",
    component: resolves?.component ?? "",
    fault_code: "",
    fault_severity: "",
    resolves_id: resolves?.event_id ?? "",
    description: "",
    provider: "",
    cost: "",
    downtime_hours: "",
    origin: "" as "measured" | "organization_provided" | "",
    source_id: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const vparams = useMemo(() => (vehicle ? { vehicle_id: vehicle.id } : null), [vehicle]);
  const requirements = useResource(listServiceRequirements, vparams);
  const isFault = f.event_type === "fault_report";
  const canResolve = f.event_type === "repair" || f.event_type === "component_replacement";
  const status = useResource(loadStatus, vehicle && canResolve && !resolves ? vehicle.id : null);
  const openFaults = status.data?.vehicle_id === vehicle?.id ? status.data?.result.open_faults ?? [] : [];

  const save = () =>
    submit.run(async () => {
      if (!vehicle) throw new Error("Select a vehicle.");
      if (!f.event_type) throw new Error("Choose the event type.");
      if (!f.origin) throw new Error("Choose the origin of this record.");
      await createMaintenanceEvent({
        vehicle_id: vehicle.id,
        event_type: f.event_type,
        occurred_on: f.occurred_on,
        completed_on: f.completed_on || null,
        odometer_km: f.odometer_km || null,
        requirement_id: SERVICE_TYPES.includes(f.event_type) ? f.requirement_id || null : null,
        component: f.component.trim(),
        fault_code: isFault ? f.fault_code.trim() : "",
        fault_severity: isFault ? (f.fault_severity as MaintenanceEvent["fault_severity"]) : "",
        resolves_id: canResolve ? f.resolves_id || null : null,
        description: f.description.trim(),
        provider: f.provider.trim(),
        cost: f.cost || null,
        currency: f.cost ? (currency ?? "") : "",
        downtime_hours: f.downtime_hours || null,
        origin: f.origin,
        source_id: f.source_id || null,
      });
      toast.success(`${EVENT_TYPE_LABEL[f.event_type]} recorded.`);
      invalidate();
      onClose();
    });

  const e = submit.errors;
  return (
    <Drawer open title={resolves ? "Record the fix for a fault" : "Record a maintenance event"} onClose={onClose}
      wide={!presetVehicle}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : "Save event"}
          </button>
        </>
      }>
      <form className="ops-form" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {presetVehicle ? (
          <p style={{ margin: 0 }}>Vehicle: <strong>{presetVehicle.label}</strong></p>
        ) : (
          <VehicleChoice vehicle={vehicle} setVehicle={setVehicle} error={e.vehicle_id} />
        )}
        {resolves && (
          <p className="ops-callout" style={{ margin: 0 }}>
            Resolves the fault reported {faultLabel(resolves)}
          </p>
        )}
        <div className="ops-form__row">
          <SelectField label="Event type" required value={f.event_type} error={e.event_type}
            options={Object.entries(EVENT_TYPE_LABEL)
              .filter(([k]) => !resolves || k === "repair" || k === "component_replacement")
              .map(([value, label]) => ({ value, label }))}
            placeholder="Select…" onChange={(ev) => set("event_type", ev.target.value)} />
          <TextField label="Date" type="date" required value={f.occurred_on} error={e.occurred_on}
            onChange={(ev) => set("occurred_on", ev.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Odometer (km)" type="number" min={0} step="any" value={f.odometer_km} error={e.odometer_km}
            hint="Needed for distance-based intervals" onChange={(ev) => set("odometer_km", ev.target.value)} />
          <TextField label="Completed on" type="date" value={f.completed_on} error={e.completed_on}
            onChange={(ev) => set("completed_on", ev.target.value)} />
        </div>
        {f.event_type && SERVICE_TYPES.includes(f.event_type) && (
          <SelectField label="Satisfies requirement" value={f.requirement_id} error={e.requirement_id}
            options={(requirements.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
            placeholder={vehicle ? "None" : "Select a vehicle first"}
            hint="Link it so the schedule counts the next interval from this event."
            onChange={(ev) => set("requirement_id", ev.target.value)} />
        )}
        {isFault && (
          <div className="ops-form__row">
            <TextField label="Fault code" value={f.fault_code} error={e.fault_code}
              onChange={(ev) => set("fault_code", ev.target.value)} />
            <SelectField label="Severity (as recorded)" value={f.fault_severity} error={e.fault_severity}
              options={["unknown", "low", "medium", "high", "critical"].map((v) => ({ value: v, label: v }))}
              placeholder="Not recorded" onChange={(ev) => set("fault_severity", ev.target.value)} />
          </div>
        )}
        {canResolve && !resolves && (
          <SelectField label="Resolves fault" value={f.resolves_id} error={e.resolves_id}
            options={openFaults.map((fl) => ({ value: fl.event_id, label: faultLabel(fl) }))}
            placeholder={openFaults.length ? "None" : "No open faults"} hint="Open (unresolved) fault reports for this vehicle"
            onChange={(ev) => set("resolves_id", ev.target.value)} />
        )}
        <TextField label="Component" value={f.component} error={e.component} onChange={(ev) => set("component", ev.target.value)} />
        <TextArea label={isFault ? "What was observed" : "Description"} value={f.description} error={e.description}
          onChange={(ev) => set("description", ev.target.value)} />
        <div className="ops-form__row ops-form__row--3">
          <TextField label={`Cost${currency ? ` (${currency})` : ""}`} type="number" min={0} step="any" value={f.cost}
            error={e.cost ?? e.currency} hint="Leave empty if unknown — never counted as zero"
            onChange={(ev) => set("cost", ev.target.value)} />
          <TextField label="Downtime (hours)" type="number" min={0} step="any" value={f.downtime_hours}
            error={e.downtime_hours} hint="Leave empty if unknown" onChange={(ev) => set("downtime_hours", ev.target.value)} />
          <TextField label="Provider" value={f.provider} error={e.provider} onChange={(ev) => set("provider", ev.target.value)} />
        </div>
        <SelectField label="This record is" required value={f.origin} error={e.origin}
          options={[
            { value: "measured", label: "From a job card, invoice or inspection report (cite it)" },
            { value: "organization_provided", label: "Entered from our own knowledge" },
          ]}
          placeholder="Select…" onChange={(ev) => set("origin", ev.target.value)} />
        <SourceSelect value={f.source_id} error={e.source_id} required={f.origin === "measured"}
          onChange={(id) => set("source_id", id)} />
      </form>
    </Drawer>
  );
}
