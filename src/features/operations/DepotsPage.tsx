import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import {
  createDepotRecord,
  deleteDepot,
  getDepot,
  listDepotsPage,
  updateDepot,
  type DepotInput,
  type OpsDepot,
} from "../../lib/opsApi";
import { conflictDetail, useListState, useResource } from "./hooks";
import { WS } from "./filterDefaults";
import { plural } from "./format";
import { useOps } from "./useOps";
import { useDrill, useRecordParams, useSubmit } from "./workspaceHooks";
import WorkspaceHead from "./WorkspaceHead";
import ConfirmDialog from "./ui/ConfirmDialog";
import DataTable, { type Column } from "./ui/DataTable";
import { DetailList, Section } from "./ui/Detail";
import Drawer from "./ui/Drawer";
import { CheckField, TextField } from "./ui/Fields";
import { FilterBar, FilterSelect, SearchBox } from "./ui/FilterBar";
import { Pill } from "./ui/Pill";
import Pagination from "./ui/Pagination";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";

const PAGE_SIZE = 15;
const YES_NO = [
  { value: "", label: "Any" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

interface FormValues {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  parking_capacity: string;
  charger_count: string;
  maintenance_bays: string;
  workshop_available: boolean;
  fuel_station_available: boolean;
  charging_available: boolean;
  depot_manager_name: string;
  depot_manager_contact: string;
}

const EMPTY: FormValues = {
  name: "",
  address: "",
  latitude: "",
  longitude: "",
  parking_capacity: "0",
  charger_count: "0",
  maintenance_bays: "0",
  workshop_available: false,
  fuel_station_available: false,
  charging_available: false,
  depot_manager_name: "",
  depot_manager_contact: "",
};

function fromDepot(depot: OpsDepot): FormValues {
  const [lng, lat] = depot.location?.coordinates ?? [];
  return {
    name: depot.name,
    address: depot.address,
    latitude: lat === undefined ? "" : String(lat),
    longitude: lng === undefined ? "" : String(lng),
    parking_capacity: String(depot.parking_capacity),
    charger_count: String(depot.charger_count),
    maintenance_bays: String(depot.maintenance_bays),
    workshop_available: depot.workshop_available,
    fuel_station_available: depot.fuel_station_available,
    charging_available: depot.charging_available,
    depot_manager_name: depot.depot_manager_name,
    depot_manager_contact: depot.depot_manager_contact,
  };
}

/** Client-side checks for obvious mistakes; the server remains the authority. */
function validate(v: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!v.name.trim()) errors.name = "Name is required.";
  if (!v.address.trim()) errors.address = "Address is required.";

  const hasLat = v.latitude.trim() !== "";
  const hasLng = v.longitude.trim() !== "";
  if (hasLat !== hasLng) {
    errors[hasLat ? "longitude" : "latitude"] = "Provide both latitude and longitude, or neither.";
  } else if (hasLat) {
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.latitude = "Between -90 and 90.";
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.longitude = "Between -180 and 180.";
  }
  for (const field of ["parking_capacity", "charger_count", "maintenance_bays"] as const) {
    const n = Number(v[field]);
    if (!Number.isInteger(n) || n < 0) errors[field] = "Whole number, 0 or more.";
  }
  return errors;
}

function toInput(v: FormValues): DepotInput {
  const hasLocation = v.latitude.trim() !== "" && v.longitude.trim() !== "";
  return {
    name: v.name.trim(),
    address: v.address.trim(),
    location: hasLocation
      ? { type: "Point", coordinates: [Number(v.longitude), Number(v.latitude)] }
      : null,
    parking_capacity: Number(v.parking_capacity),
    charger_count: Number(v.charger_count),
    maintenance_bays: Number(v.maintenance_bays),
    workshop_available: v.workshop_available,
    fuel_station_available: v.fuel_station_available,
    charging_available: v.charging_available,
    depot_manager_name: v.depot_manager_name.trim(),
    depot_manager_contact: v.depot_manager_contact.trim(),
  };
}

function DepotForm({
  depot,
  onClose,
  onSaved,
}: {
  depot: OpsDepot | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast, invalidate } = useOps();
  const submit = useSubmit();
  const [values, setValues] = useState<FormValues>(() => (depot ? fromDepot(depot) : EMPTY));
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const err = (key: string) => clientErrors[key] ?? submit.errors[key];

  const save = async () => {
    const problems = validate(values);
    setClientErrors(problems);
    if (Object.keys(problems).length) return;

    await submit.run(async () => {
      const saved = depot
        ? await updateDepot(depot.id, toInput(values))
        : await createDepotRecord(toInput(values));
      toast.success(depot ? "Depot updated." : "Depot created.");
      invalidate();
      onSaved(saved.id);
    });
  };

  return (
    <Drawer
      open
      title={depot ? "Edit depot" : "Add depot"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>
            Cancel
          </button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : depot ? "Save changes" : "Create depot"}
          </button>
        </>
      }
    >
      <form
        className="ops-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}

        <TextField label="Name" required value={values.name} error={err("name")}
          onChange={(e) => set("name", e.target.value)} />
        <TextField label="Address" required value={values.address} error={err("address")}
          onChange={(e) => set("address", e.target.value)} />

        <div className="ops-form__row">
          <TextField label="Latitude" inputMode="decimal" value={values.latitude} error={err("latitude")}
            hint="Optional. Needed to show the depot on the map." onChange={(e) => set("latitude", e.target.value)} />
          <TextField label="Longitude" inputMode="decimal" value={values.longitude} error={err("longitude")}
            onChange={(e) => set("longitude", e.target.value)} />
        </div>

        <div className="ops-form__row ops-form__row--3">
          <TextField label="Parking spaces" type="number" min={0} value={values.parking_capacity}
            error={err("parking_capacity")} onChange={(e) => set("parking_capacity", e.target.value)} />
          <TextField label="Chargers" type="number" min={0} value={values.charger_count}
            error={err("charger_count")} onChange={(e) => set("charger_count", e.target.value)} />
          <TextField label="Maintenance bays" type="number" min={0} value={values.maintenance_bays}
            error={err("maintenance_bays")} onChange={(e) => set("maintenance_bays", e.target.value)} />
        </div>

        <fieldset className="ops-checks">
          <legend>Facilities</legend>
          <CheckField label="Charging available" checked={values.charging_available}
            onChange={(e) => set("charging_available", e.target.checked)} />
          <CheckField label="Workshop" checked={values.workshop_available}
            onChange={(e) => set("workshop_available", e.target.checked)} />
          <CheckField label="Fuel station" checked={values.fuel_station_available}
            onChange={(e) => set("fuel_station_available", e.target.checked)} />
        </fieldset>

        <div className="ops-form__row">
          <TextField label="Depot manager" value={values.depot_manager_name}
            error={err("depot_manager_name")} onChange={(e) => set("depot_manager_name", e.target.value)} />
          <TextField label="Manager contact" value={values.depot_manager_contact}
            error={err("depot_manager_contact")} onChange={(e) => set("depot_manager_contact", e.target.value)} />
        </div>
      </form>
    </Drawer>
  );
}

function DepotDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (d: OpsDepot) => void }) {
  const { toast, invalidate } = useOps();
  const drill = useDrill();
  const { data: depot, error, loading, reload } = useResource(getDepot, id);
  const [confirming, setConfirming] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const del = useSubmit();

  const remove = async () => {
    const ok = await del.run(async () => {
      try {
        await deleteDepot(id);
      } catch (e) {
        const reason = conflictDetail(e);
        if (reason) setBlocked(reason);
        throw e;
      }
    });
    if (ok) {
      toast.success("Depot deleted.");
      invalidate();
      setConfirming(false);
      onClose();
    }
  };

  return (
    <Drawer
      open
      title={depot?.name ?? "Depot"}
      subtitle={depot?.address}
      onClose={onClose}
      footer={
        depot && (
          <>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--danger-text"
              onClick={() => { setBlocked(null); setConfirming(true); }}>
              <Trash2 size={16} /> Delete
            </button>
            <button type="button" className="ops-btn ops-btn--primary" onClick={() => onEdit(depot)}>
              <Pencil size={16} /> Edit
            </button>
          </>
        )
      }
    >
      {error && !depot ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !depot ? (
        <Skeleton lines={8} />
      ) : (
        <div className={loading ? "ops-busy" : undefined}>
          <Section title="Resources based here">
            <div className="ops-stats">
              <button type="button" className="ops-stat"
                onClick={() => drill("vehicles", "/fleets/vehicles", { depot: depot.id })}>
                <strong>{depot.vehicle_count}</strong>
                <span>{plural(depot.vehicle_count, "vehicle")}</span>
                <small>{depot.ev_count} electric</small>
              </button>
              <button type="button" className="ops-stat"
                onClick={() => drill("routes", "/fleets/routes", { depot: depot.id })}>
                <strong>{depot.route_count}</strong>
                <span>{plural(depot.route_count, "route")}</span>
                <small>start or end here</small>
              </button>
              <button type="button" className="ops-stat" disabled={depot.fleet_count === 0}
                onClick={() => drill("fleets", "/fleets/fleets", {})}>
                <strong>{depot.fleet_count}</strong>
                <span>{plural(depot.fleet_count, "fleet")}</span>
                <small>with vehicles here</small>
              </button>
            </div>
          </Section>

          <Section title="Details">
            <DetailList items={[
              ["Manager", depot.depot_manager_name || "—"],
              ["Contact", depot.depot_manager_contact || "—"],
              ["Parking spaces", depot.parking_capacity],
              ["Chargers", depot.charging_available ? depot.charger_count : "None"],
              ["Maintenance bays", depot.maintenance_bays],
              ["Facilities", [
                depot.charging_available && "Charging",
                depot.workshop_available && "Workshop",
                depot.fuel_station_available && "Fuel station",
              ].filter(Boolean).join(", ") || "None recorded"],
              ["Location", depot.location
                ? `${depot.location.coordinates[1].toFixed(5)}, ${depot.location.coordinates[0].toFixed(5)}`
                : "Not set"],
            ]} />
          </Section>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this depot?"
        confirmLabel="Delete depot"
        danger
        busy={del.busy}
        blockedReason={blocked}
        error={del.formError}
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      >
        <p>
          <strong>{depot?.name}</strong> will be removed permanently. Depots that still have routes or
          vehicles can’t be deleted — you’ll be told what to move first.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

function DepotsPage() {
  const list = useListState(WS.depots.key, { ...WS.depots.defaults } as Record<string, string>, WS.depots.sort);
  const { state } = list;
  const { openId, creating, open, create, close } = useRecordParams();
  const [editing, setEditing] = useState<OpsDepot | null>(null);

  const params = useMemo(
    () => ({
      page: state.page,
      page_size: PAGE_SIZE,
      search: list.query,
      ordering: state.sort,
      charging: state.filters.charging,
      workshop: state.filters.workshop,
    }),
    [state.page, state.sort, state.filters, list.query],
  );
  const { data, error, loading, reload } = useResource(listDepotsPage, params);

  const columns: Column<OpsDepot>[] = [
    {
      key: "name",
      header: "Depot",
      sortKey: "name",
      render: (d) => (
        <div className="ops-cell">
          <strong>{d.name}</strong>
          <small>{d.address}</small>
        </div>
      ),
    },
    {
      key: "facilities",
      header: "Facilities",
      render: (d) => (
        <div className="ops-pills">
          {d.charging_available && <Pill tone="ok">Charging · {d.charger_count}</Pill>}
          {d.workshop_available && <Pill>Workshop</Pill>}
          {d.fuel_station_available && <Pill>Fuel</Pill>}
          {!d.charging_available && !d.workshop_available && !d.fuel_station_available && "—"}
        </div>
      ),
    },
    { key: "vehicles", header: "Vehicles", className: "ops-num", render: (d) => d.vehicle_count },
    { key: "routes", header: "Routes", className: "ops-num", render: (d) => d.route_count },
    {
      key: "parking",
      header: "Parking",
      sortKey: "parking_capacity",
      className: "ops-num",
      render: (d) => d.parking_capacity,
    },
    { key: "manager", header: "Manager", render: (d) => d.depot_manager_name || "—" },
  ];

  const formOpen = creating || editing !== null;

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Depots"
        description="Where your vehicles are based and your routes start and end."
        count={data?.count}
        action={{ label: "Add Depot", onClick: create }}
      />

      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <SearchBox label="Search depots" placeholder="Search name, address or manager"
          value={state.search} onChange={list.setSearch} />
        <FilterSelect label="Charging" value={state.filters.charging}
          onChange={(v) => list.setFilter("charging", v)} options={YES_NO} />
        <FilterSelect label="Workshop" value={state.filters.workshop}
          onChange={(v) => list.setFilter("workshop", v)} options={YES_NO} />
      </FilterBar>

      <DataTable
        caption="Depots"
        columns={columns}
        rows={data?.results}
        rowKey={(d) => d.id}
        onRowClick={(d) => open(d.id)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          list.hasActiveFilters ? (
            <EmptyBlock title="No depots match" text="Try a different search or clear the filters." />
          ) : (
            <EmptyBlock
              title="No depots yet"
              text="Add the first depot your vehicles operate from."
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Depot</button>}
            />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="depots" />
      )}

      {openId && !formOpen && <DepotDetail id={openId} onClose={close} onEdit={setEditing} />}
      {formOpen && (
        <DepotForm
          key={editing?.id ?? "new"}
          depot={editing}
          onClose={() => {
            setEditing(null);
            close();
          }}
          onSaved={(id) => {
            setEditing(null);
            open(id);
          }}
        />
      )}
    </div>
  );
}

export default DepotsPage;
