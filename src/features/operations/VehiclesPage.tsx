import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  createVehicleRecord,
  deleteVehicle,
  getVehicle,
  listVehiclesPage,
  updateVehicle,
  type OpsVehicle,
  type VehicleInput,
} from "../../lib/opsApi";
import { conflictDetail, useListState, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import { formatWindow, fuelLabel, humanize, JOB_STATUS_LABEL, plural } from "./format";
import { useOps } from "./useOps";
import { useDrill, useLookups, useRecordParams, useSubmit } from "./workspaceHooks";
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
import { jobTone, vehicleTone } from "./ui/tones";

const PAGE_SIZE = 15;

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "under_maintenance", label: "Under maintenance" },
  { value: "retired", label: "Retired" },
  { value: "sold", label: "Sold" },
];
const TYPES = ["bus", "truck", "car", "van", "trailer", "other"].map((v) => ({
  value: v,
  label: humanize(v),
}));
const FUELS = ["diesel", "petrol", "ev", "cng", "lpg", "other"].map((v) => ({
  value: v,
  label: fuelLabel(v),
}));

type FormValues = Record<
  | "registration_number" | "manufacturer" | "model" | "variant" | "manufacture_year"
  | "purchase_date" | "vehicle_type" | "fuel_type" | "status" | "insurance_expiry"
  | "battery_capacity_kwh" | "mileage_kmpl" | "payload_kg" | "seating_capacity" | "gvw_kg"
  | "vin" | "fleet_id" | "depot_id",
  string
>;

const EMPTY: FormValues = {
  registration_number: "",
  manufacturer: "",
  model: "",
  variant: "",
  manufacture_year: String(new Date().getFullYear()),
  purchase_date: "",
  vehicle_type: "truck",
  fuel_type: "diesel",
  status: "active",
  insurance_expiry: "",
  battery_capacity_kwh: "",
  mileage_kmpl: "0",
  payload_kg: "0",
  seating_capacity: "1",
  gvw_kg: "0",
  vin: "",
  fleet_id: "",
  depot_id: "",
};

function fromVehicle(v: OpsVehicle): FormValues {
  return {
    registration_number: v.registration_number,
    manufacturer: v.manufacturer,
    model: v.model,
    variant: v.variant ?? "",
    manufacture_year: String(v.manufacture_year),
    purchase_date: v.purchase_date,
    vehicle_type: v.vehicle_type,
    fuel_type: v.fuel_type,
    status: v.status,
    insurance_expiry: v.insurance_expiry ?? "",
    battery_capacity_kwh: v.battery_capacity_kwh ?? "",
    mileage_kmpl: v.mileage_kmpl,
    payload_kg: v.payload_kg,
    seating_capacity: String(v.seating_capacity),
    gvw_kg: v.gvw_kg,
    vin: v.vin ?? "",
    fleet_id: v.fleet_id ?? "",
    depot_id: v.depot_id ?? "",
  };
}

function validate(v: FormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.registration_number.trim()) e.registration_number = "Registration number is required.";
  if (!v.manufacturer.trim()) e.manufacturer = "Manufacturer is required.";
  if (!v.model.trim()) e.model = "Model is required.";
  if (!v.purchase_date) e.purchase_date = "Purchase date is required.";
  const year = Number(v.manufacture_year);
  if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear() + 1) {
    e.manufacture_year = "Enter a valid year.";
  }
  if (v.fuel_type === "ev" && v.battery_capacity_kwh && !(Number(v.battery_capacity_kwh) > 0)) {
    e.battery_capacity_kwh = "Must be greater than 0.";
  }
  for (const f of ["mileage_kmpl", "payload_kg", "gvw_kg"] as const) {
    if (!(Number(v[f]) >= 0)) e[f] = "Must be 0 or more.";
  }
  if (!Number.isInteger(Number(v.seating_capacity)) || Number(v.seating_capacity) < 0) {
    e.seating_capacity = "Whole number, 0 or more.";
  }
  return e;
}

function toInput(v: FormValues): VehicleInput {
  return {
    registration_number: v.registration_number.trim(),
    manufacturer: v.manufacturer.trim(),
    model: v.model.trim(),
    variant: v.variant.trim() || null,
    manufacture_year: Number(v.manufacture_year),
    purchase_date: v.purchase_date,
    vehicle_type: v.vehicle_type,
    fuel_type: v.fuel_type,
    status: v.status,
    insurance_expiry: v.insurance_expiry || null,
    battery_capacity_kwh: v.fuel_type === "ev" && v.battery_capacity_kwh ? v.battery_capacity_kwh : null,
    mileage_kmpl: v.mileage_kmpl,
    payload_kg: v.payload_kg,
    seating_capacity: Number(v.seating_capacity),
    gvw_kg: v.gvw_kg,
    vin: v.vin.trim() || null,
    fleet_id: v.fleet_id || null,
    depot_id: v.depot_id || null,
  };
}

function VehicleForm({
  vehicle,
  onClose,
  onSaved,
}: {
  vehicle: OpsVehicle | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast, invalidate } = useOps();
  const lookups = useLookups();
  const submit = useSubmit();
  const [values, setValues] = useState<FormValues>(() => (vehicle ? fromVehicle(vehicle) : EMPTY));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const set = (key: keyof FormValues, value: string) => setValues((c) => ({ ...c, [key]: value }));
  const err = (key: string) => clientErrors[key] ?? submit.errors[key];

  const save = async () => {
    const problems = validate(values);
    setClientErrors(problems);
    if (Object.keys(problems).length) return;
    await submit.run(async () => {
      const saved = vehicle
        ? await updateVehicle(vehicle.id, toInput(values))
        : await createVehicleRecord(toInput(values));
      toast.success(vehicle ? "Vehicle updated." : "Vehicle added.");
      invalidate();
      onSaved(saved.id);
    });
  };

  return (
    <Drawer
      open
      wide
      title={vehicle ? "Edit vehicle" : "Add vehicle"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : vehicle ? "Save changes" : "Add vehicle"}
          </button>
        </>
      }
    >
      <form className="ops-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        {lookups.error && <p className="ops-callout ops-callout--warn">Couldn’t load fleets/depots: {lookups.error}</p>}

        <TextField label="Registration number" required value={values.registration_number}
          error={err("registration_number")} onChange={(e) => set("registration_number", e.target.value)} />
        <div className="ops-form__row">
          <TextField label="Manufacturer" required value={values.manufacturer} error={err("manufacturer")}
            onChange={(e) => set("manufacturer", e.target.value)} />
          <TextField label="Model" required value={values.model} error={err("model")}
            onChange={(e) => set("model", e.target.value)} />
        </div>
        <div className="ops-form__row">
          <TextField label="Variant" value={values.variant} error={err("variant")}
            onChange={(e) => set("variant", e.target.value)} />
          <TextField label="VIN" value={values.vin} error={err("vin")}
            onChange={(e) => set("vin", e.target.value)} />
        </div>
        <div className="ops-form__row ops-form__row--3">
          <SelectField label="Type" options={TYPES} value={values.vehicle_type} error={err("vehicle_type")}
            onChange={(e) => set("vehicle_type", e.target.value)} />
          <SelectField label="Fuel" options={FUELS} value={values.fuel_type} error={err("fuel_type")}
            onChange={(e) => set("fuel_type", e.target.value)} />
          <SelectField label="Status" options={STATUSES} value={values.status} error={err("status")}
            onChange={(e) => set("status", e.target.value)} />
        </div>
        {values.fuel_type === "ev" && (
          <TextField label="Battery capacity (kWh)" type="number" min={0} step="0.1"
            value={values.battery_capacity_kwh} error={err("battery_capacity_kwh")}
            onChange={(e) => set("battery_capacity_kwh", e.target.value)} />
        )}
        <div className="ops-form__row ops-form__row--3">
          <TextField label="Year" type="number" required value={values.manufacture_year}
            error={err("manufacture_year")} onChange={(e) => set("manufacture_year", e.target.value)} />
          <TextField label="Purchase date" type="date" required value={values.purchase_date}
            error={err("purchase_date")} onChange={(e) => set("purchase_date", e.target.value)} />
          <TextField label="Insurance expiry" type="date" value={values.insurance_expiry}
            error={err("insurance_expiry")} onChange={(e) => set("insurance_expiry", e.target.value)}
            hint="Expired insurance blocks assignment." />
        </div>
        <div className="ops-form__row ops-form__row--3">
          <TextField label="Payload (kg)" type="number" min={0} value={values.payload_kg}
            error={err("payload_kg")} onChange={(e) => set("payload_kg", e.target.value)} />
          <TextField label="GVW (kg)" type="number" min={0} value={values.gvw_kg}
            error={err("gvw_kg")} onChange={(e) => set("gvw_kg", e.target.value)} />
          <TextField label="Seats" type="number" min={0} value={values.seating_capacity}
            error={err("seating_capacity")} onChange={(e) => set("seating_capacity", e.target.value)} />
        </div>
        <TextField label="Mileage (km/l)" type="number" min={0} step="0.1" value={values.mileage_kmpl}
          error={err("mileage_kmpl")} onChange={(e) => set("mileage_kmpl", e.target.value)} />
        <div className="ops-form__row">
          <SelectField label="Fleet" placeholder="No fleet" options={lookups.fleets} value={values.fleet_id}
            error={err("fleet_id")} onChange={(e) => set("fleet_id", e.target.value)} />
          <SelectField label="Home depot" placeholder="No depot" options={lookups.depots} value={values.depot_id}
            error={err("depot_id")} onChange={(e) => set("depot_id", e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}

const fetchVehicle = ({ id }: { id: string; date: string }) => getVehicle(id);

function VehicleDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (v: OpsVehicle) => void }) {
  const { toast, invalidate, date } = useOps();
  const drill = useDrill();
  const params = useMemo(() => ({ id, date }), [id, date]);
  const { data: vehicle, error, loading, reload } = useResource(fetchVehicle, params);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const del = useSubmit();
  const statusChange = useSubmit();

  const remove = async () => {
    const ok = await del.run(async () => {
      try {
        await deleteVehicle(id);
      } catch (e) {
        const reason = conflictDetail(e);
        if (reason) setBlocked(reason);
        throw e;
      }
    });
    if (ok) {
      toast.success("Vehicle deleted.");
      invalidate();
      setConfirming(false);
      onClose();
    }
  };

  const changeStatus = async (status: string) => {
    const ok = await statusChange.run(async () => {
      await updateVehicle(id, { status });
    });
    if (ok) {
      toast.success(`Status set to ${humanize(status).toLowerCase()}.`);
      invalidate();
    } else {
      toast.error(statusChange.formError ?? "Couldn’t change the status.");
    }
  };

  const job = vehicle?.current_job;

  return (
    <Drawer
      open
      wide
      title={vehicle?.registration_number ?? "Vehicle"}
      subtitle={vehicle && `${vehicle.manufacturer} ${vehicle.model}${vehicle.variant ? ` ${vehicle.variant}` : ""}`}
      onClose={onClose}
      footer={
        vehicle && (
          <>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--danger-text"
              onClick={() => { setBlocked(null); setConfirming(true); }}>
              <Trash2 size={16} /> Delete
            </button>
            <button type="button" className="ops-btn ops-btn--primary" onClick={() => onEdit(vehicle)}>
              <Pencil size={16} /> Edit
            </button>
          </>
        )
      }
    >
      {error && !vehicle ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !vehicle ? (
        <Skeleton lines={8} />
      ) : (
        <div className={loading ? "ops-busy" : undefined}>
          <Section title="Status">
            <div className="ops-form__row">
              <div className="ops-pills">
                <Pill tone={vehicleTone(vehicle.status)}>{humanize(vehicle.status)}</Pill>
                <Pill>{vehicle.fuel_type === "ev" ? "Electric" : "ICE"}</Pill>
              </div>
              <label className="ops-filter">
                <span className="ops-filter__label">Change status</span>
                <select value={vehicle.status} disabled={statusChange.busy}
                  onChange={(e) => void changeStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
            </div>
            {vehicle.status !== "active" && (
              <p className="ops-callout ops-callout--warn">
                Only active vehicles can be assigned to new jobs.
              </p>
            )}
          </Section>

          <Section title={`Assignment on selected day`}>
            {job ? (
              <ul className="ops-list">
                <li>
                  <div className="ops-list__main">
                    <strong>{job.job_template_name}</strong>
                    <small>{formatWindow(job.scheduled_start_at, job.scheduled_end_at)}</small>
                  </div>
                  <Pill tone={jobTone(job.status)}>{JOB_STATUS_LABEL[job.status]}</Pill>
                </li>
              </ul>
            ) : (
              <p className="ops-muted">No open job for this vehicle.</p>
            )}
            <div className="ops-pills">
              <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                onClick={() => drill("jobs", "/fleets/jobs", {
                  range: "all", vehicle: vehicle.id, vehicle_label: vehicle.registration_number })}>
                View jobs{vehicle.open_job_count !== undefined ? ` (${plural(vehicle.open_job_count, "open job")})` : ""}
              </button>
            </div>
          </Section>

          <Section title="Placement">
            <DetailList items={[
              ["Fleet", vehicle.fleet_name ?? "Not in a fleet"],
              ["Depot", vehicle.depot_name ?? "No home depot"],
            ]} />
          </Section>

          <Section title="Specification">
            <DetailList items={[
              ["Type", humanize(vehicle.vehicle_type)],
              ["Fuel", fuelLabel(vehicle.fuel_type)],
              ["Battery", vehicle.battery_capacity_kwh ? `${vehicle.battery_capacity_kwh} kWh` : "—"],
              ["Year", vehicle.manufacture_year],
              ["Payload", `${vehicle.payload_kg} kg`],
              ["GVW", `${vehicle.gvw_kg} kg`],
              ["Seats", vehicle.seating_capacity],
              ["Mileage", `${vehicle.mileage_kmpl} km/l`],
              ["VIN", vehicle.vin ?? "—"],
              ["Purchased", vehicle.purchase_date],
              ["Insurance expiry", vehicle.insurance_expiry ?? "Not recorded"],
            ]} />
          </Section>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this vehicle?"
        confirmLabel="Delete vehicle"
        danger
        busy={del.busy}
        blockedReason={blocked}
        error={del.formError}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong>{vehicle?.registration_number}</strong> will be removed permanently. Vehicles that
          have jobs can’t be deleted — set them to retired instead.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

function VehiclesPage() {
  const list = useListState(WS.vehicles.key, { ...WS.vehicles.defaults } as Record<string, string>, WS.vehicles.sort);
  const { state } = list;
  const { date } = useOps();
  const lookups = useLookups();
  const { openId, creating, open, create, close } = useRecordParams();
  const [editing, setEditing] = useState<OpsVehicle | null>(null);

  const params = useMemo(
    () => ({
      page: state.page,
      page_size: PAGE_SIZE,
      search: list.query,
      ordering: state.sort,
      status: state.filters.status,
      powertrain: state.filters.powertrain,
      fleet_id: state.filters.fleet,
      depot_id: state.filters.depot,
      availability: state.filters.availability,
      date,
    }),
    [state.page, state.sort, state.filters, list.query, date],
  );
  const { data, error, loading, reload } = useResource(listVehiclesPage, params);

  const columns: Column<OpsVehicle>[] = [
    {
      key: "reg",
      header: "Vehicle",
      sortKey: "registration_number",
      render: (v) => (
        <div className="ops-cell">
          <strong>{v.registration_number}</strong>
          <small>{v.manufacturer} {v.model}</small>
        </div>
      ),
    },
    { key: "fuel", header: "Powertrain", sortKey: "fuel_type", render: (v) => fuelLabel(v.fuel_type) },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      render: (v) => <Pill tone={vehicleTone(v.status)}>{humanize(v.status)}</Pill>,
    },
    { key: "fleet", header: "Fleet", sortKey: "fleet", render: (v) => v.fleet_name ?? "—" },
    { key: "depot", header: "Depot", sortKey: "depot", render: (v) => v.depot_name ?? "—" },
    {
      key: "job",
      header: "Today’s job",
      render: (v) =>
        v.current_job ? (
          <div className="ops-cell">
            <strong>{v.current_job.job_template_name}</strong>
            <small>{JOB_STATUS_LABEL[v.current_job.status]}</small>
          </div>
        ) : (
          <span className="ops-muted">—</span>
        ),
    },
    { key: "ins", header: "Insurance", sortKey: "insurance_expiry", render: (v) => v.insurance_expiry ?? "—" },
  ];

  const formOpen = creating || editing !== null;

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Vehicles"
        description="Every vehicle in your fleet, its status, placement and what it is doing."
        count={data?.count}
        action={{ label: "Add Vehicle", onClick: create }}
      />

      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <SearchBox label="Search vehicles" placeholder="Registration, make, model or VIN"
          value={state.search} onChange={list.setSearch} />
        <FilterSelect label="Status" value={state.filters.status} onChange={(v) => list.setFilter("status", v)}
          options={[{ value: "", label: "All" }, ...STATUSES]} />
        <FilterSelect label="Powertrain" value={state.filters.powertrain}
          onChange={(v) => list.setFilter("powertrain", v)}
          options={[{ value: "", label: "All" }, { value: "ev", label: "Electric" }, { value: "ice", label: "ICE" }]} />
        <FilterSelect label="Fleet" value={state.filters.fleet} onChange={(v) => list.setFilter("fleet", v)}
          options={[{ value: "", label: "All" }, { value: "none", label: "No fleet" }, ...lookups.fleets]} />
        <FilterSelect label="Depot" value={state.filters.depot} onChange={(v) => list.setFilter("depot", v)}
          options={[{ value: "", label: "All" }, { value: "none", label: "No depot" }, ...lookups.depots]} />
        <FilterSelect label="Availability" value={state.filters.availability}
          onChange={(v) => list.setFilter("availability", v)}
          options={[
            { value: "", label: "Any" },
            { value: "available", label: "Available" },
            { value: "assigned", label: "Assigned" },
            { value: "unavailable", label: "Unavailable" },
          ]} />
      </FilterBar>

      <DataTable
        caption="Vehicles"
        columns={columns}
        rows={data?.results}
        rowKey={(v) => v.id}
        onRowClick={(v) => open(v.id)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          list.hasActiveFilters ? (
            <EmptyBlock title="No vehicles match" text="Try a different search or clear the filters." />
          ) : (
            <EmptyBlock title="No vehicles yet" text="Add your first vehicle to start planning jobs."
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Vehicle</button>} />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="vehicles" />
      )}

      {openId && !formOpen && <VehicleDetail id={openId} onClose={close} onEdit={setEditing} />}
      {formOpen && (
        <VehicleForm
          key={editing?.id ?? "new"}
          vehicle={editing}
          onClose={() => { setEditing(null); close(); }}
          onSaved={(id) => { setEditing(null); open(id); }}
        />
      )}
    </div>
  );
}

export default VehiclesPage;
