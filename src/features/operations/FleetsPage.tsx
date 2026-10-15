import { useMemo, useState } from "react";
import { Pencil, Trash2, UserMinus, UserPlus } from "lucide-react";

import {
  changeFleetVehicles,
  createFleet,
  deleteFleet,
  getFleet,
  listFleetsPage,
  listVehiclesPage,
  updateFleet,
  type Fleet,
} from "../../lib/opsApi";
import { WS } from "./filterDefaults";
import { fuelLabel, humanize, plural } from "./format";
import { useDebounced, useListState, useResource } from "./hooks";
import { useOps } from "./useOps";
import { useDrill, useRecordParams, useSubmit } from "./workspaceHooks";
import WorkspaceHead from "./WorkspaceHead";
import ConfirmDialog from "./ui/ConfirmDialog";
import DataTable, { type Column } from "./ui/DataTable";
import { DetailList, Section } from "./ui/Detail";
import Drawer from "./ui/Drawer";
import { TextArea, TextField } from "./ui/Fields";
import { FilterBar, SearchBox } from "./ui/FilterBar";
import { Pill } from "./ui/Pill";
import Pagination from "./ui/Pagination";
import { EmptyBlock, ErrorBlock, Skeleton } from "./ui/states";
import { vehicleTone } from "./ui/tones";

const PAGE_SIZE = 15;

function FleetForm({
  fleet,
  onClose,
  onSaved,
}: {
  fleet: Fleet | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { toast, invalidate } = useOps();
  const submit = useSubmit();
  const [name, setName] = useState(fleet?.name ?? "");
  const [description, setDescription] = useState(fleet?.description ?? "");
  const [nameError, setNameError] = useState<string>();

  const save = async () => {
    if (!name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError(undefined);
    await submit.run(async () => {
      const input = { name: name.trim(), description: description.trim() };
      const saved = fleet ? await updateFleet(fleet.id, input) : await createFleet(input);
      toast.success(fleet ? "Fleet updated." : "Fleet created.");
      invalidate();
      onSaved(saved.id);
    });
  };

  return (
    <Drawer
      open
      title={fleet ? "Edit fleet" : "Add fleet"}
      subtitle="A fleet groups vehicles, e.g. by region, service or powertrain."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="ops-btn ops-btn--ghost" onClick={onClose} disabled={submit.busy}>Cancel</button>
          <button type="button" className="ops-btn ops-btn--primary" onClick={save} disabled={submit.busy}>
            {submit.busy ? "Saving…" : fleet ? "Save changes" : "Create fleet"}
          </button>
        </>
      }
    >
      <form className="ops-form" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
        {submit.formError && <p className="ops-callout ops-callout--danger" role="alert">{submit.formError}</p>}
        <TextField label="Name" required value={name} error={nameError ?? submit.errors.name}
          onChange={(e) => setName(e.target.value)} />
        <TextArea label="Description" value={description} error={submit.errors.description}
          onChange={(e) => setDescription(e.target.value)} />
      </form>
    </Drawer>
  );
}

function AddVehicles({ fleetId, onChanged }: { fleetId: string; onChanged: () => void }) {
  const { toast, invalidate } = useOps();
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const params = useMemo(() => ({ page_size: 6, search: q, ordering: "registration_number" }), [q]);
  const { data, error, loading, reload } = useResource(listVehiclesPage, params);
  const submit = useSubmit();

  const add = (id: string) =>
    submit.run(async () => {
      await changeFleetVehicles(fleetId, { add: [id] });
      toast.success("Vehicle added to fleet.");
      invalidate();
      onChanged();
    });

  const candidates = (data?.results ?? []).filter((v) => v.fleet_id !== fleetId);

  return (
    <div className="ops-picker">
      <SearchBox label="Find vehicles to add" placeholder="Search registration or model" value={text} onChange={setText} />
      {submit.formError && <p className="ops-callout ops-callout--danger">{submit.formError}</p>}
      {error ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !data ? (
        <Skeleton lines={3} />
      ) : candidates.length === 0 ? (
        <p className="ops-muted">{loading ? "Searching…" : "No other vehicles match."}</p>
      ) : (
        <ul className="ops-list">
          {candidates.map((v) => (
            <li key={v.id}>
              <div className="ops-cell">
                <strong>{v.registration_number}</strong>
                <small>{v.manufacturer} {v.model}{v.fleet_name ? ` · currently in ${v.fleet_name}` : ""}</small>
              </div>
              <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm"
                disabled={submit.busy} onClick={() => add(v.id)}>
                <UserPlus size={15} /> Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FleetDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (f: Fleet) => void }) {
  const { toast, invalidate, version } = useOps();
  const drill = useDrill();
  const { data: fleet, error, loading, reload } = useResource(getFleet, id);
  const memberParams = useMemo(
    () => ({ fleet_id: id, page_size: 8, ordering: "registration_number", v: version }),
    [id, version],
  );
  const members = useResource(listVehiclesPage, memberParams);
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  const del = useSubmit();
  const rm = useSubmit();

  const remove = async () => {
    const ok = await del.run(async () => {
      await deleteFleet(id);
    });
    if (ok) {
      toast.success("Fleet deleted. Its vehicles were kept.");
      invalidate();
      setConfirming(false);
      onClose();
    }
  };

  const removeVehicle = (vehicleId: string) =>
    rm.run(async () => {
      await changeFleetVehicles(id, { remove: [vehicleId] });
      toast.success("Vehicle removed from fleet.");
      invalidate();
    });

  return (
    <Drawer
      open
      wide
      title={fleet?.name ?? "Fleet"}
      subtitle={fleet?.description || undefined}
      onClose={onClose}
      footer={
        fleet && (
          <>
            <button type="button" className="ops-btn ops-btn--ghost ops-btn--danger-text" onClick={() => setConfirming(true)}>
              <Trash2 size={16} /> Delete
            </button>
            <button type="button" className="ops-btn ops-btn--primary" onClick={() => onEdit(fleet)}>
              <Pencil size={16} /> Edit
            </button>
          </>
        )
      }
    >
      {error && !fleet ? (
        <ErrorBlock message={error} onRetry={reload} compact />
      ) : !fleet ? (
        <Skeleton lines={8} />
      ) : (
        <div className={loading ? "ops-busy" : undefined}>
          <Section title="Composition">
            <div className="ops-stats">
              <div className="ops-stat"><strong>{fleet.vehicle_count}</strong><span>Vehicles</span></div>
              <div className="ops-stat"><strong>{fleet.ev_count}</strong><span>Electric</span></div>
              <div className="ops-stat"><strong>{fleet.ice_count}</strong><span>Combustion</span></div>
              <div className="ops-stat"><strong>{fleet.active_count}</strong><span>Active</span></div>
            </div>
          </Section>

          <Section title="Depots">
            {fleet.depots.length === 0 ? (
              <p className="ops-muted">No vehicles in this fleet yet.</p>
            ) : (
              <ul className="ops-list">
                {fleet.depots.map((d) => (
                  <li key={d.depot_id ?? "none"}>
                    <span>{d.depot_name ?? "No depot set"}</span>
                    <span className="ops-muted">{plural(d.vehicle_count, "vehicle")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Vehicles"
            action={
              <button type="button" className="ops-btn ops-btn--secondary ops-btn--sm" onClick={() => setAdding((v) => !v)}>
                <UserPlus size={15} /> {adding ? "Done" : "Add vehicles"}
              </button>
            }
          >
            {adding && <AddVehicles fleetId={id} onChanged={reload} />}
            {rm.formError && <p className="ops-callout ops-callout--danger">{rm.formError}</p>}
            {members.error && !members.data ? (
              <ErrorBlock message={members.error} onRetry={members.reload} compact />
            ) : !members.data ? (
              <Skeleton lines={3} />
            ) : members.data.results.length === 0 ? (
              <p className="ops-muted">No vehicles yet. Add some above.</p>
            ) : (
              <ul className="ops-list">
                {members.data.results.map((v) => (
                  <li key={v.id}>
                    <div className="ops-cell">
                      <strong>{v.registration_number}</strong>
                      <small>
                        {v.manufacturer} {v.model} · {fuelLabel(v.fuel_type)}
                        {v.current_job ? ` · ${humanize(v.current_job.status)}: ${v.current_job.job_template_name}` : ""}
                      </small>
                    </div>
                    <Pill tone={vehicleTone(v.status)}>{humanize(v.status)}</Pill>
                    <button type="button" className="ops-icon-btn" aria-label={`Remove ${v.registration_number} from fleet`}
                      disabled={rm.busy} onClick={() => removeVehicle(v.id)}>
                      <UserMinus size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {members.data && members.data.count > members.data.results.length && (
              <button type="button" className="ops-link"
                onClick={() => drill("vehicles", "/fleets/vehicles", { fleet: id })}>
                View all {members.data.count} vehicles →
              </button>
            )}
          </Section>

          <Section title="Details">
            <DetailList items={[["Created", new Date(fleet.created_at).toLocaleDateString()]]} />
          </Section>
        </div>
      )}

      <ConfirmDialog open={confirming} title="Delete this fleet?" confirmLabel="Delete fleet" danger
        busy={del.busy} error={del.formError} onConfirm={remove} onCancel={() => setConfirming(false)}>
        <p>
          This removes the grouping only. {fleet ? plural(fleet.vehicle_count, "vehicle") : "Its vehicles"} will
          be kept, just no longer part of a fleet.
        </p>
      </ConfirmDialog>
    </Drawer>
  );
}

function FleetsPage() {
  const list = useListState(WS.fleets.key, {} as Record<string, string>, WS.fleets.sort);
  const { state } = list;
  const { openId, creating, open, create, close } = useRecordParams();
  const [editing, setEditing] = useState<Fleet | null>(null);

  const params = useMemo(
    () => ({ page: state.page, page_size: PAGE_SIZE, search: list.query, ordering: state.sort }),
    [state.page, state.sort, list.query],
  );
  const { data, error, loading, reload } = useResource(listFleetsPage, params);

  const columns: Column<Fleet>[] = [
    {
      key: "name",
      header: "Fleet",
      sortKey: "name",
      render: (f) => (
        <div className="ops-cell">
          <strong>{f.name}</strong>
          {f.description && <small>{f.description}</small>}
        </div>
      ),
    },
    { key: "vehicles", header: "Vehicles", className: "ops-num", render: (f) => f.vehicle_count },
    { key: "ev", header: "Electric", className: "ops-num", render: (f) => f.ev_count },
    { key: "ice", header: "Combustion", className: "ops-num", render: (f) => f.ice_count },
    { key: "active", header: "Active", className: "ops-num", render: (f) => f.active_count },
  ];

  const formOpen = creating || editing !== null;

  return (
    <div className="ops-ws">
      <WorkspaceHead
        title="Fleets"
        description="Named groups of vehicles. A fleet’s depots come from where its vehicles are based."
        count={data?.count}
        action={{ label: "Add Fleet", onClick: create }}
      />
      <FilterBar active={list.hasActiveFilters} onClear={list.clear}>
        <SearchBox label="Search fleets" placeholder="Search fleets" value={state.search} onChange={list.setSearch} />
      </FilterBar>
      <DataTable
        caption="Fleets"
        columns={columns}
        rows={data?.results}
        rowKey={(f) => f.id}
        onRowClick={(f) => open(f.id)}
        sort={state.sort}
        onSort={list.setSort}
        loading={loading}
        error={error}
        onRetry={reload}
        empty={
          list.hasActiveFilters ? (
            <EmptyBlock title="No fleets match" text="Try a different search." />
          ) : (
            <EmptyBlock title="No fleets yet" text="Create a fleet, then add vehicles to it."
              action={<button type="button" className="ops-btn ops-btn--primary" onClick={create}>Add Fleet</button>} />
          )
        }
      />
      {data && (
        <Pagination page={data.page} totalPages={data.total_pages} count={data.count}
          pageSize={data.page_size} onPage={list.setPage} noun="fleets" />
      )}

      {openId && !formOpen && <FleetDetail id={openId} onClose={close} onEdit={setEditing} />}
      {formOpen && (
        <FleetForm key={editing?.id ?? "new"} fleet={editing}
          onClose={() => { setEditing(null); close(); }}
          onSaved={(id) => { setEditing(null); open(id); }} />
      )}
    </div>
  );
}

export default FleetsPage;
